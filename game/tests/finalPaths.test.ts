import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { loadScriptFromDisk, silentAudio } from './harness';

// Deterministic walks through the final chapter: a policy picks options by their text.
type Policy = (options: string[], sceneId: string) => number;

function play(policy: Policy, maxLoops = 1) {
  const { script, errors } = loadScriptFromDisk();
  if (errors.length) throw new Error(errors.join('\n'));
  let wall = 0;
  let save: GameSave = freshSave();
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => wall }, { speed: 1 });
  director.jumpToChapter('final', true);
  const finalOptions: string[][] = [];
  const scenes: string[] = [];
  for (let steps = 0; steps < 200_000; steps++) {
    const view = director.view;
    if (view.phase === 'ending' || director.save.loop > maxLoops) break;
    if (view.sceneId && scenes[scenes.length - 1] !== view.sceneId) scenes.push(view.sceneId);
    if (view.choice && view.focus === 'main') {
      const texts = view.choice.options.map((option) => option.text);
      if (view.sceneId === 'f_choice') finalOptions.push(texts);
      director.choose(policy(texts, view.sceneId ?? ''));
    } else {
      director.hurry();
    }
    wall += 200;
    director.tick(200);
  }
  return { endings: director.save.endings, ending: director.view.ending, loop: director.save.loop, knowledge: new Set(director.save.knowledge), finalOptions, scenes };
}

const pick = (pattern: RegExp, fallback = 0): Policy => (options) => {
  const index = options.findIndex((text) => pattern.test(text));
  return index >= 0 ? index : fallback;
};

// The first option of every visit is the respectful one; the hub lists visits first.
const RESPECTFUL_TO_C = pick(/右邊——東牆|撤銷所有改寫/);

describe('final chapter paths', () => {
  it('a respectful day that hears the east wall can reach Ending C', () => {
    const result = play(RESPECTFUL_TO_C);
    expect(result.finalOptions[0]).toContain('「撤銷所有改寫，然後封存今天。」');
    expect(result.ending).toBe('c');
    expect(result.scenes).toEqual(expect.arrayContaining(['f_end_c', 'f_epilogue_c', 'f_epilogue_station']));
  });

  it('the same day can choose to seal only today (Ending A)', () => {
    const result = play(pick(/右邊——東牆|只封存這一個今天/));
    expect(result.ending).toBe('a');
    expect(result.scenes).toContain('f_epilogue_a');
  });

  it('「……再一次。」 records Ending B and replays the final day', () => {
    const result = play(pick(/右邊——東牆|再一次/), 1);
    expect(result.endings).toContain('b');
    expect(result.loop).toBe(2);
    expect(result.knowledge.has('f_again')).toBe(true);
  });

  it('pressuring Ruoqing loses the cabinet: Ending C is not offered', () => {
    const result = play((options, sceneId) => {
      if (sceneId === 'f_ruoqing') return options.findIndex((text) => text.includes('會死在舊車站'));
      return RESPECTFUL_TO_C(options, sceneId);
    });
    expect(result.finalOptions[0]).not.toContain('「撤銷所有改寫，然後封存今天。」');
    expect(result.finalOptions[0]).toContain('「只封存這一個今天。」');
  });

  it('pressuring Tingan leaves only 「……再一次。」', () => {
    const result = play((options, sceneId) => {
      if (sceneId === 'f_tingan') return options.findIndex((text) => text.includes('九點十四分'));
      return RESPECTFUL_TO_C(options, sceneId);
    });
    expect(result.finalOptions[0]).toEqual(['「……再一次。」']);
    expect(result.endings).toContain('b');
  });

  it('two wrong directions at 18:31 lose G1', () => {
    const result = play((options, sceneId) => {
      if (sceneId === 'f_station') return options.findIndex((text) => !text.includes('右邊'));
      return RESPECTFUL_TO_C(options, sceneId);
    });
    expect(result.finalOptions[0]).not.toContain('「撤銷所有改寫，然後封存今天。」');
  });
});
