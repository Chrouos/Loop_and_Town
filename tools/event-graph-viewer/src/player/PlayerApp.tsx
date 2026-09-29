import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPlayerStoryBundle } from '../lib/loadPlayerStoryBundle';
import type { SimulationDefinition, WorldState } from '../simulator/types';
import { clockMinuteAt, displayMinute, isLiveSyncAvailable } from './clock';
import { entryPresentation, entryWindowFor } from './entry';
import { attendPresenceRecord, availablePresenceRecords, beginMemoryCapture, reconcilePlayer, visibleRecords } from './knowledge';
import { knownDiff, pinExcerpt } from './logic';
import { normalizeSave, type ActionId, type PlayerSave } from './model';
import { activeLoop, confirmAction, continuePendingBoundary, createNextLoop, replayLoop } from './runtime';
import { LEGACY_KEY, exportSave, importLegacy, readSave, writeSave } from './storage';
import { EvidenceBoard } from './EvidenceBoard';
import { WorldlineNotebook } from './WorldlineNotebook';
import { ResetTransitionScene } from './scenes/ResetTransitionScene';
import { DialogueScene } from './scenes/DialogueScene';
import { OpeningScene } from './scenes/OpeningScene';
import { SceneFrame } from './ui/SceneFrame';
import { WorldlineHud } from './ui/WorldlineHud';
import { SpatialTextLayer } from './SpatialTextLayer';
import { markPlayerNarrativeSeen, projectPlayerNarrativeRecords } from './narrativeRecords';
import { recordById } from './story';
import type { PlayerStoryBundle } from '../types/playerStory';

type LegacyStory = { definition: SimulationDefinition; initialState: WorldState };
type Story = PlayerStoryBundle | LegacyStory;
type Props = { now?: () => number; storage?: Storage; loadStory?: () => Promise<Story> };
type Drawer = 'tools' | 'case' | 'board' | 'worldlines' | 'save' | null;

function isPlayerStoryBundle(story: Story): story is PlayerStoryBundle {
  return 'narrativeDocuments' in story;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function presenceCueLabel(id: string): string {
  if (id === 'station-blackout') return '……鐘聲？';
  return '……剛才那邊？';
}

export function PlayerApp({ now = Date.now, storage = window.localStorage, loadStory = () => loadPlayerStoryBundle('story/manifests/loop_01.yaml') }: Props) {
  const [save, setSave] = useState<PlayerSave>(() => readSave(storage, now()));
  const [story, setStory] = useState<Story | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [selected, setSelected] = useState('letter');
  const [importText, setImportText] = useState('');
  const [exporting, setExporting] = useState(false);
  const [resetPresentationComplete, setResetPresentationComplete] = useState(false);
  const [modeCommitInFlight, setModeCommitInFlight] = useState(false);
  const [currentMs, setCurrentMs] = useState(() => now());
  const opener = useRef<HTMLButtonElement | null>(null);

  const commit = useCallback((next: PlayerSave) => { const copy = normalizeSave(next, now()); setSave(copy); writeSave(storage, copy); }, [now, storage]);
  const refresh = useCallback((data: Story) => {
    const time = now();
    const simulation = isPlayerStoryBundle(data) ? data.simulation : data;
    setCurrentMs(time);
    const next = reconcilePlayer(
      readSave(storage, time),
      time,
      simulation.definition,
      simulation.initialState,
      isPlayerStoryBundle(data) ? data : undefined,
    );
    commit(next);
  }, [now, storage, commit]);

  useEffect(() => {
    let mounted = true;
    loadStory().then(data => { if (mounted) { setStory(data); refresh(data); } }).catch(e => { if (mounted) setError(e instanceof Error ? e.message : String(e)); });
    return () => { mounted = false; };
  }, [loadStory, refresh]);
  useEffect(() => {
    if (!story) return;
    const timer = window.setInterval(() => refresh(story), 15000);
    const visible = () => { if (!document.hidden) refresh(story); };
    const changed = () => refresh(story);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('storage', changed);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('storage', changed); };
  }, [story, refresh]);
  useEffect(() => {
    if (!drawer) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(null); };
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('keydown', close); opener.current?.focus(); };
  }, [drawer]);

  const loopId = save.currentLoopId;
  const loop = activeLoop(save);
  const clock = { loop: loopId, minute: clockMinuteAt(loop.clock, Math.max(currentMs, save.lastConfirmedMs)) };
  const entryWindow = entryWindowFor(Math.min(clock.minute, 1439));
  const entry = entryPresentation(entryWindow);
  const playerRecords = story && isPlayerStoryBundle(story)
    ? projectPlayerNarrativeRecords(
      story,
      loopId,
      replayLoop(story.simulation.definition, story.simulation.initialState, save, loopId, clock.minute).history,
      clock.minute,
    )
    : undefined;
  const recordSource = loopId === 1 ? undefined : playerRecords;
  const records = visibleRecords(save, loopId, recordSource);
  const opportunities = availablePresenceRecords(save, loopId, clock.minute, recordSource);
  const opened = loopId !== 1 || save.knowledge.opened.includes(`${loopId}:letter`) || save.knowledge.opened.includes('letter');
  const selectedProjectedRecord = recordSource?.find(item => (
    item.id === selected
    && loop.revealedIds.includes(`${loopId}:${item.id}`)
    && (item.acquisition !== 'presence' || loop.perceivedSceneIds.includes(item.sceneId))
  ));
  const record = records.find(x => x.id === selected) ?? selectedProjectedRecord ?? records[0];
  const attentionRecord = loop.attention.targetId
    ? (recordSource?.find(item => item.id === loop.attention.targetId) ?? recordById(loop.attention.targetId))
    : undefined;
  const observingSpatialRecord = loop.attention.phase === 'observing' && attentionRecord?.spatialScript
    ? attentionRecord
    : undefined;
  const lastPerceivedRecord = loop.lastPerceivedRecordId
    ? (recordSource?.find(item => item.id === loop.lastPerceivedRecordId) ?? recordById(loop.lastPerceivedRecordId))
    : undefined;
  const lastMemory = lastPerceivedRecord
    ? save.knowledge.memories.find(memory => memory.id === `memory:${loopId}:${lastPerceivedRecord.id}`)
    : undefined;
  const incoming = records.filter(item => item.acquisition !== 'presence' && item.revealMinute > 0 && !save.knowledge.opened.includes(`${loopId}:${item.id}`));
  const hasAction = (id: ActionId) => loop.actionIds.includes(id);
  const canAct = clock.minute < 1100;
  const next = clock.minute < 1100 ? '18:20 前，你還能改變今晚的行程' : clock.minute < 1111 ? '18:31，舊車站' : clock.minute < 1120 ? '等候鎮上的通報' : clock.minute < 1280 ? '21:20，予安說會再聯絡' : '午夜，日期會回到今天';
  const resetPending = loop.clock.pendingCriticalBoundary === 'reset';

  useEffect(() => {
    if (!resetPending) setResetPresentationComplete(false);
  }, [resetPending]);

  useEffect(() => {
    if (!story || loop.attention.phase === 'idle') return;
    const deadline = loop.attention.phase === 'shifting'
      ? loop.attention.shiftEndsAtMs
      : loop.attention.observationEndsAtMs;
    if (deadline === undefined) return;
    const timer = window.setTimeout(() => refresh(story), Math.max(0, deadline - now()) + 1);
    return () => window.clearTimeout(timer);
  }, [story, loop.attention.phase, loop.attention.shiftEndsAtMs, loop.attention.observationEndsAtMs, refresh, now]);

  function showDrawer(value: Drawer, target?: HTMLButtonElement) { opener.current = target ?? null; setDrawer(value); setNote(''); }
  function choose(id: ActionId) {
    try { const nextSave = normalizeSave(save, now()); confirmAction(nextSave, id, now()); commit(nextSave); setNote(id === 'protect_wakaharu' ? '你答應在若晴出門前陪她留在家裡。' : '你請予安先到醫院，設法留住陳柏勳。'); }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
  }
  function chooseMode(mode: 'ACCELERATED' | 'LIVE_SYNC') {
    if (modeCommitInFlight) return;
    setModeCommitInFlight(true);
    try {
      const nextSave = normalizeSave(save, now());
      if (story) {
        const definition = isPlayerStoryBundle(story) ? story.simulation.definition : story.definition;
        const initialState = isPlayerStoryBundle(story) ? story.simulation.initialState : story.initialState;
        continuePendingBoundary(nextSave, definition, initialState);
      }
      createNextLoop(nextSave, mode, now());
      commit(nextSave);
      if (story) refresh(story);
    } catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
    finally { setModeCommitInFlight(false); }
  }
  function openRecord(id: string) {
    const nextSave = normalizeSave(save, now());
    const readKey = `${loopId}:${id}`;
    if (!nextSave.knowledge.opened.includes(readKey)) nextSave.knowledge.opened.push(readKey);
    if (loopId !== 1 && records.some((item) => item.id === id && item.sceneId === id)) {
      markPlayerNarrativeSeen(nextSave, loopId, id);
    }
    commit(nextSave); setSelected(id); setDrawer(null);
  }
  function attend(id: string) {
    const nextSave = normalizeSave(save, now());
    if (!attendPresenceRecord(nextSave, loopId, id, clock.minute, recordSource, record?.id, now())) return;
    commit(nextSave);
  }
  function capture(id: string) {
    const nextSave = normalizeSave(save, now());
    if (!beginMemoryCapture(nextSave, loopId, id, clock.minute, recordSource, now())) return;
    commit(nextSave);
  }
  function pin(ref: string) {
    try { const nextSave = normalizeSave(save, now()); pinExcerpt(nextSave, ref); commit(nextSave); setNote('已放在推理桌上。'); }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
  }
  function importSave() {
    const nextSave = importLegacy(importText, normalizeSave(save, now()));
    commit(nextSave); setNote(nextSave === save ? '無法讀取這份存檔。' : '存檔已匯入；舊案卷的結論只作為個人筆記。');
    if (story) refresh(story);
  }

  return <div className="player-shell">
    <header className="player-header player-header--minimal"><WorldlineHud loop={clock.loop} time={displayMinute(clock.minute)} /><button className="player-utility-trigger" aria-label="開啟工具" onClick={e => showDrawer('tools', e.currentTarget)}>···</button></header>
    <main className={`player-stage ${resetPending && !resetPresentationComplete ? 'player-stage--cinematic' : 'player-stage--reading'}`}>
      <SceneFrame className="scene-frame--flat player-presentation-frame">
        {error ? <p role="alert">無法讀取鎮上的紀錄：{error}</p> : !story ? <p>正在取出案卷……</p> : resetPending && !resetPresentationComplete ? <ResetTransitionScene reducedMotion={prefersReducedMotion()} onPresentationComplete={() => setResetPresentationComplete(true)} /> : resetPending ? <div className="opening mode-choice"><p>鐘聲落下，今天又回到可以重來的地方。</p><p>下一次進入灰潮鎮時，你要怎麼走進這一天？</p><button onClick={() => chooseMode('LIVE_SYNC')} disabled={modeCommitInFlight || !isLiveSyncAvailable(currentMs)}>跟著現在走<span> · {isLiveSyncAvailable(currentMs) ? '從此刻的鎮內時間進入' : '現在是 Live Sync 無法進入的時間'}</span></button><button onClick={() => chooseMode('ACCELERATED')} disabled={modeCommitInFlight}>回到記憶開始的地方<span> · 從 06:12 的返程列車開始</span></button>{note && <p className="inline-note" role="status">{note}</p>}</div> : !opened ? <OpeningScene label={entry.label} lines={entry.lines} onOpenLetter={() => openRecord('letter')} /> : <div className={`reading-scene attention-${loop.attention.phase}`} key={`${clock.loop}:${record?.id}`}>
        {opportunities.length > 0 && <div className="presence-opportunities" aria-label="周遭動靜">{opportunities.map(item => <button key={item.id} onClick={() => attend(item.id)} aria-label={presenceCueLabel(item.id)} aria-current={loop.attention.targetId === item.id ? 'true' : undefined}>{presenceCueLabel(item.id)}</button>)}</div>}
        {loop.capture && <div className="memory-capture-status" role="status"><p>你正在把剛才的感覺留下來……</p></div>}
        {!loop.capture && lastPerceivedRecord && !lastMemory && <div className="memory-capture-prompt" role="status"><p>剛才那一幕還留在你心裡。</p><button onClick={() => capture(lastPerceivedRecord.id)}>捕捉這段記憶</button></div>}
        {!loop.capture && lastMemory && <div className="memory-capture-status" role="status"><p>已將「{lastMemory.title}」收進持久記憶。</p></div>}
        {incoming.length > 0 && <div className="incoming-records" aria-label="新消息"><p>鎮上有新消息</p>{incoming.map(item => <button key={item.id} onClick={() => openRecord(item.id)}>閱讀新消息：{item.title}</button>)}</div>}
        {observingSpatialRecord ? <SpatialTextLayer script={observingSpatialRecord.spatialScript!} now={now} /> : record?.spatialScript && record.acquisition === 'presence' ? <SpatialTextLayer script={record.spatialScript} now={now} /> : <>
          <div className="document-top"><span>第 {clock.loop} 次今天</span><span>{record?.source}　／　{record?.formedAt}</span></div>
          <h1>{record?.title}</h1>
          <div className="document-lines">{record?.body.map((line, i) => <p key={i}>{line}</p>)}</div>
          {record?.excerpts.length ? <div className="excerpts"><span>留下你認為重要的句子</span>{record.excerpts.map(part => <button key={part.id} onClick={() => pin(`${record.id}:${part.id}`)}>{part.text}<span>＋</span></button>)}</div> : null}
        </>}
        {record?.id === 'letter' && records.some(x => x.id === 'yu-an-message') && <div className="decisions"><p>手機震了一下。予安留了話。</p><button onClick={() => openRecord('yu-an-message')}>讀予安的留言</button></div>}
        {record?.id === 'yu-an-message' && canAct ? <DialogueScene
          speaker="予安"
          text="18:20 前，你可以決定今晚要怎麼做。"
          reducedMotion={prefersReducedMotion()}
          choices={[
            { actionId: 'protect_wakaharu', label: hasAction('protect_wakaharu') ? '已和若晴約好' : '保護若晴：「今晚，我陪你留下來。」', disabled: hasAction('protect_wakaharu') },
            { actionId: 'stop_doctor', label: hasAction('stop_doctor') ? '予安已答應去醫院' : '請予安：「幫我去醫院。」', disabled: hasAction('stop_doctor') },
          ]}
          onChoose={actionId => choose(actionId as ActionId)}
        /> : null}
        {record?.id === 'yu-an-message' && (hasAction('protect_wakaharu') || hasAction('stop_doctor')) && <div className="choice-replies" aria-label="今晚的回覆">
          {hasAction('protect_wakaharu') && <p>若晴回了訊息：「好，我今晚先不去車站。你來的時候，我把信給你看。」</p>}
          {hasAction('stop_doctor') && <p>予安回覆：「我現在去醫院找陳柏勳。會試著留住他，之後再回你。」</p>}
          <small>約定已記下。車站的消息會在鎮上傳來時出現在這裡。</small>
        </div>}
        {note && <p className="inline-note" role="status">{note}</p>}
      </div>}
      </SceneFrame>
    </main>
    {drawer && <div className="drawer-shade" onMouseDown={e => { if (e.target === e.currentTarget) setDrawer(null); }}><section className={`drawer ${drawer === 'board' ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={drawer === 'tools' ? '工具' : drawer === 'case' ? '案卷' : drawer === 'board' ? '推理桌' : drawer === 'save' ? '存檔' : '世界線'}>
      <header><h2>{drawer === 'tools' ? '工具' : drawer === 'case' ? '案卷' : drawer === 'board' ? '推理桌' : drawer === 'save' ? '存檔' : '世界線歷史'}</h2><button autoFocus onClick={() => setDrawer(null)} aria-label="關閉">×</button></header>
      {drawer === 'tools' && <div className="tool-menu"><button onClick={() => setDrawer('case')}>案卷 <i>{records.length}</i></button><button onClick={() => setDrawer('board')}>推理桌</button><button onClick={() => setDrawer('worldlines')}>世界線</button><button onClick={() => setDrawer('save')}>存檔</button></div>}
      {drawer === 'case' && <div className="case-list">{records.map(item => <button key={item.id} onClick={() => openRecord(item.id)}><small>{item.source} · {item.obtainedAt}</small><strong>{item.title}</strong>{!save.knowledge.opened.includes(`${clock.loop}:${item.id}`) && <em>新</em>}</button>)}</div>}
      {drawer === 'board' && <EvidenceBoard save={save} onChange={commit} onNotice={setNote} />}
      {drawer === 'worldlines' && <WorldlineNotebook save={save} currentLoop={clock.loop} knownDiff={knownDiff} />}
      {drawer === 'save' && <div className="save-panel"><p>進度存在此瀏覽器。要換裝置，可以複製 JSON 後在新裝置貼上。</p><button onClick={() => setExporting(v => !v)}>顯示這台裝置的存檔</button>{exporting && <textarea readOnly aria-label="目前存檔" value={exportSave(save)} />}
        <p>舊網站若在另一個網址，先在舊網站的瀏覽器 Console 執行：</p><code>copy(localStorage.getItem('ash-town-bible-v1'))</code><p>把複製到的內容貼在下方，或選取 JSON 檔。</p><button onClick={() => { try { setImportText(storage.getItem(LEGACY_KEY) ?? ''); } catch { setNote('讀不到舊案卷。'); } }}>讀取此網址的舊案卷</button><input type="file" accept=".json,application/json" aria-label="選取存檔" onChange={async e => { const file = e.target.files?.[0]; if (file) setImportText(await file.text()); }} /><textarea aria-label="貼上存檔 JSON" value={importText} onChange={e => setImportText(e.target.value)} /><button onClick={importSave}>匯入存檔</button>{note && <p role="status">{note}</p>}{save.knowledge.notes.map((x, i) => <p key={i}>{x.text}</p>)}</div>}
    </section></div>}
  </div>;
}
