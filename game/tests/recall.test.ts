import { Director } from '../src/engine/director';
import { freshSave, type GameSave, type Memory } from '../src/engine/save';
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
    cast: { yuan: right }
    beats:
      - { yuan: 但我會去接妳。, mem: m_pickup }
      - choice:
          options:
            - text: 「我不知道。」
              then:
                - set: plain
            - recall:
                accept:
                  - mem: m_pickup
                    then:
                      - set: recalled
                      - me: 你說過，你會去接我。
                miss:
                  - set: missed
                  - think: 這句不對。
      - end: reset
`;

function setup(memories: Partial<Memory>[]) {
  const { script, errors } = buildScript([{ name: 'a.yaml', source: SCRIPT }]);
  expect(errors).toEqual([]);
  let save: GameSave = { ...freshSave(), started: true, scene: 's1' };
  save.memories = memories.map((memory, index) => ({ key: `k${index}`, text: `記憶${index}`, kind: 'char', loop: 1, chapter: '1', ...memory }) as Memory);
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 });
  director.start();
  const run = (ms: number) => { for (let t = 0; t < ms; t += 50) director.tick(50); };
  const untilChoice = () => { for (let i = 0; i < 600 && !(director.view.choice && director.view.focus === 'main'); i++) { director.hurry(); run(50); } };
  return { director, run, untilChoice };
}

describe('memory input (recall)', () => {
  it('is hidden when she carries no memories', () => {
    const { director, untilChoice } = setup([]);
    untilChoice();
    expect(director.view.choice?.options.some((option) => option.recall)).toBe(false);
  });

  it('accepts the right memory and takes its branch', () => {
    const { director, run, untilChoice } = setup([{ id: 'm_other' }, { id: 'm_pickup', text: '但我會去接妳。' }]);
    untilChoice();
    const option = director.view.choice!.options.find((candidate) => candidate.recall)!;
    director.choose(option.index);
    expect(director.view.recall?.memories).toHaveLength(2);
    director.recallPick('k1');
    run(200);
    expect(director.loopFlags.has('recalled')).toBe(true);
  });

  it('a wrong memory plays the miss beats and asks the same question again without that memory', () => {
    const { director, run, untilChoice } = setup([{ id: 'm_other' }, { id: 'm_pickup' }]);
    untilChoice();
    director.choose(director.view.choice!.options.find((candidate) => candidate.recall)!.index);
    director.recallPick('k0');
    run(200);
    expect(director.loopFlags.has('missed')).toBe(true);
    untilChoice();
    const again = director.view.choice!.options.find((candidate) => candidate.recall)!;
    director.choose(again.index);
    expect(director.view.recall?.memories.map((memory) => memory.key)).toEqual(['k1']);
  });

  it('putting it back returns to the normal options', () => {
    const { director, untilChoice } = setup([{ id: 'm_pickup' }]);
    untilChoice();
    director.choose(director.view.choice!.options.find((candidate) => candidate.recall)!.index);
    director.recallPick(null);
    expect(director.view.recall).toBeNull();
    expect(director.view.choice).not.toBeNull();
  });

  it('running out of time never picks the recall option', () => {
    const timed = SCRIPT
      .replace('      - choice:\n          options:', '      - choice:\n          timeout: 4\n          options:')
      .replace('                - set: plain', '                - set: plain\n                - pause: 30');
    const { script, errors } = buildScript([{ name: 'a.yaml', source: timed }]);
    expect(errors).toEqual([]);
    let save: GameSave = { ...freshSave(), started: true, scene: 's1' };
    save.memories = [{ key: 'k0', id: 'm_pickup', text: 'x', kind: 'char', loop: 1, chapter: '1' }];
    const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 });
    director.start();
    for (let i = 0; i < 600 && !director.loopFlags.has('plain'); i++) director.tick(100);
    expect(director.loopFlags.has('plain')).toBe(true);
  });

  it('validator rejects a recall that accepts an unknown memory', () => {
    const { errors } = buildScript([{ name: 'a.yaml', source: SCRIPT.replace('mem: m_pickup\n                    then', 'mem: m_nowhere\n                    then') }]);
    expect(errors.join('\n')).toMatch(/m_nowhere/);
  });
});
