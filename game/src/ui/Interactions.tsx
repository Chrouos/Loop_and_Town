import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { DIRECTIONS, type Direction } from '../audio/catalog';
import type { Director, InteractView } from '../engine/director';
import { placeOf } from './geometry';

/** A finger moving faster than this between cells skims past instead of reading. */
const TOO_FAST_MS = 140;
const DONE_LINGER_MS = 900;

export function Interaction({ director, interact }: { director: Director; interact: InteractView }) {
  if (interact.type === 'touch') return <TouchStrip key={interact.key} director={director} interact={interact} />;
  if (interact.type === 'locate') return <LocateRing key={interact.key} director={director} interact={interact} />;
  return <PunchSlate key={interact.key} director={director} interact={interact} />;
}

// ───────────────────────── 摸讀 ─────────────────────────

/** Decorative raised-dot pattern for a cell; the screen shows what her fingertip finds, not a braille lesson. */
function dotsFor(text: string, index: number): number[] {
  let hash = index * 7 + 3;
  for (const char of text) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  const dots = [1, 2, 3, 4, 5, 6].filter((dot) => (hash >> dot) & 1);
  return dots.length ? dots : [1, 4];
}

function TouchStrip({ director, interact }: { director: Director; interact: Extract<InteractView, { type: 'touch' }> }) {
  const [state, setState] = useState<('idle' | 'clear' | 'skim')[]>(() => interact.cells.map(() => 'idle'));
  const lastEnter = useRef<{ index: number; at: number } | null>(null);
  const finished = useRef(false);
  const unreadable = interact.style === 'engrave';
  const next = state.findIndex((cell) => cell !== 'clear');

  const reach = useCallback((index: number, slow: boolean) => {
    setState((current) => {
      const firstOpen = current.findIndex((cell) => cell !== 'clear');
      if (index !== firstOpen) return current;
      const copy = [...current];
      copy[index] = slow ? 'clear' : 'skim';
      director.touchCell(index, slow);
      return copy;
    });
  }, [director]);

  useEffect(() => {
    if (next !== -1 || finished.current) return;
    finished.current = true;
    const timer = window.setTimeout(() => director.touchDone(), DONE_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [director, next]);

  // Keyboard: → or Space reads the next cell, at a careful pace.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        const firstOpen = state.findIndex((cell) => cell !== 'clear');
        if (firstOpen >= 0) reach(firstOpen, true);
      }
    };
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  }, [reach, state]);

  const strip = useRef<HTMLDivElement | null>(null);
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.buttons === 0 && event.type === 'pointermove') return;
    const rects = [...(strip.current?.querySelectorAll<HTMLElement>('[data-cell]') ?? [])].map((cell) => cell.getBoundingClientRect());
    const open = state.findIndex((cell) => cell !== 'clear');
    if (open < 0 || !rects[open]) return;
    const x = event.clientX;
    const index = rects.findIndex((rect) => x >= rect.left && x <= rect.right);
    const now = performance.now();
    // Sliding past the next unread cell without dwelling on it: the fingertip skimmed.
    if ((index > open || (index === -1 && x > rects[open].right)) && lastEnter.current?.index !== open) {
      if (state[open] !== 'skim') reachSkim(open);
      return;
    }
    if (index !== open || lastEnter.current?.index === open) return;
    const previous = lastEnter.current;
    const slow = !previous || previous.index !== open - 1 || now - previous.at >= TOO_FAST_MS;
    lastEnter.current = { index: open, at: now };
    reach(open, slow);
  };
  const reachSkim = (index: number) => {
    lastEnter.current = null;
    reach(index, false);
  };

  const skimmed = state.includes('skim');
  return (
    <div className="lt-interact lt-touch" onPointerUp={(event) => event.stopPropagation()}>
      <div className="lt-interact-prompt">{interact.prompt ?? '用手指從左往右，慢慢摸過去'}</div>
      <div
        ref={strip}
        className={`lt-touch-strip style-${interact.style}`}
        onPointerDown={(event) => { (event.target as HTMLElement).releasePointerCapture?.(event.pointerId); lastEnter.current = null; onMove(event); }}
        onPointerMove={onMove}
        role="group"
        aria-label="摸讀"
      >
        {interact.cells.map((cell, index) => (
          <div key={index} data-cell={index} className={`lt-touch-cell ${state[index]}${index === next ? ' next' : ''}`} onClick={() => reach(index, true)}>
            {interact.style === 'braille'
              ? <div className="lt-dots">{[1, 2, 3, 4, 5, 6].map((dot) => <span key={dot} className={`dot d${dot}${dotsFor(cell, index).includes(dot) ? ' on' : ''}`} />)}</div>
              : <div className="lt-groove" />}
            <div className="lt-touch-char">{state[index] === 'clear' ? (unreadable ? '？' : cell) : ''}</div>
          </div>
        ))}
      </div>
      <div className="lt-interact-note">{skimmed ? '太快了，指尖滑過去什麼都沒留下。慢一點。' : ' '}</div>
    </div>
  );
}

// ───────────────────────── 聽聲辨位 ─────────────────────────

const NUMPAD: Record<string, Direction> = { '8': 'front', '9': 'front-right', '6': 'right', '3': 'back-right', '2': 'back', '1': 'back-left', '4': 'left', '7': 'front-left' };
const KEY_OF: Record<Direction, string> = Object.fromEntries(Object.entries(NUMPAD).map(([key, dir]) => [dir, key])) as Record<Direction, string>;

function LocateRing({ director, interact }: { director: Director; interact: Extract<InteractView, { type: 'locate' }> }) {
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const dir = NUMPAD[event.key];
      if (!dir) return;
      event.preventDefault();
      event.stopPropagation();
      director.locatePick(dir);
    };
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  }, [director]);
  return (
    <div className="lt-interact lt-locate" onPointerUp={(event) => event.stopPropagation()}>
      <div className="lt-locate-prompt">{interact.prompt ?? '聲音在哪裡？'}</div>
      {DIRECTIONS.map((dir) => {
        const place = placeOf({ dir, dist: 'mid' });
        const wrong = interact.wrong.includes(dir);
        return (
          <button
            key={dir}
            type="button"
            className={`lt-locate-spot${wrong ? ' wrong' : ''}`}
            style={{ left: place.left, top: place.top }}
            aria-label={`指向${LABEL[dir]}`}
            disabled={wrong}
            onClick={(event) => { event.stopPropagation(); director.locatePick(dir); }}
          >
            <span className="lt-locate-dot" />
            <span className="lt-locate-key">{KEY_OF[dir]}</span>
          </button>
        );
      })}
      {interact.hint && <div className="lt-interact-note lt-locate-note">再聽一次。</div>}
    </div>
  );
}

const LABEL: Record<Direction, string> = {
  front: '前方', 'front-right': '右前方', right: '右邊', 'back-right': '右後方', back: '後方', 'back-left': '左後方', left: '左邊', 'front-left': '左前方',
};

// ───────────────────────── 點字板 ─────────────────────────

/** On a slate you punch from the back, so each cell's left and right columns swap. */
const MIRROR: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3 };

function PunchSlate({ director, interact }: { director: Director; interact: Extract<InteractView, { type: 'punch' }> }) {
  // Punching order is right to left on the back of the page: the last cell read is punched first.
  const order = [...interact.cells].reverse().map((cell) => cell.map((dot) => MIRROR[dot]).sort());
  const [punched, setPunched] = useState<number[][]>(() => order.map(() => []));
  const [cellIndex, setCellIndex] = useState(0);
  const finished = useRef(false);
  const done = cellIndex >= order.length;

  useEffect(() => {
    if (!done || finished.current) return;
    finished.current = true;
    const timer = window.setTimeout(() => director.punchDone(), DONE_LINGER_MS + 600);
    return () => window.clearTimeout(timer);
  }, [director, done]);

  const press = (dot: number) => {
    if (done) return;
    const target = order[cellIndex];
    if (!target.includes(dot) || punched[cellIndex].includes(dot)) return;
    director.punchDot();
    const nextPunched = punched.map((cell, index) => (index === cellIndex ? [...cell, dot] : cell));
    setPunched(nextPunched);
    if (target.every((needed) => nextPunched[cellIndex].includes(needed))) setCellIndex(cellIndex + 1);
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!/^[1-6]$/.test(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      press(Number(event.key));
    };
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  });

  return (
    <div className="lt-interact lt-punch" onPointerUp={(event) => event.stopPropagation()}>
      <div className="lt-interact-prompt">{interact.prompt ?? '點字板要從背面打，左右是反的'}</div>
      <div className="lt-punch-row">
        {order.map((cell, index) => (
          <div key={index} className={`lt-punch-cell${index === cellIndex ? ' active' : ''}${index < cellIndex ? ' done' : ''}`}>
            {[1, 2, 3, 4, 5, 6].map((dot) => {
              const needed = cell.includes(dot);
              const isPunched = punched[index].includes(dot);
              return (
                <button
                  key={dot}
                  type="button"
                  className={`lt-punch-dot d${dot}${needed ? ' needed' : ''}${isPunched ? ' punched' : ''}`}
                  aria-label={`第 ${dot} 點`}
                  disabled={index !== cellIndex}
                  onClick={(event) => { event.stopPropagation(); press(dot); }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="lt-interact-note">{done ? interact.label ?? ' ' : '輕輕壓下去，紙的另一面會凸起來'}</div>
    </div>
  );
}
