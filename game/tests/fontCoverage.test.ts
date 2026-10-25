import chars from '../src/assets/fonts/wenkai-tc-chars.txt?raw';

const sources = {
  ...import.meta.glob('../../story/*.yaml', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;

describe('self-hosted LXGW WenKai TC subset', () => {
  it('covers every CJK character in the story and the UI', () => {
    const covered = new Set(chars);
    const missing = new Set<string>();
    for (const text of Object.values(sources)) {
      for (const ch of text) {
        if (/[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/u.test(ch) && !covered.has(ch)) missing.add(ch);
      }
    }
    // New text needs `python tools/subset-font.py` to rebuild the font.
    expect([...missing].join('')).toBe('');
  });
});
