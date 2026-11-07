import { Fragment, cloneElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactElement, type RefObject } from 'react';
import { ECHO_MS, type Card, type CenterLine, type Director, type InteractView, type Peripheral, type View } from '../engine/director';
import { interpolateClock, leanOf, placeLabel, type Box } from './geometry';
import { DEFAULT_PROMPT, INTERACT_LESSON, Interaction, lastInput } from './Interactions';
import type { Pos } from '../script/types';
import { FONT_SIZES } from '../engine/save';
import { gluePunctuation, type Phrase } from '../engine/text';

const HOLD_MS = 560;
/** The largest text scale a phone-sized stage takes (the same cap as --ts in game.css). */
const SMALL_SCREEN_SCALE = 1.4;
/** Narrower than this, turning toward a sound folds the main conversation out of its way. */
const NARROW_PX = 600;
const MOVE_MS = 700;
const LEAVE_MS = 420;
const GONE_MS = 480;
/** How long the screen takes to clear after a daze (matches .lt-daze.clearing in game.css). */
const DAZE_CLEAR_MS = 4100;
// Lifts off from standstill and settles slowly: no kick on the first frame, and a slide stacked on one still
// under way adds to its speed instead of jolting it.
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

type Role = 'center' | 'away' | 'echo' | 'leaving';

// ───────────────────────── keyboard and screen readers ─────────────────────────

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** What a key press may land on and should act on by itself (Space / Enter activate it natively). */
export const CONTROL = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="switch"]';

/** `inert` as a plain attribute: React 18 does not know it, and a boolean would be dropped. */
export function inertProps(on: boolean): Record<string, string> {
  return on ? { inert: '' } : {};
}

/** Open dialogs, oldest first: only the top one keeps Tab inside itself. */
const openDialogs: HTMLElement[] = [];

function focusablesIn(box: HTMLElement): HTMLElement[] {
  // A roving list (the menu's tabs) leaves only its current item in the Tab order.
  return [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getAttribute('tabindex') !== '-1' && !el.closest('[inert], [aria-hidden="true"]'));
}

/**
 * A modal dialog: focus moves in when it opens (to `initial`, else its first control, else the dialog itself),
 * Tab and Shift+Tab go round inside it, and focus goes back to where it was once it closes.
 */
export function useModal(ref: RefObject<HTMLElement>, initial?: string): void {
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const before = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    openDialogs.push(box);
    const first = (initial ? box.querySelector<HTMLElement>(initial) : null) ?? focusablesIn(box)[0] ?? box;
    first.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || openDialogs[openDialogs.length - 1] !== box) return;
      event.preventDefault();
      const list = focusablesIn(box);
      if (!list.length) { box.focus({ preventScroll: true }); return; }
      const at = list.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (at <= 0 ? list.length - 1 : at - 1) : (at === -1 || at === list.length - 1 ? 0 : at + 1);
      list[next].focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openDialogs.splice(openDialogs.indexOf(box), 1);
      // After the commit, once whatever was behind the dialog is no longer inert; never pulls focus from a new home.
      window.setTimeout(() => {
        const now = document.activeElement;
        const lost = !now || now === document.body || !now.isConnected;
        if (lost && before?.isConnected && !before.closest('[inert]')) before.focus({ preventScroll: true });
      }, 0);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Focus moved onto a list the moment it appeared: a key still held (or pressed again at once) from what came
 * before must not pick its first item. Pointer clicks are never held back.
 */
function useFreshGuard(key: unknown, ms = 600): (event: { detail: number }) => boolean {
  const shownAt = useRef(0);
  useEffect(() => { shownAt.current = performance.now(); }, [key]);
  return (event) => event.detail === 0 && performance.now() - shownAt.current < ms;
}

/** Up and down arrows move between the buttons of a list, wrapping round. */
export function arrowsBetween(event: ReactKeyboardEvent<HTMLElement>, selector: string) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>(selector)].filter((el) => !(el as HTMLButtonElement).disabled);
  if (!items.length) return;
  event.preventDefault();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const down = event.key === 'ArrowDown';
  // From the list itself (nothing in it focused yet): down is the first item, up the last.
  const next = at === -1 ? (down ? 0 : items.length - 1) : (at + (down ? 1 : -1) + items.length) % items.length;
  items[next].focus();
}

const INTERACT_HELP: Record<InteractView['type'], string> = {
  touch: '用鍵盤的話，按右方向鍵或空白鍵，一格一格摸過去',
  locate: '聽完之後，選聲音傳來的方向。鍵盤可以用方向鍵，兩個一起按是斜的；也可以用數字鍵，或 Q W E、A D、Z X C',
  approach: '聲音到面前時，按空白鍵或點畫面開口',
  hold: '按住空白鍵或畫面不放',
  punch: '用數字鍵 1 到 6 打點',
};

/** What a choice says to a screen reader: every option, in order, with the ones she cannot take marked. */
function choiceAnnouncement(choice: NonNullable<View['choice']>): string {
  const options = choice.options.map((option, index) => `${index + 1}，${unstop(option.text)}${option.disabled ? '（已經做過了）' : ''}`).join('。');
  return `要回答了${choice.timeout ? '，時間有限' : ''}：${options}`;
}

function cardAnnouncement(card: Card, phase: View['phase']): string {
  const parts = phase === 'reset' ? [card.mark, card.loopText] : [card.chapter, card.title, card.time, card.place, card.loopText, card.recap?.memory];
  return parts.filter(Boolean).join('，');
}

/**
 * One polite voice for what happens around the lines (a question, a new place, a new day, a task for her hands),
 * so each is said once. The lines themselves have their own region.
 */
function useAnnouncer(view: View): string {
  const [said, setSaid] = useState('');
  const cardSaid = useRef<string | undefined>(undefined);
  const lastPlace = useRef<string | undefined>(view.place);
  const choiceKey = view.choice && view.focus === 'main' ? view.choice.key : null;
  const carded = (view.phase === 'card' || view.phase === 'reset') && view.card ? view.card : null;
  useEffect(() => {
    if (choiceKey === null || !view.choice) return;
    setSaid(choiceAnnouncement(view.choice));
  }, [choiceKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!carded) return;
    cardSaid.current = carded.place ?? cardSaid.current;
    lastPlace.current = view.place;
    setSaid(cardAnnouncement(carded, view.phase));
  }, [carded]); // eslint-disable-line react-hooks/exhaustive-deps
  // A place reached without a card (a continuous scene) is said on its own; one the card just said is not.
  useEffect(() => {
    if (!view.place || view.place === lastPlace.current) return;
    lastPlace.current = view.place;
    if (view.place !== cardSaid.current) setSaid([view.clock, view.place].filter(Boolean).join('，'));
  }, [view.place]); // eslint-disable-line react-hooks/exhaustive-deps
  const interactKey = view.interact?.key;
  useEffect(() => {
    if (!view.interact) return;
    setSaid(`${view.interact.prompt ?? DEFAULT_PROMPT[view.interact.type]}。${INTERACT_HELP[view.interact.type]}`);
  }, [interactKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return said;
}

// An echo pushed out by the next one stays mounted briefly so it can fade from wherever it was.
function useLeaving(echo: CenterLine | null, centerKey: number | undefined): CenterLine[] {
  const [prev, setPrev] = useState(echo);
  const [leaving, setLeaving] = useState<CenterLine[]>([]);
  if (echo?.key !== prev?.key) {
    setPrev(echo);
    if (prev) setLeaving((list) => [...list.filter((line) => line.key !== prev.key), prev]);
  }
  useEffect(() => {
    if (!leaving.length) return;
    const timer = window.setTimeout(() => setLeaving([]), LEAVE_MS + 80);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  return leaving.filter((line) => line.key !== echo?.key && line.key !== centerKey);
}

// Whatever the director drops from the view stays mounted a moment, marked .gone, so it can fade from where it was.
function useLinger<T>(value: T | null, ms = GONE_MS + 80): [T | null, boolean] {
  const [last, setLast] = useState(value);
  if (value !== null && value !== last) setLast(value);
  useEffect(() => {
    if (value !== null || last === null) return;
    const timer = window.setTimeout(() => setLast(null), ms);
    return () => window.clearTimeout(timer);
  }, [value, last, ms]);
  return value !== null ? [value, false] : [last, last !== null];
}

// Same for the periphery, keeping the old order so no element is moved (a moved node restarts its CSS animations).
type Departing = { item: Peripheral; gone: boolean; goneAt?: number };
function useDeparting(items: Peripheral[]): Departing[] {
  const [state, setState] = useState(() => ({ items, list: items.map((item): Departing => ({ item, gone: false })) }));
  let list = state.list;
  if (state.items !== items) {
    const live = new Map(items.map((item) => [item.key, item]));
    const now = performance.now();
    list = state.list.map((entry) => live.has(entry.item.key) ? { item: live.get(entry.item.key)!, gone: false }
      : entry.gone ? entry : { item: entry.item, gone: true, goneAt: now });
    const known = new Set(state.list.map((entry) => entry.item.key));
    list.push(...items.filter((item) => !known.has(item.key)).map((item) => ({ item, gone: false })));
    setState({ items, list });
  }
  const anyGone = list.some((entry) => entry.gone);
  // Swept on a steady beat, so a busy scene that keeps changing still lets faded ones go.
  useEffect(() => {
    if (!anyGone) return;
    const timer = window.setInterval(() => {
      const cutoff = performance.now() - GONE_MS - 80;
      setState((current) => current.list.some((entry) => entry.gone && entry.goneAt! <= cutoff)
        ? { ...current, list: current.list.filter((entry) => !entry.gone || entry.goneAt! > cutoff) }
        : current);
    }, 250);
    return () => window.clearInterval(timer);
  }, [anyGone]);
  return list;
}

function fadeAway(el: HTMLElement) {
  el.dataset.fading = '';
  if (!el.animate) return;
  const style = getComputedStyle(el);
  el.animate(
    [{ opacity: style.opacity, filter: style.filter === 'none' ? 'blur(0px)' : style.filter }, { opacity: 0, filter: 'blur(3px)' }],
    { duration: GONE_MS, easing: 'ease-out', fill: 'forwards' },
  );
}

// Sounds are placed once, measured, the moment they appear: around what she is reading, never on top of it.
// Already placed ones stay put (unless the screen changed size) and count as taken.
function placeSounds(root: HTMLElement, periph: Peripheral[], ripples: View['ripples'], turn: Pos | null, again: boolean, textScale: number) {
  const W = root.clientWidth;
  const H = root.clientHeight;
  const origin = root.getBoundingClientRect();
  const gap = 14;
  // A long line on a narrow screen runs past where the choices start: let the choices step down below it.
  const choices = root.querySelector<HTMLElement>('.lt-choices');
  const said = root.querySelector('.lt-center .lt-line:not(.lt-echo) .lt-text');
  if (choices) {
    choices.style.top = '';
    choices.classList.remove('tight');
    // Never lifted onto what she is reading, nor onto the echo above it.
    const lines = [...root.querySelectorAll('.lt-center .lt-line:not(.leaving) .lt-text')].map((el) => el.getBoundingClientRect().bottom - origin.top + 28);
    const floor = Math.max(H * 0.18, ...lines);
    // Every option should be seen at once: below the line if it fits, else lifted toward it, else in tighter rows.
    // Only a list that still cannot fit is left to scroll.
    const settle = () => {
      const top = Math.max(choices.getBoundingClientRect().top - origin.top, said ? floor : 0);
      const need = choices.scrollHeight;
      const lifted = Math.min(top, Math.max(floor, H - 16 - need));
      choices.style.top = `${lifted}px`;
      return H - 16 - lifted >= need;
    };
    if (!settle()) {
      choices.style.top = '';
      choices.classList.add('tight');
      settle();
    }
    choices.style.maxHeight = `${Math.max(0, H - (choices.getBoundingClientRect().top - origin.top) - 16)}px`;
  }
  const boxOf = (el: Element, pad = gap): Box => {
    const r = el.getBoundingClientRect();
    return { l: r.left - origin.left - pad, t: r.top - origin.top - pad, r: r.right - origin.left + pad, b: r.bottom - origin.top + pad };
  };
  // Room for a typical three-row line with its label and echo, even before a longer one arrives.
  const lineH = Math.min(Math.max(18.4, 0.023 * W), 25.6) * 1.85 * textScale;
  const halfW = Math.min(0.38 * W, 340);
  const keepOut: Box[] = [{ l: W / 2 - halfW - gap, r: W / 2 + halfW + gap, t: H / 2 - 3.5 * lineH - 30, b: H / 2 + 1.5 * lineH + 26 + gap }];
  root.querySelectorAll('.lt-center .lt-line:not(.leaving) .lt-text, .lt-center .lt-line:not(.leaving) .lt-label, .lt-teach-keep, .lt-choice, .lt-choice-teach, .lt-wait, .lt-where').forEach((el) => keepOut.push(boxOf(el)));
  document.querySelectorAll('.lt-corner, .lt-mem-btn, .lt-mem-teach').forEach((el) => keepOut.push(boxOf(el)));

  // Measured things only (not the room kept for a longer line), unpadded: a label merely brushing the margin stays put.
  const fixed = keepOut.length;
  // What she turned toward is written beside its sound: new sounds keep off it, but it never pushes that sound away.
  root.querySelectorAll('.lt-side .lt-line:not(.leaving) .lt-text').forEach((el) => keepOut.push(boxOf(el)));
  const hits = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const byKey = new Map(periph.map((item) => [String(item.key), item]));
  const centres = new Map<Pos, { x: number; y: number }>();
  root.querySelectorAll<HTMLElement>('.lt-p[data-key]').forEach((el) => {
    const item = byKey.get(el.dataset.key!);
    if (!item) return;
    // Already placed, but the choices (or a longer line) have since landed on it: it slides aside.
    const live = !el.classList.contains('gone');
    const crowdedOut = live && el.dataset.placed !== undefined && !again && keepOut.slice(1, fixed)
      .some((box) => hits(boxOf(el, 0), { l: box.l + gap, t: box.t + gap, r: box.r - gap, b: box.b - gap }));
    if (crowdedOut) el.style.transition = 'left 450ms var(--ease), top 450ms var(--ease)';
    if (again || crowdedOut || el.dataset.placed === undefined) {
      const { x, y, crowded } = placeLabel(item.pos, el.offsetWidth, el.offsetHeight, W, H, keepOut);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      // Strangers' talk is only colour: with no room left it is heard, not written over what she is reading.
      el.classList.toggle('crowded', Boolean(crowded) && item.kind === 'life');
      el.dataset.placed = '';
    }
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    centres.set(item.pos, { x, y });
    // One already fading out is about to be gone; it does not hold its spot.
    if (!el.classList.contains('gone')) {
      keepOut.push({ l: x - el.offsetWidth / 2 - 6, r: x + el.offsetWidth / 2 + 6, t: y - el.offsetHeight / 2 - 6, b: y + el.offsetHeight / 2 + 6 });
      // The hint hanging under a cue is outside its box; strangers' talk must not land on it either.
      const hint = el.querySelector<HTMLElement>('.lt-hint');
      if (hint) keepOut.push({ l: x - hint.offsetWidth / 2 - 6, r: x + hint.offsetWidth / 2 + 6, t: y + el.offsetHeight / 2 - 6, b: y + el.offsetHeight / 2 + hint.offsetHeight + 10 });
    }
  });

  // A ripple rises where its sound's word is; a voice without a word gets a spot of its own.
  const ripplePos = new Map(ripples.map((ripple) => [String(ripple.key), ripple.pos]));
  root.querySelectorAll<HTMLElement>('.lt-ripple[data-key]').forEach((el) => {
    if (!again && el.dataset.placed !== undefined) return;
    const pos = ripplePos.get(el.dataset.key!);
    if (!pos) return;
    const at = centres.get(pos) ?? placeLabel(pos, 64, 40, W, H, keepOut);
    el.style.left = `${at.x}px`;
    el.style.top = `${at.y}px`;
    el.dataset.placed = '';
  });
  // A cue's hint ("tap here", "tap again") is wider than the word it hangs under: keep it on screen.
  root.querySelectorAll<HTMLElement>('.lt-p.kind-cue[data-placed]').forEach((el) => {
    const x = parseFloat(el.style.left);
    el.querySelectorAll<HTMLElement>('.lt-hint').forEach((hint) => {
      const half = hint.offsetWidth / 2;
      const shift = Math.max(0, 12 - (x - half)) - Math.max(0, x + half - (W - 12));
      hint.style.marginLeft = shift ? `${shift}px` : '';
    });
  });
  const glow = root.querySelector<HTMLElement>('.lt-turn');
  const at = turn ? centres.get(turn) : undefined;
  if (glow && at) { glow.style.left = `${at.x}px`; glow.style.top = `${at.y}px`; }
}

// Beside the sound it comes from: above it in the lower half of the screen, below it in the upper half, flush with
// its outer edge, and never off screen. Once that sound has gone, the box stays where it was while it fades.
const SIDE_MARGIN = 16;

/**
 * Returns whether the box, placed by its sound, lies over the main line: then the blurred main line steps back
 * further (.side-over) rather than the box being moved away from the sound it belongs to.
 */
function placeSide(root: HTMLElement, box: HTMLElement, cue: HTMLElement | null): boolean {
  if (!cue || cue.dataset.placed === undefined) return false;
  const W = root.clientWidth;
  const H = root.clientHeight;
  const margin = SIDE_MARGIN;
  const x = parseFloat(cue.style.left);
  const y = parseFloat(cue.style.top);
  const w = box.offsetWidth;
  const align = x < W * 0.4 ? 'left' : x > W * 0.6 ? 'right' : 'middle';
  const left = align === 'left' ? x - cue.offsetWidth / 2 : align === 'right' ? x + cue.offsetWidth / 2 - w : x - w / 2;
  box.style.left = `${Math.min(Math.max(left, margin), W - w - margin)}px`;
  box.dataset.align = align;
  const below = y < H / 2;
  box.style.top = below ? `${y + cue.offsetHeight / 2 + 10}px` : '';
  box.style.bottom = below ? '' : `${Math.max(margin, H - (y - cue.offsetHeight / 2 - 10))}px`;
  const main = root.querySelector<HTMLElement>('.lt-center-inner .lt-line');
  if (!main) return false;
  const a = box.getBoundingClientRect();
  const b = main.getBoundingClientRect();
  return a.width > 0 && b.width > 0 && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * One beat on screen, from how hard it sounds (0–1): the red at the edges peaks and settles higher the harder it
 * beats, and from about a racing heart up the stage jolts by whole pixels (1px at a time as it climbs or calms).
 */
/**
 * The screen never draws a full stop (docs/style.md): one at the end of a line, or just before its closing
 * bracket, is dropped; one inside becomes a breath (a full-width space). The centre lines get this from
 * engine/text.ts; strangers' talk, choices and remembered lines get it here.
 */
export function unstop(text: string): string {
  return text
    .replace(/。+(?=[」』）]*$)/u, '')
    .replace(/。+(?=[」』）])/gu, '')
    .replace(/。+/gu, '\u3000')
    .trim();
}

function heartPulse(glow: number, ms: number): { glow: CSSProperties; jolt: CSSProperties | null } {
  const beat = `${Math.round(Math.min(ms, 1000))}ms`;
  const jolt = Math.max(0, Math.round((glow - 0.45) * 7.3));
  return {
    glow: { ['--hi' as string]: Math.pow(glow, 1.5).toFixed(3), ['--lo' as string]: (Math.max(0, glow - 0.45) * 0.76).toFixed(3), ['--beat' as string]: beat },
    jolt: jolt > 0 ? { ['--jolt' as string]: `${-jolt}px`, ['--dub' as string]: `${Math.round(jolt / 2)}px`, ['--beat' as string]: beat } : null,
  };
}

type Props = {
  director: Director; view: View; onCapture: () => void; firstCueHint: boolean; onCueHintShown: () => void;
  /** A dialog (the menu, her memories) is open over the stage: nothing here can be reached. */
  blocked?: boolean;
  /** Keep what she is hearing, without a long press (the 記住這句 button); defaults to a plain capture. */
  onKeep?: () => void;
  /** Fast-forward past what she has heard before (the 快轉聽過的話 button); defaults to the director's own. */
  onFastForward?: () => void;
};

export function Stage({ director, view, onCapture, firstCueHint, onCueHintShown, blocked = false, onKeep, onFastForward }: Props) {
  const [shaking, setShaking] = useState<View['shakeLevel'] | null>(null);
  const lastShake = useRef(view.shake);
  useEffect(() => {
    if (view.shake === lastShake.current) return;
    lastShake.current = view.shake;
    setShaking(view.shakeLevel);
    const timer = window.setTimeout(() => setShaking(null), view.shakeLevel === 'hard' ? 760 : 380);
    return () => window.clearTimeout(timer);
  }, [view.shake]); // eslint-disable-line react-hooks/exhaustive-deps
  // Two identical animations swapped every beat, so each beat restarts the pulse; how hard it lands follows the sound.
  const pulse = view.heart ? heartPulse(view.heart.glow, view.heart.ms) : null;
  const beat = view.heart ? ` beating beat-${view.heart.beat % 2}` : '';

  const shifting = view.shiftingTo !== null || (view.phase === 'scene' && view.focus === null);
  const focusPos = view.focus && view.focus !== 'main' ? view.periph.find((item) => item.kind === 'cue' && item.thread === view.focus)?.pos : undefined;
  const turnedAway = (view.focus !== null && view.focus !== 'main') || view.shiftingTo !== null;
  // A phone-width screen has no room beside the line for what she turned toward (see .narrow in game.css).
  const phone = typeof window !== 'undefined' && window.innerWidth < NARROW_PX;
  const narrow = phone;
  const className = ['lt-stage', narrow ? 'narrow' : '', `phase-${view.phase}`, view.phase === 'out' && view.brief ? 'brief' : '', shifting ? 'shifting' : '', turnedAway ? 'away' : '', shaking ? `shake shake-${shaking}` : '', view.tension ? `tension-${view.tension}` : '', director.settings.motion ? '' : 'still'].join(' ');
  const firstCue = firstCueHint ? view.periph.find((item) => item.kind === 'cue' && item.thread !== view.focus) : undefined;

  useEffect(() => { if (firstCue) onCueHintShown(); }, [firstCue?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // One keyed list, so a line keeps its element as it moves from center to echo to leaving.
  const echo = view.echo && view.echo.key !== view.center?.key ? view.echo : null;
  const leaving = useLeaving(echo, view.center?.key);
  const lines: { line: CenterLine; role: Role }[] = [
    ...leaving.map((line) => ({ line, role: 'leaving' as const })),
    ...(echo ? [{ line: echo, role: 'echo' as const }] : []),
    ...(view.center ? [{ line: view.center, role: 'center' as const }] : []),
  ];
  // The middle only ever carries the main conversation: sharp while she listens to it, blurred while she has turned away.
  const awayLine = view.away && view.away.key !== view.center?.key ? view.away : null;
  const middle = [...lines.filter(({ line }) => line.thread === 'main'), ...(awayLine ? [{ line: awayLine, role: 'away' as const }] : [])];
  const middleSaying = middle.some(({ role }) => role === 'center' || role === 'away');
  // What she turned toward is written beside its own sound.
  const side = lines.filter(({ line }) => line.thread !== 'main');
  const sideThread = side[side.length - 1]?.line.thread;
  const sideCue = sideThread ? view.periph.find((item) => item.kind === 'cue' && item.thread === sideThread)?.key : undefined;

  const [turn, turnGone] = useLinger(view.shiftingTo);
  const [choice, choiceGone] = useLinger(view.choice && view.focus === 'main' ? view.choice : null);
  const [waiting, waitingGone] = useLinger(view.waiting);
  // Coming out of a daze, the blur and the sway are kept on (shrinking) until the screen is clear again.
  const [daze, dazeClearing] = useLinger(view.daze, DAZE_CLEAR_MS);
  // During a real wait the corner clock walks from the wait's start time to its end, minute by minute.
  const clockShown = useWaitClock(view, director.speed) ?? view.clock;
  const carded = view.phase === 'card' || view.phase === 'reset';
  const cardPhase = useRef(view.phase);
  if (carded) cardPhase.current = view.phase;
  const [card, cardGone] = useLinger(carded && view.card ? view.card : null);
  const periph = useDeparting(view.periph);
  // A departing cue keeps exactly the look it had (active, held, its hint), so nothing about it jumps while it fades.
  const lastLook = useRef(new Map<number, ReactElement<Record<string, unknown>>>());

  // Between two lines the centre stays as tall as the last one, so the echo rises once, not once now and again
  // when the next line pushes it.
  const centerHeight = useRef(0);
  const awayFor = useRef<string | null>(null);
  const holdSlot = !middleSaying && middle.length > 0 && centerHeight.current > 0;

  const root = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState(0);
  const placedFor = useRef(screen);
  // A phone-sized stage caps the text size where the layout still holds (matches --ts in game.css).
  const small = typeof window !== 'undefined' && (window.innerWidth <= 560 || window.innerHeight <= 500);
  const textScale = Math.min(FONT_SIZES[director.settings.fontSize].scale, small ? SMALL_SCREEN_SCALE : Infinity);
  const placedScale = useRef(textScale);
  useEffect(() => {
    const onResize = () => setScreen((value) => value + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useLayoutEffect(() => {
    if (!root.current) return;
    const said = root.current.querySelector<HTMLElement>('.lt-center .lt-line:not(.lt-echo)');
    if (middleSaying && said) centerHeight.current = said.offsetHeight;
    else if (!middle.length) centerHeight.current = 0;
    // Turned away on a phone: the main conversation steps to the half of the screen the sound is not in. Decided
    // once per turn (from where that sound sits), so it never hops while she listens.
    const turnedTo = root.current.querySelector<HTMLElement>('.lt-p.kind-cue.active[data-placed]');
    if (narrow && turnedAway && turnedTo) {
      const key = turnedTo.dataset.key!;
      if (awayFor.current !== key) {
        awayFor.current = key;
        root.current.style.setProperty('--away-top', parseFloat(turnedTo.style.top) > root.current.clientHeight / 2 ? '24%' : '76%');
      }
    } else if (!turnedAway) awayFor.current = null;
    const sideBox = root.current.querySelector<HTMLElement>('.lt-side');
    // The box stays by its sound; on a wide screen, where it lies over the blurred main line, that line steps back.
    const over = sideBox !== null && placeSide(root.current, sideBox, sideCue !== undefined ? root.current.querySelector<HTMLElement>(`.lt-p[data-key="${sideCue}"]`) : null);
    root.current.classList.toggle('side-over', over && !narrow);
    placeSounds(root.current, periph.map((entry) => entry.item), view.ripples, turn, placedFor.current !== screen || placedScale.current !== textScale, textScale);
    placedFor.current = screen;
    placedScale.current = textScale;
    root.current.querySelectorAll<HTMLElement>('.gone:not([data-fading])').forEach(fadeAway);
    const mounted = new Set(periph.map((entry) => entry.item.key));
    for (const key of lastLook.current.keys()) if (!mounted.has(key)) lastLook.current.delete(key);
  });

  const announced = useAnnouncer(view);
  const keep = onKeep ?? (() => { if (director.capture()) onCapture(); });

  return (
    <div className={className} ref={root} style={{ ['--wound' as string]: (director.tension / 100).toFixed(2) }} {...inertProps(blocked)}>
      <div className={`lt-heart${beat}`} style={pulse?.glow} aria-hidden="true" />
      <div className="lt-world" {...inertProps(Boolean(view.recall || view.keep))}>
        <div className={`lt-daze${daze ? ` daze-${daze}` : ''}${dazeClearing ? ' clearing' : ''}`}>
          <div className={`lt-body${pulse?.jolt ? `${beat} jolting` : ''}${view.noise ? ` noise-${view.noise.level}` : ''}`} style={pulse?.jolt ?? undefined}>
            {view.ripples.map((ripple) => <div key={ripple.key} data-key={ripple.key} className={`lt-ripple dist-${ripple.pos.dist}`} />)}
            {turn && <div className={`lt-turn${turnGone ? ' gone' : ''}`} />}

            {periph.map(({ item, gone }) => {
              const looked = lastLook.current.get(item.key);
              if (gone && looked) {
                return cloneElement(looked, { className: `${looked.props.className as string} gone`, disabled: true, tabIndex: -1, onClick: undefined, 'aria-hidden': true });
              }
              if (gone) return null;
              const element = renderPeriph(item);
              lastLook.current.set(item.key, element);
              return element;
            })}

            <div className="lt-center">
              <div className="lt-center-inner" style={{ transform: focusPos ? leanOf(focusPos) : undefined }}>
                {middle.map(({ line, role }) => <Line key={line.key} line={line} role={role} director={director} view={view} onCapture={onCapture} />)}
                {holdSlot && <div className="lt-hold" style={{ height: centerHeight.current }} aria-hidden="true" />}
                {view.teach && view.center && (
                  <div className="lt-teach-keep" role="status">
                    {view.teach === 'tap' ? tapLesson(director.settings.autoAdvance) : LESSON_TEXT[view.teach]}
                    <span className="lt-sr">{LESSON_KEYS[view.teach]}</span>
                  </div>
                )}
              </div>
            </div>

            {side.length > 0 && (
              <div className="lt-side">
                {side.map(({ line, role }) => <Line key={line.key} line={line} role={role} side director={director} view={view} onCapture={onCapture} />)}
              </div>
            )}

            {choice && !view.recall && !view.keep && <Choices director={director} choice={choice} gone={choiceGone} />}
            {waiting && <Waiting gone={waitingGone} first={Boolean(waiting.first)} />}
          </div>
        </div>
      </div>

      {/* What her hands do stays still and sharp, even while her body shakes or the room swims. */}
      {view.recall && <RecallPicker director={director} recall={view.recall} />}
      {view.interact && <Interaction director={director} interact={view.interact} />}
      {card && <CardView card={card} phase={cardPhase.current} gone={cardGone} />}
      {(view.clock || view.place) && view.phase !== 'idle' && (
        <div className="lt-where">
          {clockShown && <span key={view.clockMark} className="lt-where-time">{clockShown}</span>}
          {view.place && <span key={view.place} className="lt-where-place">{view.place}</span>}
        </div>
      )}
      <div className="lt-sr" aria-live="polite">{view.center ? `${view.center.label ? `${view.center.label}：` : ''}${view.center.text.replace(/\|/g, '')}` : ''}</div>
      <div className="lt-sr" aria-live="polite">{announced}</div>
      {/* For a screen reader or the keyboard: what a long press and a tap do. Unseen until focused; kept mounted so
          focus is not lost between lines. */}
      {view.phase !== 'idle' && (
        <div className="lt-quiet-keys" onPointerUp={(event) => event.stopPropagation()} {...inertProps(Boolean(view.recall || view.keep))}>
          <button type="button" className="lt-quiet-key" aria-keyshortcuts="K" onClick={keep}>記住這句</button>
          <button type="button" className="lt-quiet-key" onClick={() => director.hurry()}>下一句</button>
          <button type="button" className="lt-quiet-key" aria-keyshortcuts="F" onClick={() => (onFastForward ? onFastForward() : director.fastForward())}>快轉聽過的話</button>
        </div>
      )}
      {/* Fast-forwarding is said (and shown, small) while it lasts; the first line it stops at is read as usual. */}
      {view.phase !== 'idle' && <div className={`lt-skip${view.skipping ? ' on' : ''}`} role="status">{view.skipping ? '快轉中' : ''}</div>}
    </div>
  );

  function renderPeriph(item: Peripheral): ReactElement<Record<string, unknown>> {
    const labels = director.settings.soundLabels;
    // Fixed at birth: recomputing it on every render would shorten a running animation and make it jump ahead.
    const life = Number.isFinite(item.until) ? Math.max(400, (item.until - item.born) / director.speed) : 0;
    // Where it sits is worked out after it is measured (placeSounds), so no left/top here.
    const style = { ['--life' as string]: `${life}ms` };
    if (item.kind === 'cue') {
      const active = view.focus === item.thread || (view.shiftingTo !== null && view.shiftingTo === item.pos);
      // While someone is asking her something, she cannot turn away.
      const held = view.choice !== null && !active;
      return (
        <button
          key={item.key}
          data-key={item.key}
          type="button"
          className={`lt-p kind-cue dist-${item.pos.dist}${active ? ' active' : ''}${held ? ' held' : ''}${view.teach === 'turn' && !active ? ' teach' : ''}`}
          style={style}
          disabled={held}
          aria-label={active ? `回到自己：${item.text}` : `轉向聲音：${item.text}`}
          onClick={(event) => { event.stopPropagation(); director.attend(item.thread!); }}
        >
          {item.text}
          {item.src && labels && <span className="lt-p-src">{item.src}</span>}
          {active && view.focus === item.thread && <span className="lt-hint" key="back">再點一下，回到自己</span>}
          {!active && view.teach === 'turn' && <span className="lt-hint stay">點這裡</span>}
          {!active && view.teach !== 'turn' && firstCue?.key === item.key && <span className="lt-hint">點一下，轉過去聽</span>}
        </button>
      );
    }
    return (
      <span key={item.key} data-key={item.key} className={`lt-p kind-${item.kind} dist-${item.pos.dist}`} style={style} aria-hidden="true">
        {item.kind === 'sfx' ? item.text : unstop(item.text)}
        {item.src && labels && <span className="lt-p-src">{item.src}</span>}
      </span>
    );
  }
}

function Line({ line, role, side = false, director, view, onCapture }: { line: CenterLine; role: Role; side?: boolean; director: Director; view: View; onCapture: () => void }) {
  const echo = role === 'echo' || role === 'leaving';
  const current = role === 'center' || role === 'away';
  const [holding, setHolding] = useState(false);
  const [kept, setKept] = useState(false);
  const timer = useRef<number | null>(null);
  const elapsed = (view.t - line.startedAt) / director.speed;
  // Phrase delays count from when this element mounted; re-deriving them each render would pull later phrases forward.
  const mountedAt = useRef(elapsed);
  // Once she stops listening the line freezes as far as she heard it, so nothing unheard pops in on the echo.
  const heardAll = useRef(!current);
  if (current) heardAll.current = elapsed >= line.revealMs / director.speed - 30;
  const revealed = heardAll.current;

  // Slide instead of jumping whenever the line's slot moves (turning into an echo, the line below changing
  // height) and ease into its new resting shape (the echo's shrink, a lean). The two run on separate layers:
  // slides stack on top of one still running, so a second move mid-way bends the path instead of stopping it,
  // and the shape always starts from what is on screen. The slot is measured untransformed (bottom centre,
  // from the stage centre) so leans and the -50% centring never read as a move.
  const rest = restingTransform(line, role, side);
  const ref = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const slot = useRef<{ x: number; y: number; rest: string } | null>(null);
  const reshape = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const body = inner.current;
    const box = el?.offsetParent as HTMLElement | null;
    if (!el || !body || !box) return;
    const next = {
      x: el.offsetLeft + el.offsetWidth / 2 - box.offsetWidth / 2,
      y: el.offsetTop + el.offsetHeight - box.offsetHeight / 2,
      rest,
    };
    const prev = slot.current;
    slot.current = next;
    if (!prev || !el.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dx = prev.x - next.x;
    const dy = prev.y - next.y;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: MOVE_MS, easing: EASE, composite: 'add' },
      );
    }
    if (prev.rest !== next.rest) {
      const now = reshape.current?.playState === 'running' ? getComputedStyle(body).transform : prev.rest;
      reshape.current?.cancel();
      reshape.current = body.animate([{ transform: now }, { transform: rest }], { duration: MOVE_MS, easing: EASE });
    }
  });

  // A voice on the move: the lean travels with it. It rides the reshape layer, so turning into an echo midway
  // eases on from wherever the lean had got to.
  useLayoutEffect(() => {
    const body = inner.current;
    if (!current || side || line.kind !== 'char' || !line.to || !body?.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const left = (line.glideMs ?? 0) / director.speed - Math.max(0, mountedAt.current);
    if (left <= 0) return;
    reshape.current = body.animate([{ transform: leanOf(line.pos) }, { transform: leanOf(line.to) }], { duration: left, easing: 'ease-in-out' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fade out from the current opacity rather than restarting a CSS animation.
  useLayoutEffect(() => {
    const el = ref.current;
    if (role !== 'leaving' || !el?.animate) return;
    const style = getComputedStyle(el);
    el.animate(
      [{ opacity: style.opacity, filter: style.filter }, { opacity: 0, filter: 'blur(4px)' }],
      { duration: LEAVE_MS, easing: 'ease-out', fill: 'forwards' },
    );
  }, [role]);

  const start = (event: ReactPointerEvent) => {
    if (role === 'away' || (!line.perceived && !echo && line.kind === 'phone')) return;
    event.stopPropagation();
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (director.capture(line.key)) { setKept(true); onCapture(); }
      setHolding(false);
    }, HOLD_MS);
  };
  const cancel = () => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    setHolding(false);
  };

  const classes = ['lt-line', `kind-${line.kind}`, line.past ? 'voice-past' : '', line.heard ? 'heard' : '', echo ? 'lt-echo' : '', role === 'away' ? 'lt-away' : '', role === 'center' && view.teach === 'keep' && !kept ? 'teach' : '', role === 'leaving' ? 'leaving' : '', revealed ? 'revealed' : '', holding ? 'holding' : '', kept ? 'kept' : ''].join(' ');
  return (
    <div
      ref={ref}
      className={classes}
      style={{ ['--echo-ms' as string]: `${ECHO_MS / director.speed}ms` }}
      onPointerDown={start}
      onPointerUp={(event) => { if (timer.current !== null) { cancel(); director.hurry(); event.stopPropagation(); } }}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div ref={inner} className="lt-line-in" style={{ transform: rest }}>
        {line.label && <div className="lt-label">{line.label}</div>}
        <p className="lt-text">
          {sentencesOf(line.phrases).map((sentence, index) => {
            const group = (
              <span className="lt-sent">
                {sentence.phrases.map((phrase, n) => {
                  const delay = Math.max(0, (phrase.at / director.speed) - Math.max(0, mountedAt.current));
                  return <span key={n} className="lt-phrase" style={{ animationDelay: `${delay}ms` }}>{gluePunctuation(phrase.text).map((piece, k) => (piece.glue ? <span key={k} className="lt-glue">{piece.text}</span> : <Fragment key={k}>{piece.text}</Fragment>))}</span>;
                })}
              </span>
            );
            return sentence.br ? <Fragment key={index}>{group}<br /></Fragment> : <Fragment key={index}>{group}</Fragment>;
          })}
        </p>
      </div>
    </div>
  );
}

// A sentence wraps as one piece: two short ones share a row with a breath between them, and a row never
// ends in the middle of a word. The breath is the gap between pieces, so it never sits at a row's edge.
function sentencesOf(phrases: Phrase[]): { phrases: Phrase[]; br: boolean }[] {
  const out: { phrases: Phrase[]; br: boolean }[] = [];
  let current: Phrase[] = [];
  for (const phrase of phrases) {
    const ends = phrase.text.endsWith('　');
    current.push(ends ? { ...phrase, text: phrase.text.slice(0, -1) } : phrase);
    if (ends || phrase.br) { out.push({ phrases: current, br: !!phrase.br }); current = []; }
  }
  if (current.length) out.push({ phrases: current, br: false });
  return out;
}

// Where a line rests: leaning toward whoever speaks; her own words a little lower; an echo shrunk toward its
// bottom edge (scaled, not re-sized, so it keeps its rows instead of re-wrapping halfway).
// Beside a sound there is no leaning: the place on screen already says where it comes from.
function restingTransform(line: CenterLine, role: Role, side: boolean): string {
  if (side) return role === 'center' ? 'none' : 'scale(0.82)';
  const lower = line.kind === 'me' ? 'translateY(26px)' : '';
  if (role === 'center' || role === 'away') return line.kind === 'char' ? leanOf(line.to ?? line.pos) : lower || 'none';
  const shrink = line.kind === 'narr' || line.kind === 'phone' ? 'scale(0.82)' : 'scale(0.66)';
  return `${lower} ${shrink}`.trim();
}

/** What a running-out choice will do, for a screen reader (the shrinking line under the options says it to the eye). */
function fallbackOf(choice: NonNullable<View['choice']>): string {
  if (!choice.timeout || !choice.fallback) return '';
  if (choice.fallback === 'silence') return '時間到了還沒選，就當作沉默';
  return `時間到了還沒選，就會選「${unstop(choice.fallback.trim().replace(/^「(.*)」$/u, '$1'))}」`;
}

function Choices({ director, choice, gone }: { director: Director; choice: NonNullable<View['choice']>; gone: boolean }) {
  const timeoutMs = choice.timeout ? (choice.timeout * 1000) / director.speed : 0;
  const fallback = fallbackOf(choice);
  const box = useRef<HTMLDivElement>(null);
  const tooSoon = useFreshGuard(choice.key);
  // She is being asked: focus goes to the question itself (a screen reader says 要回答了), unless a dialog holds
  // it. Not onto the first answer: a Space or Enter meant to hurry the line before would pick it. An arrow key or
  // Tab steps in; digits answer straight away. Only for someone on a keyboard: after a tap or a click, focus stays
  // where it was (no ring jumping onto the screen), and the live region still says the question either way.
  useEffect(() => {
    if (gone || lastInput() !== 'key' || document.querySelector('[role="dialog"]')) return;
    box.current?.focus({ preventScroll: true });
  }, [choice.key, gone]);
  return (
    <div
      ref={box}
      className={`lt-choices${timeoutMs ? ' timed' : ''}${gone ? ' gone' : ''}`}
      style={{ ['--timeout' as string]: `${timeoutMs}ms` }}
      key={choice.key}
      role="group"
      aria-label="要回答了"
      aria-describedby={fallback ? `lt-choice-fallback-${choice.key}` : undefined}
      tabIndex={-1}
      onKeyDown={(event) => arrowsBetween(event, '.lt-choice')}
    >
      {choice.options.map((option, index) => (
        <button
          key={index}
          type="button"
          className={`lt-choice${option.disabled ? ' done' : ''}`}
          disabled={gone || option.disabled}
          style={{ animationDelay: `${index * 140}ms, ${index * 140}ms` }}
          aria-keyshortcuts={String(index + 1)}
          onClick={(event) => { event.stopPropagation(); if (!tooSoon(event)) director.choose(option.index); }}
        >
          <span className="lt-key" aria-hidden="true">{index + 1}</span>{unstop(option.text)}
          {option.disabled && <span className="lt-sr">（已經做過了）</span>}
        </button>
      ))}
      {timeoutMs > 0 && <div className="lt-timer" aria-hidden="true" />}
      {fallback && <span className="lt-sr" id={`lt-choice-fallback-${choice.key}`}>{fallback}</span>}
      {choice.first && (
        <div className="lt-choice-teach" role="status">
          點一個，就是妳接下來說的話、做的事。
          {timeoutMs > 0 && <><br />不選，也是一種回答。</>}
        </div>
      )}
    </div>
  );
}

const RECALL_HINT_KEY = 'listening-town-recall-hint';

/** What each first-play lesson says under the line it holds. */
/** Tapping hurries, but the story is meant to be left to its own pace; manual reading waits for every tap. */
function tapLesson(auto: boolean): ReactElement {
  return auto
    ? <>點一下，先聽下一句。<br />不點，也會自己說下去。</>
    : <>每一句都等妳點一下。</>;
}

/** The same lessons for a keyboard or a screen reader, said after the visible text and never shown. */
const LESSON_KEYS: Record<NonNullable<View['teach']>, string> = {
  tap: '。用鍵盤的話按 Enter，或找「下一句」按鈕',
  turn: '。用 Tab 選到那個聲音，再按 Enter',
  keep: '。用鍵盤的話按 K，或找「記住這句」按鈕',
  locate: '。看完按 Enter 往下',
  approach: '。看完按 Enter 往下',
  hold: '。看完按 Enter 往下',
};

const LESSON_TEXT: Record<Exclude<NonNullable<View['teach']>, 'tap'>, string> = {
  turn: '點有聲音的地方，轉過去聽。',
  keep: '長按這句話，把它留在身上',
  ...INTERACT_LESSON,
};

/** Memory Input: the lines she carried past midnight, one of which she may say out loud. */
export function RecallPicker({ director, recall }: { director: Director; recall: NonNullable<View['recall']> }) {
  const empty = recall.memories.length === 0;
  const [firstTime] = useState(() => { try { return localStorage.getItem(RECALL_HINT_KEY) !== 'done'; } catch { return false; } });
  // The how-to is spent only once there was something to pick from.
  useEffect(() => { if (!empty) try { localStorage.setItem(RECALL_HINT_KEY, 'done'); } catch { /* ignore */ } }, [empty]);
  const box = useRef<HTMLDivElement>(null);
  useModal(box);
  const tooSoon = useFreshGuard(recall.key, 400);
  return (
    <div
      ref={box}
      className="lt-recall"
      key={recall.key}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lt-recall-head"
      aria-describedby={empty || firstTime ? 'lt-recall-hint' : undefined}
      tabIndex={-1}
      onPointerUp={(event) => event.stopPropagation()}
      onKeyDown={(event) => arrowsBetween(event, '.lt-recall-item')}
    >
      <div className="lt-recall-head" id="lt-recall-head">想起一句話</div>
      {empty
        ? <div className="lt-recall-hint" id="lt-recall-hint">還沒有記住任何一句話<br />聽到想留下來的話，長按它，下次就能在這裡想起來</div>
        : firstTime && <div className="lt-recall-hint" id="lt-recall-hint">選一句之前記下來的話，把它說出口</div>}
      <div className="lt-recall-list">
        {recall.memories.map((memory, index) => (
          <button key={memory.key} type="button" className="lt-recall-item" aria-keyshortcuts={index < 9 ? String(index + 1) : undefined} onClick={(event) => { if (!tooSoon(event)) director.recallPick(memory.key); }}>
            <span className="lt-key" aria-hidden="true">{index + 1}</span>
            <span className="lt-recall-text">{unstop(memory.kind === 'me' ? `「${memory.text}」` : memory.text)}</span>
            <span className="lt-recall-meta">{[memory.label, memory.clock, memory.place].filter(Boolean).join(' · ')}</span>
          </button>
        ))}
      </div>
      <button type="button" className="lt-recall-cancel" onClick={() => director.recallPick(null)}>算了</button>
    </div>
  );
}

/** The clock a running wait has reached (null when not waiting, or the wait has no end time). */
function useWaitClock(view: View, speed: number): string | undefined {
  const waiting = view.waiting;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!waiting?.until) return;
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [waiting?.startedAt, waiting?.until]);
  // view.t only refreshes on render; approximate progress from wall time since this wait was shown.
  const started = useRef<{ key: number; at: number } | null>(null);
  if (!waiting?.until) {
    started.current = null;
    return undefined;
  }
  if (started.current?.key !== waiting.startedAt) {
    started.current = { key: waiting.startedAt, at: performance.now() - Math.max(0, view.t - waiting.startedAt) / speed };
  }
  const fraction = Math.min(1, ((performance.now() - started.current.at) * speed) / (waiting.seconds * 1000));
  return interpolateClock(waiting.clock ?? view.clock, waiting.until, fraction);
}

function Waiting({ gone, first }: { gone: boolean; first: boolean }) {
  return (
    <div className={`lt-wait${gone ? ' gone' : ''}`} aria-hidden={!first}>
      <div className="lt-wait-breath" />
      {first && <div className="lt-wait-teach" role="status">這段時間點了也不會變快<br />聽聽四周的聲音就好</div>}
    </div>
  );
}

function CardView({ card, phase, gone }: { card: Card; phase: View['phase']; gone: boolean }) {
  const ms = phase === 'reset' ? 6500 : card.chapter ? 4200 : 2600;
  return (
    // Said once by the stage's announcer, so a screen reader does not read it twice.
    <div className={`lt-card${gone ? ' gone' : ''}`} style={{ ['--card-ms' as string]: `${ms}ms` }} key={`${phase}-${card.time}-${card.place}-${card.title}-${card.loopText}`} aria-hidden="true">
      {card.chapter && <div className="lt-card-chapter">{card.chapter}</div>}
      {card.title && <div className="lt-card-title">{card.title}</div>}
      {card.time && <div className="lt-card-time">{card.time}</div>}
      {card.place && <div className="lt-card-place">{card.place}</div>}
      {card.mark && phase === 'reset' && <div className="lt-card-mark" style={{ animationDelay: '600ms', animationDuration: `${card.markMs ?? 2000}ms` }}>{card.mark}</div>}
      {card.loopText && phase === 'reset' && <div className="lt-card-loop" style={{ animationDelay: '3000ms', animationDuration: '3400ms' }}>{card.loopText}</div>}
      {card.loopText && phase !== 'reset' && <div className="lt-card-loop">{card.loopText}</div>}
      {card.recap?.memory && <div className="lt-card-recap lt-card-echo">{card.recap.memory}</div>}
    </div>
  );
}
