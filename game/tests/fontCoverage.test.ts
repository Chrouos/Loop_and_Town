import { load } from 'js-yaml';
import chars from '../src/assets/fonts/wenkai-tc-chars.txt?raw';
import machineChars from '../src/assets/fonts/sarasa-fixed-tc-chars.txt?raw';
import pastChars from '../src/assets/fonts/iansui-chars.txt?raw';

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
function voices(): { machine: string[]; past: string[] } {
  const machine: string[] = [];
  const past: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    const map = node as Record<string, unknown>;
    if (typeof map.phone === 'string') machine.push(map.phone);
    for (const key of ['time', 'clock', 'until']) if (typeof map[key] === 'string' || typeof map[key] === 'number') machine.push(String(map[key]));
    if (map.via === 'tape' || typeof map.zhixia === 'string') {
      for (const [key, value] of Object.entries(map)) if (key !== 'via' && typeof value === 'string') past.push(value);
    }
    Object.values(map).forEach(walk);
  };
  for (const source of Object.values(stories)) walk(load(source));
  return { machine, past };
}

describe('self-hosted fonts', () => {
  it('LXGW WenKai TC covers every CJK character in the story and the UI', () => {
    expect(missingFrom(chars, Object.values(sources))).toBe('');
  });

  it('the machine voice (Sarasa Fixed TC) covers every phone line and every clock', () => {
    const { machine } = voices();
    expect(machine.length).toBeGreaterThan(50);
    expect(missingFrom(machineChars, machine)).toBe('');
  });

  it('a voice from before (Iansui) covers every tape and every line of Zhixia', () => {
    const { past } = voices();
    expect(past.length).toBeGreaterThan(5);
    expect(missingFrom(pastChars, past)).toBe('');
  });
});
