// A first day that missed things on her sister's desk: the second day reminds her and lets her find them again.
import { it, expect } from 'vitest';
import { Director } from '../src/engine/director';
import { freshSave } from '../src/engine/save';
import { loadScriptFromDisk, silentAudio } from './harness';

it('chapter two hands back what chapter one left on the desk', () => {
  const { script } = loadScriptFromDisk();
  const save = { ...freshSave(), started: true, chapter: '2', reached: ['1', '2'], knowledge: ['k_ruoqing_died', 'k_in_station_hall'] };
  const d = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 }, { speed: 1 });
  d.start();
  const said: string[] = [];
  for (let i = 0; i < 200000 && d.view.phase !== 'reset' && d.view.sceneId !== 'c2_bell'; i++) {
    const v = d.view;
    if (v.center && said.at(-1) !== v.center.text) said.push(v.center.text);
    if (v.choice && v.focus === 'main' && v.t - v.choice.startedAt > 1500) d.choose(v.choice.options[0].index);
    if (v.keep) d.skipKeep();
    d.tick(100);
  }
  expect(said).toContain('姊姊桌上那幾樣東西，這次我一定要搞清楚。');
  expect(said).toContain('那天在舊站大廳，東牆那邊有個東西一直在嗡。她大概就倒在那面牆腳，那是什麼，我到最後都沒摸到。');
  for (const id of ['k_watch_1831', 'k_photo_tingan', 'k_notebook_1831', 'k_watch_engraving']) expect(d.knows.has(id), id).toBe(true);
});
