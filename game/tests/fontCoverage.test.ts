import { load } from 'js-yaml';
import chars from '../src/assets/fonts/wenkai-tc-chars.txt?raw';
import screenChars from '../src/assets/fonts/screen-pixel-chars.txt?raw';
import stampChars from '../src/assets/fonts/stamps-chars.txt?raw';

const stories = import.meta.glob('../../story/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const sources = {
  ...stories,
  ...import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;

const SHOWN = /[\p{Script=Han}　-〿＀-￯]/u;
// New text needs `python tools/subset-font.py` to rebuild the fonts.
function missingFrom(cut: string, texts: Iterable<string>): string {
  const covered = new Set(cut);
  const missing = new Set<string>();
  for (const text of texts) for (const ch of text) if (SHOWN.test(ch) && !covered.has(ch)) missing.add(ch);
  return [...missing].join('');
}

// Which lines each voice speaks, the same way tools/subset-font.py reads them.
type Voice = 'screen' | 'stamps';

function voices(): Record<Voice, string[]> {
  const found: Record<Voice, string[]> = { screen: [], stamps: [] };
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    const map = node as Record<string, unknown>;
    if (typeof map.phone === 'string') found.screen.push(map.phone);
    for (const key of ['place', 'title']) if (typeof map[key] === 'string') found.stamps.push(map[key] as string);
    if (typeof map.place === 'string') found.screen.push(map.place);
    for (const key of ['time', 'clock', 'until']) {
      if (typeof map[key] === 'string' || typeof map[key] === 'number') { found.screen.push(String(map[key])); found.stamps.push(String(map[key])); }
    }
    Object.values(map).forEach(walk);
  };
  for (const source of Object.values(stories)) walk(load(source));
  return found;
}

// Marks a face does not draw fall back to WenKai.
const MARKS = /[—《》（）・．／～　·]/g;

describe('self-hosted fonts', () => {
  it('LXGW WenKai TC covers every CJK character in the story and the UI', () => {
    expect(missingFrom(chars, Object.values(sources))).toBe('');
  });

  const cases: [string, Voice, string, number][] = [
    ['the screen (the FashionBitmap16 cut) covers every phone line, clock and place', 'screen', screenChars, 50],
    ['the stamps (Noto Sans CJK TC Light) cover every card time, place and title', 'stamps', stampChars, 50],
  ];
  for (const [name, voice, cut, least] of cases) {
    it(name, () => {
      const lines = voices()[voice];
      expect(lines.length).toBeGreaterThan(least);
      expect(missingFrom(cut, lines).replace(MARKS, '')).toBe('');
    });
  }
});
