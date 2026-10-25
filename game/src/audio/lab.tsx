// Dev-only audition page for the audio engine: `npm run dev` → /audio-lab.html.
// Every sound that has a recording can be played from the recording (錄音) or from its synthesis
// recipe (合成) side by side; ambience beds switch source globally. Not part of the production build.

import { StrictMode, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_SETTINGS } from '../engine/save';
import {
  AMBIENCE,
  DIRECTIONS,
  SFX,
  type AmbienceId,
  type Direction,
  type Distance,
  type SfxId,
  type SpatialPos,
} from './catalog';
import { createAudioEngine, type AudioEngineDebug, type SampleMode } from './engine';
import { AMBIENCE_SAMPLES, SFX_SAMPLES, sampleUrl } from './samples';

type Playable = 'ok' | 'bad';
const RECHECK_MS = 4000;

/** Decode one recording off the audio graph, so the page only offers versions that can really play. */
async function probe(file: string): Promise<Playable> {
  try {
    const response = await fetch(sampleUrl(file), { cache: 'no-store' });
    if (!response.ok) return 'bad';
    const data = await response.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    await ctx.decodeAudioData(data);
    return 'ok';
  } catch {
    return 'bad';
  }
}

/** Which recording files decode right now; unreadable ones are re-checked until they come back. */
function usePlayable(): [Record<string, Playable>, (file: string) => void] {
  const [state, setState] = useState<Record<string, Playable>>({});
  const files = useMemo(() => Object.values(SFX_SAMPLES).flatMap((entry) => entry?.files ?? []), []);
  useEffect(() => {
    let alive = true;
    const run = async (list: string[]) => {
      for (const file of list) {
        const result = await probe(file);
        if (!alive) return;
        setState((current) => (current[file] === result ? current : { ...current, [file]: result }));
      }
    };
    void run(files);
    const timer = window.setInterval(() => {
      setState((current) => {
        const bad = files.filter((file) => current[file] === 'bad');
        if (bad.length) void run(bad);
        return current;
      });
    }, RECHECK_MS);
    return () => { alive = false; window.clearInterval(timer); };
  }, [files]);
  const markBad = (file: string) => setState((current) => ({ ...current, [file]: 'bad' }));
  return [state, markBad];
}

const GROUPS: ReadonlyArray<readonly [label: string, first: SfxId]> = [
  ['人與移動', 'step'],
  ['物件', 'paper_rustle'],
  ['城鎮', 'train_brake'],
  ['天氣', 'rain_burst'],
  ['異常', 'hum_rise'],
  ['介面', 'memory_keep'],
];

const GRID: ReadonlyArray<Direction | 'center'> = ['front-left', 'front', 'front-right', 'left', 'center', 'right', 'back-left', 'back', 'back-right'];

const ARROW: Record<Direction | 'center', string> = {
  'front-left': '↖',
  front: '↑',
  'front-right': '↗',
  left: '←',
  center: '●',
  right: '→',
  'back-left': '↙',
  back: '↓',
  'back-right': '↘',
};

const css = {
  page: { maxWidth: 1080, margin: '0 auto', padding: '24px 16px 80px', font: '14px/1.5 system-ui, -apple-system, "Noto Sans TC", sans-serif' },
  h1: { fontWeight: 400, fontSize: 20, letterSpacing: '0.2em', color: '#e6e8e3', margin: '0 0 4px' },
  h2: { fontWeight: 400, fontSize: 13, letterSpacing: '0.18em', color: '#7d827b', margin: '28px 0 10px', textTransform: 'uppercase' },
  muted: { color: '#9ca397', fontSize: 12 },
  row: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  btn: {
    background: '#0d0f0d',
    color: '#c9cdc6',
    border: '1px solid #262a25',
    borderRadius: 6,
    padding: '6px 10px',
    cursor: 'pointer',
    font: 'inherit',
    textAlign: 'left',
  },
  on: { background: '#1b2a1f', borderColor: '#3f6b4a', color: '#e8f5ea' },
  failed: { background: '#2a1717', borderColor: '#7a3a3a', color: '#f0c9c9' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: 4 },
  cell: { width: 44, height: 44, fontSize: 18, textAlign: 'center', padding: 0 },
  list: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 6 },
  small: { display: 'block', color: '#9ca397', fontSize: 11 },
  pair: { display: 'flex', gap: 4, marginTop: 6 },
  mini: { padding: '2px 8px', fontSize: 12 },
  tag: { marginLeft: 6, fontSize: 10, color: '#7fae8a', letterSpacing: '0.1em' },
  stats: { marginTop: 24, color: '#9ca397', font: '11px ui-monospace, monospace', overflowWrap: 'anywhere' },
} satisfies Record<string, CSSProperties>;

function Btn(props: { on?: boolean; onClick: (e: MouseEvent<HTMLButtonElement>) => void; children: ReactNode; style?: CSSProperties; title?: string }) {
  return (
    <button type="button" title={props.title} onClick={props.onClick} style={{ ...css.btn, ...(props.on ? css.on : null), ...props.style }}>
      {props.children}
    </button>
  );
}

function Lab() {
  const [playable, markBad] = usePlayable();
  const engine = useMemo(() => createAudioEngine(), []);
  const [ready, setReady] = useState(false);
  const [dir, setDir] = useState<Direction | 'center'>('front');
  const [dist, setDist] = useState<Distance>('mid');
  const [randomDir, setRandomDir] = useState(false);
  const [gain, setGain] = useState(1);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [voiceVolume, setVoiceVolume] = useState(0.8);
  const [ambienceVolume, setAmbienceVolume] = useState(DEFAULT_SETTINGS.ambience);
  const [sfxVolume, setSfxVolume] = useState(DEFAULT_SETTINGS.sfx);
  const [enabled, setEnabled] = useState(true);
  const [layers, setLayers] = useState<AmbienceId[]>([]);
  const [fadeMs, setFadeMs] = useState(2500);
  const [last, setLast] = useState('');
  // the button just pressed lights up (red if it could not play), so feedback is visible where you clicked
  const [pressed, setPressed] = useState<{ key: string; ok: boolean | null } | null>(null);
  const pressedTimer = useRef<number | null>(null);
  const [stats, setStats] = useState('');
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'recorded' | 'synth-only'>('all');
  const [mode, setMode] = useState<SampleMode>('auto');
  const [sampled, setSampled] = useState<string[]>([]);
  const [bank, setBank] = useState('');
  const sweepTimers = useRef<number[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const dbg = engine as Partial<AudioEngineDebug>;
      if (dbg.stats) {
        const s = dbg.stats();
        setStats(`${s.state} · layers ${s.layers.length} · sfx ${s.shots} · voices ${s.voices} · layer events ${s.layerShots} · timers ${s.layerTimers}`);
        setSampled(s.sampledLayers);
        setBank(s.samples ? `錄音已載入：音效 ${s.samples.sfxReady}/${s.samples.sfxTotal} · 環境 ${s.samples.ambReady}/${s.samples.ambTotal}${s.samples.failed ? ` · 失敗 ${s.samples.failed}` : ''}` : '');
      }
      setReady(engine.ready);
    }, 500);
    const vis = () => (document.hidden ? engine.suspend() : engine.resume());
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [engine]);

  const pos = (): SpatialPos => ({ dir: randomDir ? DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)]! : dir, dist });

  const unlock = async () => {
    await engine.unlock();
    engine.setVolume(volume);
    engine.setVoiceVolume(voiceVolume);
    engine.setAmbienceVolume(ambienceVolume);
    engine.setSfxVolume(sfxVolume);
    setReady(engine.ready);
  };

  const play = (id: SfxId, p: SpatialPos = pos()) => {
    void unlock().then(() => {
      engine.play(id, p, { gain, rate });
      setLast(`${id} @ ${p.dir}/${p.dist}`);
    });
  };

  const playFrom = (id: SfxId, source: 'sample' | 'synth', variant?: number) => {
    const key = `${id}:${source}:${variant ?? ''}`;
    if (pressedTimer.current !== null) window.clearTimeout(pressedTimer.current);
    setPressed({ key, ok: null });
    void unlock().then(async () => {
      const dbg = engine as Partial<AudioEngineDebug>;
      const p = pos();
      const ok = dbg.playSource ? await dbg.playSource(id, p, source, { gain, rate, variant }) : false;
      if (!ok && source === 'sample' && variant !== undefined) {
        // Hide it rather than leave a broken button; the re-check brings it back once it decodes.
        const file = SFX_SAMPLES[id]?.files[variant];
        if (file) markBad(file);
        setPressed(null);
        setLast(`${id} · 錄音 ${variant + 1} 暫時讀不到，先隱藏，讀得到時會自動出現`);
        return;
      }
      setPressed({ key, ok });
      pressedTimer.current = window.setTimeout(() => setPressed((cur) => (cur?.key === key ? null : cur)), ok ? 900 : 2500);
      setLast(`${id} @ ${p.dir}/${p.dist} · ${source === 'sample' ? `錄音 ${variant === undefined ? '隨機' : variant + 1}` : '合成配方'}${ok ? '' : '（無法播放）'}`);
    });
  };

  const pressedStyle = (key: string): CSSProperties | null => (pressed?.key === key ? (pressed.ok === false ? css.failed : css.on) : null);
  const pressedLabel = (key: string, label: string): string => (pressed?.key === key && pressed.ok === false ? '無法播放' : label);

  const switchMode = (m: SampleMode) => {
    setMode(m);
    void unlock().then(() => (engine as Partial<AudioEngineDebug>).setSampleMode?.(m));
  };

  const sweep = (id: SfxId) => {
    for (const t of sweepTimers.current) window.clearTimeout(t);
    sweepTimers.current = DIRECTIONS.map((d, i) => window.setTimeout(() => play(id, { dir: d, dist }), i * 900));
  };

  const toggleLayer = (id: AmbienceId) => {
    const next = layers.includes(id) ? layers.filter((l) => l !== id) : [...layers, id];
    setLayers(next);
    void unlock().then(() => engine.setAmbience(next, fadeMs));
  };

  const sfxIds = Object.keys(SFX) as SfxId[];
  const matches = (id: string, label: string, recorded: boolean) =>
    `${id} ${label}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (sourceFilter === 'all' || (sourceFilter === 'recorded' ? recorded : !recorded));
  const recordedCount = sfxIds.filter((id) => SFX_SAMPLES[id]).length;
  const recordingVersions = Object.values(SFX_SAMPLES).reduce((sum, entry) => sum + (entry?.files.length ?? 0), 0);
  const groups = GROUPS.map(([label, first], gi) => {
    const start = sfxIds.indexOf(first);
    const next = GROUPS[gi + 1];
    const end = next ? sfxIds.indexOf(next[1]) : sfxIds.length;
    return [label, sfxIds.slice(start, end).filter((id) => matches(id, SFX[id], !!SFX_SAMPLES[id]))] as const;
  });

  return (
    <div style={css.page}>
      <h1 style={css.h1}>灰潮鎮 · Audio Lab</h1>
      <div style={css.muted}>
        錄音是固定音檔，可逐版試聽；合成是即時產生的一套配方，每次有些微隨機變化，不代表多個固定版本。點名稱可試聽遊戲播放方式；Shift+點名稱可繞八個方位。建議戴耳機。
      </div>
      <div style={{ ...css.muted, marginTop: 4 }}>{bank || '（啟用聲音後開始載入錄音）'}</div>

      <div style={{ ...css.row, marginTop: 16 }}>
        <Btn on={ready} onClick={() => void unlock()}>
          {ready ? '聲音已啟用' : '點此啟用聲音'}
        </Btn>
        <label>
          <input type="checkbox" checked={enabled} onChange={(e) => (setEnabled(e.target.checked), engine.setEnabled(e.target.checked))} /> 開啟
        </label>
        <label>
          主音量 <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => (setVolume(+e.target.value), engine.setVolume(+e.target.value))} />
        </label>
        <label>
          環境音 <input type="range" min={0} max={1} step={0.01} value={ambienceVolume} onChange={(e) => (setAmbienceVolume(+e.target.value), engine.setAmbienceVolume(+e.target.value))} />
        </label>
        <label>
          音效 <input type="range" min={0} max={1} step={0.01} value={sfxVolume} onChange={(e) => (setSfxVolume(+e.target.value), engine.setSfxVolume(+e.target.value))} />
        </label>
        <label>
          手機讀屏 <input type="range" min={0} max={1} step={0.01} value={voiceVolume} onChange={(e) => (setVoiceVolume(+e.target.value), engine.setVoiceVolume(+e.target.value))} />
        </label>
      </div>

      <h2 style={css.h2}>方位</h2>
      <div style={{ ...css.row, gap: 24, alignItems: 'flex-start' }}>
        <div style={css.grid}>
          {GRID.map((d) => (
            <Btn key={d} on={!randomDir && dir === d} onClick={() => (setDir(d), setRandomDir(false))} style={css.cell} title={d}>
              {ARROW[d]}
            </Btn>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={css.row}>
            {(['near', 'mid', 'far'] as const).map((d) => (
              <Btn key={d} on={dist === d} onClick={() => setDist(d)}>
                {d}
              </Btn>
            ))}
            <Btn on={randomDir} onClick={() => setRandomDir(!randomDir)}>
              隨機方位
            </Btn>
          </div>
          <label>
            gain {gain.toFixed(2)} <input type="range" min={0} max={2} step={0.05} value={gain} onChange={(e) => setGain(+e.target.value)} />
          </label>
          <label>
            rate {rate.toFixed(2)} <input type="range" min={0.5} max={2} step={0.05} value={rate} onChange={(e) => setRate(+e.target.value)} />
          </label>
          <div style={css.muted}>{last || '—'}</div>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <Btn onClick={() => (void unlock(), engine.setAttention(1))}>注意力轉向（悶住 0.7 秒）</Btn>
          <Btn onClick={() => (void unlock(), engine.duck(0.7, 2000))}>壓低環境 2 秒</Btn>
          <Btn onClick={() => (engine.silence(fadeMs), setLayers([]))}>環境全部靜默</Btn>
          <Btn onClick={() => sweep('step')}>腳步繞一圈（左右/前後測試）</Btn>
        </div>
      </div>

      <h2 style={css.h2}>音源目錄</h2>
      <p style={css.small}>音效 {sfxIds.length} 種 · 有錄音 {recordedCount} 種／{recordingVersions} 個版本 · 僅合成 {sfxIds.length - recordedCount} 種 · 每種音效各有 1 套合成配方</p>
      <div style={css.row}>
        <input aria-label="搜尋音效與環境音" placeholder="搜尋名稱或中文說明…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...css.btn, cursor: 'text', minWidth: 230 }} />
        {([['all', '全部'], ['recorded', '有錄音＋合成'], ['synth-only', '僅合成']] as const).map(([value, label]) => (
          <Btn key={value} on={sourceFilter === value} onClick={() => setSourceFilter(value)}>{label}</Btn>
        ))}
      </div>
      <p style={css.small}>來源篩選與搜尋同時套用於環境音及音效。版本數表示目前音檔數，並非修改歷史。</p>
      <p style={css.small}>遊戲預設錄音優先，未載入時立即使用合成；呼吸、嘆氣、笑聲、咳嗽等人聲音效也適用。每個錄音版本與合成配方都可用按鈕直接試聽，「全部合成」模式會強制使用合成。</p>

      <h2 style={css.h2}>手機讀屏 · 合成 1 套配方</h2>
      <p style={css.small}>手機讀屏提示的小滴答。</p>
      <div style={css.row}>
        <Btn onClick={() => void unlock().then(() => { engine.voice('phone', pos(), 0); setLast('voice phone'); })}>phone<span style={css.small}>tick</span></Btn>
      </div>

      <h2 style={css.h2}>說話的人 · 不模擬人聲</h2>
      <p style={css.small}>有人開口時只在他的位置放一個真實的小聲音：換人說話（或隔 8 秒以上再開口）時一聲衣服摩擦；背景路人說話時是衣服與身體挪動。主角自己說話不出聲。</p>
      <div style={css.row}>
        <Btn onClick={() => void unlock().then(() => { engine.voice('yuan', pos(), 1500); setLast('voice yuan（換人開口）'); })}>有人開口<span style={css.small}>衣服摩擦</span></Btn>
        <Btn onClick={() => void unlock().then(() => { engine.voice('woman', pos(), 1500, 'life'); setLast('voice woman（背景路人）'); })}>背景路人說話<span style={css.small}>湊近的動靜</span></Btn>
      </div>

      <h2 style={css.h2}>環境層</h2>
      <div style={{ ...css.row, marginBottom: 8 }}>
        <span>來源</span>
        <Btn on={mode === 'auto'} onClick={() => switchMode('auto')}>
          自動：錄音優先，合成備援
        </Btn>
        <Btn on={mode === 'synth'} onClick={() => switchMode('synth')}>
          全部合成
        </Btn>
        <span style={css.muted}>切換時交叉淡化約 2.5 秒</span>
      </div>
      <div style={{ ...css.row, marginBottom: 8 }}>
        <label>
          淡入淡出 {fadeMs} ms <input type="range" min={100} max={6000} step={100} value={fadeMs} onChange={(e) => setFadeMs(+e.target.value)} />
        </label>
      </div>
      <div style={css.list}>
        {(Object.keys(AMBIENCE) as AmbienceId[]).filter((id) => matches(id, AMBIENCE[id], !!AMBIENCE_SAMPLES[id])).map((id) => (
          <Btn key={id} on={layers.includes(id)} onClick={() => toggleLayer(id)}>
            {id}
            <span style={css.small}>{AMBIENCE[id]}</span>
            <span style={css.small}>錄音 {AMBIENCE_SAMPLES[id]?.files.length ?? 0} 版 · 合成 1 套</span>
            {AMBIENCE_SAMPLES[id]?.extras ? <span style={css.small}>錄音模式會疊加程序事件（混合音源）</span> : null}
            {layers.includes(id) ? <span style={css.tag}>播放中：{sampled.includes(id) ? (AMBIENCE_SAMPLES[id]?.extras ? '錄音＋程序事件' : '錄音') : '合成'}</span> : null}
          </Btn>
        ))}
      </div>

      {groups.filter(([, ids]) => ids.length).map(([label, ids]) => (
        <section key={label}>
          <h2 style={css.h2}>{label} · {ids.length}</h2>
          <div style={css.list}>
            {ids.map((id) => (
              <div key={id} style={{ ...css.btn, cursor: 'default' }}>
                <Btn onClick={(e) => (e.shiftKey ? sweep(id) : play(id))} style={{ border: 'none', padding: 0, background: 'transparent' }}>
                  {id}
                  <span style={css.small}>{SFX[id]}</span>
                </Btn>
                {(() => {
                  const files = SFX_SAMPLES[id]?.files ?? [];
                  const ready = files.filter((file) => playable[file] === 'ok').length;
                  const hidden = files.filter((file) => playable[file] === 'bad').length;
                  const loading = files.length - ready - hidden;
                  return (
                    <>
                      <div style={{ ...css.small, marginTop: 8 }}>
                        錄音 · {files.length ? `${files.length} 個版本` : '尚無錄音'}
                        {loading > 0 && `（讀取中 ${loading}）`}
                        {hidden > 0 && `（${hidden} 個暫時讀不到，已隱藏）`}
                      </div>
                      <div style={{ ...css.pair, flexWrap: 'wrap' }}>
                        {files.map((file, variant) => (playable[file] === 'ok' ? (
                          <Btn key={file} title={file} onClick={() => playFrom(id, 'sample', variant)} style={{ ...css.mini, ...pressedStyle(`${id}:sample:${variant}`) }}>{pressedLabel(`${id}:sample:${variant}`, `▶ 錄音 ${variant + 1}`)}</Btn>
                        ) : null))}
                      </div>
                    </>
                  );
                })()}
                <div style={{ ...css.small, marginTop: 8 }}>合成 · 1 套配方（隨機變化）</div>
                <div style={css.pair}>
                  <Btn onClick={() => playFrom(id, 'synth')} style={{ ...css.mini, ...pressedStyle(`${id}:synth:`) }}>▶ 合成</Btn>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {!groups.some(([, ids]) => ids.length) ? <p style={css.muted}>沒有符合條件的音效；可清除搜尋或切換來源篩選。</p> : null}
      <div style={css.stats}>{stats}</div>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <StrictMode>
      <Lab />
    </StrictMode>,
  );
}
