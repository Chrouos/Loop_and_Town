import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { createAudioEngine, type AudioEngine } from './audio/engine';
import { VIBRATIONS, type VibrationId } from './audio/catalog';
import { ATTRIBUTION_CREDITS } from './audio/credits';
import { sampleUrl } from './audio/samples';
import { parseSoundSources, type SoundSource } from './audio/sourceList';
import { Director, toChineseNumber } from './engine/director';
import { FONT_SIZES, MEMORY_CAPACITY, readSave, writeSave, type FontSize, type GameSave, type Memory } from './engine/save';
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
    if (options.reset) storage?.removeItem('listening-town-save-v1');
    const save = readSave(storage);
    const created = new Director(report.script, save, { audio, vibrate, persist: (next: GameSave) => writeSave(storage, next), wallNow: () => Date.now() }, { speed: options.speed });
    if (options.tension !== null && Number.isFinite(Number(options.tension))) created.setTension(Number(options.tension));
    return created;
  }, [audio, options, report, storage]);
  useSyncExternalStore(director.subscribe, director.getVersion);
  const view = director.view;
  const fontStyle = { '--text-scale': FONT_SIZES[director.settings.fontSize].scale } as CSSProperties;

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
      if (view.recall) {
        if (event.key === 'Escape') { director.recallPick(null); return; }
        const memory = /^[1-9]$/.test(event.key) ? view.recall.memories[Number(event.key) - 1] : undefined;
        if (memory) director.recallPick(memory.key);
        return;
      }
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
  }, [director, menu, screen, view.choice, view.recall]);

  if (report.errors.length) {
    return (
      <div className="lt-overlay" style={{ alignItems: 'flex-start', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.8 }}>
        <div>劇本有錯誤：</div>
        {report.errors.slice(0, 80).map((error) => <div key={error}>{error}</div>)}
      </div>
    );
  }

  if (screen === 'title') return <div className="lt-app" style={fontStyle}><Title save={director.save} onStart={begin} /></div>;
  if (screen === 'calibrate') return <div className="lt-app" style={fontStyle}><Calibration audio={audio} onDone={finishCalibration} /></div>;
  if (view.phase === 'ending') return <div className="lt-app" style={fontStyle}><Ending which={view.ending ?? 'c'} onBack={() => { setScreen('title'); }} /></div>;

  return (
    <div
      className="lt-app"
      style={fontStyle}
      onPointerUp={(event) => {
        if (menu) return;
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
      {options.dev && <div className="lt-dev-tension" aria-hidden="true">緊張 {director.tension}</div>}
      {view.keep && <KeepPrompt director={director} memory={view.keep} />}
      {menu && (
        <Menu
          director={director}
          onClose={() => setMenu(false)}
          onTitle={() => { setMenu(false); setScreen('title'); }}
          onSettings={applySettings}
          dev={options.dev}
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

function Menu({ director, onClose, onTitle, onSettings, dev }: { director: Director; onClose: () => void; onTitle: () => void; onSettings: () => void; dev: boolean }) {
  const [tab, setTab] = useState<'memory' | 'chapters' | 'settings' | 'refs'>('memory');
  const [confirm, setConfirm] = useState(false);
  const save = director.save;
  const settings = director.settings;
  const set = (patch: Partial<typeof settings>) => { director.updateSettings(patch); onSettings(); };
  return (
    <div className="lt-overlay" onPointerUp={(event) => event.stopPropagation()}>
      <div className="lt-tabs">
        <button type="button" className={`lt-tab${tab === 'memory' ? ' on' : ''}`} onClick={() => setTab('memory')}>記憶</button>
        <button type="button" className={`lt-tab${tab === 'chapters' ? ' on' : ''}`} onClick={() => setTab('chapters')}>章節</button>
        <button type="button" className={`lt-tab${tab === 'settings' ? ' on' : ''}`} onClick={() => setTab('settings')}>設定</button>
        <button type="button" className={`lt-tab${tab === 'refs' ? ' on' : ''}`} onClick={() => setTab('refs')}>參考資料</button>
      </div>
      {tab === 'memory' && (
        <div className="lt-panel">
          <div className="lt-count">{save.memories.length} ／ {MEMORY_CAPACITY}</div>
          {save.memories.length === 0 && <div className="lt-empty">沒有紀錄<br />長按話語，代表記憶深刻的話語，以後或許有用</div>}
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
          <div className="lt-row"><span>畫面晃動</span><Toggle on={settings.motion} onChange={(motion) => set({ motion })} /></div>
          <div className="lt-row"><span>聲音來源</span><Toggle on={settings.soundLabels} onChange={(soundLabels) => set({ soundLabels })} /></div>
          <div className="lt-row"><span>字體大小</span>
            <div className="lt-opts" role="group" aria-label="字體大小">
              {(Object.keys(FONT_SIZES) as FontSize[]).map((size) => (
                <button key={size} type="button" className={`lt-opt${settings.fontSize === size ? ' on' : ''}`} aria-pressed={settings.fontSize === size} onClick={() => set({ fontSize: size })}>{FONT_SIZES[size].label}</button>
              ))}
            </div>
          </div>
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
        </div>
      )}
      {tab === 'chapters' && <Chapters director={director} dev={dev} onPicked={onClose} />}
      {tab === 'refs' && <References />}
      <button type="button" className="lt-close" onClick={onClose}>回到故事</button>
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
  const action = (key: string, index: number) => {
    if (key === target) return save.replay ? '現在回去' : '從早上重來';
    return index < targetIndex ? '回去這一天' : '跳過去';
  };
  return (
    <div className="lt-panel">
      {save.replay
        ? <div className="lt-empty">正在{numeral(save.chapter)}。這一天的午夜過後，會回到{numeral(target)}。</div>
        : <div className="lt-empty">帶著記憶，重新輪迴<br />回到「{numeral(target)}」</div>}
      {list.map((chapter, index) => {
        const open = dev || save.reached.includes(chapter.key);
        const now = chapter.key === save.chapter;
        return (
          <div className="lt-row" key={chapter.key}>
            <span>{numeral(chapter.key)}　{open ? chapter.title : '……'}{now ? '　·　現在' : ''}</span>
            {open && (
              <button type="button" className="lt-opt" onClick={() => { director.selectChapter(chapter.key); onPicked(); }}>
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
  { name: 'IBM Plex Mono', author: 'IBM', url: 'https://github.com/IBM/plex' },
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
      {sources === 'failed' && <div className="lt-credits"><div className="lt-credit">清單讀不到，可以直接看{link(sampleUrl('CREDITS.md'), '完整清單')}。</div></div>}
      {sourceGroup('amb', '環境音')}
      {sourceGroup('sfx', '音效')}
      {Array.isArray(sources) && <div className="lt-credits"><div className="lt-credit">每段錄音怎麼處理，寫在{link(sampleUrl('CREDITS.md'), '完整清單')}裡。</div></div>}
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

