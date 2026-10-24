import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createAudioEngine, type AudioEngine } from './audio/engine';
import { VIBRATIONS, type VibrationId } from './audio/catalog';
import { ATTRIBUTION_CREDITS } from './audio/credits';
import { sampleUrl } from './audio/samples';
import { Director, toChineseNumber } from './engine/director';
import { MEMORY_CAPACITY, readSave, writeSave, type GameSave, type Memory } from './engine/save';
import { loadGameScript } from './script/load';
import { CHAPTER_NUMERALS } from './script/types';
import { Stage } from './ui/Stage';
import { placeOf } from './ui/geometry';
import './ui/game.css';

type Screen = 'title' | 'calibrate' | 'play';
const HINT_KEY = 'listening-town-cue-hint';

function params() {
  const search = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  return {
    speed: Math.max(1, Number(search.get('fast') ?? 1) || 1),
    chapter: search.get('chapter'),
    know: search.get('know') !== '0',
    reset: search.has('reset'),
    mute: search.has('mute'),
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
    if (options.reset) storage?.removeItem('listening-town-save-v1');
    const save = readSave(storage);
    return new Director(report.script, save, { audio, vibrate, persist: (next: GameSave) => writeSave(storage, next), wallNow: () => Date.now() }, { speed: options.speed });
  }, [audio, options, report, storage]);
  useSyncExternalStore(director.subscribe, director.getVersion);
  const view = director.view;

  const [screen, setScreen] = useState<Screen>('title');
  const [menu, setMenu] = useState(false);
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

  const applySettings = useCallback(() => {
    const settings = director.settings;
    audio.setEnabled(settings.audio && !options.mute);
    audio.setVolume(settings.volume);
    audio.setAmbienceVolume(settings.ambience);
    audio.setSfxVolume(settings.sfx);
    audio.setVoiceVolume(settings.voice);
  }, [audio, director, options.mute]);

  const begin = useCallback(async () => {
    await audio.unlock();
    applySettings();
    if (options.chapter) { setScreen('play'); director.jumpToChapter(options.chapter, options.know); return; }
    if (director.save.finished) director.newGame();
    if (!director.save.calibrated && options.speed === 1) { setScreen('calibrate'); return; }
    setScreen('play');
    director.start();
  }, [applySettings, audio, director, options]);

  const finishCalibration = useCallback(() => {
    director.save.calibrated = true;
    writeSave(storage, director.save);
    setScreen('play');
    director.start();
  }, [director, storage]);

  // Keyboard: Space/Enter hurries, holding Space keeps the line, digits choose, Esc opens the memory layer.
  useEffect(() => {
    if (screen !== 'play') return;
    let holdTimer: number | null = null;
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu((open) => !open); return; }
      if (menu) return;
      const onButton = (event.target as HTMLElement | null)?.tagName === 'BUTTON';
      if (/^[1-9]$/.test(event.key) && view.choice) {
        const option = view.choice.options[Number(event.key) - 1];
        if (option) director.choose(option.index);
        return;
      }
      if (event.key === ' ' && !event.repeat) {
        event.preventDefault();
        holdTimer = window.setTimeout(() => { holdTimer = null; if (director.capture()) setPulse((value) => value + 1); }, 600);
      }
      if (event.key === 'Enter' && !onButton) director.hurry();
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === ' ' && holdTimer !== null) { window.clearTimeout(holdTimer); holdTimer = null; director.hurry(); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [director, menu, screen, view.choice]);

  if (report.errors.length) {
    return (
      <div className="lt-overlay" style={{ alignItems: 'flex-start', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.8 }}>
        <div>劇本有錯誤：</div>
        {report.errors.slice(0, 80).map((error) => <div key={error}>{error}</div>)}
      </div>
    );
  }

  if (screen === 'title') return <Title save={director.save} onStart={begin} />;
  if (screen === 'calibrate') return <Calibration audio={audio} onDone={finishCalibration} />;
  if (view.phase === 'ending') return <Ending which={view.ending ?? 'c'} onBack={() => { setScreen('title'); }} />;

  return (
    <div
      onPointerUp={(event) => {
        if (menu) return;
        const target = event.target as HTMLElement;
        if (target.closest('button')) return;
        director.hurry();
      }}
    >
      <Stage
        director={director}
        view={view}
        onCapture={() => setPulse((value) => value + 1)}
        firstCueHint={cueHint}
        onCueHintShown={() => { setCueHint(false); try { storage?.setItem(HINT_KEY, 'done'); } catch { /* ignore */ } }}
      />
      <button
        type="button"
        key={pulse}
        className={`lt-corner${view.memoryCount ? ' has' : ''}${pulse ? ' pulse' : ''}`}
        aria-label="記憶與設定"
        onClick={(event) => { event.stopPropagation(); setMenu(true); }}
      >
        <span className="lt-corner-dot" />
      </button>
      {view.keep && <KeepPrompt director={director} memory={view.keep} />}
      {menu && (
        <Menu
          director={director}
          onClose={() => setMenu(false)}
          onTitle={() => { setMenu(false); setScreen('title'); }}
          onSettings={applySettings}
        />
      )}
    </div>
  );
}

function safeStorage(): Storage | undefined {
  try { return window.localStorage; } catch { return undefined; }
}

// ───────────────────────── title ─────────────────────────

function Title({ save, onStart }: { save: GameSave; onStart: () => void }) {
  const inProgress = save.started && !save.finished;
  const chapter = CHAPTER_NUMERALS[save.chapter] ?? '';
  return (
    <div className="lt-title" role="button" tabIndex={0} onClick={onStart} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onStart(); }}>
      <div className="lt-title-name">灰潮鎮</div>
      <div className="lt-title-sub">第七封信</div>
      <div className="lt-title-hint">
        請戴上耳機<br />
        {inProgress ? '點一下，繼續聆聽' : '點一下，開始聆聽'}
      </div>
      <div className="lt-title-meta">
        {inProgress ? `${chapter}　第 ${toChineseNumber(save.loop)} 次的十月三日` : ''}
        {save.endings.length ? `${inProgress ? '　·　' : ''}抵達過的結局 ${save.endings.map((e) => e.toUpperCase()).sort().join(' ')}` : ''}
      </div>
    </div>
  );
}

// ───────────────────────── calibration ─────────────────────────

const CALIBRATION: { at: number; text?: string; cue?: { dir: 'left' | 'right' | 'back' | 'front'; text: string } }[] = [
  { at: 400, text: '先確認聲音的方向。' },
  { at: 2600, text: '左邊。', cue: { dir: 'left', text: '叩' } },
  { at: 4800, text: '右邊。', cue: { dir: 'right', text: '叩' } },
  { at: 7000, text: '後面。', cue: { dir: 'back', text: '叩' } },
  { at: 9200, text: '分不太出前後，也沒關係。' },
  { at: 11800, text: '聲音會出現在它真正的方向。' },
  { at: 14200, text: '點一下聲音，就能轉過去聽。' },
  { at: 16800, text: '長按一句話，就能記住它。' },
  { at: 19600 },
];

function Calibration({ audio, onDone }: { audio: AudioEngine; onDone: () => void }) {
  const [step, setStep] = useState(-1);
  const done = useRef(false);
  const finish = useCallback(() => { if (!done.current) { done.current = true; onDone(); } }, [onDone]);
  useEffect(() => {
    audio.setAmbience(['room_tone'], 1500);
    const timers = CALIBRATION.map((entry, index) => window.setTimeout(() => {
      if (index === CALIBRATION.length - 1) { finish(); return; }
      setStep(index);
      if (entry.cue) audio.play('cane_tap', { dir: entry.cue.dir, dist: 'mid' }, { gain: 1 });
    }, entry.at));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [audio, finish]);
  const entry = step >= 0 ? CALIBRATION[step] : undefined;
  const place = entry?.cue ? placeOf({ dir: entry.cue.dir, dist: 'mid' }) : null;
  return (
    <div className="lt-stage lt-calib" onClick={finish}>
      {place && entry?.cue && <><div key={`r${step}`} className="lt-ripple" style={{ left: place.left, top: place.top }} /><span key={`c${step}`} className="lt-p kind-sfx dist-mid" style={{ left: place.left, top: place.top }}>{entry.cue.text}</span></>}
      <div className="lt-center">
        {entry?.text && <div key={step} className="lt-line kind-narr revealed"><p className="lt-text"><span className="lt-phrase">{entry.text}</span></p></div>}
      </div>
    </div>
  );
}

// ───────────────────────── memory layer ─────────────────────────

function memoryMeta(memory: Memory): string {
  return [`第${toChineseNumber(memory.loop)}次`, memory.clock, memory.place, memory.label].filter(Boolean).join(' · ');
}

function Menu({ director, onClose, onTitle, onSettings }: { director: Director; onClose: () => void; onTitle: () => void; onSettings: () => void }) {
  const [tab, setTab] = useState<'memory' | 'settings'>('memory');
  const [confirm, setConfirm] = useState(false);
  const save = director.save;
  const settings = director.settings;
  const set = (patch: Partial<typeof settings>) => { director.updateSettings(patch); onSettings(); };
  return (
    <div className="lt-overlay" onPointerUp={(event) => event.stopPropagation()}>
      <div className="lt-tabs">
        <button type="button" className={`lt-tab${tab === 'memory' ? ' on' : ''}`} onClick={() => setTab('memory')}>記憶</button>
        <button type="button" className={`lt-tab${tab === 'settings' ? ' on' : ''}`} onClick={() => setTab('settings')}>設定</button>
      </div>
      {tab === 'memory' && (
        <div className="lt-panel">
          <div className="lt-count">{save.memories.length} ／ {MEMORY_CAPACITY}</div>
          {save.memories.length === 0 && <div className="lt-empty">還沒有記住任何一句話。<br />長按聽清楚的話，就能把它帶過午夜。</div>}
          {[...save.memories].reverse().map((memory) => (
            <div className="lt-mem" key={memory.key}>
              <div className="lt-mem-body">
                <div className="lt-mem-text">{memory.kind === 'me' ? `「${memory.text}」` : memory.text}</div>
                <div className="lt-mem-meta">{memoryMeta(memory)}</div>
              </div>
              <button type="button" className="lt-mem-drop" onClick={() => director.releaseMemory(memory.key)}>放下</button>
            </div>
          ))}
        </div>
      )}
      {tab === 'settings' && (
        <div className="lt-panel">
          <div className="lt-row"><span>聲音</span><Toggle on={settings.audio} onChange={(audio) => set({ audio })} /></div>
          <div className="lt-row"><span>總音量</span><input className="lt-range" type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(event) => set({ volume: Number(event.target.value) })} /></div>
          <div className="lt-row"><span>環境音</span><input className="lt-range" type="range" min={0} max={1} step={0.05} value={settings.ambience} onChange={(event) => set({ ambience: Number(event.target.value) })} /></div>
          <div className="lt-row"><span>音效</span><input className="lt-range" type="range" min={0} max={1} step={0.05} value={settings.sfx} onChange={(event) => set({ sfx: Number(event.target.value) })} /></div>
          <div className="lt-row"><span>震動</span><Toggle on={settings.vibration} onChange={(vibration) => set({ vibration })} /></div>
          <div className="lt-row"><span>文字速度</span>
            <div className="lt-opts">
              {(['slow', 'normal', 'fast'] as const).map((speed) => (
                <button key={speed} type="button" className={`lt-opt${settings.textSpeed === speed ? ' on' : ''}`} onClick={() => set({ textSpeed: speed })}>{{ slow: '慢', normal: '中', fast: '快' }[speed]}</button>
              ))}
            </div>
          </div>
          <div className="lt-row"><span>自動前進</span>
            <div className="lt-opts">
              <button type="button" className={`lt-opt${settings.autoAdvance ? ' on' : ''}`} onClick={() => set({ autoAdvance: true })}>自動</button>
              <button type="button" className={`lt-opt${!settings.autoAdvance ? ' on' : ''}`} onClick={() => set({ autoAdvance: false })}>等我點</button>
            </div>
          </div>
          <div className="lt-row"><span>回到標題</span><button type="button" className="lt-opt" onClick={onTitle}>回去</button></div>
          <div className="lt-row"><span>從第一個十月三日重新開始</span>
            {confirm
              ? <button type="button" className="lt-opt lt-danger" onClick={() => { setConfirm(false); director.newGame(); onClose(); }}>確定，全部忘記</button>
              : <button type="button" className="lt-opt" onClick={() => setConfirm(true)}>重新開始</button>}
          </div>
          <div className="lt-credits">
            <div className="lt-credits-head">聲音素材</div>
            {ATTRIBUTION_CREDITS.map((credit) => (
              <div className="lt-credit" key={credit.url}>
                <span className="lt-credit-use">{credit.use}</span>
                <a href={credit.url} target="_blank" rel="noreferrer">{credit.title}</a>
                <span> — {credit.author}，</span>
                <a href={credit.licenseUrl} target="_blank" rel="noreferrer">{credit.license}</a>
                <span>，已裁切、濾波、調整音量</span>
              </div>
            ))}
            <div className="lt-credit">其餘錄音皆為 Freesound 上的 CC0 作品，<a href={sampleUrl('CREDITS.md')} target="_blank" rel="noreferrer">完整清單</a></div>
          </div>
        </div>
      )}
      <button type="button" className="lt-close" onClick={onClose}>回到聲音裡</button>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="lt-opts">
      <button type="button" className={`lt-opt${on ? ' on' : ''}`} onClick={() => onChange(true)}>開</button>
      <button type="button" className={`lt-opt${!on ? ' on' : ''}`} onClick={() => onChange(false)}>關</button>
    </div>
  );
}

function KeepPrompt({ director, memory }: { director: Director; memory: Memory }) {
  return (
    <div className="lt-keep" onPointerUp={(event) => event.stopPropagation()}>
      <div className="lt-keep-q">已經記不下了。<br />要放下哪一段，換成「{memory.text.slice(0, 14)}{memory.text.length > 14 ? '……' : ''}」？</div>
      {director.save.memories.map((existing) => (
        <button key={existing.key} type="button" onClick={() => director.releaseMemory(existing.key)}>{existing.text.slice(0, 22)}{existing.text.length > 22 ? '……' : ''}</button>
      ))}
      <button type="button" onClick={() => director.skipKeep()} style={{ color: 'var(--ink-faint)', marginTop: 6 }}>這次不記了</button>
    </div>
  );
}

// ───────────────────────── endings ─────────────────────────

const ENDINGS: Record<'a' | 'c', { lines: string[]; mark: string }> = {
  c: {
    lines: ['十月四日。', '零點以後的世界，沒有人聽過。', '所以每一個聲音，都是第一次。'],
    mark: '結局 C　停止改寫',
  },
  a: {
    lines: ['十月四日。', '這一個今天，被留下來了。', '可是舊車站的牆裡，還有一點點聲音。'],
    mark: '結局 A　只留下這一個今天',
  },
};

function Ending({ which, onBack }: { which: 'a' | 'c'; onBack: () => void }) {
  const ending = ENDINGS[which];
  return (
    <div className="lt-ending">
      {ending.lines.map((line, index) => <div key={line} className="lt-ending-line" style={{ animationDelay: `${800 + index * 2600}ms` }}>{line}</div>)}
      <div className="lt-ending-mark" style={{ animationDelay: `${800 + ending.lines.length * 2600 + 1200}ms` }}>{ending.mark}</div>
      <div className="lt-ending-mark" style={{ animationDelay: `${800 + ending.lines.length * 2600 + 2600}ms` }}>灰潮鎮：第七封信</div>
      <button type="button" className="lt-ending-back" style={{ animationDelay: `${800 + ending.lines.length * 2600 + 4600}ms` }} onClick={onBack}>謝謝你聽完　·　回到標題</button>
    </div>
  );
}

