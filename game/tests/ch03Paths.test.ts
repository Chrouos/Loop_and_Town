// Chapter 3: the ways to keep 陳醫生 at the hospital, played end to end.
import { it, expect } from 'vitest';
import { Director } from '../src/engine/director';
import { freshSave } from '../src/engine/save';
import { loadScriptFromDisk, silentAudio } from './harness';

function play(pick: (scene: string, options: string[], shownAt: number, t: number) => number | null) {
  const { script } = loadScriptFromDisk();
  const d = new Director(script, freshSave(), { audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 }, { speed: 1 });
  d.jumpToChapter('3', true);
  const said: string[] = [];
  let stays = false;
  for (let i = 0; i < 200000 && d.view.phase !== 'reset'; i++) {
    const v = d.view;
    if (v.center && said.at(-1) !== v.center.text) said.push(v.center.text);
    if (d.loopFlags.has('boxun_stays')) stays = true;
    if (v.choice && v.focus === 'main') {
      const c = pick(v.sceneId!, v.choice.options.map((o) => o.text), v.choice.startedAt, v.t);
      if (c !== null) d.choose(v.choice.options[c]?.index ?? -1);
    }
    if (v.keep) d.skipKeep();
    d.tick(100);
  }
  return { stays, said, learned: d.knows.has('k_no_known_death') };
}

it('silence, then calling after him', () => {
  const r = play((scene, opts, at, t) => {
    if (scene === 'c3_hospital') { const i = opts.indexOf('「陳醫生！」'); return i >= 0 ? i : null; }
    return t - at > 1500 ? 0 : null;
  });
  expect(r.said).toContain('結果我還是差點走了。');
  expect(r.stays && r.learned).toBe(true);
});

it('silence twice still fails', () => {
  const r = play((scene, opts, at, t) => (scene === 'c3_hospital' ? null : t - at > 1500 ? 0 : null));
  expect(r.said).toContain('……失陪了。');
  expect(r.stays).toBe(false);
});

it('naming the side passage', () => {
  const r = play((scene, opts, at, t) => {
    const i = opts.findIndex((o) => o.includes('旁邊那條通道'));
    if (scene === 'c3_hospital' && i >= 0) return i;
    return t - at > 1500 ? 0 : null;
  });
  expect(r.said).toContain('那條通道，連醫院裡都沒幾個人知道。');
  expect(r.stays && r.learned).toBe(true);
});
