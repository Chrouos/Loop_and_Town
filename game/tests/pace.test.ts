import { describe, expect, it } from 'vitest';
import { Director } from '../src/engine/director';
import { DEFAULT_SETTINGS, freshSave, type GameSave } from '../src/engine/save';
import { lineTiming, paceBreath, pacedSpeed } from '../src/engine/text';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

const SCRIPT = `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    time: "06:12"
    place: 房間
    beats:
      - narr: 一開始照她自己的速度。
      - pace: -3
      - narr: 這裡慢下來，一個字一個字。
      - pace: 2
      - narr: 這裡快一點。
      - pace: 0
      - narr: 回到她自己的速度。
      - pace: -2
      - goto: s2
  - id: s2
    time: "06:30"
    place: 街上
    beats:
      - narr: 換了地方，又是她自己的速度。
      - end: reset
`;

describe('a scene sets its own pace (pace:)', () => {
  it('adds characters per second to the player\'s speed; instant stays instant', () => {
    expect(pacedSpeed(7, -3)).toBe(4);
    expect(pacedSpeed(7, 2)).toBe(9);
    expect(pacedSpeed(7, 0)).toBe(7);
    expect(pacedSpeed(2, -5)).toBe(1);
    expect(pacedSpeed('instant', -3)).toBe('instant');
  });

  it('stretches the pauses between phrases with it, so a comma or a new row is felt too', () => {
    expect(paceBreath(11, 0)).toBe(1);
    expect(paceBreath('instant', 5)).toBe(1);
    expect(paceBreath(11, 5)).toBeCloseTo(11 / 16);
    expect(paceBreath(11, -2)).toBeCloseTo(11 / 9);
    expect(paceBreath(4, -3)).toBe(2.5);
    const line = '妳剛剛不是叫我先出去嗎……妳起來，帶我出去啊。';
    const own = lineTiming(line, 'me', 11);
    const fast = lineTiming(line, 'me', 16, paceBreath(11, 5));
    expect(fast.holdMs).toBeLessThan(own.holdMs);
    expect(fast.revealMs / own.revealMs).toBeLessThan(0.72);
  });

  it('only takes a whole number from -10 to 10', () => {
    const errorsOf = (pace: string) => buildScript([{ name: 'a.yaml', source: `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    beats:
      - pace: ${pace}
      - end: reset
` }]).errors;
    expect(errorsOf('-2')).toEqual([]);
    expect(errorsOf('+1')).toEqual([]);
    expect(errorsOf('1.5').join()).toContain('pace');
    expect(errorsOf('20').join()).toContain('pace');
    expect(errorsOf('slow').join()).toContain('pace');
  });

  it('holds until changed, 0 goes back, and a new scene starts at her own speed', () => {
    const { script, errors } = buildScript([{ name: 'a.yaml', source: SCRIPT }]);
    expect(errors).toEqual([]);
    let save: GameSave = freshSave();
    let wall = 0;
    const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => wall });
    director.start();
    const reveal = new Map<string, number>();
    for (let i = 0; i < 4000 && reveal.size < 5; i++) {
      wall += 50;
      director.tick(50);
      const line = director.view.center;
      if (line && !reveal.has(line.text)) reveal.set(line.text, line.revealMs);
      if (director.view.center && director.view.teach) director.hurry();
    }
    const own = DEFAULT_SETTINGS.textSpeed as number;
    const expected = (text: string, cps: number) => lineTiming(text, 'narr', cps, paceBreath(own, cps - own)).revealMs;
    expect(reveal.get('一開始照她自己的速度。')).toBe(expected('一開始照她自己的速度。', own));
    expect(reveal.get('這裡慢下來，一個字一個字。')).toBe(expected('這裡慢下來，一個字一個字。', own - 3));
    expect(reveal.get('這裡快一點。')).toBe(expected('這裡快一點。', own + 2));
    expect(reveal.get('回到她自己的速度。')).toBe(expected('回到她自己的速度。', own));
    expect(reveal.get('換了地方，又是她自己的速度。')).toBe(expected('換了地方，又是她自己的速度。', own));
  });
});
