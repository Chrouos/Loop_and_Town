import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { DIRECTIONS, type Direction } from '../audio/catalog';
import type { Director, InteractView } from '../engine/director';
import { placeOf } from './geometry';

/** A finger moving faster than this between cells skims past instead of reading. */
const TOO_FAST_MS = 140;
const DONE_LINGER_MS = 900;

/**
 * What the player last used: a key or a pointer (mouse, finger, pen). Written to <html data-input>, so key hints
 * (the locate spots' ↑ 8 W) show only to someone on a keyboard, and focus is moved only for them (Stage's choices).
 */
export type InputKind = 'key' | 'pointer';
let lastInputKind: InputKind = 'pointer';
let tracking = false;
export function lastInput(): InputKind { return lastInputKind; }
export function trackInput() {
  if (tracking || typeof window === 'undefined') return;
  tracking = true;
  const set = (kind: InputKind) => {
    lastInputKind = kind;
    if (document.documentElement.dataset.input !== kind) document.documentElement.dataset.input = kind;
  };
  window.addEventListener('keydown', () => set('key'), true);
  window.addEventListener('pointerdown', () => set('pointer'), true);
}
trackInput();

/** What each moment says when the script gives no prompt of its own. */
export const DEFAULT_PROMPT: Record<InteractView['type'], string> = {
  touch: '用手指從左往右，慢慢摸過去',
  locate: '聲音在哪裡？',
  approach: '等聲音到面前，再開口',
  hold: '按住，慢慢吐氣',
  punch: '點字板要從背面打，左右是反的',
};

/**
 * Said once, the first time each of these moments comes (or on a line that writes `teach: locate` before it).
 * Plain and about the sound, the way someone beside her would say it.
 */
export const INTERACT_LESSON: Record<'locate' | 'approach' | 'hold', string> = {
  locate: '聲音會一直響。聽它從哪一邊來，就點那一邊。',
  approach: '腳步會越來越近。等到最近的那一兩步，再開口。',
  hold: '按住不要放，慢慢把氣吐掉。撐久一點，很小的聲音才聽得到。',
};

/** The lesson, under the moment it is about. */
function Lesson({ type }: { type: keyof typeof INTERACT_LESSON }) {
  return <div className="lt-interact-lesson" role="status">{INTERACT_LESSON[type]}</div>;
}

/** A key typed into an open dialog (the menu, her memories) is not this moment's. */
function inDialog(event: KeyboardEvent): boolean {
  return event.target instanceof Element && event.target.closest('[role="dialog"]') !== null;
}

/** Space / Enter on a control elsewhere on screen (the menu dot, a sound) belong to that control. */
function onOtherControl(event: KeyboardEvent): boolean {
  if (inDialog(event)) return true;
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(target && !target.closest('.lt-interact') && target.matches('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="switch"]'));
}

export function Interaction({ director, interact }: { director: Director; interact: InteractView }) {
  if (interact.type === 'touch') return <TouchStrip key={interact.key} director={director} interact={interact} />;
  if (interact.type === 'locate') return <LocateRing key={interact.key} director={director} interact={interact} />;
  if (interact.type === 'approach') return <ApproachCall key={interact.key} director={director} interact={interact} />;
  if (interact.type === 'hold') return <HoldBreath key={interact.key} director={director} interact={interact} />;
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
        if (onOtherControl(event)) return;
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
      <div className="lt-interact-prompt">{interact.prompt ?? DEFAULT_PROMPT.touch}</div>
      <div
        ref={strip}
        className={`lt-touch-strip style-${interact.style}`}
        onPointerDown={(event) => { (event.target as HTMLElement).releasePointerCapture?.(event.pointerId); lastEnter.current = null; onMove(event); }}
        onPointerMove={onMove}
        role="group"
        aria-label="摸讀"
      >
        {interact.cells.map((cell, index) => (
          <div
            key={index}
            data-cell={index}
            className={`lt-touch-cell ${state[index]}${index === next ? ' next' : ''}`}
            role="button"
            aria-label={state[index] === 'clear' ? cell : `第 ${index + 1} 格`}
            aria-disabled={index !== next}
            onClick={() => reach(index, true)}
          >
            {interact.style === 'braille'
              ? <div className="lt-dots">{[1, 2, 3, 4, 5, 6].map((dot) => <span key={dot} className={`dot d${dot}${dotsFor(cell, index).includes(dot) ? ' on' : ''}`} />)}</div>
              : <div className="lt-groove" />}
            <div className="lt-touch-char">{state[index] === 'clear' ? cell : ''}</div>
          </div>
        ))}
      </div>
      <div className="lt-interact-note" aria-live="polite">{skimmed ? '太快了，沒讀懂' : ' '}</div>
    </div>
  );
}

// ───────────────────────── 聽聲辨位 ─────────────────────────

const NUMPAD: Record<string, Direction> = { '8': 'front', '9': 'front-right', '6': 'right', '3': 'back-right', '2': 'back', '1': 'back-left', '4': 'left', '7': 'front-left' };
const KEY_OF: Record<Direction, string> = Object.fromEntries(Object.entries(NUMPAD).map(([key, dir]) => [dir, key])) as Record<Direction, string>;
/** The same keypad by its physical keys, so it works with Num Lock off too (then 8 sends ↑, 7 sends Home). */
const NUMPAD_CODE: Record<string, Direction> = Object.fromEntries(Object.entries(NUMPAD).map(([key, dir]) => [`Numpad${key}`, dir]));
/** Q W E / A · D / Z X C: the letter keys round S, by where they sit on the keyboard (S is where she stands, so nothing). */
const LETTER_OF: Record<Direction, string> = { 'front-left': 'Q', front: 'W', 'front-right': 'E', left: 'A', right: 'D', 'back-left': 'Z', back: 'X', 'back-right': 'C' };
const LETTER_CODE: Record<string, Direction> = Object.fromEntries(Object.entries(LETTER_OF).map(([dir, letter]) => [`Key${letter}`, dir as Direction]));
const LETTER_KEY: Record<string, Direction> = Object.fromEntries(Object.entries(LETTER_OF).map(([dir, letter]) => [letter.toLowerCase(), dir as Direction]));
const ARROW: Record<string, Direction> = { ArrowUp: 'front', ArrowRight: 'right', ArrowDown: 'back', ArrowLeft: 'left' };
const ARROW_GLYPH: Partial<Record<Direction, string>> = { front: '↑', right: '→', back: '↓', left: '←' };
/** Two arrows pressed within this long of each other point between them (↑ + → = front-right). */
export const ARROW_CHORD_MS = 150;
const BETWEEN: Record<string, Direction> = { 'front|right': 'front-right', 'back|right': 'back-right', 'back|left': 'back-left', 'front|left': 'front-left' };
/** The diagonal two arrows make together; none for the same arrow twice or opposite arrows. */
export function arrowChord(a: Direction, b: Direction): Direction | null {
  return BETWEEN[`${a}|${b}`] ?? BETWEEN[`${b}|${a}`] ?? null;
}
const SHORTCUT_ARROWS: Record<Direction, string> = {
  front: 'ArrowUp', 'front-right': 'ArrowUp+ArrowRight', right: 'ArrowRight', 'back-right': 'ArrowDown+ArrowRight',
  back: 'ArrowDown', 'back-left': 'ArrowDown+ArrowLeft', left: 'ArrowLeft', 'front-left': 'ArrowUp+ArrowLeft',
};

/** A direction from the keypad or the letters round S; arrows are read on their own (they can chord). */
export function keyedDirection(event: Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey'>): Direction | undefined {
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
  return NUMPAD_CODE[event.code] ?? NUMPAD[event.key] ?? LETTER_CODE[event.code] ?? LETTER_KEY[event.key.toLowerCase()];
}

function LocateRing({ director, interact }: { director: Director; interact: Extract<InteractView, { type: 'locate' }> }) {
  // An arrow waits a moment for a second one, so ↑ and → pressed together are one turn to the front-right.
  const pendingArrow = useRef<{ dir: Direction; timer: number } | null>(null);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (inDialog(event)) return;
      const keyed = keyedDirection(event);
      const arrow = keyed ? undefined : ARROW[event.key];
      if (!keyed && !arrow) return;
      // Only while she is pointing: these arrows are hers, not the answers' or the page's.
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (keyed) { director.locatePick(keyed); return; }
      const held = pendingArrow.current;
      if (held) {
        window.clearTimeout(held.timer);
        pendingArrow.current = null;
        const between = arrowChord(held.dir, arrow!);
        if (between) { director.locatePick(between); return; }
      }
      const timer = window.setTimeout(() => { pendingArrow.current = null; director.locatePick(arrow!); }, ARROW_CHORD_MS);
      pendingArrow.current = { dir: arrow!, timer };
    };
    window.addEventListener('keydown', down, true);
    return () => {
      window.removeEventListener('keydown', down, true);
      if (pendingArrow.current) window.clearTimeout(pendingArrow.current.timer);
      pendingArrow.current = null;
    };
  }, [director]);
  return (
    <div className="lt-interact lt-locate" onPointerUp={(event) => event.stopPropagation()}>
      <div className="lt-locate-prompt">{interact.prompt ?? DEFAULT_PROMPT.locate}</div>
      {interact.lesson && <Lesson type="locate" />}
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
            aria-keyshortcuts={`${SHORTCUT_ARROWS[dir]} ${KEY_OF[dir]} ${LETTER_OF[dir]}`}
            disabled={wrong}
            onClick={(event) => { event.stopPropagation(); director.locatePick(dir); }}
          >
            <span className="lt-locate-dot" />
            <span className="lt-locate-key" aria-hidden="true">{[ARROW_GLYPH[dir], KEY_OF[dir], LETTER_OF[dir]].filter(Boolean).join(' ')}</span>
          </button>
        );
      })}
      <div className="lt-interact-note lt-locate-note" aria-live="polite">{interact.hint ? '再聽一次' : ''}</div>
    </div>
  );
}

const LABEL: Record<Direction, string> = {
  front: '前方', 'front-right': '右前方', right: '右邊', 'back-right': '右後方', back: '後方', 'back-left': '左後方', left: '左邊', 'front-left': '左前方',
};

// ───────────────────────── 聽距離 ─────────────────────────

/** The whole screen is her mouth: tap anywhere (or Space / Enter) to speak up when the steps reach her. */
function ApproachCall({ director, interact }: { director: Director; interact: Extract<InteractView, { type: 'approach' }> }) {
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.key !== ' ' && event.key !== 'Enter') || onOtherControl(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) director.approachCall();
    };
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  }, [director]);
  return (
    <div className="lt-interact lt-approach" onPointerUp={(event) => event.stopPropagation()}>
      <button type="button" className="lt-approach-pad" aria-label="開口" onClick={(event) => { event.stopPropagation(); director.approachCall(); }} />
      <div className="lt-locate-prompt">{interact.prompt ?? DEFAULT_PROMPT.approach}</div>
      {interact.lesson && <Lesson type="approach" />}
      <div className="lt-interact-note lt-locate-note">點一下畫面開口</div>
    </div>
  );
}

// ───────────────────────── 屏息 ─────────────────────────

/** Press and hold anywhere (or Space) and keep holding: her breath slows, the room drops away, a small sound comes through. */
function HoldBreath({ director, interact }: { director: Director; interact: Extract<InteractView, { type: 'hold' }> }) {
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if ((event.key !== ' ' && event.key !== 'Enter') || onOtherControl(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) director.holdStart();
    };
    const up = (event: KeyboardEvent) => {
      if ((event.key !== ' ' && event.key !== 'Enter') || onOtherControl(event)) return;
      event.preventDefault();
      director.holdEnd();
    };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    return () => { window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); };
  }, [director]);
  const holding = interact.since !== null;
  return (
    <div className={`lt-interact lt-hold${holding ? ' holding' : ''}`} onPointerUp={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="lt-hold-pad"
        aria-label="按住，慢慢吐氣"
        onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId); director.holdStart(); }}
        onPointerUp={(event) => { event.stopPropagation(); director.holdEnd(); }}
        onPointerCancel={() => director.holdEnd()}
        onContextMenu={(event) => event.preventDefault()}
      />
      <div className="lt-locate-prompt">{interact.prompt ?? DEFAULT_PROMPT.hold}</div>
      {interact.lesson && <Lesson type="hold" />}
      <div className="lt-hold-breath" key={interact.since ?? 'idle'} style={{ animationDuration: `${interact.seconds}s` }} aria-hidden="true" />
      <div className="lt-interact-note lt-locate-note" aria-live="polite">{holding ? '不要放開' : '按住畫面不要放'}</div>
    </div>
  );
}

// ───────────────────────── 點字板 ─────────────────────────

/** On a slate you punch from the back, so each cell's left and right columns swap. */
const MIRROR: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 1, 5: 2, 6: 3 };

function PunchSlate({ director, interact }: { director: Director; interact: Extract<InteractView, { type: 'punch' }> }) {
  // Punching order is right to left on the back of the page: the last cell read is punched first.
  const order = [...interact.cells].reverse().map((cell) => cell.map((dot) => MIRROR[dot]).sort());
  const [punched, setPunched] = useState<number[][]>(() => order.map(() => []));
  const [cellIndex, setCellIndex] = useState(0);
  // The last press found a dot this cell does not need (said in the note, so a screen reader hears it too).
  const [missed, setMissed] = useState(false);
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
    if (punched[cellIndex].includes(dot)) return;
    if (!target.includes(dot)) { director.punchMiss(); setMissed(true); return; }
    setMissed(false);
    director.punchDot();
    const nextPunched = punched.map((cell, index) => (index === cellIndex ? [...cell, dot] : cell));
    setPunched(nextPunched);
    if (target.every((needed) => nextPunched[cellIndex].includes(needed))) setCellIndex(cellIndex + 1);
  };

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (!/^[1-6]$/.test(event.key) || inDialog(event)) return;
      event.preventDefault();
      event.stopPropagation();
      press(Number(event.key));
    };
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  });

  return (
    <div className="lt-interact lt-punch" onPointerUp={(event) => event.stopPropagation()}>
      <div className="lt-interact-prompt">{interact.prompt ?? DEFAULT_PROMPT.punch}</div>
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
                  aria-label={`第 ${dot} 點${needed && !isPunched ? '，要打' : ''}`}
                  aria-pressed={isPunched}
                  disabled={index !== cellIndex}
                  onClick={(event) => { event.stopPropagation(); press(dot); }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="lt-interact-note" aria-live="polite">{done ? interact.label ?? ' ' : missed ? '這一點不用打' : '輕輕壓下去，紙的另一面會凸起來'}</div>
    </div>
  );
}
