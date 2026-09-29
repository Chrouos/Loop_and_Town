import { createLoopClock, LOOP_START_MINUTE, MINUTE, type LoopClockState } from './clock';

export type ActionId = 'protect_wakaharu' | 'stop_doctor';
export type LoopHistoryEntry = {
  sequence: number;
  simulationMinute: number;
  realTimestampMs: number;
  kind: string;
  eventId?: string;
  variantId?: string;
  title: string;
  visibility: string;
  playerPresent?: boolean;
};
export type CharacterInsight = {
  id: string;
  characterId: string;
  sourceLoop: number;
  text: string;
};
export type LoopSave = {
  actionIds: ActionId[];
  revealedIds: string[];
  perceivedSceneIds: string[];
  seenSceneIds: string[];
  sealed: boolean;
  clock: LoopClockState;
  history: LoopHistoryEntry[];
};
export type KnowledgeSave = {
  opened: string[];
  pins: string[];
  positions: Record<string, { x: number; y: number }>;
  connections: string[];
  notes: Array<{ source: 'legacy' | 'player'; text: string }>;
  characterInsights: CharacterInsight[];
  discoveredEvidence: string[];
};
export type PlayerSave = {
  version: 2;
  currentLoopId: number;
  lastConfirmedMs: number;
  loops: Record<number, LoopSave>;
  knowledge: KnowledgeSave;
  importedLegacy?: boolean;
};

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 250) : [];
const action = (value: unknown): value is ActionId => value === 'protect_wakaharu' || value === 'stop_doctor';
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const emptyHistory = (value: unknown): LoopHistoryEntry[] => Array.isArray(value)
  ? value.filter(record).map((item, index) => ({
    sequence: finite(item.sequence) ? item.sequence : index,
    simulationMinute: finite(item.simulationMinute) ? item.simulationMinute : LOOP_START_MINUTE,
    realTimestampMs: finite(item.realTimestampMs) ? item.realTimestampMs : 0,
    kind: typeof item.kind === 'string' ? item.kind : 'unknown',
    eventId: typeof item.eventId === 'string' ? item.eventId : undefined,
    variantId: typeof item.variantId === 'string' ? item.variantId : undefined,
    title: typeof item.title === 'string' ? item.title : '',
    visibility: typeof item.visibility === 'string' ? item.visibility : 'debug',
    playerPresent: typeof item.playerPresent === 'boolean' ? item.playerPresent : undefined,
  })).slice(0, 2000)
  : [];

export const emptyLoop = (clock: LoopClockState = createLoopClock('ACCELERATED', 0)): LoopSave => ({
  actionIds: [],
  revealedIds: [],
  perceivedSceneIds: [],
  seenSceneIds: [],
  sealed: false,
  clock,
  history: [],
});

function legacyTimeAt(anchorMs: number, nowMs: number): { loop: number; minute: number } {
  const elapsed = Math.max(0, nowMs - anchorMs);
  const firstLoopDuration = 6 * 60 * MINUTE;
  if (elapsed < firstLoopDuration) return { loop: 1, minute: 18 * 60 + Math.floor(elapsed / MINUTE) };
  const afterFirst = elapsed - firstLoopDuration;
  return { loop: 2 + Math.floor(afterFirst / (24 * 60 * MINUTE)), minute: Math.floor((afterFirst % (24 * 60 * MINUTE)) / MINUTE) };
}

function migratedClock(minute: number, nowMs: number): LoopClockState {
  return {
    mode: 'ACCELERATED',
    anchor: { realStartedAtMs: nowMs, simulationStartedMinute: minute, scale: 1 },
    entryMinute: minute,
    lastProcessedMinute: minute,
  };
}

function normalizeClock(value: unknown, nowMs: number): LoopClockState | undefined {
  if (!record(value)) return undefined;
  const mode = value.mode === 'LIVE_SYNC' ? 'LIVE_SYNC' : value.mode === 'ACCELERATED' ? 'ACCELERATED' : null;
  const anchor = record(value.anchor) ? value.anchor : {};
  if (!mode || !finite(anchor.realStartedAtMs) || !finite(anchor.simulationStartedMinute) || !finite(anchor.scale) || anchor.scale <= 0) return undefined;
  return {
    mode,
    anchor: { realStartedAtMs: anchor.realStartedAtMs, simulationStartedMinute: anchor.simulationStartedMinute, scale: anchor.scale },
    entryMinute: finite(value.entryMinute) ? value.entryMinute : LOOP_START_MINUTE,
    lastProcessedMinute: finite(value.lastProcessedMinute) ? value.lastProcessedMinute : LOOP_START_MINUTE,
    pendingCriticalBoundary: value.pendingCriticalBoundary === 'convergence' || value.pendingCriticalBoundary === 'bell' || value.pendingCriticalBoundary === 'reset'
      ? value.pendingCriticalBoundary : undefined,
  };
}

function normalizeLoop(value: unknown, nowMs: number, fallbackClock?: LoopClockState): LoopSave {
  const src = record(value) ? value : {};
  return {
    actionIds: [...new Set(strings(src.actionIds).filter(action))],
    revealedIds: [...new Set(strings(src.revealedIds))],
    perceivedSceneIds: [...new Set(strings(src.perceivedSceneIds))],
    seenSceneIds: [...new Set(strings(src.seenSceneIds))],
    sealed: src.sealed === true,
    clock: normalizeClock(src.clock, nowMs) ?? fallbackClock ?? createLoopClock('ACCELERATED', nowMs),
    history: emptyHistory(src.history),
  };
}

export function normalizeSave(raw: unknown, nowMs: number): PlayerSave {
  let input: unknown = raw;
  if (typeof raw === 'string') { try { input = JSON.parse(raw) as unknown; } catch { input = null; } }
  const src = record(input) ? input : {};
  if (src.version === 1 || finite(src.anchorMs)) return normalizeV1(src, nowMs);
  const lastConfirmedMs = finite(src.lastConfirmedMs) ? Math.max(0, src.lastConfirmedMs) : nowMs;
  const savedLoops = record(src.loops) ? src.loops : {};
  const loops: Record<number, LoopSave> = {};
  for (const [key, value] of Object.entries(savedLoops).slice(0, 366)) {
    const id = Number(key);
    if (!Number.isSafeInteger(id) || id < 1 || !record(value)) continue;
    loops[id] = normalizeLoop(value, nowMs);
  }
  if (!loops[1]) loops[1] = emptyLoop(createLoopClock('ACCELERATED', nowMs));
  const requestedCurrent = finite(src.currentLoopId) && Number.isSafeInteger(src.currentLoopId) ? src.currentLoopId : 1;
  const currentLoopId = loops[requestedCurrent] ? requestedCurrent : Math.max(...Object.keys(loops).map(Number));
  const old = record(src.knowledge) ? src.knowledge : {};
  const positions: KnowledgeSave['positions'] = {};
  if (record(old.positions)) for (const [key, value] of Object.entries(old.positions).slice(0, 6)) {
    if (record(value) && typeof value.x === 'number' && typeof value.y === 'number' && Number.isFinite(value.x) && Number.isFinite(value.y)) positions[key] = { x: value.x, y: value.y };
  }
  return { version: 2, currentLoopId, lastConfirmedMs, loops, importedLegacy: src.importedLegacy === true,
    knowledge: normalizeKnowledge(old),
  };
}

function normalizeV1(src: Record<string, unknown>, nowMs: number): PlayerSave {
  const anchorMs = finite(src.anchorMs) && src.anchorMs >= 0 ? src.anchorMs : nowMs;
  const lastConfirmedMs = finite(src.lastConfirmedMs) ? Math.max(anchorMs, src.lastConfirmedMs) : anchorMs;
  const current = legacyTimeAt(anchorMs, lastConfirmedMs);
  const savedLoops = record(src.loops) ? src.loops : {};
  const loops: Record<number, LoopSave> = {};
  for (const [key, value] of Object.entries(savedLoops).slice(0, 366)) {
    const id = Number(key);
    if (!Number.isSafeInteger(id) || id < 1 || !record(value)) continue;
    loops[id] = normalizeLoop(value, nowMs, migratedClock(id === current.loop ? current.minute : LOOP_START_MINUTE, nowMs));
  }
  if (!loops[current.loop]) loops[current.loop] = emptyLoop(migratedClock(current.minute, nowMs));
  if (!loops[1]) loops[1] = emptyLoop(migratedClock(current.loop === 1 ? current.minute : LOOP_START_MINUTE, nowMs));
  const old = record(src.knowledge) ? src.knowledge : {};
  return {
    version: 2,
    currentLoopId: current.loop,
    lastConfirmedMs,
    loops,
    importedLegacy: src.importedLegacy === true,
    knowledge: normalizeKnowledge(old),
  };
}

function normalizeKnowledge(old: Record<string, unknown>): KnowledgeSave {
  const positions: KnowledgeSave['positions'] = {};
  if (record(old.positions)) for (const [key, value] of Object.entries(old.positions).slice(0, 6)) {
    if (record(value) && finite(value.x) && finite(value.y)) positions[key] = { x: value.x, y: value.y };
  }
  return {
    opened: strings(old.opened),
    pins: strings(old.pins).slice(0, 6),
    connections: strings(old.connections),
    positions,
    notes: Array.isArray(old.notes) ? old.notes.filter((n): n is { source: 'legacy' | 'player'; text: string } => record(n) && (n.source === 'legacy' || n.source === 'player') && typeof n.text === 'string').slice(0, 40) : [],
    characterInsights: Array.isArray(old.characterInsights)
      ? old.characterInsights.filter(record).map((item): CharacterInsight | undefined => {
        if (
          typeof item.id !== 'string'
          || typeof item.characterId !== 'string'
          || !Number.isSafeInteger(item.sourceLoop)
          || (item.sourceLoop as number) < 1
          || typeof item.text !== 'string'
        ) return undefined;
        return { id: item.id, characterId: item.characterId, sourceLoop: item.sourceLoop as number, text: item.text };
      }).filter((item): item is CharacterInsight => item !== undefined).slice(0, 250)
      : [],
    discoveredEvidence: strings(old.discoveredEvidence),
  };
}
