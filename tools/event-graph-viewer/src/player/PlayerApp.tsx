import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPlayerStoryBundle } from '../lib/loadPlayerStoryBundle';
import type { SimulationDefinition, WorldState } from '../simulator/types';
import { BELL_MINUTE, clockMinuteAt, displayMinute, isLiveSyncAvailable } from './clock';
import { entryPresentation, idleLine, entryWindowFor } from './entry';
import { attendPresenceRecord, availablePresenceRecords, beginMemoryCapture, narrativeExcerptMemoryId, reconcilePlayer, rememberNarrativeExcerpt, visibleRecords } from './knowledge';
import { knownDiff, pinExcerpt } from './logic';
import { normalizeSave, type ActionId, type PlayerSave } from './model';
import { activeLoop, confirmAction, continuePendingBoundary, createNextLoop, isAwayFromTown, PROTECT_AWAY_MESSAGE, replayLoop } from './runtime';
import { LEGACY_KEY, exportSave, importLegacy, readSave, writeSave } from './storage';
import { EvidenceBoard } from './EvidenceBoard';
import { WorldlineNotebook } from './WorldlineNotebook';
import { ResetTransitionScene } from './scenes/ResetTransitionScene';
import { DialogueScene } from './scenes/DialogueScene';
import { OpeningScene } from './scenes/OpeningScene';
import { SceneFrame } from './ui/SceneFrame';
import { AutoFlowNarrative } from './ui/AutoFlowNarrative';
import { WorldlineHud } from './ui/WorldlineHud';
import { SpatialTextLayer } from './SpatialTextLayer';
import { markPlayerNarrativeSeen, playerSceneConditions, projectPlayerNarrativeRecords } from './narrativeRecords';
import { recordById, staticPlayerRecords } from './story';
import type { PlayerStoryBundle } from '../types/playerStory';
import { projectPlayerPresentation } from './presentation/projectPlayerPresentation';
import { PlayerSceneStage } from './ui/PlayerSceneStage';
import { getAudioPreference, setAudioPreference } from './ui/audioPreferences';
import { FinalInvestigationScene } from './ui/FinalInvestigationScene';
import { applyFinalStep, finalCorrection, finalInvestigationReady, type FinalStep } from './finalGameplay';
import { materializeRecoveryBoundary } from '../simulator/recoveryBoundary';
import { chapterOf } from './chapters';
import { isAtOldStation, leaveOldStation, leaveTown, protagonistLocationAt, TOWN_PLACES, TOWN_TRAVEL_MINUTES, travelToOldStation, travelToTown, type TownPlace } from './stationTravel';
import { activeActivity, activityLines, startActivity, stopActivity, type HomeActivityId } from './mainAction';
import { InlineTextTarget } from './ui/InlineTextTarget';

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

// The stage follows the present: older unwatched scenes wait in the case file instead of replaying a backlog.
const STAGE_FRESH_MINUTES = 30;
// A finished passage stays on screen for a breath before the next scene takes the stage.
const STAGE_LINGER_MS = 2500;
// Documents the player chose to open stay longer before the day moves on.
const DOCUMENT_LINGER_MS = 7000;
const NOTE_VISIBLE_MS = 8000;
// A perceived moment can be kept only shortly after it ends; afterwards it is simply gone.
const CAPTURE_GRACE_MINUTES = 10;
// The Loop 1 opening scene already shows the protagonist waking on the train.
const OPENING_COVERED_SCENE = 'prologue_arrival';
const PLACE_NAMES: Record<string, string> = { old_house: '老家', clock_shop: '鐘錶店', cafe: '咖啡店', hospital: '醫院', old_station: '舊車站', en_route: '路上', train: '返鄉列車' };
const WALK_LABELS: Record<TownPlace, string> = { clock_shop: '去予安的鐘錶店', cafe: '走去咖啡店', hospital: '去醫院看看' };
const MINUTE_WORDS: Record<number, string> = { 8: '八', 12: '十二', 18: '十八' };

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
  const [audioEnabled, setAudioEnabled] = useState(() => getAudioPreference(storage));
  const [currentMs, setCurrentMs] = useState(() => now());
  const [finishedRecordId, setFinishedRecordId] = useState<string | null>(null);
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
      chapterOf(save, loopId),
      replayLoop(story.simulation.definition, story.simulation.initialState, save, loopId, clock.minute).history,
      clock.minute,
      playerSceneConditions(save, loopId, story.activities),
    )
    : undefined;
  // Real-world cues and authored scenes coexist in every loop; neither grants automatic perception.
  const recordSource = playerRecords ? [...playerRecords, ...staticPlayerRecords(loopId)] : undefined;
  const records = visibleRecords(save, loopId, recordSource);
  const opportunities = availablePresenceRecords(save, loopId, clock.minute, recordSource);
  const opened = loopId !== 1 || save.knowledge.opened.includes(`${loopId}:letter`) || save.knowledge.opened.includes('letter');
  const selectedProjectedRecord = recordSource?.find(item => (
    item.id === selected
    && loop.revealedIds.includes(`${loopId}:${item.id}`)
    && (item.acquisition !== 'presence' || loop.perceivedSceneIds.includes(item.sceneId))
  ));
  const record = (loopId > 1 && selected === 'letter' && !save.knowledge.opened.includes(`${loopId}:letter`)
    ? records.find(x => x.id !== 'letter') : undefined)
    ?? records.find(x => x.id === selected) ?? selectedProjectedRecord ?? records[0];
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
  const incoming = records.filter(item => item.acquisition === 'message' && item.revealMinute > 0 && !save.knowledge.opened.includes(`${loopId}:${item.id}`));
  const hasAction = (id: ActionId) => loop.actionIds.includes(id);
  const canAct = clock.minute < 1100;
  const awayFromTown = isAwayFromTown(save, clock.minute);
  const activities = story && isPlayerStoryBundle(story) ? story.activities ?? [] : [];
  const here = protagonistLocationAt(save, loopId, clock.minute);
  const townPlace = TOWN_PLACES.find(place => place === here);
  const currentActivity = activeActivity(save, loopId, clock.minute, activities);
  const homeActivityAvailable = (id: HomeActivityId) => here === 'old_house' && !currentActivity
    && activities.some(item => item.id === id) && !loop.activityRuns?.some(run => run.id === id);
  const next = clock.minute < 1100 ? '18:20 前，你還能改變今晚的行程' : clock.minute < 1111 ? '18:31，舊車站' : clock.minute < 1120 ? '等候鎮上的通報' : clock.minute < 1280 ? '21:20，予安說會再聯絡' : '午夜，日期會回到今天';
  const worldState=story ? replayLoop(
    isPlayerStoryBundle(story)?story.simulation.definition:story.definition,
    isPlayerStoryBundle(story)?story.simulation.initialState:story.initialState,
    save,loopId,Math.min(clock.minute,1440),
  ).state : undefined;
  const atOldStation=isAtOldStation(save,clock.minute);
  const canInvestigate=worldState && finalInvestigationReady(save,worldState,clock.minute) && clock.minute>=1111;
  const finalSession=worldState && loopId>=2 && (canInvestigate || loop.finalSteps.length>0)
    ? finalCorrection(save,clock.minute):undefined;
  const finalForward=finalSession?.outcome==='FORWARD';
  const finalSafetyHold=finalSession?.outcome==='SAFETY_HOLD';
  const finalBoundary=finalSession && (finalForward || finalSafetyHold) && story && worldState
    ? materializeRecoveryBoundary({ ...worldState, correction:finalSession },
      isPlayerStoryBundle(story)?story.simulation.initialState:story.initialState,
      save.knowledge.memories)
    : undefined;
  const resetPending = loop.clock.pendingCriticalBoundary === 'reset' && !finalForward && !finalSafetyHold;
  const captureOpen = Boolean(lastPerceivedRecord && !lastMemory && !resetPending
    && clock.minute <= (lastPerceivedRecord.availableUntilMinute ?? lastPerceivedRecord.revealMinute + 5) + CAPTURE_GRACE_MINUTES);

  useEffect(() => {
    if (!resetPending) setResetPresentationComplete(false);
  }, [resetPending]);

  // When the current passage has finished playing, the stage moves on to the earliest authored scene the
  // player has not watched yet. Reading in a drawer, attending, capturing or an open 18:20 decision hold it.
  const authoredIds = new Set((playerRecords ?? []).map(item => item.id));
  const nextAuthoredScene = (recordSource ?? [])
    .filter(item => authoredIds.has(item.id)
      && item.acquisition !== 'presence'
      && item.id !== record?.id
      && loop.revealedIds.includes(`${loopId}:${item.id}`)
      && !loop.seenSceneIds.includes(item.sceneId)
      && !save.knowledge.opened.includes(`${loopId}:${item.id}`)
      && item.revealMinute >= clock.minute - STAGE_FRESH_MINUTES)
    .sort((left, right) => left.revealMinute - right.revealMinute)[0];
  const holdsDecision = record?.id === 'yu-an-message' && canAct;
  // The 23:59 bell and the midnight scene play to the end before the reset presentation takes the stage.
  const finalePlaying = Boolean(record && authoredIds.has(record.id) && record.revealMinute >= BELL_MINUTE && finishedRecordId !== record.id);
  const deferReset = resetPending && opened && (finalePlaying || (nextAuthoredScene?.revealMinute ?? 0) >= BELL_MINUTE);
  const presentation = projectPlayerPresentation({
    save,
    loopId,
    minute: clock.minute,
    records,
    opportunities,
    scene: record,
    resetHeld: deferReset,
    resetSettled: resetPresentationComplete,
    location: resetPending ? '灰潮鎮' : PLACE_NAMES[here] ?? '灰潮鎮',
  });
  const stageRecordId = record?.id ?? null;
  const markStageFinished = useCallback(() => setFinishedRecordId(stageRecordId), [stageRecordId]);
  const stageIdle = opened && (!resetPending || deferReset) && !drawer && loop.attention.phase === 'idle' && !loop.capture;
  const openRecordRef = useRef(openRecord);
  openRecordRef.current = openRecord;
  const nextSceneId = nextAuthoredScene?.id;
  const stageReadyToMove = Boolean(nextSceneId) && stageIdle && !holdsDecision && finishedRecordId === stageRecordId;
  const lingerMs = stageRecordId && authoredIds.has(stageRecordId) ? STAGE_LINGER_MS : DOCUMENT_LINGER_MS;
  useEffect(() => {
    if (!stageReadyToMove || !nextSceneId) return;
    const timer = window.setTimeout(() => openRecordRef.current(nextSceneId), lingerMs);
    return () => window.clearTimeout(timer);
  }, [stageReadyToMove, nextSceneId, lingerMs]);
  // A finished scene from long ago gives way to the present moment instead of staying on stage for hours.
  // A finished passage gives way to the present moment once it is old, once it was a document, or once the
  // protagonist has started doing something else.
  const stageDone = Boolean(record && finishedRecordId === record.id && !nextAuthoredScene && !holdsDecision);
  const stageStale = stageDone && Boolean(record && (record.revealMinute < clock.minute - STAGE_FRESH_MINUTES
    || !authoredIds.has(record.id) || currentActivity));
  const worldCharacters = (worldState?.characters ?? {}) as Record<string, { location?: unknown } | undefined>;
  useEffect(() => {
    if (!note) return;
    const timer = window.setTimeout(() => setNote(''), NOTE_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [note]);

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
    try { const nextSave = normalizeSave(save, now()); confirmAction(nextSave, id, now()); commit(nextSave); setNote(id === 'protect_wakaharu' ? '你答應在若晴出門前陪她留在家裡。' : id === 'stop_doctor' ? '你請予安先到醫院，設法留住陳柏勳。' : '你把兩份紀錄交給予安，請他自行判斷是否調查備援接口。'); }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
  }
  function visitStation() {
    try { const nextSave=normalizeSave(save,now());travelToOldStation(nextSave,clock.minute);commit(nextSave);setNote('你動身前往舊車站。約二十分鐘後抵達，世界仍在流動。'); }
    catch(e) {setNote(e instanceof Error?e.message:String(e));}
  }
  function goToTown(place: TownPlace) {
    try { const nextSave = normalizeSave(save, now()); travelToTown(nextSave, place, clock.minute); commit(nextSave); setNote(`你出門往${PLACE_NAMES[place]}走。路上的時間仍會發生事情。`); }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
  }
  function walkHome() {
    try { const nextSave = normalizeSave(save, now()); leaveTown(nextSave, clock.minute); commit(nextSave); setNote('你往老家走。路上的時間仍會發生事情。'); }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
  }
  function beginActivity(id: HomeActivityId) {
    try { const nextSave = normalizeSave(save, now()); startActivity(nextSave, loopId, id, clock.minute, activities); commit(nextSave); }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
  }
  function putDownActivity() {
    const nextSave = normalizeSave(save, now()); stopActivity(nextSave, loopId, clock.minute, activities); commit(nextSave);
  }
  function returnFromStation() {
    try {const nextSave=normalizeSave(save,now());leaveOldStation(nextSave,clock.minute);commit(nextSave);setNote('你離開舊站。路上的二十分鐘仍會發生事情。');}
    catch(e) {setNote(e instanceof Error?e.message:String(e));}
  }
  function chooseFinal(step: FinalStep) {
    if(!worldState) return;
    try { const nextSave=normalizeSave(save,now()); applyFinalStep(nextSave,worldState,clock.minute,step); commit(nextSave); setNote('你的行動已經留下痕跡。世界仍持續前進。'); }
    catch(e) { setNote(e instanceof Error ? e.message : String(e)); }
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
      createNextLoop(nextSave, mode, now(), story && isPlayerStoryBundle(story) ? story.chapterProgression : undefined);
      commit(nextSave);
      if (story) refresh(story);
    } catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
    finally { setModeCommitInFlight(false); }
  }
  function openRecord(id: string) {
    const nextSave = normalizeSave(save, now());
    const readKey = `${loopId}:${id}`;
    if (!nextSave.knowledge.opened.includes(readKey)) nextSave.knowledge.opened.push(readKey);
    if (id === 'letter' && chapterOf(nextSave, loopId) === 1) markPlayerNarrativeSeen(nextSave, loopId, OPENING_COVERED_SCENE);
    if (authoredIds.has(id)) {
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
    try { const nextSave = normalizeSave(save, now()); pinExcerpt(nextSave, ref); commit(nextSave); setNote('已放在推理桌上。'); return true; }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); return false; }
  }
  // Static records keep the legacy table pins; authored scene words become Persistent Memory.
  function rememberExcerpt(target: NonNullable<typeof record>, excerptId: string) {
    if (recordById(target.id)) return pin(`${target.id}:${excerptId}`);
    try { const nextSave = normalizeSave(save, now()); rememberNarrativeExcerpt(nextSave, loopId, target, excerptId, clock.minute, now()); commit(nextSave); setNote('已收進記憶庫。'); return true; }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); return false; }
  }
  const rememberedExcerptIds = (target: typeof record) => (target?.excerpts ?? []).filter(excerpt => (
    recordById(target!.id)
      ? save.knowledge.pins.includes(`${target!.id}:${excerpt.id}`)
      : save.knowledge.memories.some(memory => memory.id === narrativeExcerptMemoryId(loopId, target!.id, excerpt.id))
  )).map(excerpt => excerpt.id);
  function importSave() {
    const nextSave = importLegacy(importText, normalizeSave(save, now()));
    commit(nextSave); setNote(nextSave === save ? '無法讀取這份存檔。' : '存檔已匯入；舊案卷的結論只作為個人筆記。');
    if (story) refresh(story);
  }

  return <div className="player-shell player-shell--immersive">
    <header className="player-header player-header--minimal"><WorldlineHud loop={clock.loop} time={displayMinute(clock.minute)} showTime={false} /><button className="player-utility-trigger" aria-label="開啟工具" onClick={e => showDrawer('tools', e.currentTarget)}>···</button></header>
    <main className={`player-stage ${resetPending && !resetPresentationComplete ? 'player-stage--cinematic' : 'player-stage--reading'}`}>
      <PlayerSceneStage
        presentation={presentation}
        reducedMotion={prefersReducedMotion()}
        audioEnabled={audioEnabled}
        input={{
          onAttend: opportunities[0] ? () => attend(opportunities[0].id) : undefined,
          onCapture: captureOpen && lastPerceivedRecord ? () => capture(lastPerceivedRecord.id) : undefined,
        }}
        onAmbientAttend={attend}
        focusedId={loop.attention.targetId}
      >
        <SceneFrame className="scene-frame--flat player-presentation-frame">
        {error ? <p role="alert">無法讀取鎮上的紀錄：{error}</p> : !story ? <p>正在取出案卷……</p> : finalForward ? <div className="opening final-outcome" role="status"><p>鐘聲響完，日期沒有回去。</p><p>{finalSession?.sealMode==='PERMANENT'?'舊站的兩條自動改寫路徑已失去權限。每個人仍保留自己的選擇。':'這一輪已經封存，但改寫權限依然存在。'}</p><p>{finalBoundary?.nextCheckpoint ?? '10/4 00:01'}</p></div> : finalSafetyHold ? <div className="opening final-outcome" role="status"><p>已經切斷的路徑不能自行恢復，但當輪仍未通過安全結案。</p><p>午夜沒有被宣告勝利。等待可靠的確認。</p></div> : resetPending && !deferReset && !resetPresentationComplete ? <ResetTransitionScene reducedMotion={prefersReducedMotion()} onPresentationComplete={() => setResetPresentationComplete(true)} /> : resetPending && !deferReset ? <div className="opening mode-choice"><p>鐘聲落下，今天又回到可以重來的地方。</p><p>下一次進入灰潮鎮時，你要怎麼走進這一天？</p><button onClick={() => chooseMode('LIVE_SYNC')} disabled={modeCommitInFlight || !isLiveSyncAvailable(currentMs)}>跟著現在走<small>{isLiveSyncAvailable(currentMs) ? '從此刻的鎮內時間進入' : '清晨六點以前，鎮上還沒有可以走進去的今天'}</small></button><button onClick={() => chooseMode('ACCELERATED')} disabled={modeCommitInFlight}>回到記憶開始的地方<small>從 06:12 的返程列車開始</small></button>{note && <p className="inline-note" role="status">{note}</p>}</div> : !opened ? <OpeningScene label={entry.label} lines={entry.lines} paperAvailable={opportunities.some(item => item.id === 'paper-word')} onAttendPaper={() => attend('paper-word')} onOpenLetter={() => openRecord('letter')} /> : <div className={`reading-scene reading-scene--immersive attention-${loop.attention.phase}${holdsDecision ? ' reading-scene--deciding' : ''}`} key={`${clock.loop}:${record?.id}`}>
        
        {loop.capture && <div className="memory-capture-status" role="status"><p>你正在把剛才的感覺留下來……</p></div>}
        {!loop.capture && captureOpen && lastPerceivedRecord && <div className="memory-capture-prompt" role="status"><p>剛才那一幕還留在你心裡。</p><button onClick={() => capture(lastPerceivedRecord.id)}>捕捉這段記憶</button></div>}
        {!loop.capture && lastMemory && <div key={lastMemory.id} className="memory-capture-status memory-capture-status--fading" role="status"><p>已將「{lastMemory.title}」收進持久記憶。</p></div>}
        {incoming.length > 0 && <aside className="incoming-records incoming-records--quiet" aria-label="新消息"><span>鎮上有 {incoming.length} 則新消息</span><button type="button" onClick={() => showDrawer('case')}>查看消息 <span aria-hidden="true">↗</span></button></aside>}
        {observingSpatialRecord && <SpatialTextLayer script={observingSpatialRecord.spatialScript!} now={now} />}
        {/* Attending elsewhere hides the passage without stopping it: faded does not mean paused. */}
        {record?.spatialScript && record.acquisition === 'presence' ? !observingSpatialRecord && <SpatialTextLayer script={record.spatialScript} now={now} /> : <div className="stage-primary" hidden={Boolean(observingSpatialRecord)}>
          {stageStale ? <section className="stage-idle" aria-label="此刻">
            <p className="stage-idle__time">{PLACE_NAMES[here] ?? '灰潮鎮'} · {entry.label}</p>
            {currentActivity ? <>
              {activityLines(currentActivity, clock.minute).slice(-2).map(line => <p key={line} className="stage-idle__line">{line}</p>)}
              <p className="stage-idle__state">{currentActivity.definition.presentation.idle}<button type="button" className="stage-idle__stop" onClick={putDownActivity}>先放下</button></p>
            </> : here === 'old_house' ? <>
              <p className="stage-idle__line">{idleLine(entryWindow)}</p>
              <p className="stage-idle__line">老家很安靜。桌上的<InlineTextTarget available={homeActivityAvailable('research_online')} actionLabel="打開筆電查資料" onAttend={() => beginActivity('research_online')}>筆電</InlineTextTarget>還沒打開，<InlineTextTarget available={homeActivityAvailable('wait_for_call')} actionLabel="把手機放在手邊等消息" onAttend={() => beginActivity('wait_for_call')}>手機</InlineTextTarget>就放在手邊。</p>
            </> : townPlace === 'cafe' ? <p className="stage-idle__line">{worldCharacters.wakaharu?.location === 'cafe' ? '若晴在吧台後面忙著，還沒注意到我。咖啡機一直在響。' : '靠窗的位置換了幾次客人，吧台後面已經沒有若晴。'}</p>
            : townPlace === 'clock_shop' ? <p className="stage-idle__line">{clock.minute < 17 * 60 + 50 ? '予安趴在工作台前修錶，收音機開得很小聲，牆上的鐘各走各的。' : '鐵門拉下了一半，予安不在店裡。'}</p>
            : townPlace === 'hospital' ? <p className="stage-idle__line">{worldCharacters.doctor?.location === 'hospital' ? '護理站說陳醫生下午都在看診，診間的門一直關著。' : '走廊的廣播叫過幾個號碼，陳醫生的診間已經熄燈。'}</p>
            : <p className="stage-idle__line">{idleLine(entryWindow)}</p>}
          </section> : <AutoFlowNarrative key={`${clock.loop}:${record?.id}`} title={record?.title} lines={record?.body ?? []} excerpts={record?.excerpts ?? []} rememberedIds={rememberedExcerptIds(record)} onComplete={markStageFinished} onRemember={excerptId => record ? rememberExcerpt(record, excerptId) : false} reducedMotion={prefersReducedMotion()} />}
        </div>}
        {record?.id !== 'yu-an-message' && canAct && !hasAction('protect_wakaharu') && !hasAction('stop_doctor') && records.some(x => x.id === 'yu-an-message') && <div className="decisions"><p>手機震了一下。予安留了話。</p><button onClick={() => openRecord('yu-an-message')}>讀予安的留言</button></div>}
        {record?.id === 'yu-an-message' && canAct ? <DialogueScene
          speaker="予安"
          text="18:20 前，你可以決定今晚要怎麼做。"
          reducedMotion={prefersReducedMotion()}
          choices={[
            { actionId: 'protect_wakaharu', label: hasAction('protect_wakaharu') ? '已和若晴約好' : awayFromTown ? `保護若晴：${PROTECT_AWAY_MESSAGE}` : '保護若晴：「今晚，我陪你留下來。」', disabled: hasAction('protect_wakaharu') || awayFromTown },
            { actionId: 'stop_doctor', label: hasAction('stop_doctor') ? '予安已答應去醫院' : '請予安：「幫我去醫院。」', disabled: hasAction('stop_doctor') },
            ...(save.knowledge.discoveredEvidence.includes('primary_recovery_both_active') ? [{actionId:'request_backup_inspection',label:hasAction('request_backup_inspection')?'已請予安查證備援接口':'拿著紀錄請予安查證另一條線',disabled:hasAction('request_backup_inspection')}] : []),
          ]}
          onChoose={actionId => choose(actionId as ActionId)}
        /> : null}
        {record?.id === 'yu-an-message' && (hasAction('protect_wakaharu') || hasAction('stop_doctor')) && <div className="choice-replies" aria-label="今晚的回覆">
          {hasAction('protect_wakaharu') && <p>若晴回了訊息：「好，我今晚先不去車站。你來的時候，我把信給你看。」</p>}
          {hasAction('stop_doctor') && <p>予安回覆：「我現在去醫院找陳柏勳。會試著留住他，之後再回你。」</p>}
          {hasAction('request_backup_inspection') && <p>予安：「我先去查銘牌上的第二條路。能不能動，我要自己看過才知道。」</p>}
          <small>約定已記下。車站的消息會在鎮上傳來時出現在這裡。</small>
        </div>}
        {here !== 'en_route' && here !== 'old_station' && clock.minute>=460 && clock.minute<1439 && <div className="station-travel">
          {!loop.stationVisit && clock.minute<1111 && <button type="button" onClick={visitStation}>沿著舊路前往車站 <small>約二十分鐘；世界不會等待</small></button>}
          {here === 'old_house' && TOWN_PLACES.map(place => <button key={place} type="button" onClick={() => goToTown(place)}>{WALK_LABELS[place]} <small>約{MINUTE_WORDS[TOWN_TRAVEL_MINUTES[place]]}分鐘</small></button>)}
          {townPlace && <button type="button" onClick={walkHome}>回老家 <small>約{MINUTE_WORDS[TOWN_TRAVEL_MINUTES[townPlace]]}分鐘</small></button>}
        </div>}
        {here === 'en_route' && !(loop.stationVisit && clock.minute>=loop.stationVisit.departMinute && clock.minute<loop.stationVisit.arriveMinute) && <p className="station-travel" role="status">你正走在路上……這段時間的事件仍然發生。</p>}
        {loop.stationVisit && clock.minute>=loop.stationVisit.departMinute && clock.minute<loop.stationVisit.arriveMinute && <p className="station-travel" role="status">你正沿著舊路前往車站……這段時間的事件仍然發生。</p>}
        {atOldStation && !loop.stationVisit?.returnDepartMinute && <button className="station-return" type="button" onClick={returnFromStation}>離開舊站，返回鎮中心</button>}
        {worldState && <FinalInvestigationScene save={save} world={worldState} minute={clock.minute} onStep={chooseFinal} />}
        {note && <p className="inline-note" role="status">{note}</p>}
      </div>}
        </SceneFrame>
      </PlayerSceneStage>
    </main>
    {drawer && <div className="drawer-shade" onMouseDown={e => { if (e.target === e.currentTarget) setDrawer(null); }}><section className={`drawer ${drawer === 'board' ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={drawer === 'tools' ? '工具' : drawer === 'case' ? '案卷' : drawer === 'board' ? '推理桌' : drawer === 'save' ? '存檔' : '世界線'}>
      <header><h2>{drawer === 'tools' ? '工具' : drawer === 'case' ? '案卷' : drawer === 'board' ? '推理桌' : drawer === 'save' ? '存檔' : '世界線歷史'}</h2><button autoFocus onClick={() => setDrawer(null)} aria-label="關閉">×</button></header>
      {drawer === 'tools' && <div className="tool-menu"><button onClick={() => setDrawer('case')}>案卷 <i>{records.length}</i></button><button onClick={() => setDrawer('board')}>推理桌</button><button onClick={() => setDrawer('worldlines')}>世界線</button><button onClick={() => setDrawer('save')}>存檔</button><button onClick={() => setAudioEnabled(setAudioPreference(storage, !audioEnabled))}>聲音提示 <i>{audioEnabled ? '開' : '關'}</i></button></div>}
      {drawer === 'case' && <div className="case-list">{records.map(item => <button key={item.id} onClick={() => openRecord(item.id)}><small>{item.source} · {item.obtainedAt}</small><strong>{item.title}</strong>{!save.knowledge.opened.includes(`${clock.loop}:${item.id}`) && <em>新</em>}</button>)}</div>}
      {drawer === 'board' && <EvidenceBoard save={save} onChange={commit} onNotice={setNote} />}
      {drawer === 'worldlines' && <WorldlineNotebook save={save} currentLoop={clock.loop} knownDiff={knownDiff} />}
      {drawer === 'save' && <div className="save-panel"><p>進度存在此瀏覽器。要換裝置，可以複製 JSON 後在新裝置貼上。</p><button onClick={() => setExporting(v => !v)}>顯示這台裝置的存檔</button>{exporting && <textarea readOnly aria-label="目前存檔" value={exportSave(save)} />}
        <p>舊網站若在另一個網址，先在舊網站的瀏覽器 Console 執行：</p><code>copy(localStorage.getItem('ash-town-bible-v1'))</code><p>把複製到的內容貼在下方，或選取 JSON 檔。</p><button onClick={() => { try { setImportText(storage.getItem(LEGACY_KEY) ?? ''); } catch { setNote('讀不到舊案卷。'); } }}>讀取此網址的舊案卷</button><input type="file" accept=".json,application/json" aria-label="選取存檔" onChange={async e => { const file = e.target.files?.[0]; if (file) setImportText(await file.text()); }} /><textarea aria-label="貼上存檔 JSON" value={importText} onChange={e => setImportText(e.target.value)} /><button onClick={importSave}>匯入存檔</button>{note && <p role="status">{note}</p>}{save.knowledge.notes.map((x, i) => <p key={i}>{x.text}</p>)}</div>}
    </section></div>}
  </div>;
}
