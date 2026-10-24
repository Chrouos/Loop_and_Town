import { Fragment, cloneElement, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { ECHO_MS, type Card, type CenterLine, type Director, type Peripheral, type View } from '../engine/director';
import { interpolateClock, leanOf, placeOf } from './geometry';

const HOLD_MS = 560;
const MOVE_MS = 700;
const LEAVE_MS = 420;
const GONE_MS = 480;
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

type Role = 'center' | 'echo' | 'leaving';

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
function useLinger<T>(value: T | null): [T | null, boolean] {
  const [last, setLast] = useState(value);
  if (value !== null && value !== last) setLast(value);
  useEffect(() => {
    if (value !== null || last === null) return;
    const timer = window.setTimeout(() => setLast(null), GONE_MS + 80);
    return () => window.clearTimeout(timer);
  }, [value, last]);
  return value !== null ? [value, false] : [last, last !== null];
}

// Same for the periphery, keeping the old order so no element is moved (a moved node restarts its CSS animations).
function useDeparting(items: Peripheral[]): { item: Peripheral; gone: boolean }[] {
  const [state, setState] = useState(() => ({ items, list: items.map((item) => ({ item, gone: false })) }));
  let list = state.list;
  if (state.items !== items) {
    const live = new Map(items.map((item) => [item.key, item]));
    list = state.list.map((entry) => live.has(entry.item.key) ? { item: live.get(entry.item.key)!, gone: false } : { item: entry.item, gone: true });
    const known = new Set(state.list.map((entry) => entry.item.key));
    list.push(...items.filter((item) => !known.has(item.key)).map((item) => ({ item, gone: false })));
    setState({ items, list });
  }
  const anyGone = list.some((entry) => entry.gone);
  useEffect(() => {
    if (!anyGone) return;
    const timer = window.setTimeout(() => setState((current) => ({ ...current, list: current.list.filter((entry) => !entry.gone) })), GONE_MS + 80);
    return () => window.clearTimeout(timer);
  }, [list, anyGone]);
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

type Props = { director: Director; view: View; onCapture: () => void; firstCueHint: boolean; onCueHintShown: () => void };

export function Stage({ director, view, onCapture, firstCueHint, onCueHintShown }: Props) {
  const [shaking, setShaking] = useState(false);
  const lastShake = useRef(view.shake);
  useEffect(() => {
    if (view.shake === lastShake.current) return;
    lastShake.current = view.shake;
    setShaking(true);
    const timer = window.setTimeout(() => setShaking(false), 440);
    return () => window.clearTimeout(timer);
  }, [view.shake]);

  const shifting = view.shiftingTo !== null || (view.phase === 'scene' && view.focus === null);
  const focusPos = view.focus && view.focus !== 'main' ? view.periph.find((item) => item.kind === 'cue' && item.thread === view.focus)?.pos : undefined;
  const className = ['lt-stage', `phase-${view.phase}`, view.phase === 'out' && view.brief ? 'brief' : '', shifting ? 'shifting' : '', shaking ? 'shake' : ''].join(' ');
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

  const [turn, turnGone] = useLinger(view.shiftingTo);
  const [choice, choiceGone] = useLinger(view.choice && view.focus === 'main' ? view.choice : null);
  const [waiting, waitingGone] = useLinger(view.waiting);
  const carded = view.phase === 'card' || view.phase === 'reset';
  const cardPhase = useRef(view.phase);
  if (carded) cardPhase.current = view.phase;
  const [card, cardGone] = useLinger(carded && view.card ? view.card : null);
  const periph = useDeparting(view.periph);
  // A departing cue keeps exactly the look it had (active, held, its hint), so nothing about it jumps while it fades.
  const lastLook = useRef(new Map<number, ReactElement<Record<string, unknown>>>());

  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    root.current?.querySelectorAll<HTMLElement>('.gone:not([data-fading])').forEach(fadeAway);
    const mounted = new Set(periph.map((entry) => entry.item.key));
    for (const key of lastLook.current.keys()) if (!mounted.has(key)) lastLook.current.delete(key);
  });

  return (
    <div className={className} ref={root}>
      <div className="lt-world">
        {view.ripples.map((ripple) => {
          const place = placeOf(ripple.pos);
          return <div key={ripple.key} className={`lt-ripple dist-${ripple.pos.dist}`} style={{ left: place.left, top: place.top }} />;
        })}
        {turn && (() => { const place = placeOf(turn); return <div className={`lt-turn${turnGone ? ' gone' : ''}`} style={{ left: place.left, top: place.top }} />; })()}

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
            {lines.map(({ line, role }) => <Line key={line.key} line={line} role={role} director={director} view={view} onCapture={onCapture} />)}
          </div>
        </div>

        {choice && <Choices director={director} choice={choice} gone={choiceGone} />}
        {waiting && <Waiting view={view} waiting={waiting} gone={waitingGone} speed={director.speed} />}
      </div>

      {card && <CardView card={card} phase={cardPhase.current} gone={cardGone} />}
      {(view.clock || view.place) && view.phase !== 'idle' && (
        <div className="lt-where" aria-hidden="true">
          {view.clock && <span key={view.clock} className="lt-where-time">{view.clock}</span>}
          {view.place && <span key={view.place} className="lt-where-place">{view.place}</span>}
        </div>
      )}
      <div className="lt-sr" aria-live="polite">{view.center ? `${view.center.label ? `${view.center.label}：` : ''}${view.center.text.replace(/\|/g, '')}` : ''}</div>
    </div>
  );

  function renderPeriph(item: Peripheral): ReactElement<Record<string, unknown>> {
    const place = placeOf(item.pos);
    // Fixed at birth: recomputing it on every render would shorten a running animation and make it jump ahead.
    const life = Number.isFinite(item.until) ? Math.max(400, (item.until - item.born) / director.speed) : 0;
    // Overheard talk can be long: keep its whole box on screen.
    const style = item.kind === 'life'
      ? { left: `clamp(min(20vw, 160px), ${place.left}, calc(100% - min(20vw, 160px)))`, top: `clamp(10vh, ${place.top}, 90vh)`, ['--life' as string]: `${life}ms` }
      : { left: place.left, top: place.top, ['--life' as string]: `${life}ms` };
    if (item.kind === 'cue') {
      const active = view.focus === item.thread || (view.shiftingTo !== null && view.shiftingTo === item.pos);
      // While someone is asking her something, she cannot turn away.
      const held = view.choice !== null && !active;
      return (
        <button
          key={item.key}
          type="button"
          className={`lt-p kind-cue dist-${item.pos.dist}${active ? ' active' : ''}${held ? ' held' : ''}`}
          style={style}
          disabled={held}
          aria-label={active ? `回到自己：${item.text}` : `轉向聲音：${item.text}`}
          onClick={(event) => { event.stopPropagation(); director.attend(item.thread!); }}
        >
          {item.text}
          {active && view.focus === item.thread && <span className="lt-hint" key="back">再點一下，回到自己</span>}
          {!active && firstCue?.key === item.key && <span className="lt-hint">點一下，轉過去聽</span>}
        </button>
      );
    }
    return <span key={item.key} className={`lt-p kind-${item.kind} dist-${item.pos.dist}`} style={style} aria-hidden="true">{item.text}</span>;
  }
}

function Line({ line, role, director, view, onCapture }: { line: CenterLine; role: Role; director: Director; view: View; onCapture: () => void }) {
  const echo = role !== 'center';
  const [holding, setHolding] = useState(false);
  const [kept, setKept] = useState(false);
  const timer = useRef<number | null>(null);
  const elapsed = (view.t - line.startedAt) / director.speed;
  // Phrase delays count from when this element mounted; re-deriving them each render would pull later phrases forward.
  const mountedAt = useRef(elapsed);
  // Once she stops listening the line freezes as far as she heard it, so nothing unheard pops in on the echo.
  const heardAll = useRef(role !== 'center');
  if (role === 'center') heardAll.current = elapsed >= line.revealMs / director.speed - 30;
  const revealed = heardAll.current;

  // Slide instead of jumping whenever the text's slot moves: turning into an echo, or the line below changing height.
  // Measured untransformed (offsets from the stage centre, text bottom) so leans, the -50% centring and the
  // echo's font shrink never read as a move.
  const ref = useRef<HTMLDivElement>(null);
  const slot = useRef<{ x: number; y: number } | null>(null);
  const move = useRef<{ anim: Animation; dx: number; dy: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const text = el?.querySelector<HTMLElement>('.lt-text');
    const box = el?.offsetParent as HTMLElement | null;
    if (!el || !text || !box) return;
    const next = {
      x: el.offsetLeft + text.offsetLeft - box.offsetWidth / 2,
      y: el.offsetTop + text.offsetTop + text.offsetHeight - box.offsetHeight / 2,
    };
    const prev = slot.current;
    slot.current = next;
    if (!prev || !el.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let dx = prev.x - next.x;
    let dy = prev.y - next.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const running = move.current;
    if (running) {
      const progress = running.anim.effect?.getComputedTiming().progress ?? 1;
      dx += running.dx * (1 - progress);
      dy += running.dy * (1 - progress);
      running.anim.cancel();
    }
    const anim = el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: MOVE_MS, easing: EASE, composite: 'add' },
    );
    move.current = { anim, dx, dy };
  });

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
    if (!line.perceived && !echo && line.kind === 'phone') return;
    event.stopPropagation();
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (director.capture()) { setKept(true); onCapture(); }
      setHolding(false);
    }, HOLD_MS);
  };
  const cancel = () => {
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    setHolding(false);
  };

  const classes = ['lt-line', `kind-${line.kind}`, echo ? 'lt-echo' : '', role === 'leaving' ? 'leaving' : '', revealed ? 'revealed' : '', holding ? 'holding' : '', kept ? 'kept' : ''].join(' ');
  const lean = line.kind === 'char' ? leanOf(line.pos) : undefined;
  return (
    <div
      ref={ref}
      className={classes}
      style={{ transform: echo ? undefined : lean, ['--echo-ms' as string]: `${ECHO_MS / director.speed}ms` }}
      onPointerDown={start}
      onPointerUp={(event) => { if (timer.current !== null) { cancel(); director.hurry(); event.stopPropagation(); } }}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
    >
      {line.label && <div className="lt-label">{line.label}</div>}
      <p className="lt-text">
        {line.phrases.map((phrase, index) => {
          const delay = Math.max(0, (phrase.at / director.speed) - Math.max(0, mountedAt.current));
          const span = <span className="lt-phrase" style={{ animationDelay: `${delay}ms` }}>{phrase.text}</span>;
          return phrase.br ? <Fragment key={index}>{span}<br /></Fragment> : <Fragment key={index}>{span}</Fragment>;
        })}
      </p>
    </div>
  );
}

function Choices({ director, choice, gone }: { director: Director; choice: NonNullable<View['choice']>; gone: boolean }) {
  const timeoutMs = choice.timeout ? (choice.timeout * 1000) / director.speed : 0;
  return (
    <div className={`lt-choices${timeoutMs ? ' timed' : ''}${gone ? ' gone' : ''}`} style={{ ['--timeout' as string]: `${timeoutMs}ms` }} key={choice.key}>
      {choice.options.map((option, index) => (
        <button
          key={index}
          type="button"
          className="lt-choice"
          disabled={gone}
          style={{ animationDelay: `${index * 140}ms, ${index * 140}ms` }}
          onClick={(event) => { event.stopPropagation(); director.choose(option.index); }}
        >
          <span className="lt-key">{index + 1}</span>{option.text}
        </button>
      ))}
      {timeoutMs > 0 && <div className="lt-timer" />}
    </div>
  );
}

function Waiting({ view, waiting, gone, speed }: { view: View; waiting: NonNullable<View['waiting']>; gone: boolean; speed: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const total = waiting.seconds * 1000;
  // view.t only refreshes on render; approximate progress from wall time since this wait was shown.
  const started = useRef(performance.now() - Math.max(0, view.t - waiting.startedAt) / speed);
  const fraction = gone ? 1 : Math.min(1, ((performance.now() - started.current) * speed) / total);
  const clock = waiting.until ? interpolateClock(waiting.clock ?? view.clock, waiting.until, fraction) : undefined;
  return (
    <div className={`lt-wait${gone ? ' gone' : ''}`} aria-hidden="true">
      <div className="lt-wait-breath" />
      {clock && <div className="lt-wait-clock">{clock}</div>}
    </div>
  );
}

function CardView({ card, phase, gone }: { card: Card; phase: View['phase']; gone: boolean }) {
  const ms = phase === 'reset' ? 6500 : card.chapter ? 4200 : 2600;
  return (
    <div className={`lt-card${gone ? ' gone' : ''}`} style={{ ['--card-ms' as string]: `${ms}ms` }} key={`${phase}-${card.time}-${card.place}-${card.title}-${card.loopText}`}>
      {card.chapter && <div className="lt-card-chapter">{card.chapter}</div>}
      {card.title && <div className="lt-card-title">{card.title}</div>}
      {card.time && <div className="lt-card-time">{card.time}</div>}
      {card.place && <div className="lt-card-place">{card.place}</div>}
      {card.loopText && phase === 'reset' && <div className="lt-card-loop" style={{ animationDelay: '3000ms', animationDuration: '3400ms' }}>{card.loopText}</div>}
      {card.loopText && phase !== 'reset' && <div className="lt-card-loop">{card.loopText}</div>}
    </div>
  );
}
