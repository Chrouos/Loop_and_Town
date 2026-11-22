import type { Pos } from '../src/script/types';
import { Director, SHIFT_MS, SNEAK_GRACE_MS, SNEAK_LISTEN_MS } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

// 偷偷做: held, her hands work; whoever she hides from walks a loop of legs. Close or gone quiet, they see her.
const chapter = (sneak: string) => `
chapter: 1
title: 測試
start: s1
advance:
  - if: "true"
    to: 1
scenes:
  - id: s1
    beats:
      - sneak:
${sneak.trim().split('\n').map((line) => `          ${line}`).join('\n')}
          success:
            - set: done
          caught:
            - set: caught
          fail:
            - set: late
      - pause: 30
      - end: reset
`;

// 4 s far off (safe), then 2 s right behind her (sees her), round and round.
const WALK = `
work: 3
timeout: 30
sfx: cloth_rustle
watch:
  - { sfx: step, at: back, dist: far, for: 4 }
  - { sfx: step, at: back, dist: near, for: 2 }`;

type Played = { id: string; pos?: Pos; t: number };

function rig(source: string, tension = 0) {
  const { script, errors } = buildScript([{ name: 'a.yaml', source }]);
  expect(errors).toEqual([]);
  const played: Played[] = [];
  let save: GameSave = { ...freshSave(), started: true, scene: 's1', taught: ['locate', 'approach', 'hold', 'sneak'], tension };
  let director!: Director;
  const audio = { ...silentAudio(), play: (id: string, pos?: Pos) => { played.push({ id, pos, t: director.view.t }); } };
  director = new Director(script, save, { audio: audio as never, vibrate: () => {}, persist: (next) => { save = next; }, wallNow: () => 0 });
  director.start();
  const run = (ms: number) => { for (let t = 0; t < ms; t += 50) director.tick(50); };
  for (let i = 0; i < 600 && director.view.interact?.type !== 'sneak'; i++) run(50);
  expect(director.view.interact?.type).toBe('sneak');
  // The legs start once her attention has come round to it.
  run(SHIFT_MS);
  return { director, played, run };
}

const outcome = (director: Director) => ['done', 'caught', 'late'].filter((name) => director.loopFlags.has(name));

describe('sneak', () => {
  it('working while they are far off gets it done', () => {
    const { director, run } = rig(chapter(WALK));
    director.sneakStart();
    run(3200);
    expect(outcome(director)).toEqual(['done']);
  });

  it('still working once they are right there gets her caught', () => {
    const { director, run } = rig(chapter(WALK.replace('work: 3', 'work: 8')));
    director.sneakStart();
    run(4000 + SNEAK_GRACE_MS[0] + 200);
    expect(outcome(director)).toEqual(['caught']);
  });

  it('stopping when the steps come close, and going on once they are gone, gets it done', () => {
    const { director, run } = rig(chapter(WALK.replace('work: 3', 'work: 5')));
    director.sneakStart();
    run(4100);
    director.sneakEnd();
    expect(director.view.interact?.type === 'sneak' && director.view.interact.done).toBeGreaterThan(3.5);
    run(2000);
    director.sneakStart();
    run(1500);
    expect(outcome(director)).toEqual(['done']);
  });

  it('starting while they are close is caught as well, after the same moment', () => {
    const { director, run } = rig(chapter(WALK));
    run(4100);
    director.sneakStart();
    run(SNEAK_GRACE_MS[0] - 200);
    expect(outcome(director)).toEqual([]);
    run(400);
    expect(outcome(director)).toEqual(['caught']);
  });

  it('gone quiet counts as looking', () => {
    const { director, run } = rig(chapter(`
work: 6
timeout: 30
watch:
  - { sfx: step, at: back-right, dist: far, for: 2 }
  - { at: back-right, dist: far, for: 2, still: true }`));
    director.sneakStart();
    run(2000 + SNEAK_GRACE_MS[0] + 200);
    expect(outcome(director)).toEqual(['caught']);
  });

  it('a slip makes them stop and listen: keep going and she is caught, freeze and she is not', () => {
    const slip = `
work: 3
timeout: 30
slips: [{ at: 1, sfx: drawer_catch, text: 喀 }]
watch:
  - { sfx: step, at: back, dist: far, for: 10 }`;
    const kept = rig(chapter(slip));
    kept.director.sneakStart();
    kept.run(1000 + SNEAK_GRACE_MS[0] + 200);
    expect(kept.played.some((entry) => entry.id === 'drawer_catch')).toBe(true);
    expect(outcome(kept.director)).toEqual(['caught']);

    const froze = rig(chapter(slip));
    froze.director.sneakStart();
    froze.run(1100);
    froze.director.sneakEnd();
    froze.run(SNEAK_LISTEN_MS + 200);
    expect(outcome(froze.director)).toEqual([]);
    froze.director.sneakStart();
    froze.run(2200);
    expect(outcome(froze.director)).toEqual(['done']);
  });

  it('their steps come from where the leg says, and stop while they stand still', () => {
    const { played, run } = rig(chapter(`
work: 6
timeout: 30
watch:
  - { sfx: step, at: back-right, dist: far, for: 2, every: 0.5 }
  - { at: back-right, dist: far, for: 2, still: true, looks: false }`));
    run(1900);
    const steps = played.filter((entry) => entry.id === 'step');
    expect(steps.length).toBe(4);
    expect(steps.every((entry) => entry.pos?.dir === 'back-right' && entry.pos.dist === 'far')).toBe(true);
    const quiet = played.length;
    run(1900);
    expect(played.slice(quiet).filter((entry) => entry.id === 'step')).toEqual([]);
  });

  it('never starting, time runs out and it goes to fail', () => {
    const { director, run } = rig(chapter(WALK));
    run(31_000);
    expect(outcome(director)).toEqual(['late']);
  });

  it('wound up, she has less time to stop', () => {
    const { director, run } = rig(chapter(WALK.replace('work: 3', 'work: 8')), 80);
    expect(director.view.tension).toBe(3);
    run(4000);
    director.sneakStart();
    run(SNEAK_GRACE_MS[3] + 150);
    expect(outcome(director)).toEqual(['caught']);
  });
});

describe('sneak script checks', () => {
  const errorsOf = (sneak: string) => buildScript([{ name: 'a.yaml', source: chapter(sneak) }]).errors;

  it('needs at least one leg where they are not looking', () => {
    expect(errorsOf(`
work: 3
watch:
  - { sfx: step, at: back, dist: near, for: 2 }`).join()).toContain('沒在看');
  });

  it('a leg makes a sound unless it is still, and a slip lands inside the work', () => {
    const errors = errorsOf(`
work: 3
slips: [{ at: 5, sfx: drawer_catch }]
watch:
  - { at: back, dist: far, for: 2 }
  - { sfx: step, at: back, dist: far, for: 2, still: true }`).join('\n');
    expect(errors).toContain('要有 sfx');
    expect(errors).toContain('still 是沒有聲音');
    expect(errors).toContain('slips[0]');
  });
});
