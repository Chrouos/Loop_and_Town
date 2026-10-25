import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

const SCRIPT = `
chapter: 1
title: 測試
start: s1
advance:
  - if: "true"
    to: 1
scenes:
  - id: s1
    beats:
      - touch:
          cells: [不, 要, 回, 來]
          timeout: 20
      - set: read
      - locate:
          sfx: hum_rise
          at: right
          decoys: [{ sfx: light_buzz, at: left }]
          tries: 2
          success:
            - set: found
          fail:
            - set: lost
      - punch:
          cells: [[3, 4, 5, 6], [1, 4, 5]]
          label: 4
      - set: punched
      - pause: 30
      - end: reset
`;

function setup(source = SCRIPT) {
  const { script, errors } = buildScript([{ name: 'a.yaml', source }]);
  expect(errors).toEqual([]);
  let save: GameSave = { ...freshSave(), started: true, scene: 's1' };
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 });
  director.start();
  const run = (ms: number) => { for (let t = 0; t < ms; t += 50) director.tick(50); };
  const until = (type: string) => { for (let i = 0; i < 600 && director.view.interact?.type !== type; i++) run(50); };
  return { director, run, until };
}

describe('hands and ears interactions', () => {
  it('touch blocks the scene until she has read every cell', () => {
    const { director, run, until } = setup();
    until('touch');
    expect(director.view.interact?.type).toBe('touch');
    run(5000);
    expect(director.loopFlags.has('read')).toBe(false);
    director.touchDone();
    run(200);
    expect(director.loopFlags.has('read')).toBe(true);
  });

  it('touch finishes on its own when time runs out (the day does not wait)', () => {
    const { director, run, until } = setup();
    until('touch');
    run(22000);
    expect(director.loopFlags.has('read')).toBe(true);
  });

  it('locate accepts the right direction, its neighbour, or the front/back mirror', () => {
    for (const pick of ['right', 'front-right', 'back-right'] as const) {
      const { director, run, until } = setup();
      until('touch'); director.touchDone(); until('locate');
      director.locatePick(pick);
      run(100);
      expect(director.loopFlags.has('found')).toBe(true);
    }
  });

  it('locate with exact: only the one direction counts, a neighbour is a miss', () => {
    const exact = SCRIPT.replace('          tries: 2\n', '          tries: 1\n          exact: true\n');
    for (const [pick, flag] of [['right', 'found'], ['front-right', 'lost'], ['back-right', 'lost']] as const) {
      const { director, run, until } = setup(exact);
      until('touch'); director.touchDone(); until('locate');
      director.locatePick(pick);
      run(100);
      expect(director.loopFlags.has(flag)).toBe(true);
    }
  });

  it('locate: a wrong turn leaves a hint, a second wrong turn takes the fail branch', () => {
    const { director, run, until } = setup();
    until('touch'); director.touchDone(); until('locate');
    director.locatePick('left');
    expect(director.view.interact?.type === 'locate' && director.view.interact.hint).toBe('right');
    director.locatePick('back-left');
    run(100);
    expect(director.loopFlags.has('lost')).toBe(true);
  });

  it('punch waits for the slate, then moves on', () => {
    const { director, run, until } = setup();
    until('touch'); director.touchDone(); until('locate'); director.locatePick('right'); until('punch');
    expect(director.view.interact?.type).toBe('punch');
    director.punchDone();
    run(100);
    expect(director.loopFlags.has('punched')).toBe(true);
  });

  it('validator keeps interactions out of side threads and checks their sounds', () => {
    const bad = SCRIPT.replace('sfx: hum_rise', 'sfx: no_such_sound');
    expect(buildScript([{ name: 'a.yaml', source: bad }]).errors.join('\n')).toMatch(/no_such_sound/);
  });
});
