import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

const chapter = (beats: string, next = '1') => `
chapter: 1
title: 測試
start: s1
advance:
  - if: "true"
    to: ${next}
scenes:
  - id: s1
    ambience: [room_tone]
    life: "off"
    beats:
${[...beats.trim().split('\n'), ...(beats.includes('end:') ? [] : ['- end: reset'])].map((line) => `      ${line}`).join('\n')}
`;

const CH2 = `
chapter: 2
title: 第二
start: t1
advance: []
scenes:
  - id: t1
    time: "08:00"
    place: 火車上
    beats:
      - pause: 60
      - end: reset
`;

function setup(beats: string, options: { tension?: number; extra?: string[]; next?: string } = {}) {
  const files = [{ name: 'a.yaml', source: chapter(beats, options.next) }, ...(options.extra ?? []).map((source, i) => ({ name: `x${i}.yaml`, source }))];
  const { script, errors } = buildScript(files);
  expect(errors).toEqual([]);
  const log: string[] = [];
  let save: GameSave = { ...freshSave(), started: true, scene: 's1', tension: options.tension ?? 0 };
  const director = new Director(script, save, { audio: silentAudio(log), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 });
  director.start();
  const run = (ms: number) => { for (let t = 0; t < ms; t += 50) director.tick(50); };
  for (let i = 0; i < 600 && director.view.sceneId !== 's1'; i++) run(50);
  return { director, log, run, save: () => save };
}

const heartbeats = (log: string[]) => log.filter((entry) => entry === 'sfx:heartbeat').length;

describe('hidden tension', () => {
  it('a tension beat winds her up, and crossing into a new band is felt as one beat', () => {
    const { director, log, run } = setup(`
- pause: 1
- tension: 35
- pause: 30`);
    run(500);
    expect(director.view.tension).toBe(0);
    expect(heartbeats(log)).toBe(0);
    run(1500);
    expect(director.tension).toBe(35);
    expect(director.view.tension).toBe(1);
    expect(heartbeats(log)).toBe(1);
  });

  it('coming down needs a little give, so the band does not flicker at the line', () => {
    const { director, run } = setup(`
- tension: -3
- pause: 1
- tension: -6
- pause: 30`, { tension: 57 });
    expect(director.view.tension).toBe(2);
    run(500);
    expect(director.tension).toBe(54);
    expect(director.view.tension).toBe(2);
    run(1500);
    expect(director.tension).toBe(48);
    expect(director.view.tension).toBe(1);
  });

  it('tense, the heart the script asks for beats one step faster', () => {
    const calm = setup('- heart: fast\n- pause: 30');
    calm.run(500);
    expect(calm.director.view.heart?.level).toBe('fast');
    const tense = setup('- heart: fast\n- pause: 30', { tension: 60 });
    tense.run(500);
    expect(tense.director.view.heart?.level).toBe('pound');
    const slow = setup('- heart: slow\n- pause: 30', { tension: 60 });
    slow.run(500);
    expect(slow.director.view.heart?.level).toBe('fast');
  });

  it('a heart already beating catches up when she crosses into tense', () => {
    const { director, run } = setup(`
- heart: slow
- pause: 1
- tension: 30
- pause: 30`, { tension: 30 });
    run(500);
    expect(director.view.heart?.level).toBe('slow');
    run(1500);
    expect(director.view.tension).toBe(2);
    expect(director.view.heart?.level).toBe('fast');
  });

  it('in a panic with no heart scripted, it still beats faintly underneath', () => {
    const calm = setup('- pause: 30', { tension: 20 });
    calm.run(5000);
    expect(heartbeats(calm.log)).toBe(0);
    const panic = setup('- pause: 30', { tension: 90 });
    panic.run(5000);
    expect(heartbeats(panic.log)).toBeGreaterThan(4);
    expect(panic.director.view.heart).toBeNull();
  });

  it('<心率> on her phone reads her heart: the same line shows a higher number when she is wound up', () => {
    const line = '- heart: pound\n- { phone: 心率 <心率>，過高，已記錄。十八點三十一分。, mem: m_1831 }\n- pause: 30';
    const calm = setup(line, { tension: 0 });
    calm.run(300);
    const panic = setup(line, { tension: 90 });
    panic.run(300);
    const bpm = (d: Director) => Number(/心率 (\d+)/.exec(d.view.center?.text ?? '')?.[1]);
    expect(bpm(calm.director)).toBe(142);
    expect(bpm(panic.director)).toBe(169);
    expect(panic.director.view.center?.text).not.toContain('<');
  });

  const LOCATE = `
- locate:
    sfx: hum_rise
    at: right
    decoys: [{ sfx: light_buzz, at: left }]
    tries: 2
    success:
      - set: found
    fail:
      - set: lost
- pause: 30`;

  it('missing a sound winds her up; finding it lets her breathe a little', () => {
    const miss = setup(LOCATE, { tension: 10 });
    miss.run(1000);
    miss.director.locatePick('left');
    expect(miss.director.tension).toBe(14);
    miss.director.locatePick('back-left');
    expect(miss.director.loopFlags.has('lost')).toBe(true);
    expect(miss.director.tension).toBe(26);

    const hit = setup(LOCATE, { tension: 10 });
    hit.run(1000);
    hit.director.locatePick('right');
    expect(hit.director.loopFlags.has('found')).toBe(true);
    expect(hit.director.tension).toBe(6);
  });

  it('wound up, her own heart gets in the way of the sound; in a panic a wrong turn shows no ripple', () => {
    const calm = setup(LOCATE, { tension: 0 });
    calm.run(6000);
    expect(heartbeats(calm.log)).toBe(0);
    const tense = setup(LOCATE, { tension: 60 });
    tense.run(6000);
    expect(heartbeats(tense.log)).toBeGreaterThan(1);

    const panic = setup(LOCATE, { tension: 90 });
    panic.run(1000);
    panic.director.locatePick('left');
    expect(panic.director.view.interact).toMatchObject({ type: 'locate', hint: null });
    const uneasy = setup(LOCATE, { tension: 40 });
    uneasy.run(1000);
    uneasy.director.locatePick('left');
    expect(uneasy.director.view.interact).toMatchObject({ type: 'locate', hint: 'right' });
  });

  it('freezing on a timed choice is its own fright', () => {
    const { director, run } = setup(`
- choice:
    timeout: 2
    options:
      - text: 走
        then: [{ set: went }]
      - text: 留
        then: [{ set: stayed }]
- pause: 30`, { tension: 10 });
    run(4000);
    expect(director.loopFlags.has('stayed')).toBe(true);
    expect(director.tension).toBe(15);
  });

  it('carries into the next chapter, eased by the night', () => {
    const { director, run, save } = setup('- tension: 30\n- end: reset', { tension: 40, extra: [CH2], next: '2' });
    run(20000);
    expect(director.view.chapterKey).toBe('2');
    // 70 × 0.6 = 42 at midnight, then 2 less for waking somewhere new.
    expect(save().tension).toBe(40);
    expect(director.view.tension).toBe(1);
  });

  it('a new game starts calm', () => {
    const { director } = setup('- pause: 30', { tension: 90 });
    director.newGame();
    expect(director.tension).toBe(0);
  });

  it('the script checks the size of each step', () => {
    for (const bad of ['tension: 0', 'tension: 50', 'tension: 1.5', 'tension: lots']) {
      const { errors } = buildScript([{ name: 'a.yaml', source: chapter(`- ${bad}`) }]);
      expect(errors.join('\n')).toContain('tension');
    }
  });
});
