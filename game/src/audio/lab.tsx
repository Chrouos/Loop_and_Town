// Dev-only audition page for the procedural audio engine: `npm run dev` → /audio-lab.html.
// Not part of the production build inputs.

import { StrictMode, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AMBIENCE,
  DIRECTIONS,
  SFX,
  VOICES,
  type AmbienceId,
  type Direction,
  type Distance,
  type SfxId,
  type SpatialPos,
  type VoiceId,
} from './catalog';
import { createAudioEngine, type AudioEngineDebug } from './engine';

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
  muted: { color: '#5f645e', fontSize: 12 },
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: 4 },
  cell: { width: 44, height: 44, fontSize: 18, textAlign: 'center', padding: 0 },
  list: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 6 },
  small: { display: 'block', color: '#6c7169', fontSize: 11 },
  stats: { position: 'fixed', right: 12, bottom: 10, color: '#4d524c', font: '11px ui-monospace, monospace' },
} satisfies Record<string, CSSProperties>;

function Btn(props: { on?: boolean; onClick: (e: MouseEvent<HTMLButtonElement>) => void; children: ReactNode; style?: CSSProperties; title?: string }) {
  return (
    <button type="button" title={props.title} onClick={props.onClick} style={{ ...css.btn, ...(props.on ? css.on : null), ...props.style }}>
      {props.children}
    </button>
  );
}

function Lab() {
  const engine = useMemo(() => createAudioEngine(), []);
  const [ready, setReady] = useState(false);
  const [dir, setDir] = useState<Direction | 'center'>('front');
  const [dist, setDist] = useState<Distance>('mid');
  const [randomDir, setRandomDir] = useState(false);
  const [gain, setGain] = useState(1);
  const [rate, setRate] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [voiceVolume, setVoiceVolume] = useState(0.8);
  const [enabled, setEnabled] = useState(true);
  const [layers, setLayers] = useState<AmbienceId[]>([]);
  const [fadeMs, setFadeMs] = useState(2500);
  const [last, setLast] = useState('');
  const [stats, setStats] = useState('');
  const sweepTimers = useRef<number[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const dbg = engine as Partial<AudioEngineDebug>;
      if (dbg.stats) {
        const s = dbg.stats();
        setStats(`${s.state} · layers ${s.layers.length} · sfx ${s.shots} · voices ${s.voices} · layer events ${s.layerShots} · timers ${s.layerTimers}`);
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
    setReady(engine.ready);
  };

  const play = (id: SfxId, p: SpatialPos = pos()) => {
    void unlock();
    engine.play(id, p, { gain, rate });
    setLast(`${id} @ ${p.dir}/${p.dist}`);
  };

  const sweep = (id: SfxId) => {
    for (const t of sweepTimers.current) window.clearTimeout(t);
    sweepTimers.current = DIRECTIONS.map((d, i) => window.setTimeout(() => play(id, { dir: d, dist }), i * 900));
  };

  const toggleLayer = (id: AmbienceId) => {
    void unlock();
    const next = layers.includes(id) ? layers.filter((l) => l !== id) : [...layers, id];
    setLayers(next);
    engine.setAmbience(next, fadeMs);
  };

  const sfxIds = Object.keys(SFX) as SfxId[];
  const groups = GROUPS.map(([label, first], gi) => {
    const start = sfxIds.indexOf(first);
    const next = GROUPS[gi + 1];
    const end = next ? sfxIds.indexOf(next[1]) : sfxIds.length;
    return [label, sfxIds.slice(start, end)] as const;
  });

  return (
    <div style={css.page}>
      <h1 style={css.h1}>灰潮鎮 · Audio Lab</h1>
      <div style={css.muted}>所有聲音皆為即時合成。建議戴耳機。點選聲音即在選定方位播放；Shift+點 = 繞八個方位一圈。</div>

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
          人聲存在感 <input type="range" min={0} max={1} step={0.01} value={voiceVolume} onChange={(e) => (setVoiceVolume(+e.target.value), engine.setVoiceVolume(+e.target.value))} />
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

      <h2 style={css.h2}>說話者存在感（2 秒）</h2>
      <div style={css.row}>
        {(Object.keys(VOICES) as VoiceId[]).map((v) => (
          <Btn key={v} onClick={() => (void unlock(), engine.voice(v, pos(), 2000), setLast(`voice ${v}`))}>
            {v}
            <span style={css.small}>{VOICES[v].pitch ? `${VOICES[v].pitch} Hz` : 'tick'}</span>
          </Btn>
        ))}
      </div>

      <h2 style={css.h2}>環境層</h2>
      <div style={{ ...css.row, marginBottom: 8 }}>
        <label>
          淡入淡出 {fadeMs} ms <input type="range" min={100} max={6000} step={100} value={fadeMs} onChange={(e) => setFadeMs(+e.target.value)} />
        </label>
      </div>
      <div style={css.list}>
        {(Object.keys(AMBIENCE) as AmbienceId[]).map((id) => (
          <Btn key={id} on={layers.includes(id)} onClick={() => toggleLayer(id)}>
            {id}
            <span style={css.small}>{AMBIENCE[id]}</span>
          </Btn>
        ))}
      </div>

      {groups.map(([label, ids]) => (
        <section key={label}>
          <h2 style={css.h2}>{label}</h2>
          <div style={css.list}>
            {ids.map((id) => (
              <Btn key={id} onClick={(e) => (e.shiftKey ? sweep(id) : play(id))}>
                {id}
                <span style={css.small}>{SFX[id]}</span>
              </Btn>
            ))}
          </div>
        </section>
      ))}

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
