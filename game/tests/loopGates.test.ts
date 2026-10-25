import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { loadScriptFromDisk, silentAudio } from './harness';

// Chapters 4, 5 and 7 gate on what she says: a wrong answer closes a door for this loop,
// leaves a lead behind, and the next loop opens a new option instead of replaying everything.
type Policy = (options: string[], sceneId: string, chLoop: number) => number;

function play(chapter: string, policy: Policy, maxLoops: number) {
  const { script, errors } = loadScriptFromDisk();
  if (errors.length) throw new Error(errors.join('\n'));
  let wall = 0;
  let save: GameSave = freshSave();
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => wall }, { speed: 1 });
  director.jumpToChapter(chapter, true);
  const startLoop = director.save.loop;
  const scenesByLoop: string[][] = [[]];
  const optionsSeen: string[][] = [];
  for (let steps = 0; steps < 400_000; steps++) {
    const view = director.view;
    if (director.save.chapter !== chapter || director.save.loop - startLoop >= maxLoops) break;
    const loopIndex = director.save.loop - startLoop;
    scenesByLoop[loopIndex] ??= [];
    const scenes = scenesByLoop[loopIndex];
    if (view.sceneId && scenes[scenes.length - 1] !== view.sceneId) scenes.push(view.sceneId);
    if (view.choice && view.focus === 'main') {
      const texts = view.choice.options.map((option) => option.text);
      optionsSeen.push(texts);
      director.choose(policy(texts, view.sceneId ?? '', director.save.chLoop));
    } else if (view.recall) {
      director.recallPick(null);
    } else if (view.interact?.type === 'touch') {
      director.touchDone();
    } else if (view.interact?.type === 'punch') {
      director.punchDone();
    } else {
      director.hurry();
    }
    if (view.keep) director.skipKeep();
    wall += 200;
    director.tick(200);
  }
  return { chapter: director.save.chapter, knowledge: new Set(director.save.knowledge), scenesByLoop, optionsSeen };
}

/** Picks the first option matching one of the patterns, in order; otherwise the first non-recall option. */
const prefer = (...patterns: RegExp[]) => (options: string[]) => {
  for (const pattern of patterns) {
    const index = options.findIndex((text) => pattern.test(text));
    if (index >= 0) return index;
  }
  const plain = options.findIndex((text) => !text.includes('想起一句話'));
  return plain >= 0 ? plain : 0;
};

describe('chapter 4 gates', () => {
  it('saying nothing to 周警官 keeps the recorder shut, and the drawer lead opens it next loop', () => {
    const result = play('4', (options, sceneId, chLoop) => {
      if (sceneId === 'c4_police' && chLoop === 1) return prefer(/什麼都不說/)(options);
      return prefer(/卡兩次/, /我已經聽過好幾次/, /她跟你說過/, /妳恨她嗎/, /妳答應過她什麼/)(options);
    }, 2);
    expect(result.knowledge.has('c4_lead_drawer')).toBe(true);
    expect(result.knowledge.has('k_recorder_voice')).toBe(true);
    expect(result.optionsSeen.some((texts) => texts.some((text) => text.includes('卡兩次')))).toBe(true);
    // Everything after the police station was heard in loop 1: straight from the police to 17:40 at the institute.
    expect(result.scenesByLoop[1]).toEqual(expect.arrayContaining(['c4_police', 'c4_call_tingan', 'c4_saw']));
    expect(result.scenesByLoop[1]).not.toContain('c4_hospital');
    expect(result.scenesByLoop[1]).not.toContain('c4_library');
    expect(result.chapter).toBe('5');
  });

  it('a loop that already has a piece skips the place that gave it', () => {
    const result = play('4', (options, sceneId, chLoop) => {
      if (sceneId === 'c4_institute' && chLoop === 1) return prefer(/她是想救人/)(options);
      return prefer(/我已經聽過好幾次/, /她跟你說過/, /颱風封路/, /妳恨她嗎/, /妳答應過她什麼/)(options);
    }, 2);
    expect(result.knowledge.has('c4_lead_promise')).toBe(true);
    expect(result.scenesByLoop[0]).not.toContain('c4_memory');
    expect(result.scenesByLoop[1]).not.toContain('c4_police');
    expect(result.scenesByLoop[1]).not.toContain('c4_hospital');
    expect(result.scenesByLoop[1]).toEqual(expect.arrayContaining(['c4_call_tingan', 'c4_library', 'c4_saw', 'c4_memory']));
    expect(result.chapter).toBe('5');
  });
});

describe('chapter 5 gates', () => {
  it('telling him the truth and then arranging his evening keeps 17:58 from him', () => {
    const result = play('5', prefer(/今天我已經過了很多次呢/, /斷掉的錶帶/, /像上次那樣/), 1);
    expect(result.knowledge.has('c5_lead_arranged')).toBe(true);
    expect(result.knowledge.has('k_yuan_1758')).toBe(false);
    expect(result.chapter).toBe('5');
  });

  it('asking straight about the toolbox closes it; the truth without arranging advances', () => {
    const first = play('5', prefer(/什麼樣的工具箱/, /今天我已經過了很多次呢/, /我把我知道的告訴你/), 1);
    expect(first.knowledge.has('k_tower_kit')).toBe(false);
    expect(first.knowledge.has('c5_lead_kit')).toBe(true);
    const good = play('5', prefer(/斷掉的錶帶/, /今天我已經過了很多次呢/, /我把我知道的告訴你/), 1);
    expect(good.chapter).toBe('6');
  });
});

describe('chapter 7 gates', () => {
  it('ordering 周警官 to go hurts him, the day repeats, and the next morning goes straight to the evening', () => {
    const result = play('7', (options, _sceneId, chLoop) => {
      if (chLoop === 1) return prefer(/對。你去/)(options);
      return prefer(/是妳的事/, /妳先聽我說完/, /當成推測/, /去不去，是你的事/)(options);
    }, 2);
    expect(result.knowledge.has('c7_lead_zhiyuan')).toBe(true);
    expect(result.scenesByLoop[1]).not.toContain('c7_notes');
    expect(result.scenesByLoop[1]).toContain('c7_letter');
    expect(result.chapter).toBe('final');
  });

  it('leaving the page folded means she never learns what it says', () => {
    const result = play('7', prefer(/摺回去/, /是妳的事/, /妳先聽我說完/, /當成推測/, /去不去，是你的事/), 1);
    expect(result.knowledge.has('k_my_death_page')).toBe(false);
    expect(result.chapter).toBe('final');
  });

  it('telling everyone without deciding for them reaches the final chapter in one loop', () => {
    const result = play('7', prefer(/是妳的事/, /妳先聽我說完/, /當成推測/, /去不去，是你的事/), 1);
    expect(result.chapter).toBe('final');
  });
});
