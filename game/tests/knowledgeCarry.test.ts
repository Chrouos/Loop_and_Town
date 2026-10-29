import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { loadScriptFromDisk, silentAudio } from './harness';

// What she heard stays heard: going back to chapter 1 from the chapter list, she skips the photo
// and still has what 予安 told her about it the first time.
describe('knowledge carries over when she lives a day again', () => {
  it('the photo option reaches 庭安 on a replay where she never touches the frame', () => {
    const { script, errors } = loadScriptFromDisk();
    expect(errors).toEqual([]);
    let save: GameSave = freshSave();
    const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 }, { speed: 1 });
    director.jumpToChapter('1', false);
    let pass = 1;
    const tinganOptions: Record<number, string[]> = {};
    const roomPicks: Record<number, string[]> = { 1: [], 2: [] };
    for (let steps = 0; steps < 400_000 && pass <= 2; steps++) {
      const view = director.view;
      if (pass === 1 && director.save.chapter === '2') { pass = 2; director.selectChapter('1'); continue; }
      if (pass === 2 && director.save.replay === null) break;
      if (view.choice && view.focus === 'main') {
        const texts = view.choice.options.map((option) => option.text);
        let pick = texts.findIndex((text) => !text.includes('想起一句話'));
        if (view.sceneId === 'c1_room_touch') {
          const want = pass === 1 ? /摸相框/ : /拿起手錶/;
          const touch = texts.findIndex((text) => want.test(text));
          const leave = texts.findIndex((text) => /離開房間/.test(text));
          pick = touch >= 0 ? touch : leave;
          roomPicks[pass].push(texts[pick]);
        }
        if (view.sceneId === 'c1_tingan') tinganOptions[pass] ??= texts;
        director.choose(view.choice.options[Math.max(0, pick)].index);
      } else if (view.recall) director.recallPick(null);
      else if (view.interact?.type === 'touch') director.touchDone();
      else if (view.interact?.type === 'punch') director.punchDone();
      else if (view.interact?.type === 'approach') director.approachCall();
      else if (view.interact?.type === 'locate') director.locatePick('front-right');
      else director.hurry();
      if (view.keep) director.skipKeep();
      if (view.teach === 'keep') director.capture();
      director.tick(200);
    }
    expect(roomPicks[1]).toContain('（摸相框）');
    expect(roomPicks[2]).not.toContain('（摸相框）');
    expect(director.knows.has('k_photo_tingan')).toBe(true);
    expect(tinganOptions[2]?.some((text) => text.includes('我姊桌上有一張照片'))).toBe(true);
  });
});
