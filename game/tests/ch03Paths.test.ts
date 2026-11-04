// Chapter 3: the ways to keep 陳醫生 at the hospital, and 若晴 who decides for herself, played end to end.
import { it, expect } from 'vitest';
import { Director } from '../src/engine/director';
import { freshSave } from '../src/engine/save';
import { loadScriptFromDisk, silentAudio } from './harness';

// At the cafe, telling her the truth is what lets her choose to stay home; a lie only makes her say yes.
const TRUTH = '過好幾次';

function play(pick: (scene: string, options: string[], shownAt: number, t: number) => number | null, knowledge: string[] = []) {
  const { script } = loadScriptFromDisk();
  const d = new Director(script, freshSave(), { audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 }, { speed: 1 });
  d.jumpToChapter('3', true);
  // What she carried out of an earlier 10/3 of this chapter.
  for (const id of knowledge) (d.knows as Set<string>).add(id);
  const said: string[] = [];
  let stays = false;
  for (let i = 0; i < 200000 && d.view.phase !== 'reset'; i++) {
    const v = d.view;
    if (v.center && said.at(-1) !== v.center.text) said.push(v.center.text);
    if (d.loopFlags.has('c3_boxun_stays')) stays = true;
    if (v.choice && v.focus === 'main') {
      const c = pick(v.sceneId!, v.choice.options.map((o) => o.text), v.choice.startedAt, v.t);
      if (c !== null) d.choose(v.choice.options[c]?.index ?? -1);
    }
    if (v.keep) d.skipKeep();
    d.tick(100);
  }
  return { stays, said, learned: d.knows.has('k_no_known_death'), ruoqingWent: d.knows.has('k_c3_ruoqing_went') };
}

const atCafe = (scene: string, opts: string[], text: string) => {
  const i = opts.findIndex((o) => o.includes(text));
  return scene === 'c3_ruoqing' && i >= 0 ? i : null;
};

it('silence, then calling after him', () => {
  const r = play((scene, opts, at, t) => {
    if (scene === 'c3_hospital') { const i = opts.indexOf('「陳醫生！」'); return i >= 0 ? i : null; }
    const c = atCafe(scene, opts, TRUTH);
    if (c !== null) return c;
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
    const c = atCafe(scene, opts, TRUTH);
    if (c !== null) return c;
    return t - at > 1500 ? 0 : null;
  });
  expect(r.said).toContain('那條通道，連醫院裡都沒幾個人知道。');
  expect(r.stays && r.learned).toBe(true);
});

it('a lie at the cafe gets a yes, and she goes anyway', () => {
  const r = play((scene, opts, at, t) => {
    const i = opts.findIndex((o) => o.includes('旁邊那條通道'));
    if (scene === 'c3_hospital' && i >= 0) return i;
    return t - at > 1500 ? 0 : null;
  });
  expect(r.stays).toBe(true);
  expect(r.said).toContain('我拿了東西就走啦！這是我自己的事，妳不要管我！');
  expect(r.ruoqingWent && !r.learned).toBe(true);
});

it('after she went anyway, asking what the papers mean to her lets her move it herself', () => {
  const r = play((scene, opts, at, t) => {
    const i = opts.findIndex((o) => o.includes('旁邊那條通道'));
    if (scene === 'c3_hospital' && i >= 0) return i;
    const c = atCafe(scene, opts, '對妳很重要');
    if (c !== null) return c;
    return t - at > 1500 ? 0 : null;
  }, ['k_c3_ruoqing_went', 'k_maintenance_passage']);
  expect(r.said).toContain('不是因為妳喔。是我自己也不想一個人去那裡拿她的東西。');
  expect(r.stays && r.learned).toBe(true);
});
