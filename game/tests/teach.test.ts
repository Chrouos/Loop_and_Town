import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

const SCRIPT = `
chapter: 1
title: 教學
start: s1
scenes:
  - id: s1
    cast: { yuan: right }
    beats:
      - narr: 第一句，先講完。
      - { think: 不、要、回、來。, mem: m_letter, teach: keep }
      - { yuan: 這是一句很長很長很長很長很長很長很長的話。, mem: m_long }
      - yuan: 寫什麼？
      - choice:
          options:
            - text: （伸手去摸）
              then:
                - set: touched
            - recall:
                accept:
                  - mem: m_letter
                    then:
                      - set: recalled
      - choice:
          options:
            - text: 「好。」
            - recall:
                accept:
                  - mem: m_letter
      - pause: 30
      - end: reset
`;

function setup(taught: string[] = []) {
  const { script, errors } = buildScript([{ name: 'a.yaml', source: SCRIPT }]);
  expect(errors).toEqual([]);
  let save: GameSave = { ...freshSave(), started: true, scene: 's1', taught };
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 });
  director.start();
  const run = (ms: number) => { for (let t = 0; t < ms; t += 50) director.tick(50); };
  const until = (done: () => boolean) => { for (let i = 0; i < 2000 && !done(); i++) run(50); };
  return { director, run, until, save: () => save };
}

describe('keeping a line', () => {
  it('a long-press on a line still appearing keeps that line, not the one before it', () => {
    const { director, run, until } = setup(['keep']);
    until(() => director.view.center?.text === '這是一句很長很長很長很長很長很長很長的話。');
    run(300);
    expect(director.view.center?.perceived).toBe(false);
    expect(director.capture(director.view.center!.key)).toBe(true);
    expect(director.save.memories.map((memory) => memory.text)).toEqual(['這是一句很長很長很長很長很長很長很長的話。']);
  });

  it('the first time ever, the lesson line waits for the long-press; a tap does not skip it', () => {
    const { director, run, until, save } = setup();
    until(() => director.view.teach === 'keep');
    expect(director.view.center?.text).toBe('不、要、回、來。');
    for (let i = 0; i < 20; i++) { director.hurry(); run(500); }
    expect(director.view.center?.text).toBe('不、要、回、來。');
    expect(director.capture()).toBe(true);
    expect(director.view.teach).toBeNull();
    expect(save().taught).toContain('keep');
    run(3000);
    expect(director.view.center?.text).not.toBe('不、要、回、來。');
  });

  it('once taught, the same line goes on by itself', () => {
    const { director, run } = setup(['keep']);
    run(15000);
    expect(director.view.teach).toBeNull();
    expect(director.save.memories).toEqual([]);
  });
});

describe('the memory door lesson', () => {
  it('lights up at the first question that takes a memory, and only that once', () => {
    const { director, until, run } = setup(['keep']);
    until(() => director.view.choice !== null);
    expect(director.view.choice?.teach).toBe(true);
    director.choose(director.view.choice!.options[0].index);
    run(500);
    until(() => director.view.choice !== null);
    expect(director.view.choice?.teach).toBeUndefined();
  });
});
