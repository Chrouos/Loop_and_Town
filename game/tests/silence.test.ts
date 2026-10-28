import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

const chapter = (choice: string) => `
chapter: 1
title: 沉默
start: s1
scenes:
  - id: s1
    time: "06:12"
    place: 測試
    cast: { yuan: right }
    beats:
      - choice:
${choice}
      - end: reset
`;

const SILENCE = `          timeout: 3
          options:
            - text: 「好。」
              then:
                - learn: k_said_yes
          silence:
            - learn: k_kept_quiet`;

function make(source: string) {
  const { script, errors } = buildScript([{ name: 'a.yaml', source }]);
  let save: GameSave = freshSave();
  let wall = 0;
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => wall }, { speed: 1 });
  const run = (ms: number) => { for (let t = 0; t < ms; t += 50) { wall += 50; director.tick(50); } };
  return { errors, director, run };
}

function untilChoice(director: Director, run: (ms: number) => void) {
  director.start();
  for (let i = 0; i < 800 && !director.view.choice; i++) run(50);
  expect(director.view.choice).not.toBeNull();
}

describe('silence', () => {
  it('is never shown, cannot be picked, and is what happens when the time runs out', () => {
    const { errors, director, run } = make(chapter(SILENCE));
    expect(errors).toEqual([]);
    untilChoice(director, run);
    expect(director.view.choice!.options.map((option) => option.text)).toEqual(['「好。」']);
    director.choose(1);
    expect(director.view.choice).not.toBeNull();
    run(4500);
    expect(director.view.choice).toBeNull();
    expect(director.knows.has('k_kept_quiet')).toBe(true);
    expect(director.knows.has('k_said_yes')).toBe(false);
  });

  it('is skipped when she answers in time', () => {
    const { director, run } = make(chapter(SILENCE));
    untilChoice(director, run);
    director.choose(director.view.choice!.options[0].index);
    run(4500);
    expect(director.knows.has('k_said_yes')).toBe(true);
    expect(director.knows.has('k_kept_quiet')).toBe(false);
  });

  it('needs a timeout and replaces default', () => {
    const untimed = make(chapter(SILENCE.replace('          timeout: 3\n', ''))).errors;
    expect(untimed.some((error) => error.includes('silence 需要 timeout'))).toBe(true);
    const both = make(chapter(SILENCE.replace('          timeout: 3\n', '          timeout: 3\n          default: 0\n'))).errors;
    expect(both.some((error) => error.includes('有 silence 就不用 default'))).toBe(true);
  });
});
