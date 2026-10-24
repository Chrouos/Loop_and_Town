import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ECHO_MS, type CenterLine, type Director, type View } from '../engine/director';
import { interpolateClock, leanOf, placeOf } from './geometry';

const HOLD_MS = 560;
const MOVE_MS = 700;
const LEAVE_MS = 420;
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
  const className = ['lt-stage', `phase-${view.phase}`, shifting ? 'shifting' : '', shaking ? 'shake' : ''].join(' ');
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

  return (
    <div className={className}>
      <div className="lt-world">
        {view.ripples.map((ripple) => {
          const place = placeOf(ripple.pos);
          return <div key={ripple.key} className={`lt-ripple dist-${ripple.pos.dist}`} style={{ left: place.left, top: place.top }} />;
        })}
        {view.shiftingTo && (() => { const place = placeOf(view.shiftingTo); return <div className="lt-turn" style={{ left: place.left, top: place.top }} />; })()}

        {view.periph.map((item) => {
          const place = placeOf(item.pos);
          const life = Number.isFinite(item.until) ? Math.max(400, (item.until - view.t) / director.speed) : 0;
          const style = { left: place.left, top: place.top, ['--life' as string]: `${life}ms` };
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
        })}

        <div className="lt-center">
          <div className="lt-center-inner" style={{ transform: focusPos ? leanOf(focusPos) : undefined }}>
            {lines.map(({ line, role }) => <Line key={line.key} line={line} role={role} director={director} view={view} onCapture={onCapture} />)}
          </div>
        </div>

        {view.choice && view.focus === 'main' && <Choices director={director} view={view} />}
        {view.waiting && <Waiting view={view} speed={director.speed} />}
      </div>

      {(view.phase === 'card' || view.phase === 'reset') && view.card && <CardView view={view} />}
      {view.phase === 'scene' && (view.clock || view.place) && (
        <div className="lt-where" aria-hidden="true">
          {view.clock && <span key={view.clock} className="lt-where-time">{view.clock}</span>}
          {view.place && <span key={view.place} className="lt-where-place">{view.place}</span>}
        </div>
      )}
      <div className="lt-sr" aria-live="polite">{view.center ? `${view.center.label ? `${view.center.label}：` : ''}${view.center.text.replace(/\|/g, '')}` : ''}</div>
    </div>
  );
}

function Line({ line, role, director, view, onCapture }: { line: CenterLine; role: Role; director: Director; view: View; onCapture: () => void }) {
  const echo = role !== 'center';
  const [holding, setHolding] = useState(false);
  const [kept, setKept] = useState(false);
  const timer = useRef<number | null>(null);
  const elapsed = (view.t - line.startedAt) / director.speed;
  const revealed = elapsed >= line.revealMs / director.speed - 30;

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
          const delay = Math.max(0, (phrase.at / director.speed) - Math.max(0, elapsed));
          return <span key={index} className="lt-phrase" style={{ animationDelay: `${delay}ms` }}>{phrase.text}</span>;
        })}
      </p>
    </div>
  );
}

function Choices({ director, view }: { director: Director; view: View }) {
  const choice = view.choice!;
  const timeoutMs = choice.timeout ? (choice.timeout * 1000) / director.speed : 0;
  return (
    <div className={`lt-choices${timeoutMs ? ' timed' : ''}`} style={{ ['--timeout' as string]: `${timeoutMs}ms` }} key={choice.key}>
      {choice.options.map((option, index) => (
        <button
          key={index}
          type="button"
          className="lt-choice"
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

function Waiting({ view, speed }: { view: View; speed: number }) {
  const waiting = view.waiting!;
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const total = waiting.seconds * 1000;
  // view.t only refreshes on render; approximate progress from wall time since this wait was shown.
  const started = useRef(performance.now() - Math.max(0, view.t - waiting.startedAt) / speed);
  const fraction = Math.min(1, ((performance.now() - started.current) * speed) / total);
  const clock = waiting.until ? interpolateClock(waiting.clock ?? view.clock, waiting.until, fraction) : undefined;
  return (
    <div className="lt-wait" aria-hidden="true">
      <div className="lt-wait-breath" />
      {clock && <div className="lt-wait-clock">{clock}</div>}
    </div>
  );
}

function CardView({ view }: { view: View }) {
  const card = view.card!;
  const ms = view.phase === 'reset' ? 6500 : card.chapter ? 4200 : 2600;
  return (
    <div className="lt-card" style={{ ['--card-ms' as string]: `${ms}ms` }} key={`${view.phase}-${card.time}-${card.place}-${card.title}-${card.loopText}`}>
      {card.chapter && <div className="lt-card-chapter">{card.chapter}</div>}
      {card.title && <div className="lt-card-title">{card.title}</div>}
      {card.time && <div className="lt-card-time">{card.time}</div>}
      {card.place && <div className="lt-card-place">{card.place}</div>}
      {card.loopText && view.phase === 'reset' && <div className="lt-card-loop" style={{ animationDelay: '3000ms', animationDuration: '3400ms' }}>{card.loopText}</div>}
      {card.loopText && view.phase !== 'reset' && <div className="lt-card-loop">{card.loopText}</div>}
    </div>
  );
}
