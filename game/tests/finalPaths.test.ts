import type { Direction } from '../src/audio/catalog';
import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { loadScriptFromDisk, silentAudio } from './harness';

// Deterministic walks through the final chapter: a policy picks options by their text.
type Policy = (options: string[], sceneId: string) => number;

// 18:31 at the old station: where she points, in order. The east wall hums on her right.
const EAST_WALL: Direction[] = ['right'];

// 22:00 at the east wall she has to hold her breath to hear the metal: steady holds until it comes through; shaky lets go every time;
// 'shaky-then-counted' fails her own two tries and holds on the third, the one somebody counts with her.
type Breath = 'steady' | 'shaky' | 'shaky-then-counted';

function play(policy: Policy, maxLoops = 1, station: Direction[] = EAST_WALL, forget: string[] = [], breath: Breath = 'steady') {
  const { script, errors } = loadScriptFromDisk();
  if (errors.length) throw new Error(errors.join('\n'));
  let wall = 0;
  let save: GameSave = freshSave();
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => wall }, { speed: 1 });
  director.jumpToChapter('final', true);
  // Knowledge a real playthrough may have missed (the chapter jump grants everything learnable before).
  const known = (director as unknown as { knowledge: Set<string> }).knowledge;
  for (const id of forget) known.delete(id);
  director.save.knowledge = [...known];
  const finalOptions: string[][] = [];
  const scenes: string[] = [];
  let pointed = 0;
  const holds: number[] = [];
  // This day's flags as they stand at 23:40, before midnight can clear them.
  let flags = new Set<string>();
  for (let steps = 0; steps < 200_000; steps++) {
    const view = director.view;
    if (view.phase === 'ending' || director.save.loop > maxLoops) break;
    if (view.sceneId && scenes[scenes.length - 1] !== view.sceneId) scenes.push(view.sceneId);
    if (view.sceneId === 'f_choice' && !flags.size) flags = new Set(director.loopFlags);
    if (view.choice && view.focus === 'main') {
      const texts = view.choice.options.map((option) => option.text);
      if (view.sceneId === 'f_choice') finalOptions.push(texts);
      director.choose(view.choice.options[policy(texts, view.sceneId ?? '')]?.index ?? -1);
    } else if (view.interact?.type === 'touch') {
      director.touchDone();
    } else if (view.interact?.type === 'punch') {
      director.punchDone();
    } else if (view.interact?.type === 'locate') {
      director.locatePick(station[pointed++ % station.length]);
    } else if (view.interact?.type === 'hold') {
      if (!holds.includes(view.interact.key)) holds.push(view.interact.key);
      const shaky = breath === 'shaky' || (breath === 'shaky-then-counted' && holds.length <= 2);
      if (view.interact.since === null) {
        director.holdStart();
        if (shaky) { wall += 400; director.tick(400); director.holdEnd(); }
      }
    } else {
      director.hurry();
    }
    wall += 200;
    director.tick(200);
  }
  return { endings: director.save.endings, ending: director.view.ending, loop: director.save.loop, knowledge: new Set(director.save.knowledge), flags, finalOptions, scenes, holds: holds.length };
}

const pick = (pattern: RegExp, fallback = 0): Policy => (options) => {
  const index = options.findIndex((text) => pattern.test(text));
  return index >= 0 ? index : fallback;
};

// The first option of every visit is the respectful one; the hub lists visits first.
const RESPECTFUL_TO_C = pick(/撤銷所有改寫/);

describe('final chapter paths', () => {
  it('a respectful day that hears the east wall can reach Ending C', () => {
    const result = play(RESPECTFUL_TO_C);
    expect(result.finalOptions[0]).toContain('「撤銷所有改寫，然後封存今天。」');
    expect(result.ending).toBe('c');
    expect(result.scenes).toEqual(expect.arrayContaining(['f_end_c', 'f_epilogue_c', 'f_epilogue_station']));
  });

  it('the same day can choose to seal only today (Ending A)', () => {
    const result = play(pick(/只封存這一個今天/));
    expect(result.ending).toBe('a');
    expect(result.scenes).toContain('f_epilogue_a');
  });

  it('sealing only today without finding the backup does not hold: the bell rings on', () => {
    const result = play(pick(/只封存這一個今天/), 1, ['left', 'front']);
    expect(result.finalOptions[0]).toContain('「只封存這一個今天。」');
    expect(result.ending).not.toBe('a');
    expect(result.endings).toContain('b');
    expect(result.scenes).toContain('f_end_b');
  });

  it('「……再一次。」 records Ending B and replays the final day', () => {
    const result = play(pick(/再一次/), 1);
    expect(result.endings).toContain('b');
    expect(result.loop).toBe(2);
    expect(result.knowledge.has('k_f_again')).toBe(true);
  });

  const PRESSURE_RUOQING: Policy = (options, sceneId) => {
    if (sceneId === 'f_ruoqing') return options.findIndex((text) => text.includes('會死在舊車站'));
    return RESPECTFUL_TO_C(options, sceneId);
  };

  it('pressuring Ruoqing loses the cabinet: Ending C is not offered', () => {
    const result = play(PRESSURE_RUOQING, 1, EAST_WALL, ['k_cabinet_warm']);
    expect(result.finalOptions[0]).not.toContain('「撤銷所有改寫，然後封存今天。」');
    expect(result.finalOptions[0]).toContain('「只封存這一個今天。」');
  });

  it('having touched the cabinet on some 10/3, she finds it without Ruoqing and can still reach Ending C', () => {
    const result = play(PRESSURE_RUOQING);
    expect(result.finalOptions[0]).toContain('「撤銷所有改寫，然後封存今天。」');
  });

  it('pressuring Tingan leaves only 「……再一次。」', () => {
    const result = play((options, sceneId) => {
      if (sceneId === 'f_tingan') return options.findIndex((text) => text.includes('花了半年'));
      return RESPECTFUL_TO_C(options, sceneId);
    });
    expect(result.finalOptions[0]).toEqual(['「……再一次。」']);
    expect(result.endings).toContain('b');
  });

  it('one wrong direction at 18:31 still leaves time to find the east wall', () => {
    const result = play(RESPECTFUL_TO_C, 1, ['left', 'right']);
    expect(result.finalOptions[0]).toContain('「撤銷所有改寫，然後封存今天。」');
  });

  it('two wrong directions at 18:31 lose G1', () => {
    const result = play(RESPECTFUL_TO_C, 1, ['left', 'front']);
    expect(result.finalOptions[0]).not.toContain('「撤銷所有改寫，然後封存今天。」');
  });

  // G3: a gentle visit gets a hearing, not the whole thing. Without what they can check for themselves, each gives only part.
  it('a respectful day with every piece of evidence gets everyone in full', () => {
    const result = play(RESPECTFUL_TO_C);
    for (const id of ['ev_tingan', 'ev_yuan', 'ev_ruoqing', 'ev_boxun', 'ev_zhiyuan', 'g4']) expect(result.flags.has(id)).toBe(true);
  });

  it('without the tower kit, Yuan only writes down the connector: G2 fails and he leaves a lead', () => {
    const result = play(RESPECTFUL_TO_C, 1, EAST_WALL, ['k_tower_kit']);
    expect(result.flags.has('ev_yuan_partial')).toBe(true);
    expect(result.flags.has('ev_yuan')).toBe(false);
    expect(result.flags.has('g2')).toBe(false);
    expect(result.knowledge.has('lead_f_yuan_kit')).toBe(true);
    expect(result.finalOptions[0]).not.toContain('「撤銷所有改寫，然後封存今天。」');
  });

  it('without a source, Tingan hands over only the public page and does not come', () => {
    const result = play(RESPECTFUL_TO_C, 1, EAST_WALL, ['k_research_purpose', 'k_zhixia_voice']);
    expect(result.flags.has('ev_tingan_partial')).toBe(true);
    expect(result.knowledge.has('lead_f_tingan_source')).toBe(true);
    expect(result.finalOptions[0]).toEqual(['「……再一次。」']);
  });

  it('without having heard her photos, Ruoqing keeps them; having touched the cabinet still finds it', () => {
    const photos = ['k_new_cabinet', 'k_cabinet_spot', 'k_c2_photos_heard'];
    const kept = play(RESPECTFUL_TO_C, 1, EAST_WALL, [...photos, 'k_cabinet_warm']);
    expect(kept.flags.has('ev_ruoqing_partial')).toBe(true);
    expect(kept.knowledge.has('lead_f_ruoqing_photos')).toBe(true);
    expect(kept.flags.has('g1')).toBe(false);
    const touched = play(RESPECTFUL_TO_C, 1, EAST_WALL, photos);
    expect(touched.flags.has('g1')).toBe(true);
  });

  it('without a record he can check, Dr. Chen gives one copy and G4 fails', () => {
    const result = play(RESPECTFUL_TO_C, 1, EAST_WALL, ['k_medical_records', 'k_record_12days']);
    expect(result.flags.has('ev_boxun_partial')).toBe(true);
    expect(result.knowledge.has('lead_f_boxun_record')).toBe(true);
    expect(result.flags.has('g4')).toBe(false);
  });

  it('without the voice on the tape, Zhou keeps the drawer shut', () => {
    const result = play(RESPECTFUL_TO_C, 1, EAST_WALL, ['k_recorder_voice']);
    expect(result.flags.has('ev_zhiyuan_partial')).toBe(true);
    expect(result.knowledge.has('lead_f_zhiyuan_voice')).toBe(true);
    expect(result.flags.has('g4')).toBe(false);
  });

  // G7: at 22:00 her own breathing covers the metal. After two tries of her own, 周警官 counts the third with her.
  it('failing her own two breaths, she holds the third with 周警官 counting, and Ending C is still offered', () => {
    const result = play(RESPECTFUL_TO_C, 1, EAST_WALL, [], 'shaky-then-counted');
    expect(result.holds).toBe(3);
    expect(result.flags.has('f_g4_counted')).toBe(true);
    expect(result.flags.has('g4')).toBe(true);
    expect(result.knowledge.has('lead_f_breath')).toBe(false);
    expect(result.finalOptions[0]).toContain('「撤銷所有改寫，然後封存今天。」');
  });

  // Even counted, if the third goes too, she says so: 「未確認」, and G4 does not hold.
  it('holding her breath badly all three times at the east wall loses G4, but sealing only today is still there', () => {
    const result = play(RESPECTFUL_TO_C, 1, EAST_WALL, [], 'shaky');
    expect(result.holds).toBe(3);
    expect(result.flags.has('g2')).toBe(true);
    expect(result.flags.has('g4')).toBe(false);
    expect(result.knowledge.has('lead_f_breath')).toBe(true);
    expect(result.finalOptions[0]).not.toContain('「撤銷所有改寫，然後封存今天。」');
    expect(result.finalOptions[0]).toContain('「只封存這一個今天。」');
  });
});
