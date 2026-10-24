// Turns public/audio/CREDITS.md into the list the 參考資料 tab shows: one entry per Freesound
// recording, with what the player hears it as. The file is fetched when the tab opens, so its
// processing notes never ship in the bundle.

import { AMBIENCE, SFX } from './catalog';

export interface SoundSource {
  readonly title: string;
  readonly author: string;
  readonly url: string;
  readonly license: string;
  /** 'amb' if the first file using it is an ambience bed, else 'sfx'. */
  readonly kind: 'amb' | 'sfx';
  /** What the player hears it as (catalog descriptions), in file order, no repeats. */
  readonly uses: string[];
}

const LINE = /^- `([^`]+)` — (\w+) — (.*)$/;
const SOURCE = /"(.+?)" by (.+?) — (https:\/\/freesound\.org\/\S+?\/sounds\/\d+\/)/g;
const LICENSE = /^ — (CC0|CC BY [\d.]+)/;

function describe(id: string): string {
  return (SFX as Record<string, string>)[id] ?? (AMBIENCE as Record<string, string>)[id] ?? id;
}

export function parseSoundSources(markdown: string): SoundSource[] {
  const byUrl = new Map<string, { title: string; author: string; url: string; license: string; kind: 'amb' | 'sfx'; uses: string[] }>();
  for (const line of markdown.split('\n')) {
    const match = LINE.exec(line);
    if (!match) continue;
    const [, file, id, rest] = match;
    const found = [...rest.matchAll(SOURCE)];
    if (found.length === 0) continue;
    const last = found[found.length - 1];
    const license = LICENSE.exec(rest.slice(last.index + last[0].length))?.[1] ?? '';
    const use = describe(id);
    for (const [, title, author, url] of found) {
      let entry = byUrl.get(url);
      if (!entry) {
        entry = { title, author, url, license, kind: file.startsWith('amb/') ? 'amb' : 'sfx', uses: [] };
        byUrl.set(url, entry);
      }
      if (!entry.uses.includes(use)) entry.uses.push(use);
    }
  }
  return [...byUrl.values()];
}
