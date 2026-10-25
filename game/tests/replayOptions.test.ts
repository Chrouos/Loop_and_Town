// Coming back to an earlier day with what a later chapter taught opens options that were never there the first time.
import { it, expect } from 'vitest';
import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { parseCond } from '../src/script/conditions';
import { buildScript } from '../src/script/validate';
import { loadScriptFromDisk, silentAudio } from './harness';

function replay(chapter: string, knowledge: string[], prefer: string[]) {
  const { script } = loadScriptFromDisk();
  const save: GameSave = { ...freshSave(), started: true, chapter, reached: ['1', '2', '3', '4', '5', '6'], knowledge };
  const d = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 }, { speed: 1 });
  d.start();
  const said: string[] = [];
  const scenes = new Set<string>();
  for (let i = 0; i < 300000 && d.view.phase !== 'reset'; i++) {
    const v = d.view;
    if (v.sceneId) scenes.add(v.sceneId);
    if (v.center && said.at(-1) !== v.center.text) said.push(v.center.text);
    if (v.choice && v.focus === 'main' && v.t - v.choice.startedAt > 1500) {
      const texts = v.choice.options.map((o) => o.text);
      const pick = texts.findIndex((t) => prefer.some((p) => t.includes(p)));
      d.choose(pick >= 0 ? pick : 0);
    }
    if (v.keep) d.skipKeep();
    if (v.sceneId?.endsWith('_bell')) break;
    d.tick(100);
  }
  return { said, scenes, knows: d.knows };
}

it('later.X reads as knowledge, and the validator holds it to really being later', () => {
  expect(parseCond('later.k_x')).toEqual({ op: 'know', id: 'k_x', later: true });
  const chapter = (n: string, beats: string) => ({ name: `${n}.yaml`, source: `chapter: ${n}\ntitle: t\nstart: s${n}\nscenes:\n  - id: s${n}\n    beats:\n${beats}\n      - end: reset\n` });
  const early = buildScript([chapter('1', '      - { if: "know.k_late", then: [{ narr: 甲 }] }'), chapter('2', '      - learn: k_late')]);
  expect(early.errors.join('\n')).toContain('寫 later.k_late');
  const fine = buildScript([chapter('1', '      - { if: "later.k_late", then: [{ narr: 甲 }] }'), chapter('2', '      - learn: k_late')]);
  expect(fine.errors).toEqual([]);
  const wrong = buildScript([chapter('1', '      - learn: k_early\n      - { if: "later.k_early", then: [{ narr: 甲 }] }'), chapter('2', '      - narr: 乙')]);
  expect(wrong.errors.join('\n')).toContain('寫 know.k_early');
});

it('chapter two, replayed knowing about the east wall photos and his medical method', () => {
  const r = replay('2', ['k_ruoqing_died', 'k_in_station_hall', 'k_cabinet_warm', 'k_watch_1831', 'k_photo_tingan', 'k_notebook_1831', 'k_new_cabinet', 'k_medical_records'],
    ['可以說給我聽嗎', '是攝影的事嗎', '去舊車站', '你排除病因']);
  expect(r.knows.has('k_cabinet_spot')).toBe(true);
  expect(r.scenes.has('c2_station_stay')).toBe(true);
  expect(r.scenes.has('c2_station_after')).toBe(false);
  expect(r.said).toContain('十月三日，十八點三十一分，維修通道塌落。裡面沒有人。');
  expect(r.said).toContain('若晴活著，陳醫生也活著。回到這一天，我總算把他留在正門外。');
});

it('chapter one, replayed knowing what she does at the institute and what 17:58 is to him', () => {
  const r = replay('1', ['k_research_purpose', 'k_yuan_1758'], ['數位孿生', '你陪我一下就好', '叫他先坐一下', '去舊車站']);
  expect(r.said).toContain('我以前在那裡做過事。就這樣。');
  expect(r.said).toContain('……這個時間，我都不太想一個人待著。');
});
