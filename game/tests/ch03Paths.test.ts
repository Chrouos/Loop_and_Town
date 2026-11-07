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
  return { stays, said, knows: d.knows, learned: d.knows.has('k_no_known_death'), ruoqingWent: d.knows.has('k_c3_ruoqing_went') };
}

const atCafe = (scene: string, opts: string[], text: string) => {
  const i = opts.findIndex((o) => o.includes(text));
  return scene === 'c3_ruoqing' && i >= 0 ? i : null;
};

// At the hospital, pick the first option containing any of these; every other question there is left to run out.
const atHospital = (scene: string, opts: string[], ...texts: string[]) => {
  if (scene !== 'c3_hospital') return undefined;
  for (const text of texts) { const i = opts.findIndex((o) => o.includes(text)); if (i >= 0) return i; }
  return null;
};

it('silence, then calling after him and naming the path he told no one', () => {
  const r = play((scene, opts, at, t) => {
    const h = atHospital(scene, opts, '「陳醫生！」', '維修通道');
    if (h !== undefined) return h;
    const c = atCafe(scene, opts, TRUTH);
    if (c !== null) return c;
    return t - at > 1500 ? 0 : null;
  });
  expect(r.said).toContain('結果我還是差點走了。');
  expect(r.stays && r.learned).toBe(true);
});

it('calling after him with only a warning buys him until six', () => {
  let called = false;
  const r = play((scene, opts, at, t) => {
    // The first question at the back door runs out; after calling him back, the warning is all she gives.
    if (scene === 'c3_hospital' && opts.includes('「陳醫生！」')) { called = true; return opts.indexOf('「陳醫生！」'); }
    if (scene === 'c3_hospital') return called ? atHospital(scene, opts, '會停電')! : null;
    const c = atCafe(scene, opts, TRUTH);
    if (c !== null) return c;
    return t - at > 1500 ? 0 : null;
  });
  expect(r.said).toContain('六點以後，我照原來的安排。');
  expect(r.stays || r.learned).toBe(false);
  expect(r.knows.has('lead_c3_proof') && r.knows.has('k_c3_boxun_died_again')).toBe(true);
});

it('a warning with nothing he can check only buys until six', () => {
  const r = play((scene, opts, at, t) => {
    const h = atHospital(scene, opts, '會停電', '沒有證據');
    if (h !== undefined) return h;
    const c = atCafe(scene, opts, TRUTH);
    if (c !== null) return c;
    return t - at > 1500 ? 0 : null;
  });
  expect(r.said).toContain('他交代說，如果有人打來找他，就跟她說六點了，什麼都沒有發生。');
  expect(r.stays || r.learned).toBe(false);
  expect(r.knows.has('lead_c3_proof')).toBe(true);
});

it('a warning backed by the path he told no one keeps him', () => {
  const r = play((scene, opts, at, t) => {
    const h = atHospital(scene, opts, '會停電', '還沒跟任何人講');
    if (h !== undefined) return h;
    const c = atCafe(scene, opts, TRUTH);
    if (c !== null) return c;
    return t - at > 1500 ? 0 : null;
  });
  expect(r.said).toContain('妳怎麼知道的，我不會去猜。可是這一句，我自己對得上。');
  expect(r.stays && r.learned).toBe(true);
  expect(r.knows.has('lead_c3_proof')).toBe(false);
});

it('saying she will not come, when she only said yes: he calls her and the lie comes apart', () => {
  const r = play((scene, opts, at, t) => {
    const h = atHospital(scene, opts, '若晴今天不會去拿了');
    if (h !== undefined) return h;
    return t - at > 1500 ? 0 : null;
  });
  expect(r.said).toContain('她說她會到。');
  expect(r.said).toContain('她還說，妳跟她講是我說的。');
  expect(r.knows.has('lead_c3_he_checks') && r.ruoqingWent && !r.learned).toBe(true);
});

it('saying she will not come, when she really chose not to: he calls, she agrees, tomorrow', () => {
  const r = play((scene, opts, at, t) => {
    const h = atHospital(scene, opts, '若晴今天不會去拿了');
    if (h !== undefined) return h;
    const c = atCafe(scene, opts, TRUTH);
    if (c !== null) return c;
    return t - at > 1500 ? 0 : null;
  });
  expect(r.said).toContain('她說改明天。');
  expect(r.stays && r.learned && !r.knows.has('lead_c3_he_checks')).toBe(true);
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
  // 陳醫生 stayed, so there is nothing to pick up: she goes in anyway, for her own reasons.
  expect(r.said).toContain('陳醫生說他走不開！我進去看一下就走，妳不要管我！');
  expect(r.said).toContain('若晴那邊，我會打給她改時間。');
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
  expect(r.said).toContain('先講好喔，是我自己也不想一個人去那裡拿她的東西。');
  expect(r.stays && r.learned).toBe(true);
});
