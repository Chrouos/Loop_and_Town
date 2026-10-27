import { Director } from '../src/engine/director';
import { freshSave, readSave, SAVE_KEY, type GameSave } from '../src/engine/save';
import { loadScriptFromDisk, silentAudio } from './harness';

// The chapter list: go back to an earlier chapter for one day, keep what was heard there, return at midnight.
function setup() {
  const { script, errors } = loadScriptFromDisk();
  if (errors.length) throw new Error(errors.join('\n'));
  let save: GameSave = freshSave();
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 }, { speed: 1 });
  /** Plays until the chapter changes (or a loop ends), picking the first plain option. */
  const playDay = () => {
    const startLoop = director.save.loop;
    for (let steps = 0; steps < 400_000 && director.save.loop === startLoop; steps++) {
      const view = director.view;
      if (view.choice && view.focus === 'main') {
        const plain = view.choice.options.findIndex((option) => !option.text.includes('想起一句話'));
        director.choose(view.choice.options[Math.max(0, plain)].index);
      } else if (view.recall) director.recallPick(null);
      else if (view.interact?.type === 'touch') director.touchDone();
      else if (view.interact?.type === 'punch') director.punchDone();
      else if (view.interact?.type === 'approach') director.approachCall();
      else if (view.interact?.type === 'locate') director.locatePick('right');
      else director.hurry();
      if (view.keep) director.skipKeep();
      director.tick(200);
    }
  };
  return { director, playDay };
}

function enterFirstScene(director: Director) {
  for (let step = 0; step < 200 && director.view.phase !== 'scene'; step++) director.tick(200);
  expect(director.view.phase).toBe('scene');
}

describe('chapter list', () => {
  it('keeps the previous-night prologue when starting a new game', () => {
    const { director } = setup();
    director.start();
    enterFirstScene(director);
    expect(director.view.sceneId).toBe('c1_prologue');
    expect(director.view.clock).toBe('10月2日 22:40');
  });

  it('restarts chapter one on the morning train, keeping knowledge and memories', () => {
    const { director } = setup();
    director.jumpToChapter('1', false);
    director.save.memories.push({ key: 'kept', text: '記住的話', kind: 'char', loop: 1, chapter: '1' });
    const knowledge = [...director.knows];
    director.selectChapter('1');
    enterFirstScene(director);
    expect(director.view.sceneId).toBe('c1_train');
    expect(director.view.clock).toBe('06:12');
    expect([...director.knows]).toEqual(knowledge);
    expect(director.save.memories.map((memory) => memory.key)).toContain('kept');
  });

  it('replays chapter one from the morning when selected from a later chapter', () => {
    const { director } = setup();
    director.jumpToChapter('4', true);
    director.selectChapter('1');
    enterFirstScene(director);
    expect(director.view.sceneId).toBe('c1_train');
    expect(director.view.clock).toBe('06:12');
    expect(director.save.replay?.chapter).toBe('4');
  });

  it('resumes the morning entry if reloaded immediately after selecting restart', () => {
    const { director } = setup();
    director.start();
    director.selectChapter('1');
    const { script } = loadScriptFromDisk();
    const resumed = new Director(script, JSON.parse(JSON.stringify(director.save)), {
      audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0,
    }, { speed: 1 });
    resumed.start();
    enterFirstScene(resumed);
    expect(resumed.view.sceneId).toBe('c1_train');
    expect(resumed.view.clock).toBe('06:12');
  });

  it('records every chapter the save enters', () => {
    const { director } = setup();
    director.jumpToChapter('4', true);
    expect(director.save.reached).toEqual(['4']);
    director.selectChapter('5');
    expect(director.save.reached).toEqual(['4', '5']);
  });

  it('a replayed earlier chapter keeps what she heard there and returns to the progress chapter at midnight', () => {
    const { director, playDay } = setup();
    director.jumpToChapter('6', true);
    director.save.chLoop = 3;
    const memoriesBefore = director.save.memories.length;
    director.selectChapter('5');
    expect(director.save.chapter).toBe('5');
    expect(director.save.replay).toEqual({ chapter: '6', chLoop: 3 });
    expect(director.progressChapter).toBe('6');
    playDay();
    expect(director.save.chapter).toBe('6');
    expect(director.save.chLoop).toBe(3);
    expect(director.save.replay).toBeNull();
    expect(director.save.memories.length).toBeGreaterThanOrEqual(memoriesBefore);
    expect(director.knows.has('k_slate_in_shop')).toBe(true);
  });

  it('picking the progress chapter starts its day over; picking it while replaying goes straight back', () => {
    const { director } = setup();
    director.jumpToChapter('4', true);
    director.selectChapter('4');
    expect(director.save.chapter).toBe('4');
    expect(director.save.chLoop).toBe(2);
    director.selectChapter('2');
    expect(director.save.replay?.chapter).toBe('4');
    director.selectChapter('4');
    expect(director.save.chapter).toBe('4');
    expect(director.save.chLoop).toBe(2);
    expect(director.save.replay).toBeNull();
  });

  it("a later chapter (dev list) adds every earlier chapter's knowledge without forgetting memories", () => {
    const { director } = setup();
    director.jumpToChapter('2', true);
    director.save.memories.push({ key: 'x', text: '記住的話', kind: 'char', loop: 1, chapter: '2' });
    director.selectChapter('5');
    expect(director.save.chapter).toBe('5');
    expect(director.knows.has('k_zhixia_saw_my_death')).toBe(true);
    expect(director.save.memories.map((memory) => memory.text)).toContain('記住的話');
  });

  it('old saves without a chapter list count every chapter up to the current one as reached', () => {
    const old = { ...freshSave(), started: true, chapter: '3' } as Partial<GameSave>;
    delete old.reached;
    delete old.replay;
    const storage = { getItem: (key: string) => (key === SAVE_KEY ? JSON.stringify(old) : null) } as unknown as Storage;
    expect(readSave(storage).reached).toEqual(['1', '2', '3']);
  });
});
