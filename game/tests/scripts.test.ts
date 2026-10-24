import { CHAPTER_ORDER } from '../src/script/types';
import { autoplay, loadScriptFromDisk } from './harness';

const report = loadScriptFromDisk();
const keys = report.script.order;

describe('listening town scripts', () => {
  it('parse and validate without errors', () => {
    expect(report.errors).toEqual([]);
  });

  it('report warnings (informational)', () => {
    if (report.warnings.length) console.warn(`${report.warnings.length} warnings\n${report.warnings.slice(0, 40).join('\n')}`);
    expect(Array.isArray(report.warnings)).toBe(true);
  });

  const nextOf = (key: string) => CHAPTER_ORDER[CHAPTER_ORDER.indexOf(key as never) + 1] as string | undefined;

  it('every chapter except the last can advance to the following chapter', () => {
    for (const chapter of report.script.chapters) {
      const next = nextOf(chapter.key);
      if (next) expect(chapter.advance.map((rule) => rule.to), `chapter ${chapter.key}`).toContain(next);
    }
  });

  for (const key of keys) {
    const next = nextOf(key);
    if (!next || !keys.includes(next)) continue;
    it(`chapter ${key} reaches chapter ${next} under random play`, () => {
      let reached = false;
      const stuck: string[] = [];
      for (let seed = 1; seed <= 40 && !reached; seed++) {
        const result = autoplay({ seed: seed * 7919 + key.length, maxLoops: 8, startChapter: key, stopAtChapter: next });
        if (result.stuck) stuck.push(result.stuck);
        reached = result.chapters.includes(next);
      }
      expect(stuck).toEqual([]);
      expect(reached).toBe(true);
    });
  }

  if (keys.includes('final')) {
    it('final reaches every ending under random play', () => {
      const endings = new Set<string>();
      const stuck: string[] = [];
      for (let seed = 1; seed <= 80 && endings.size < 3; seed++) {
        const result = autoplay({ seed: seed * 104729, maxLoops: 4, startChapter: 'final' });
        if (result.stuck) stuck.push(result.stuck);
        result.endings.forEach((ending) => endings.add(ending));
      }
      expect(stuck).toEqual([]);
      expect([...endings].sort()).toEqual(['a', 'b', 'c']);
    });
  }
});
