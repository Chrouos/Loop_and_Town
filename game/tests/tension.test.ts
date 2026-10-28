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

  it('tense, a racing heart races harder; an uneasy one stays slow', () => {
    const calm = setup('- heart: fast\n- pause: 30');
    calm.run(500);
    expect(calm.director.view.heart?.level).toBe('fast');
    const tense = setup('- heart: fast\n- pause: 30', { tension: 60 });
    tense.run(500);
    expect(tense.director.view.heart?.level).toBe('pound');
    const slow = setup('- heart: slow\n- pause: 30', { tension: 60 });
    slow.run(500);
    expect(slow.director.view.heart?.level).toBe('slow');
  });

  it('a heart already racing catches up when she crosses into tense', () => {
    const { director, run } = setup(`
- heart: fast
- pause: 1
- tension: 30
- pause: 30`, { tension: 30 });
    run(500);
    expect(director.view.heart?.level).toBe('fast');
    run(1500);
    expect(director.view.tension).toBe(2);
    expect(director.view.heart?.level).toBe('pound');
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

describe('scene jumps and continuous scenes', () => {
  const SRC = `
chapter: 1
title: 測試
start: s1
advance:
  - if: "true"
    to: 1
scenes:
  - id: s1
    time: "08:00"
    place: 家
    life: "off"
    beats:
      - heart: fast
      - pause: 1
      - if: "false"
        then: [{ set: yuan_with_me }]
      - goto: s2
  - id: s2
    life: "off"
    beats:
      - pause: 2
      - goto: s3
  - id: s3
    time: "09:00"
    place: 街上
    life: "off"
    beats:
      - if: flag.yuan_with_me
        then: [{ set: saw_yuan }]
      - pause: 30
      - end: reset
`;
  function make() {
    const { script, errors } = buildScript([{ name: 'a.yaml', source: SRC }]);
    expect(errors).toEqual([]);
    let save: GameSave = freshSave();
    const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 });
    const run = (ms: number) => { for (let t = 0; t < ms; t += 50) director.tick(50); };
    return { director, run };
  }

  it('her heart keeps beating into a scene that continues the same moment, and stops at a new time and place', () => {
    const { director, run } = make();
    director.jumpToScene('s1', false);
    for (let i = 0; i < 400 && director.view.sceneId !== 's2'; i++) run(50);
    expect(director.view.sceneId).toBe('s2');
    expect(director.view.heart?.level).toBe('fast');
    for (let i = 0; i < 400 && director.view.sceneId !== 's3'; i++) run(50);
    expect(director.view.sceneId).toBe('s3');
    run(5000);
    expect(director.view.heart).toBeNull();
  });

  it('?scene jumps straight to a scene, with the loop flags it is given', () => {
    const { director, run } = make();
    expect(director.jumpToScene('nope', true)).toBe(false);
    expect(director.jumpToScene('s3', true, ['yuan_with_me'])).toBe(true);
    for (let i = 0; i < 400 && director.view.sceneId !== 's3'; i++) run(50);
    run(500);
    expect(director.view.sceneId).toBe('s3');
    expect(director.loopFlags.has('saw_yuan')).toBe(true);
  });
});

describe('the heart glides between levels', () => {
  const SRC = (beats: string) => `
chapter: 1
title: 測試
start: s1
advance:
  - if: "true"
    to: 1
scenes:
  - id: s1
    life: "off"
    beats:
${beats.trim().split('\n').map((line) => `      ${line}`).join('\n')}
      - pause: 30
      - end: reset
`;
  function play(beats: string) {
    const { script, errors } = buildScript([{ name: 'a.yaml', source: SRC(beats) }]);
    expect(errors).toEqual([]);
    const heard: { t: number; gain: number }[] = [];
    const audio = { ...silentAudio(), play: (id: string, _pos: unknown, options?: { gain?: number }) => { if (id === 'heartbeat') heard.push({ t: director.view.t, gain: options?.gain ?? 1 }); } } as never;
    let save: GameSave = { ...freshSave(), started: true, scene: 's1' };
    const director: Director = new Director(script, save, { audio, vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 });
    director.start();
    const run = (ms: number) => { for (let t = 0; t < ms; t += 50) director.tick(50); };
    for (let i = 0; i < 600 && director.view.sceneId !== 's1'; i++) run(50);
    return { director, heard, run };
  }

  it('starting, it comes up from soft to full over a couple of seconds', () => {
    const { heard, run } = play('- heart: pound');
    run(4000);
    expect(heard[0].gain).toBeLessThan(0.3);
    for (let i = 1; i < heard.length; i++) expect(heard[i].gain).toBeGreaterThanOrEqual(heard[i - 1].gain - 1e-9);
    expect(heard[heard.length - 1].gain).toBeCloseTo(0.72, 2);
  });

  it('stopping, each beat is softer and further apart until it is gone', () => {
    const { director, heard, run } = play('- heart: pound\n- pause: 4\n- heart: "off"');
    run(4500);
    const at = heard.length;
    expect(director.view.heart?.shown).toBe('slow');
    run(6000);
    const fading = heard.slice(at);
    expect(fading.length).toBeGreaterThan(2);
    for (let i = 1; i < fading.length; i++) {
      expect(fading[i].gain).toBeLessThan(fading[i - 1].gain);
      if (i > 1) expect(fading[i].t - fading[i - 1].t).toBeGreaterThanOrEqual(fading[i - 1].t - fading[i - 2].t - 1);
    }
    expect(director.view.heart).toBeNull();
    const done = heard.length;
    run(3000);
    expect(heard.length).toBe(done);
  });
});
