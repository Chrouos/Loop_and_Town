import chars from '../src/assets/fonts/iansui-chars.txt?raw';

const sources = {
  ...import.meta.glob('../../story/*.yaml', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;

// Characters Iansui itself lacks; they render in the system fallback (always the same one, so no swap).
const NOT_IN_FONT = new Set(['哐', '≈']);

describe('self-hosted Iansui subset', () => {
  it('covers every CJK character in the story and the UI', () => {
    const covered = new Set(chars);
    const missing = new Set<string>();
    for (const text of Object.values(sources)) {
      for (const ch of text) {
        if (/[　-鿿＀-￯]/.test(ch) && !covered.has(ch) && !NOT_IN_FONT.has(ch)) missing.add(ch);
      }
    }
    // New text needs `python tools/subset-font.py` to rebuild the font.
    expect([...missing].join('')).toBe('');
  });
});
