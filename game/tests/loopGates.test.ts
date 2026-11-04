import { Director } from '../src/engine/director';
import { DIRECTIONS, type Direction } from '../src/audio/catalog';
import { freshSave, type GameSave } from '../src/engine/save';
import { loadScriptFromDisk, silentAudio } from './harness';

// Chapters 4, 5 and 7 gate on what she says: a wrong answer closes a door for this loop,
// leaves a lead behind, and the next loop opens a new option instead of replaying everything.
type Policy = (options: string[], sceneId: string, chLoop: number) => number;

/** Where the sound she is asked about really was; `ears: 'wrong'` points at the opposite side instead. */
function locateAnswer(director: Director, ears: 'right' | 'wrong'): Direction {
  const beat = (director as unknown as { runs: Map<string, { pendingInteract?: { beat: { at: Direction } } }> }).runs.get('main')!.pendingInteract!.beat;
  return ears === 'right' ? beat.at : DIRECTIONS[(DIRECTIONS.indexOf(beat.at) + 4) % 8];
}

function play(chapter: string, policy: Policy, maxLoops: number, ears: 'right' | 'wrong' | ((chLoop: number) => 'right' | 'wrong') = 'right') {
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
      director.choose(view.choice.options[policy(texts, view.sceneId ?? '', director.save.chLoop)]?.index ?? -1);
    } else if (view.recall) {
      director.recallPick(null);
    } else if (view.interact?.type === 'locate') {
      director.locatePick(locateAnswer(director, typeof ears === 'function' ? ears(director.save.chLoop) : ears));
    } else if (view.interact?.type === 'touch') {
      director.touchDone();
    } else if (view.interact?.type === 'punch') {
      director.punchDone();
    } else if (view.interact?.type === 'hold') {
      director.holdStart();
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
      // Saying nothing is not an option on screen: pick nothing and let the time run out.
      if (sceneId === 'c4_police' && chLoop === 1) return -1;
      return prefer(/卡兩次/, /沙沙響/, /我已經聽過好幾次/, /她跟你說過/, /妳恨她嗎/, /妳答應過她什麼/)(options);
    }, 2);
    expect(result.knowledge.has('lead_c4_drawer')).toBe(true);
    expect(result.knowledge.has('k_recorder_voice')).toBe(true);
    expect(result.optionsSeen.some((texts) => texts.some((text) => text.includes('卡兩次')))).toBe(true);
    // Everything after the police station was heard in loop 1: straight from the police to 17:40 at the institute.
    expect(result.scenesByLoop[1]).toEqual(expect.arrayContaining(['c4_police', 'c4_call_tingan', 'c4_saw']));
    expect(result.scenesByLoop[1]).not.toContain('c4_hospital');
    expect(result.scenesByLoop[1]).not.toContain('c4_library');
    expect(result.chapter).toBe('5');
  });

  it('missing where the drawer was leaves a vague lead; the two catches she did hear still open it next loop', () => {
    const result = play('4', (options, sceneId, chLoop) => {
      if (sceneId === 'c4_police' && chLoop === 1) return -1;
      return prefer(/卡兩次/, /沙沙響/, /我已經聽過好幾次/, /她跟你說過/, /妳恨她嗎/, /妳答應過她什麼/)(options);
    }, 2, 'wrong');
    expect(result.knowledge.has('lead_c4_drawer_lost')).toBe(true);
    expect(result.knowledge.has('lead_c4_drawer')).toBe(false);
    // No side to name, so not the precise line; the vaguer one about the drawer that sticks twice.
    expect(result.optionsSeen.some((texts) => texts.some((text) => text.includes('往右走到最裡面')))).toBe(false);
    expect(result.optionsSeen.some((texts) => texts.some((text) => text.includes('很少開的那種')))).toBe(true);
    expect(result.knowledge.has('k_recorder_voice')).toBe(true);
  });

  it('listening at the door a second time, the catches repeat until she can place them', () => {
    const result = play('4', (options, sceneId) => {
      if (sceneId === 'c4_police') return -1;
      return prefer(/我已經聽過好幾次/, /她跟你說過/, /妳恨她嗎/, /妳答應過她什麼/)(options);
    }, 2, (chLoop) => (chLoop === 1 ? 'wrong' : 'right'));
    expect(result.knowledge.has('lead_c4_drawer_lost')).toBe(true);
    expect(result.knowledge.has('lead_c4_drawer')).toBe(true);
  });

  it('a loop that already has a piece skips the place that gave it', () => {
    const result = play('4', (options, sceneId, chLoop) => {
      if (sceneId === 'c4_police' && chLoop === 1) return -1;
      if (sceneId === 'c4_institute' && chLoop === 1) return prefer(/她是想救人/)(options);
      return prefer(/卡兩次/, /沙沙響/, /她跟你說過/, /這是第幾次/, /短頭髮/, /颱風封路/, /妳恨她嗎/, /妳答應過她什麼/)(options);
    }, 2);
    expect(result.knowledge.has('lead_c4_promise')).toBe(true);
    expect(result.scenesByLoop[0]).not.toContain('c4_memory');
    expect(result.scenesByLoop[1]).toContain('c4_police');
    expect(result.scenesByLoop[1]).not.toContain('c4_hospital');
    expect(result.scenesByLoop[1]).toEqual(expect.arrayContaining(['c4_call_tingan', 'c4_library', 'c4_saw', 'c4_memory']));
    expect(result.chapter).toBe('5');
  });

  it('one line without evidence gets only part of it, and leaves what to bring next time', () => {
    const result = play('4', (options, sceneId, chLoop) => {
      if (chLoop === 1) return prefer(/我已經聽過好幾次/, /她跟你說過/, /我沒有別的/, /妳不只是記者/, /妳恨她嗎/)(options);
      return prefer(/卡兩次/, /沙沙響/, /這是第幾次/, /借書卡/, /妳恨她嗎/, /妳答應過她什麼/)(options);
    }, 2);
    // Loop 1: the blackout story, her chief complaint and the public version of the story are all he and she will give.
    expect(result.scenesByLoop[0]).toEqual(expect.arrayContaining(['c4_police', 'c4_hospital', 'c4_library', 'c4_alone']));
    expect(result.scenesByLoop[0]).not.toContain('c4_slope');
    expect(result.knowledge.has('lead_c4_drawer')).toBe(true);
    expect(result.knowledge.has('lead_c4_count')).toBe(true);
    expect(result.knowledge.has('lead_c4_public')).toBe(true);
    expect(result.knowledge.has('k_c4_loan_card')).toBe(true);
    expect(result.knowledge.has('k_boxun_invitation')).toBe(true);
    // Loop 2: what she heard and what she was told opens all three.
    expect(result.scenesByLoop[1]).toEqual(expect.arrayContaining(['c4_police', 'c4_hospital', 'c4_library', 'c4_slope', 'c4_saw']));
    expect(result.chapter).toBe('5');
  });

  it('threatening 周警官 with a complaint gets procedure, not the drawer', () => {
    const result = play('4', (options, sceneId, chLoop) => {
      if (sceneId === 'c4_police' && chLoop === 1) return -1;
      return prefer(/卡兩次/, /檢舉/, /她跟你說過/, /妳恨她嗎/)(options);
    }, 2);
    expect(result.knowledge.has('lead_c4_procedure')).toBe(true);
    expect(result.knowledge.has('k_recorder_voice')).toBe(false);
    expect(result.chapter).toBe('4');
  });
});

describe('chapter 5 gates', () => {
  it('telling him the truth and then arranging his evening keeps 17:58 from him', () => {
    const result = play('5', prefer(/今天我已經過了很多次呢/, /斷掉的錶帶/, /像上次那樣/), 1);
    expect(result.knowledge.has('lead_c5_arranged')).toBe(true);
    expect(result.knowledge.has('k_yuan_1758')).toBe(false);
    expect(result.chapter).toBe('5');
  });

  it('asking straight about the toolbox closes it; the truth without arranging advances', () => {
    const first = play('5', prefer(/什麼樣的工具箱/, /今天我已經過了很多次呢/, /我把我知道的告訴你/), 1);
    expect(first.knowledge.has('k_tower_kit')).toBe(false);
    expect(first.knowledge.has('lead_c5_kit')).toBe(true);
    const good = play('5', prefer(/斷掉的錶帶/, /今天我已經過了很多次呢/, /我把我知道的告訴你/), 1);
    expect(good.chapter).toBe('6');
  });
});

describe('chapter 6 gates', () => {
  it('arranging his evening without evidence: he stays put, keeps it to himself, and leaves a lead', () => {
    const result = play('6', (options, _sceneId, chLoop) => {
      if (chLoop === 1) return prefer(/待在店裡/, /結束調查/)(options);
      // The hospital gives no letter evidence, but it is asking around town: word reaches him.
      return prefer(/本來要做什麼/, /去醫院/, /結束調查/)(options);
    }, 2);
    expect(result.knowledge.has('lead_c6_he_waited')).toBe(true);
    expect(result.scenesByLoop[0]).toContain('c6_alone');
    expect(result.scenesByLoop[0]).not.toContain('c6_visit');
    // Not arranging him, and saying what she is looking for: he comes to her himself.
    expect(result.scenesByLoop[1]).toContain('c6_visit');
    expect(result.chapter).toBe('7');
  });

  it('not arranging him but asking nobody all day: he only texts, and leaves a different lead', () => {
    const result = play('6', prefer(/本來要做什麼/, /結束調查/), 1);
    expect(result.knowledge.has('lead_c6_not_asked')).toBe(true);
    expect(result.knowledge.has('lead_c6_he_waited')).toBe(false);
    expect(result.scenesByLoop[0]).toContain('c6_alone');
    expect(result.scenesByLoop[0]).not.toContain('c6_visit');
    expect(result.chapter).toBe('6');
  });

  it('the honest call before dialing: nobody catches her out', () => {
    const honest = play('6', prefer(/直接說/, /本來要做什麼/, /去醫院/, /結束調查/), 1);
    expect(honest.knowledge.has('k_c6_they_check')).toBe(false);
    expect(honest.scenesByLoop[0]).toContain('c6_visit');
    const lie = play('6', prefer(/照排好的說法/, /本來要做什麼/, /去醫院/, /結束調查/), 1);
    expect(lie.knowledge.has('k_c6_they_check')).toBe(true);
  });

  it('evidence sends her to the shop, arranged or not', () => {
    const result = play('6', prefer(/待在店裡/, /去圖書館/), 1);
    expect(result.knowledge.has('k_library_return')).toBe(true);
    expect(result.scenesByLoop[0]).toContain('c6_shop');
    expect(result.scenesByLoop[0]).not.toContain('c6_alone');
    expect(result.chapter).toBe('7');
  });
});

describe('chapter 7 gates', () => {
  it('ordering 周警官 to go hurts him, the day repeats, and the next morning goes straight to the evening', () => {
    const result = play('7', (options, _sceneId, chLoop) => {
      if (chLoop === 1) return prefer(/對。你去/)(options);
      return prefer(/是妳的事/, /妳先聽我說完/, /當成推測/, /去不去，是你的事/)(options);
    }, 2);
    expect(result.knowledge.has('lead_c7_zhiyuan')).toBe(true);
    expect(result.scenesByLoop[1]).not.toContain('c7_notes');
    expect(result.scenesByLoop[1]).toContain('c7_letter');
    expect(result.chapter).toBe('final');
  });

  it('ordering 庭安 to stay costs only the relationship: nobody is hurt, and the chapter still ends', () => {
    const result = play('7', prefer(/留下來，幫我看著它/, /妳先聽我說完/, /當成推測/, /去不去，是你的事/), 1);
    expect(result.knowledge.has('lead_c7_tingan')).toBe(true);
    expect(result.chapter).toBe('final');
  });

  it('stopping the letters at the fourth leaves two unheard, and the day repeats', () => {
    const result = play('7', prefer(/今天先聽到這裡/, /是妳的事/, /妳先聽我說完/, /當成推測/, /去不去，是你的事/), 1);
    expect(result.knowledge.has('lead_c7_four')).toBe(true);
    expect(result.knowledge.has('k_six_letters')).toBe(false);
    expect(result.chapter).toBe('7');
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
