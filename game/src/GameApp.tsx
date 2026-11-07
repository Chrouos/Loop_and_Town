import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createAudioEngine, type AudioEngine } from './audio/engine';
import { VIBRATIONS, type VibrationId } from './audio/catalog';
import { ATTRIBUTION_CREDITS } from './audio/credits';
import { sampleUrl } from './audio/samples';
import { parseSoundSources, type SoundSource } from './audio/sourceList';
import { Director, toChineseNumber, type BacklogEntry } from './engine/director';
import { FONT_SIZES, MEMORY_CAPACITY, SAVE_KEY, loadSave, setAsideNewerSave, writeSave, type FontSize, type GameSave, type Memory, type SaveProblem } from './engine/save';
import { loadGameScript } from './script/load';
import { CHAPTER_NUMERALS } from './script/types';
import { arrowsBetween, CONTROL, inertProps, Stage, unstop, useModal } from './ui/Stage';
import { placeOf } from './ui/geometry';
import './ui/game.css';

type Screen = 'title' | 'calibrate' | 'play';
const CURSOR_REST_MS = 3000;
const HINT_KEY = 'listening-town-cue-hint';
const TITLE_FADE_MS = 600;
// The mouse cursor hides over the stage after this long without moving, during play.
const CURSOR_IDLE_MS = 3000;

function reducedMotion(): boolean {
  try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; }
}

type WakeLockLike = { release: () => Promise<void>; released?: boolean };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockLike> } };

/** Keeps the screen awake while she is listening; unsupported or refused simply does nothing. */
async function requestWakeLock(): Promise<WakeLockLike | null> {
  try { return (await (navigator as WakeLockNavigator).wakeLock?.request('screen')) ?? null; } catch { return null; }
}

function params() {
  const search = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  return {
    speed: Math.max(1, Number(search.get('fast') ?? 1) || 1),
    chapter: search.get('chapter'),
    // ?scene=c1_1752 starts at one scene (with earlier chapters' knowledge unless ?know=0); ?flags=a,b sets loop flags.
    scene: search.get('scene'),
    flags: (search.get('flags') ?? '').split(',').map((flag) => flag.trim()).filter(Boolean),
    know: search.get('know') !== '0',
    reset: search.has('reset'),
    mute: search.has('mute'),
    // ?dev lists every chapter in the chapter list, not only the ones this save has reached.
    dev: search.has('dev'),
    // ?tension=70 starts her that wound up (testing the hidden tension bands).
    tension: search.get('tension'),
  };
}

function vibrate(id: VibrationId) {
  try { navigator.vibrate?.([...VIBRATIONS[id]]); } catch { /* unsupported */ }
}

export function GameApp({ storage = safeStorage() }: { storage?: Storage }) {
  const options = useMemo(params, []);
  const report = useMemo(() => loadGameScript(), []);
  const audio = useMemo<AudioEngine>(() => createAudioEngine(), []);
  const director = useMemo(() => {
    if (options.reset) { try { storage?.removeItem(SAVE_KEY); } catch { /* nothing to clear */ } }
    const { save, problem } = loadSave(storage);
    const created = new Director(report.script, save, { audio, vibrate, persist: (next: GameSave) => writeSave(storage, next), wallNow: () => Date.now() }, { speed: options.speed, saveProblem: problem });
    if (options.tension !== null && Number.isFinite(Number(options.tension))) created.setTension(Number(options.tension));
    return created;
  }, [audio, options, report, storage]);
  useSyncExternalStore(director.subscribe, director.getVersion);
  const view = director.view;
  const fontStyle = { '--text-scale': FONT_SIZES[director.settings.fontSize].scale } as CSSProperties;

  const [screen, setScreen] = useState<Screen>('title');
  // The two corner buttons open two different things: what she carries, and the game's own menu.
  const [overlay, setOverlay] = useState<'memory' | 'menu' | 'calib' | null>(null);
  const menu = overlay !== null;
  // Which page of the menu is open; H opens it straight on 剛剛聽到的 (and `logFocus` puts focus on the newest line).
  const [menuTab, setMenuTab] = useState<MenuTab>('settings');
  const [logFocus, setLogFocus] = useState(0);
  const openMenu = useCallback((tab: MenuTab = 'settings') => {
    setMenuTab(tab);
    if (tab === 'log') setLogFocus((value) => value + 1);
    setOverlay('menu');
  }, []);
  const [note, setNote] = useState<CornerNote | null>(null);
  const [pulse, setPulse] = useState(0);
  const [cueHint, setCueHint] = useState(() => { try { return storage?.getItem(HINT_KEY) !== 'done'; } catch { return true; } });

  // Expose a small automation surface for headless verification.
  useEffect(() => { (window as unknown as { __game: unknown }).__game = { director, audio, setScreen }; }, [audio, director]);

  // Clock.
  useEffect(() => {
    if (screen !== 'play') return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      director.tick(now - last);
      last = now;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [director, screen]);

  // Leaving the page pauses the scene; a real-time wait keeps counting.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) { hiddenAt = Date.now(); director.setPaused(true); audio.suspend(); }
      else {
        audio.resume();
        if (!menu) director.setPaused(false);
        if (hiddenAt) director.catchUpWait(Date.now() - hiddenAt);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [audio, director, menu]);

  useEffect(() => { director.setPaused(menu); }, [director, menu]);

  // On the black screen a mouse cursor left resting is the one thing in sight: it goes after 3 s still.
  const [calm, setCalm] = useState(false);
  useEffect(() => {
    if (screen !== 'play') { setCalm(false); return; }
    let timer = window.setTimeout(() => setCalm(true), CURSOR_REST_MS);
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      setCalm(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCalm(true), CURSOR_REST_MS);
    };
    window.addEventListener('pointermove', move);
    return () => { window.clearTimeout(timer); window.removeEventListener('pointermove', move); };
  }, [screen]);

  // The screen stays awake while she listens (the browser drops the lock when the page hides: asked again on
  // return), and lets go back on the title.
  const awake = screen !== 'title';
  useEffect(() => {
    if (!awake) return;
    let lock: WakeLockLike | null = null;
    let alive = true;
    const take = () => {
      if (lock && !lock.released) return;
      void requestWakeLock().then((got) => {
        if (!alive) { void got?.release().catch(() => undefined); return; }
        lock = got;
      });
    };
    const onVisibility = () => { if (!document.hidden) take(); };
    take();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release().catch(() => undefined);
      lock = null;
    };
  }, [awake]);

  // During play the mouse cursor hides after a while without moving, and comes back on the next move.
  const [cursorIdle, setCursorIdle] = useState(false);
  useEffect(() => {
    if (screen !== 'play') { setCursorIdle(false); return; }
    let timer = window.setTimeout(() => setCursorIdle(true), CURSOR_IDLE_MS);
    const onMove = () => {
      setCursorIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCursorIdle(true), CURSOR_IDLE_MS);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('mousemove', onMove);
    };
  }, [screen]);

  // 聲音測試 from the menu: the same check of the headphones, then back to the menu where it was asked for.
  const [retest, setRetest] = useState(false);

  const applySettings = useCallback(() => {
    const settings = director.settings;
    audio.setEnabled(settings.audio && !options.mute);
    audio.setVolume(settings.volume);
    audio.setAmbienceVolume(settings.ambience);
    audio.setSfxVolume(settings.sfx);
    audio.setVoiceVolume(settings.voice);
  }, [audio, director, options.mute]);

  // A held Enter on the title repeats: one start only.
  const starting = useRef(false);
  // The title fades out (~600 ms) while the audio unlocks; the unlock itself is called at once, inside the gesture.
  const [leaving, setLeaving] = useState(false);
  // After an ending the title asks which way back: the final morning keeps everything, the first 10/3 forgets it all.
  const begin = useCallback(async (after?: 'final' | 'over') => {
    if (starting.current) return;
    starting.current = true;
    const startedAt = performance.now();
    const unlocked = audio.unlock();
    setLeaving(true);
    try {
      await unlocked;
      const rest = TITLE_FADE_MS - (performance.now() - startedAt);
      if (rest > 0 && !reducedMotion()) await new Promise((resolve) => window.setTimeout(resolve, rest));
    } finally { starting.current = false; setLeaving(false); }
    applySettings();
    if (options.scene && director.jumpToScene(options.scene, options.know, options.flags)) { setScreen('play'); return; }
    if (options.chapter) { setScreen('play'); director.jumpToChapter(options.chapter, options.know); return; }
    if (director.save.finished && after !== 'over') { setScreen('play'); director.selectChapter('final'); return; }
    if (director.save.finished) director.newGame();
    if (!director.save.calibrated && options.speed === 1) { setScreen('calibrate'); return; }
    setScreen('play');
    director.start();
  }, [applySettings, audio, director, options]);

  // The memory button: at a question she may say one of them; any other time it just shows what she carries.
  const openMemory = useCallback(() => {
    if (director.canRemember()) { director.remember(); return; }
    setOverlay('memory');
  }, [director]);

  // Two corner notes, each shown once ever: where the menu is (right after the first tap), and where a kept line went.
  const showNote = useCallback((which: CornerNote) => {
    if (director.taught(which)) return;
    director.markTaught(which);
    setNote(which);
  }, [director]);
  const tapTaught = director.taught('tap');
  // The menu note waits for the first place card (the train), so the letter's opening is not broken by it.
  const [placeShown, setPlaceShown] = useState(false);
  const placeCard = view.phase === 'card' && Boolean(view.card?.place);
  useEffect(() => { if (placeCard) setPlaceShown(true); }, [placeCard]);
  useEffect(() => {
    if (screen !== 'play' || !tapTaught || !placeShown || director.taught('menu')) return;
    const timer = window.setTimeout(() => showNote('menu'), 1800);
    return () => window.clearTimeout(timer);
  }, [director, placeShown, screen, showNote, tapTaught]);
  useEffect(() => { if (screen === 'play' && view.memoryCount > 0) showNote('stored'); }, [screen, showNote, view.memoryCount]);
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(null), 7500);
    return () => window.clearTimeout(timer);
  }, [note]);

  const finishCalibration = useCallback(() => {
    director.setCalibrated();
    setScreen('play');
    director.start();
  }, [director]);

  // Fast-forward past what she has heard before (F held, a two-finger tap, the 快轉聽過的話 button). It says so
  // when there is nothing heard ahead to go past.
  const fastForward = useCallback(() => {
    if (!director.fastForward()) setKeptNote('這裡還沒聽過，不能快轉');
  }, [director]);
  // A two-finger tap is the fast-forward, not a tap: its fingers neither hurry the line nor stop the fast-forward.
  const twoFinger = useRef(false);
  useEffect(() => {
    if (screen !== 'play') return;
    const touches = new Set<number>();
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'touch') touches.add(event.pointerId);
      if (touches.size === 2 && !twoFinger.current) { twoFinger.current = true; fastForward(); return; }
      if (!twoFinger.current) director.stopFastForward();
    };
    const up = (event: PointerEvent) => {
      touches.delete(event.pointerId);
      // Cleared after this release has been handled (the stage's own pointerup runs after this capture listener).
      if (touches.size === 0 && twoFinger.current) window.setTimeout(() => { twoFinger.current = false; }, 0);
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, [director, fastForward, screen]);

  // Keep what she is hearing without a long press (K, a held Space, the 記住這句 button), and say how it went.
  const [keptNote, setKeptNote] = useState('');
  const keepLine = useCallback(() => {
    const kept = director.capture();
    if (kept) setPulse((value) => value + 1);
    // A full memory asks which line to let go instead (KeepPrompt).
    if (!director.view.keep) setKeptNote(kept ? '記下來了' : '這句記不住');
  }, [director]);
  useEffect(() => {
    if (!keptNote) return;
    const timer = window.setTimeout(() => setKeptNote(''), 2500);
    return () => window.clearTimeout(timer);
  }, [keptNote]);

  // The control the pointer last pressed. A button focused by a click is not where the keyboard is: Space and
  // Enter there still hurry the story instead of pressing it again.
  const pointerOn = useRef<Element | null>(null);
  useEffect(() => {
    const press = (event: PointerEvent) => { pointerOn.current = event.target instanceof Element ? event.target.closest(CONTROL) : null; };
    const focus = (event: FocusEvent) => { if (event.target !== pointerOn.current) pointerOn.current = null; };
    window.addEventListener('pointerdown', press, true);
    window.addEventListener('focusin', focus, true);
    return () => { window.removeEventListener('pointerdown', press, true); window.removeEventListener('focusin', focus, true); };
  }, []);

  // Keyboard: Space/Enter hurries, holding Space (or K) keeps the line, digits choose, M opens her memories, H what
  // she just heard, holding F fast-forwards past what she has heard before, Esc closes whatever is on top (or opens
  // the menu). Space/Enter on a control the keyboard reached press that control. Any key but F ends a fast-forward.
  useEffect(() => {
    if (screen !== 'play') return;
    let holdTimer: number | null = null;
    let spaceTaken = false;
    const down = (event: KeyboardEvent) => {
      const bare = !event.ctrlKey && !event.metaKey && !event.altKey;
      if ((event.key === 'f' || event.key === 'F') && bare) {
        if (!event.repeat && !overlay && !view.keep && !view.recall) fastForward();
        return;
      }
      if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) director.stopFastForward();
      // The sound test run again from the menu owns the keys (its Esc goes back to the menu).
      if (overlay === 'calib') return;
      if (view.recall) {
        if (event.key === 'Escape') { director.recallPick(null); return; }
        const memory = /^[1-9]$/.test(event.key) ? view.recall.memories[Number(event.key) - 1] : undefined;
        if (memory) director.recallPick(memory.key);
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      const onControl = Boolean(target?.matches(CONTROL)) && target !== pointerOn.current;
      const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
      if (event.key === 'Escape') {
        if (overlay) setOverlay(null);
        else if (view.keep) director.skipKeep();
        else openMenu();
        return;
      }
      if ((event.key === 'm' || event.key === 'M') && plain) {
        if (overlay === 'memory') setOverlay(null);
        else if (!overlay) openMemory();
        return;
      }
      if ((event.key === 'h' || event.key === 'H') && plain && !view.keep) {
        if (overlay === 'menu' && menuTab === 'log') setOverlay(null);
        else if (overlay !== 'memory') openMenu('log');
        return;
      }
      if (menu || view.keep) return;
      if (/^[1-9]$/.test(event.key) && view.choice) {
        const option = view.choice.options[Number(event.key) - 1];
        if (option) director.choose(option.index);
        return;
      }
      // Arrows step into the answers from wherever focus is (inside the list they move between them).
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && view.choice && !target?.closest('.lt-choices')) {
        const answers = [...document.querySelectorAll<HTMLButtonElement>('.lt-choices:not(.gone) .lt-choice:not(:disabled)')];
        const to = event.key === 'ArrowDown' ? answers[0] : answers[answers.length - 1];
        if (to) { event.preventDefault(); to.focus(); }
        return;
      }
      if ((event.key === 'k' || event.key === 'K') && plain) {
        if (!event.repeat) keepLine();
        return;
      }
      if (event.key === ' ') {
        if (onControl) return;
        event.preventDefault();
        spaceTaken = true;
        if (!event.repeat) holdTimer = window.setTimeout(() => { holdTimer = null; keepLine(); }, 600);
        return;
      }
      if (event.key === 'Enter') {
        if (onControl) return;
        event.preventDefault();
        director.hurry();
      }
    };
    const up = (event: KeyboardEvent) => {
      // F held is the fast-forward: letting go ends it.
      if (event.key === 'f' || event.key === 'F') { director.stopFastForward(); return; }
      if (event.key !== ' ') return;
      if (holdTimer !== null) { window.clearTimeout(holdTimer); holdTimer = null; director.hurry(); }
      // The press was the stage's: the button the pointer left focused must not fire on release.
      if (spaceTaken) { event.preventDefault(); spaceTaken = false; }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      if (holdTimer !== null) window.clearTimeout(holdTimer);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [director, fastForward, keepLine, menu, menuTab, openMemory, openMenu, overlay, screen, view.choice, view.keep, view.recall]);

  if (report.errors.length) {
    // The raw list is for whoever writes the script; a player gets one plain sentence.
    if (!import.meta.env.DEV) return <ScriptBroken errors={report.errors} />;
    return (
      <div className="lt-overlay" style={{ alignItems: 'flex-start', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.8 }}>
        <div>劇本有錯誤：</div>
        {report.errors.slice(0, 80).map((error) => <div key={error}>{error}</div>)}
      </div>
    );
  }

  if (screen === 'title') {
    return (
      <div className="lt-app" style={fontStyle}>
        <Title save={director.save} onStart={() => { void begin(); }} onStartOver={() => { void begin('over'); }} />
        {view.saveProblem && (
          <SaveNotice
            problem={view.saveProblem}
            onDismiss={() => director.dismissSaveProblem()}
            onStartOver={() => { setAsideNewerSave(storage); director.startOverHere(); }}
          />
        )}
      </div>
    );
  }
  if (screen === 'calibrate') return <div className="lt-app" style={fontStyle}><Calibration audio={audio} onDone={finishCalibration} /></div>;
  if (view.phase === 'ending') return <div className="lt-app" style={fontStyle}><Ending which={view.ending ?? 'c'} onBack={() => { setScreen('title'); }} /></div>;

  // Every question lights the memory button the same way, wanted or not, so its lighting up gives nothing away.
  const answering = Boolean(view.choice) && view.focus === 'main' && !view.recall;
  const teachRecall = answering && Boolean(view.choice?.teach);
  // Anything modal open (the menu, her memories, which line to drop, saying a memory): the rest cannot be reached.
  const behind = menu || Boolean(view.keep || view.recall);

  return (
    <div
      className={`lt-app${calm && !menu ? ' calm' : ''}`}
      style={fontStyle}
      onPointerUp={(event) => {
        if (menu || twoFinger.current) return;
        const target = event.target as HTMLElement;
        if (target.closest('button') || target.closest('.lt-interact') || director.view.interact) return;
        director.hurry();
      }}
    >
      <Stage
        director={director}
        view={view}
        onCapture={() => setPulse((value) => value + 1)}
        firstCueHint={cueHint}
        onCueHintShown={() => { setCueHint(false); try { storage?.setItem(HINT_KEY, 'done'); } catch { /* ignore */ } }}
        blocked={menu}
        onKeep={keepLine}
        onFastForward={fastForward}
      />
      <div className="lt-sr" aria-live="polite">{keptNote}</div>
      <button
        type="button"
        key={pulse}
        className={`lt-mem-btn${view.memoryCount ? ' has' : ''}${pulse ? ' pulse' : ''}${answering ? ' ready' : ''}${teachRecall || note === 'stored' ? ' teach' : ''}`}
        aria-label={answering ? '從記憶裡挑一句說出口' : '記憶'}
        aria-keyshortcuts="M"
        {...inertProps(behind)}
        onClick={(event) => { event.stopPropagation(); openMemory(); }}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 3.5H4.5v8" /><path d="M13 16.5h2.5v-8" /></svg>
      </button>
      {teachRecall ? (
        <div className="lt-mem-teach" role="status">
          記住的話都在這裡<br />要回答的時候，可以挑一句說出口<br />不一定每次都用得上
        </div>
      ) : note && (
        <div key={note} className={`lt-mem-teach note-${note}`} role="status">
          {note === 'stored'
            ? <>剛剛那句記下來了，收在這裡<br />點一下就能翻看</>
            : <>右下角的小圓點是選單<br />章節、音量、字體大小都在裡面</>}
        </div>
      )}
      <button
        type="button"
        className={`lt-corner${note === 'menu' ? ' teach' : ''}`}
        aria-label="選單"
        aria-keyshortcuts="Escape"
        {...inertProps(behind)}
        onClick={(event) => { event.stopPropagation(); openMenu(); }}
      >
        <span className="lt-corner-dot" />
      </button>
      {options.dev && <div className="lt-dev-tension" aria-hidden="true">緊張 {director.tension}</div>}
      {/* A save that stops landing mid-play is said once (the newer-build case was already said on the title). */}
      {view.saveProblem === 'failed' && <SaveNotice problem="failed" onDismiss={() => director.dismissSaveProblem()} behind={behind} />}
      {view.keep && <KeepPrompt director={director} memory={view.keep} behind={menu} />}
      {overlay === 'memory' && <MemoryPanel director={director} onClose={() => setOverlay(null)} />}
      {overlay === 'menu' && (
        <Menu
          director={director}
          tab={menuTab}
          onTab={setMenuTab}
          logFocus={logFocus}
          onClose={() => setOverlay(null)}
          onTitle={() => { setOverlay(null); setScreen('title'); }}
          onSettings={applySettings}
          onCalibrate={() => setOverlay('calib')}
          dev={options.dev}
        />
      )}
      {overlay === 'calib' && <div className="lt-recalib"><Calibration audio={audio} again onDone={() => setOverlay('menu')} /></div>}
    </div>
  );
}

/** Fullscreen is offered only where the browser has it (not iPhone Safari). */
function fullscreenAvailable(): boolean {
  return typeof document !== 'undefined' && Boolean(document.fullscreenEnabled) && typeof document.documentElement.requestFullscreen === 'function';
}

function setFullscreen(on: boolean): void {
  const request = on ? document.documentElement.requestFullscreen?.() : document.fullscreenElement ? document.exitFullscreen?.() : undefined;
  void request?.catch(() => undefined);
}

function ScriptBroken({ errors }: { errors: readonly string[] }) {
  useEffect(() => { console.error('script errors:', errors); }, [errors]);
  return <div className="lt-overlay" role="alert"><div className="lt-script-broken">這一天沒辦法開始。請重新整理，或稍後再來。</div></div>;
}

function safeStorage(): Storage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

// ───────────────────────── title ─────────────────────────

function Title({ save, onStart, onStartOver }: { save: GameSave; onStart: () => void; onStartOver: () => void }) {
  const inProgress = save.started && !save.finished;
  const chapter = CHAPTER_NUMERALS[save.chapter] ?? '';
  // The whole screen is the start button, and it has focus from the first frame: Enter or Space begins.
  const ref = useRef<HTMLDivElement>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { (save.finished ? firstChoice.current : ref.current)?.focus({ preventScroll: true }); }, [save.finished]);
  useEffect(() => { if (confirm) confirmButton.current?.focus({ preventScroll: true }); }, [confirm]);
  const endings = save.endings.length ? `抵達過的結局 ${save.endings.map((e) => e.toUpperCase()).sort().join(' ')}` : '';
  // After an ending a tap must not quietly forget everything: two ways back, and forgetting asks twice.
  if (save.finished) {
    return (
      <div className="lt-title lt-title-finished">
        <div className="lt-title-name">灰潮鎮</div>
        <div className="lt-title-sub">第七封信</div>
        <div className="lt-title-choices">
          <button ref={firstChoice} type="button" className="lt-opt" onClick={onStart}>回到最終章的早上</button>
          {confirm
            ? <button ref={confirmButton} type="button" className="lt-opt lt-danger" onClick={() => { setConfirm(false); onStartOver(); }}>確定，全部忘記</button>
            : <button type="button" className="lt-opt" onClick={() => setConfirm(true)}>從第一個十月三日重新開始</button>}
        </div>
        <div className="lt-title-meta">{endings}</div>
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className="lt-title"
      role="button"
      tabIndex={0}
      aria-keyshortcuts="Enter Space"
      onClick={onStart}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (!event.repeat) onStart();
      }}
    >
      <div className="lt-title-name">灰潮鎮</div>
      <div className="lt-title-sub">第七封信</div>
      <div className="lt-title-hint">
        請戴上耳機<br />
        {inProgress ? '點一下，繼續聆聽' : '點一下，開始聆聽'}
      </div>
      <div className="lt-title-meta">
        {inProgress ? (save.loop > 1 ? `${chapter}　第${toChineseNumber(save.loop)}次的十月三日` : chapter) : ''}
        {endings && `${inProgress ? '　·　' : ''}${endings}`}
      </div>
    </div>
  );
}

/** Why progress is not (or was not) kept: one plain sentence, said once, and what can be done about it. */
const SAVE_NOTICE: Record<SaveProblem, string> = {
  newer: '這份存檔來自比較新的版本，這次的進度不會存。',
  corrupt: '存檔讀不出來，只好從頭開始。讀不出來的那份另外留著。',
  restored: '存檔讀不出來，換回了上一次的備份，最近的一點進度可能不見了。',
  failed: '進度存不下來，可能是瀏覽器的空間滿了，或是開著無痕視窗。',
};

function SaveNotice({ problem, onDismiss, onStartOver, behind = false }: { problem: SaveProblem; onDismiss: () => void; onStartOver?: () => void; behind?: boolean }) {
  // Lost or unsaved progress interrupts (alert); a backup that loaded fine is only news (status).
  return (
    <div className={`lt-save-note problem-${problem}`} role={problem === 'restored' ? 'status' : 'alert'} onPointerUp={(event) => event.stopPropagation()} {...inertProps(behind)}>
      <p className="lt-save-text">{SAVE_NOTICE[problem]}</p>
      <div className="lt-save-actions">
        {problem === 'newer' && onStartOver && <button type="button" className="lt-opt" onClick={(event) => { event.stopPropagation(); onStartOver(); }}>用這一版重新開始</button>}
        <button type="button" className="lt-opt" onClick={(event) => { event.stopPropagation(); onDismiss(); }}>知道了</button>
      </div>
    </div>
  );
}

// ───────────────────────── calibration ─────────────────────────

const CALIBRATION: { at: number; text?: string; cue?: { dir: 'left' | 'right' | 'back' | 'front'; text: string } }[] = [
  { at: 400, text: '先確認一下聲音的方向' },
  { at: 2600, text: '左邊', cue: { dir: 'left', text: '叩' } },
  { at: 4800, text: '右邊', cue: { dir: 'right', text: '叩' } },
  { at: 7000, text: '如果左右反了，耳機可能戴反了' },
  { at: 9600, text: '後面', cue: { dir: 'back', text: '叩' } },
  { at: 11800, text: '前後分不太出來也沒關係' },
  { at: 14400, text: '聲音會從它真正的方向傳來' },
  { at: 17000 },
];

/** `again`: run from the menu over a paused scene, whose ambience stays as it is. */
function Calibration({ audio, onDone, again = false }: { audio: AudioEngine; onDone: () => void; again?: boolean }) {
  const [step, setStep] = useState(-1);
  const done = useRef(false);
  // Held in a ref: a caller passing a fresh callback each render must not restart the test's timers.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const finish = useCallback(() => { if (!done.current) { done.current = true; onDoneRef.current(); } }, []);
  useEffect(() => {
    if (!again) audio.setAmbience(['room_tone'], 1500);
    const timers = CALIBRATION.map((entry, index) => window.setTimeout(() => {
      if (index === CALIBRATION.length - 1) { finish(); return; }
      setStep(index);
      if (entry.cue) audio.play('cane_tap', { dir: entry.cue.dir, dist: 'mid' }, { gain: 1 });
    }, entry.at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [again, audio, finish]);
  // Esc (or the button, or a tap anywhere) skips it; Space and Enter do not, so a key still held from the title
  // cannot skip the one check of the headphones by accident.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.repeat) finish(); };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [finish]);
  const entry = step >= 0 ? CALIBRATION[step] : undefined;
  const place = entry?.cue ? placeOf({ dir: entry.cue.dir, dist: 'mid' }) : null;
  return (
    <div ref={ref} className="lt-stage lt-calib" onClick={finish} tabIndex={-1} role="region" aria-label="聲音測試">
      {place && entry?.cue && <><div key={`r${step}`} className="lt-ripple" style={{ left: place.left, top: place.top }} /><span key={`c${step}`} className="lt-p kind-sfx dist-mid" style={{ left: place.left, top: place.top }} aria-hidden="true">{entry.cue.text}</span></>}
      <div className="lt-center" aria-live="polite">
        {entry?.text && <div key={step} className="lt-line kind-narr revealed"><p className="lt-text"><span className="lt-phrase">{entry.text}</span></p></div>}
      </div>
      <button type="button" className="lt-calib-skip" aria-keyshortcuts="Escape" onClick={(event) => { event.stopPropagation(); finish(); }}>跳過聲音測試</button>
    </div>
  );
}

// ───────────────────────── memory layer ─────────────────────────

// Before the first midnight reset, nothing in the UI may hint that the day repeats.
function memoryMeta(memory: Memory, looped: boolean): string {
  return [looped ? `第${toChineseNumber(memory.loop)}次` : '', memory.clock, memory.place, memory.label].filter(Boolean).join(' · ');
}

type CornerNote = 'stored' | 'menu';

/** What she carries: opened from the 「」 button, on its own, never mixed into the menu. */
function MemoryPanel({ director, onClose }: { director: Director; onClose: () => void }) {
  const save = director.save;
  const box = useRef<HTMLDivElement>(null);
  // Focus lands on the heading, not on the first 放下, so opening it can never drop a line by accident.
  useModal(box, '#lt-memory-head');
  return (
    <div ref={box} className="lt-overlay" role="dialog" aria-modal="true" aria-labelledby="lt-memory-head" tabIndex={-1} onPointerUp={(event) => event.stopPropagation()}>
      <div className="lt-overlay-head" id="lt-memory-head" role="heading" aria-level={2} tabIndex={-1}>記憶</div>
      <div className="lt-panel">
        <div className="lt-count">{save.memories.length} ／ {MEMORY_CAPACITY}</div>
        {save.memories.length === 0 && <div className="lt-empty">還沒有記住任何一句<br />長按一句話，就能把它記下來<br />以後或許用得上</div>}
        {[...save.memories].reverse().map((memory) => (
          <div className="lt-mem" key={memory.key}>
            <div className="lt-mem-body">
              <div className="lt-mem-text" id={`lt-mem-${memory.key}`}>{unstop(memory.kind === 'me' ? `「${memory.text}」` : memory.text)}</div>
              <div className="lt-mem-meta">{memoryMeta(memory, save.loop > 1)}</div>
            </div>
            <button type="button" className="lt-mem-drop" id={`lt-drop-${memory.key}`} aria-labelledby={`lt-drop-${memory.key} lt-mem-${memory.key}`} onClick={() => director.releaseMemory(memory.key)}>放下</button>
          </div>
        ))}
      </div>
      <button type="button" className="lt-close" onClick={onClose}>回到故事</button>
    </div>
  );
}

type MenuTab = 'log' | 'chapters' | 'settings' | 'refs';
const MENU_TABS: [MenuTab, string][] = [['log', '剛剛聽到的'], ['chapters', '章節'], ['settings', '設定'], ['refs', '參考資料']];

/** The game's own menu, from the small dot: chapters, settings, credits. */
function Menu({ director, tab, onTab: setTab, logFocus, onClose, onTitle, onSettings, onCalibrate, dev }: { director: Director; tab: MenuTab; onTab: (tab: MenuTab) => void; logFocus: number; onClose: () => void; onTitle: () => void; onSettings: () => void; onCalibrate: () => void; dev: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // Opened on 剛剛聽到的 (H), focus lands on the newest line; otherwise on the open tab.
  useModal(box, tab === 'log' && logFocus && director.backlog.length ? `#${LOG_NEWEST}` : '[role="tab"][aria-selected="true"]');
  const confirmButton = useRef<HTMLButtonElement>(null);
  // The button is swapped for its confirmation: focus follows, so it is not dropped onto the page.
  useEffect(() => { if (confirm) confirmButton.current?.focus(); }, [confirm]);
  const save = director.save;
  const settings = director.settings;
  const set = (patch: Partial<typeof settings>) => { director.updateSettings(patch); onSettings(); };
  const [full, setFull] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const change = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  // Tabs: left and right arrows (Home, End) move between them and open the one they land on.
  const onTabKey = (event: ReactKeyboardEvent) => {
    const at = MENU_TABS.findIndex(([key]) => key === tab);
    const last = MENU_TABS.length - 1;
    const to = { ArrowRight: at === last ? 0 : at + 1, ArrowLeft: at === 0 ? last : at - 1, Home: 0, End: last }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    setTab(MENU_TABS[to][0]);
    box.current?.querySelector<HTMLElement>(`#lt-tab-${MENU_TABS[to][0]}`)?.focus();
  };
  return (
    <div ref={box} className="lt-overlay" role="dialog" aria-modal="true" aria-label="選單" tabIndex={-1} onPointerUp={(event) => event.stopPropagation()}>
      <div className="lt-tabs" role="tablist" aria-label="選單" onKeyDown={onTabKey}>
        {MENU_TABS.map(([key, name]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`lt-tab-${key}`}
            aria-selected={tab === key}
            aria-controls="lt-tabpanel"
            tabIndex={tab === key ? 0 : -1}
            className={`lt-tab${tab === key ? ' on' : ''}`}
            onClick={() => setTab(key)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="lt-tabpanel" role="tabpanel" id="lt-tabpanel" aria-labelledby={`lt-tab-${tab}`}>
        {tab === 'settings' && (
          <div className="lt-panel">
            <Toggle label="聲音" on={settings.audio} onChange={(audio) => set({ audio })} />
            <Slider label="總音量" value={settings.volume} onChange={(volume) => set({ volume })} />
            <Slider label="環境音" value={settings.ambience} onChange={(ambience) => set({ ambience })} />
            <Slider label="音效" value={settings.sfx} onChange={(sfx) => set({ sfx })} />
            <Slider label="讀屏" value={settings.voice} onChange={(voice) => set({ voice })} />
            <div className="lt-row"><span id="lt-calib-row">聲音測試</span><button type="button" className="lt-opt" aria-describedby="lt-calib-row" onClick={onCalibrate}>再聽一次</button></div>
            {fullscreenAvailable() && <Toggle label="全螢幕" on={full} onChange={setFullscreen} />}
            <Toggle label="震動" on={settings.vibration} onChange={(vibration) => set({ vibration })} />
            <Toggle label="手機讀屏念出來" on={settings.reader} onChange={(reader) => set({ reader })} />
            <Toggle label="畫面晃動" on={settings.motion} onChange={(motion) => set({ motion })} />
            <Toggle label="聲音來源" on={settings.soundLabels} onChange={(soundLabels) => set({ soundLabels })} />
            <Toggle label="聽過的話自動放快" on={settings.fastHeard} onChange={(fastHeard) => set({ fastHeard })} />
            <Toggle label="選擇不倒數" on={settings.untimedChoices} onChange={(untimedChoices) => set({ untimedChoices })} />
            <Options
              label="字體大小"
              value={settings.fontSize}
              options={(Object.keys(FONT_SIZES) as FontSize[]).map((size) => [size, FONT_SIZES[size].label])}
              onChange={(fontSize) => set({ fontSize })}
            />
            <Options label="文字速度" value={settings.textSpeed} options={[['slow', '慢'], ['normal', '中'], ['fast', '快'], ['instant', '立即']]} onChange={(textSpeed) => set({ textSpeed })} />
            <Options label="自動閱讀" value={settings.autoAdvance ? 'auto' : 'manual'} options={[['auto', '自動'], ['manual', '手動']]} onChange={(mode) => set({ autoAdvance: mode === 'auto' })} />
            <div className="lt-row"><span>回到標題</span><button type="button" className="lt-opt" aria-label="回到標題" onClick={onTitle}>回去</button></div>
            <div className="lt-row"><span>{save.loop > 1 ? '從第一個十月三日重新開始' : '從頭開始'}</span>
              {confirm
                ? <button ref={confirmButton} type="button" className="lt-opt lt-danger" onClick={() => { setConfirm(false); director.newGame(); onClose(); }}>確定，全部忘記</button>
                : <button type="button" className="lt-opt" onClick={() => setConfirm(true)}>清除進度</button>}
            </div>
          </div>
        )}
        {tab === 'log' && <Backlog entries={director.backlog} looped={save.loop > 1} focus={logFocus} />}
        {tab === 'chapters' && <Chapters director={director} dev={dev} onPicked={onClose} />}
        {tab === 'refs' && <References />}
      </div>
      <button type="button" className="lt-close" onClick={onClose}>回到故事</button>
    </div>
  );
}

// ───────────────────────── what she just heard ─────────────────────────

const LOG_NEWEST = 'lt-log-newest';

/**
 * 剛剛聽到的: the lines heard clearly, oldest first, under a heading for each place (and each day, once there has been
 * more than one). A list item per line, so a screen reader steps through them; the newest is at the bottom and is
 * where focus goes when H opens it.
 */
function Backlog({ entries, looped, focus }: { entries: readonly BacklogEntry[]; looped: boolean; focus: number }) {
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const newest = list.current?.querySelector<HTMLElement>(`#${LOG_NEWEST}`);
    newest?.scrollIntoView?.({ block: 'end' });
    if (focus) newest?.focus({ preventScroll: true });
  }, [focus]);
  if (!entries.length) return <div className="lt-panel"><div className="lt-empty">還沒有聽清楚任何一句</div></div>;
  const groups: { head: string; entries: BacklogEntry[] }[] = [];
  let last: BacklogEntry | undefined;
  for (const entry of entries) {
    if (!last || entry.place !== last.place || entry.loop !== last.loop) {
      const day = looped ? `第${toChineseNumber(entry.loop)}次` : '';
      groups.push({ head: [day, entry.clock, entry.place].filter(Boolean).join(' · ') || '……', entries: [] });
    }
    groups[groups.length - 1].entries.push(entry);
    last = entry;
  }
  const newestKey = entries[entries.length - 1].key;
  return (
    <div className="lt-panel lt-log" ref={list}>
      {groups.map((group, index) => (
        <section key={group.entries[0].key} aria-labelledby={`lt-log-head-${index}`}>
          <h3 className="lt-log-head" id={`lt-log-head-${index}`}>{group.head}</h3>
          <ul className="lt-log-list">
            {group.entries.map((entry) => (
              <li key={entry.key} className={`lt-log-line kind-${entry.kind}`} {...(entry.key === newestKey ? { id: LOG_NEWEST, tabIndex: -1 } : {})}>
                {entry.label && <span className="lt-log-label">{entry.label}<span className="lt-sr">：</span></span>}
                {entry.kind === 'think' && <span className="lt-sr">心裡想：</span>}
                <span className="lt-log-text">{unstop(entry.kind === 'me' ? `「${entry.text}」` : entry.text)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ───────────────────────── chapter list ─────────────────────────

function Chapters({ director, dev, onPicked }: { director: Director; dev: boolean; onPicked: () => void }) {
  const save = director.save;
  const list = director.chapterList;
  const target = director.progressChapter;
  const targetIndex = list.findIndex((chapter) => chapter.key === target);
  const numeral = (key: string) => CHAPTER_NUMERALS[key] ?? key;
  // Starting the day over asks twice; before the first midnight it is not offered at all, since nothing may yet hint
  // that the day comes back.
  const [confirm, setConfirm] = useState<string | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirm) confirmButton.current?.focus({ preventScroll: true }); }, [confirm]);
  const restart = (key: string) => key === target && !save.replay;
  const action = (key: string, index: number) => {
    if (key === target) return save.replay ? '現在回去' : confirm === key ? '確定，從早上重來' : '從早上重來';
    return index < targetIndex ? '回去這一天' : '跳過去';
  };
  const pick = (key: string) => {
    if (restart(key) && confirm !== key) { setConfirm(key); return; }
    setConfirm(null);
    director.selectChapter(key);
    onPicked();
  };
  return (
    <div className="lt-panel">
      {save.replay
        ? <div className="lt-empty">現在在{numeral(save.chapter)}，這一天過了午夜，會回到{numeral(target)}</div>
        : save.loop > 1 && <div className="lt-empty">我想<br />回到「{numeral(target)}」</div>}
      {list.map((chapter, index) => {
        const open = dev || save.reached.includes(chapter.key);
        const now = chapter.key === save.chapter;
        return (
          <div className="lt-row" key={chapter.key}>
            <span id={`lt-ch-${chapter.key}`}>{numeral(chapter.key)}　{open ? chapter.title : '……'}{now ? '　·　現在' : ''}</span>
            {open && !(restart(chapter.key) && save.loop === 1) && (
              <button ref={confirm === chapter.key ? confirmButton : undefined} type="button" className={`lt-opt${confirm === chapter.key ? ' lt-danger' : ''}`} id={`lt-ch-go-${chapter.key}`} aria-labelledby={`lt-ch-go-${chapter.key} lt-ch-${chapter.key}`} onClick={() => pick(chapter.key)}>
                {action(chapter.key, index)}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const FONTS = [
  { name: '霞鶩文楷 TC', author: 'LXGW WenKai Project Authors', url: 'https://github.com/lxgw/LxgwWenkaiTC' },
  { name: 'Noto Serif TC', author: 'Google', url: 'https://fonts.google.com/noto/specimen/Noto+Serif+TC' },
  { name: '更紗黑體 Sarasa Fixed TC', author: 'Belleve Invis', url: 'https://github.com/be5invis/Sarasa-Gothic' },
  { name: '芫荽 Iansui', author: 'The Iansui Project Authors', url: 'https://github.com/ButTaiwan/iansui' },
];

const WRITING = [
  { name: 'speak-human-tw', author: 'Raymondhou0917', url: 'https://github.com/Raymondhou0917/speak-human-tw', note: '去掉 AI 腔，用台灣的說法' },
  { name: 'i-have-adhd-zh-tw', author: 'panda850819', url: 'https://github.com/panda850819/i-have-adhd-zh-tw', note: '先講重點，句子短而完整' },
];

// CREDITS.md is fetched once per session, the first time the tab opens.
let soundSources: Promise<SoundSource[]> | undefined;
function loadSoundSources(): Promise<SoundSource[]> {
  soundSources ??= fetch(sampleUrl('CREDITS.md'))
    .then((res) => { if (!res.ok) throw new Error(String(res.status)); return res.text(); })
    .then(parseSoundSources)
    .catch((error: unknown) => { soundSources = undefined; throw error; });
  return soundSources;
}

function References() {
  const [sources, setSources] = useState<SoundSource[] | 'loading' | 'failed'>('loading');
  useEffect(() => {
    let live = true;
    loadSoundSources().then((list) => { if (live) setSources(list); }, () => { if (live) setSources('failed'); });
    return () => { live = false; };
  }, []);
  const link = (url: string, text: string) => <a href={url} target="_blank" rel="noreferrer">{text}</a>;
  const sourceGroup = (kind: SoundSource['kind'], head: string) => Array.isArray(sources) && (
    <div className="lt-credits">
      <div className="lt-credits-head">{head}</div>
      {sources.filter((source) => source.kind === kind).map((source) => (
        <div className="lt-credit" key={source.url}>
          <span className="lt-credit-use">{source.uses.join('、')}</span>
          {link(source.url, source.title)}
          <span> — {source.author}{source.license === 'CC0' ? '' : `，${source.license}`}</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="lt-panel">
      <div className="lt-credits">
        <div className="lt-credits-head">聲音</div>
        <div className="lt-credit">
          錄音都來自 {link('https://freesound.org', 'Freesound')}，大多是 CC0，不必標示作者，這裡還是全部列出。每段都經過裁切、淡入淡出、調整音量；沒有錄音或錄音還沒載入的聲音，由瀏覽器當場合成。
        </div>
      </div>
      <div className="lt-credits">
        <div className="lt-credits-head">需要標示作者的錄音</div>
        {ATTRIBUTION_CREDITS.map((credit) => (
          <div className="lt-credit" key={credit.url}>
            <span className="lt-credit-use">{credit.use}</span>
            {link(credit.url, credit.title)}
            <span> — {credit.author}，</span>
            {link(credit.licenseUrl, credit.license)}
            <span>，已裁切、濾波、調整音量</span>
          </div>
        ))}
      </div>
      {sources === 'loading' && <div className="lt-credits"><div className="lt-credit">清單讀取中……</div></div>}
      {sources === 'failed' && <div className="lt-credits"><div className="lt-credit">清單讀不到，可以直接看{link(sampleUrl('CREDITS.md'), '完整清單')}</div></div>}
      {sourceGroup('amb', '環境音')}
      {sourceGroup('sfx', '音效')}
      {Array.isArray(sources) && <div className="lt-credits"><div className="lt-credit">每段錄音的來源和處理方式，都寫在{link(sampleUrl('CREDITS.md'), '完整清單')}裡</div></div>}
      <div className="lt-credits">
        <div className="lt-credits-head">字型</div>
        {FONTS.map((font) => (
          <div className="lt-credit" key={font.url}>{link(font.url, font.name)}<span> — {font.author}，SIL Open Font License 1.1</span></div>
        ))}
      </div>
      <div className="lt-credits">
        <div className="lt-credits-head">寫作參考</div>
        {WRITING.map((ref) => (
          <div className="lt-credit" key={ref.url}>
            <span className="lt-credit-use">{ref.note}</span>
            {link(ref.url, ref.name)}<span> — {ref.author}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 開／關 as one switch named by its row: a screen reader hears 「聲音，開關，開啟」. A click on either word sets it to
 * that word; the keyboard (or a screen reader) flips it.
 */
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  return (
    <div className="lt-row">
      <span id={id}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={id}
        className="lt-switch"
        onClick={(event) => {
          const picked = (event.target as HTMLElement).closest<HTMLElement>('[data-value]')?.dataset.value;
          onChange(picked ? picked === 'on' : !on);
        }}
      >
        <span data-value="on" className={`lt-opt${on ? ' on' : ''}`}>開</span>
        <span data-value="off" className={`lt-opt${!on ? ' on' : ''}`}>關</span>
      </button>
    </div>
  );
}

/** A volume, named by its row and read out as a percentage. */
function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div className="lt-row">
      <span id={id}>{label}</span>
      <input
        className="lt-range"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        aria-labelledby={id}
        aria-valuetext={`${Math.round(value * 100)}%`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

/** One of a few: a group named by its row, the chosen one pressed. */
function Options<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  const id = useId();
  return (
    <div className="lt-row">
      <span id={id}>{label}</span>
      <div className="lt-opts" role="group" aria-labelledby={id}>
        {options.map(([key, text]) => (
          <button key={key} type="button" className={`lt-opt${value === key ? ' on' : ''}`} aria-pressed={value === key} onClick={() => onChange(key)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

/** Memory full: which line to let go. It floats under the line she is hearing, laid out like the recall list. */
function KeepPrompt({ director, memory, behind }: { director: Director; memory: Memory; behind: boolean }) {
  const short = (text: string, n: number) => { const shown = unstop(text); return shown.length > n ? `${shown.slice(0, n)}……` : shown; };
  const box = useRef<HTMLDivElement>(null);
  // Focus starts on 這次不記了, the one choice that loses nothing.
  useModal(box);
  return (
    <div
      ref={box}
      className="lt-recall lt-keep"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lt-keep-head"
      aria-describedby="lt-keep-hint"
      tabIndex={-1}
      onPointerUp={(event) => event.stopPropagation()}
      onKeyDown={(event) => arrowsBetween(event, '.lt-recall-item')}
      {...inertProps(behind)}
    >
      <div className="lt-recall-head" id="lt-keep-head">記不下了</div>
      <div className="lt-recall-hint" id="lt-keep-hint">要放掉哪一句，換成「{short(memory.text, 14)}」？</div>
      <button type="button" className="lt-recall-cancel" onClick={() => director.skipKeep()}>這次不記了</button>
      <div className="lt-recall-list">
        {director.save.memories.map((existing) => (
          <button key={existing.key} type="button" className="lt-recall-item" aria-label={unstop(existing.text)} onClick={() => director.releaseMemory(existing.key)}>
            <span className="lt-recall-text">{short(existing.text, 22)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── endings ─────────────────────────

const ENDINGS: Record<'a' | 'c', { lines: string[]; mark: string }> = {
  c: { lines: ['十月四日'], mark: '結局 C' },
  a: { lines: ['十月四日', '舊車站的牆裡，還有一點點聲音'], mark: '結局 A' },
};

/** Who made the sounds and letters, said slowly after the ending: CC BY recordists by name, fonts by license. */
const ENDING_RECORDISTS = [...new Set(ATTRIBUTION_CREDITS.map((credit) => credit.author))];

function Ending({ which, onBack }: { which: 'a' | 'c'; onBack: () => void }) {
  const ending = ENDINGS[which];
  // Focus moves onto the ending's heading, so a screen reader starts reading it rather than the page behind.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  const at = (step: number) => ({ animationDelay: `${800 + step * 2600}ms` });
  const after = ending.lines.length;
  return (
    <div className="lt-ending">
      <h1 ref={heading} className="lt-ending-line lt-ending-heading" tabIndex={-1} style={at(0)}>{ending.lines[0]}</h1>
      {ending.lines.slice(1).map((line, index) => <div key={line} className="lt-ending-line" style={at(index + 1)}>{line}</div>)}
      <div className="lt-ending-mark" style={{ animationDelay: `${800 + after * 2600 + 1200}ms` }}>{ending.mark}</div>
      <div className="lt-ending-mark" style={{ animationDelay: `${800 + after * 2600 + 2600}ms` }}>灰潮鎮：第七封信</div>
      <div className="lt-ending-credits" style={{ animationDelay: `${800 + after * 2600 + 4600}ms` }}>
        <div className="lt-ending-credits-roll" style={{ animationDelay: `${800 + after * 2600 + 5600}ms` }}>
          <div className="lt-ending-credits-head">聲音</div>
          {ENDING_RECORDISTS.map((author) => <div key={author}>{author}（CC BY）</div>)}
          <div>其餘錄音來自 Freesound（CC0）</div>
          <div className="lt-ending-credits-head">字體</div>
          {FONTS.map((font) => <div key={font.name}>{font.name}（SIL OFL 1.1）</div>)}
        </div>
      </div>
      <button type="button" className="lt-ending-back" style={{ animationDelay: `${800 + after * 2600 + 6600}ms` }} onClick={onBack}>謝謝你聽完　·　回到標題</button>
    </div>
  );
}

