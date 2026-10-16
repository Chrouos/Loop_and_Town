import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import './narrationBeatPager.css';

export type NarrativeBeat = { lineIndex: number; text: string };
export type NarrativePage = NarrativeBeat[];

/** Pure paging: punctuation boundaries are preferred; every source character appears exactly once. */
export function paginateNarration(lines: string[], capacity: number): NarrativePage[] {
  const size = Math.max(12, Math.floor(capacity));
  const pages: NarrativePage[] = [];
  let current: NarrativePage = [];
  let used = 0;
  const flush = () => { if (current.length) { pages.push(current); current = []; used = 0; } };

  lines.forEach((line, lineIndex) => {
    const chars = Array.from(line);
    if (!chars.length) {
      if (used > 0) flush();
      current.push({ lineIndex, text: '' });
      flush();
      return;
    }
    let cursor = 0;
    while (cursor < chars.length) {
      if (used === size) flush();
      const remaining = size - used;
      let end = Math.min(chars.length, cursor + remaining);
      if (end < chars.length && end - cursor > 12) {
        // Prefer an authored sentence end without producing tiny dangling fragments.
        for (let i = end - 1; i > cursor + Math.floor((end - cursor) / 2); i--) {
          if ('。！？!?；;，,'.includes(chars[i])) { end = i + 1; break; }
        }
      }
      current.push({ lineIndex, text: chars.slice(cursor, end).join('') });
      used += end - cursor;
      cursor = end;
      if (cursor < chars.length) flush();
    }
    // Paragraphs are natural narrative breaks; maintain their boundaries where possible.
    if (used >= size * 0.65) flush();
  });
  flush();
  return pages.length ? pages : [[{ lineIndex: 0, text: '' }]];
}

type Props = {
  lines: string[];
  /** Record identity resets visual pagination, never the game's event clock. */
  recordId: string;
  compact?: boolean;
};

/** Visual-only reading navigation. Does not mark scenes seen, save memories, or advance World Time. */
export function NarrationBeatPager({ lines, recordId, compact = false }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [limits, setLimits] = useState({ width: 0, height: 0 });
  const [pageIndex, setPageIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const target = box.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const width = target.clientWidth, height = target.clientHeight;
      if (width > 0 && height > 0) setLimits(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const capacity = useMemo(() => {
    if (!limits.width || !limits.height) return 72;
    const columns = Math.max(6, Math.floor(limits.width / (compact ? 19 : 20)));
    const rows = Math.max(2, Math.floor((limits.height - 22) / (compact ? 34 : 38)));
    // Leave breathing room around paragraphs and animations.
    return Math.max(12, Math.floor(columns * rows * 0.7));
  }, [limits, compact]);
  const pages = useMemo(() => paginateNarration(lines, capacity), [lines, capacity]);
  const index = Math.min(pageIndex, pages.length - 1);

  useEffect(() => { setPageIndex(0); }, [recordId]);
  const previous = () => setPageIndex(value => Math.max(0, value - 1));
  const next = () => setPageIndex(value => Math.min(pages.length - 1, value + 1));
  const onKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); next(); }
  };

  return <div className="narration-beat-pager" data-testid="narration-beat-pager" data-record-id={recordId} onKeyDown={onKeys}>
    <div ref={box} className="narration-beat-pager__viewport" aria-label="目前故事段落">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={`${recordId}:${index}`} className="narration-beat-pager__page"
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}>
          {pages[index].map((beat, i) => <p key={`${beat.lineIndex}:${i}`}>{beat.text || '\u00A0'}</p>)}
        </motion.div>
      </AnimatePresence>
    </div>
    <nav className="narration-beat-pager__nav" aria-label="故事分段導覽">
      <button type="button" onClick={previous} disabled={index === 0} aria-label="上一段故事">← <span>上一段</span></button>
      <span className="narration-beat-pager__counter" aria-live="polite" aria-label={`第 ${index + 1} 段，共 ${pages.length} 段`}>
        {String(index + 1).padStart(2,'0')} / {String(pages.length).padStart(2,'0')}
      </span>
      <button type="button" onClick={next} disabled={index === pages.length - 1} aria-label="下一段故事"><span>下一段</span> →</button>
    </nav>
  </div>;
}
