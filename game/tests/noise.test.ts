import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

const SCRIPT = (noise: string) => `
chapter: 1
title: 測試
start: s1
advance:
  - if: "true"
    to: 1
scenes:
  - id: s1
    ambience: [room_tone]
    life:
      - { text: 喀, sfx: house_tick, at: [left, right], dist: mid }
      - { text: 沙, sfx: paper_rustle, at: [back], dist: mid }
    beats:
      - ${noise}
      - pause: 10
      - noise: "off"
      - pause: 10
      - goto: s2
  - id: s2
    ambience: [room_tone]
    beats:
      - pause: 30
      - end: reset
`;

function play(noise: string) {
  const { script, errors } = buildScript([{ name: 'a.yaml', source: SCRIPT(noise) }]);
  expect(errors).toEqual([]);
  const log: string[] = [];
  let save: GameSave = { ...freshSave(), started: true, scene: 's1' };
  const director = new Director(script, save, { audio: silentAudio(log), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 });
  director.start();
  const run = (ms: number) => { for (let t = 0; t < ms; t += 50) director.tick(50); };
  for (let i = 0; i < 600 && director.view.sceneId !== 's1'; i++) run(50);
  return { director, log, run };
}

const background = (log: string[]) => log.filter((entry) => entry === 'sfx:house_tick' || entry === 'sfx:paper_rustle').length;

describe('panic noise', () => {
  it('heavy noise floods the background and turns the ambience up, off brings it back', () => {
    const calm = play('pause: 0');
    calm.run(8000);
    const quiet = background(calm.log);

    const { director, log, run } = play('noise: heavy');
    run(8000);
    expect(director.view.noise).toEqual({ level: 'heavy', speed: 5, loud: 2.2 });
    expect(log).toContain('noise:2.2');
    expect(background(log)).toBeGreaterThan(quiet + 10);
    run(4000);
    expect(director.view.noise).toBeNull();
    expect(log[log.length - 1 - [...log].reverse().findIndex((entry) => entry.startsWith('noise:'))]).toBe('noise:1');
  });

  it('speed and loud can be set by the script', () => {
    const { director, log, run } = play('{ noise: light, speed: 8, loud: 1.2 }');
    run(500);
    expect(director.view.noise).toEqual({ level: 'light', speed: 8, loud: 1.2 });
    expect(log).toContain('noise:1.2');
  });

  it('a new scene clears it', () => {
    const { director, run } = play('noise: heavy');
    run(25000);
    expect(director.view.sceneId).toBe('s2');
    expect(director.view.noise).toBeNull();
  });

  it('with: the crowd only shows up while she panics', () => {
    const noise = `noise: heavy
        with:
          - { say: 裡面有人嗎？, voice: man, at: [back], dist: far }
          - { text: 啊——, sfx: gasp_crowd, at: [back-left], dist: far }`;
    const { director, log, run } = play(noise);
    const crowd: string[] = [];
    director.subscribe(() => director.view.periph.forEach((item) => { if (item.text === '裡面有人嗎？') crowd.push(item.text); }));
    run(8000);
    expect(log).toContain('sfx:gasp_crowd');
    expect(crowd.length).toBeGreaterThan(0);
    run(4000);
    expect(director.view.noise).toBeNull();
    const before = log.filter((entry) => entry === 'sfx:gasp_crowd').length;
    run(6000);
    expect(log.filter((entry) => entry === 'sfx:gasp_crowd').length).toBe(before);
  });

  it('the validator keeps speed and loud in range', () => {
    const errors = buildScript([{ name: 'a.yaml', source: SCRIPT('{ noise: heavy, speed: 20, loud: 5 }') }]).errors.join('\n');
    expect(errors).toMatch(/speed/);
    expect(errors).toMatch(/loud/);
    expect(buildScript([{ name: 'a.yaml', source: SCRIPT('noise: loud') }]).errors.join('\n')).toMatch(/未知雜音/);
  });
});
