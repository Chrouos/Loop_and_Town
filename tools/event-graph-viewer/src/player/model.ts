export type ActionId = 'protect_wakaharu' | 'stop_doctor';
export type LoopSave = { actionIds: ActionId[]; revealedIds: string[]; sealed: boolean };
export type KnowledgeSave = {
  opened: string[];
  pins: string[];
  positions: Record<string, { x: number; y: number }>;
  connections: string[];
  notes: Array<{ source: 'legacy' | 'player'; text: string }>;
};
export type PlayerSave = {
  version: 1;
  anchorMs: number;
  lastConfirmedMs: number;
  loops: Record<number, LoopSave>;
  knowledge: KnowledgeSave;
  importedLegacy?: boolean;
};

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 250) : [];
export const emptyLoop = (): LoopSave => ({ actionIds: [], revealedIds: [], sealed: false });

export function normalizeSave(raw: unknown, nowMs: number): PlayerSave {
  let input: unknown = raw;
  if (typeof raw === 'string') { try { input = JSON.parse(raw) as unknown; } catch { input = null; } }
  const src = record(input) ? input : {};
  const anchorMs = typeof src.anchorMs === 'number' && Number.isFinite(src.anchorMs) && src.anchorMs >= 0 ? src.anchorMs : nowMs;
  const lastConfirmedMs = typeof src.lastConfirmedMs === 'number' && Number.isFinite(src.lastConfirmedMs) ? Math.max(anchorMs, src.lastConfirmedMs) : anchorMs;
  const savedLoops = record(src.loops) ? src.loops : {};
  const loops: Record<number, LoopSave> = {};
  for (const [key, value] of Object.entries(savedLoops).slice(0, 366)) {
    const id = Number(key);
    if (!Number.isSafeInteger(id) || id < 1 || !record(value)) continue;
    loops[id] = {
      actionIds: [...new Set(strings(value.actionIds).filter((v): v is ActionId => v === 'protect_wakaharu' || v === 'stop_doctor'))],
      revealedIds: [...new Set(strings(value.revealedIds))], sealed: value.sealed === true,
    };
  }
  if (!loops[1]) loops[1] = emptyLoop();
  const old = record(src.knowledge) ? src.knowledge : {};
  const positions: KnowledgeSave['positions'] = {};
  if (record(old.positions)) for (const [key, value] of Object.entries(old.positions).slice(0, 6)) {
    if (record(value) && typeof value.x === 'number' && typeof value.y === 'number' && Number.isFinite(value.x) && Number.isFinite(value.y)) positions[key] = { x: value.x, y: value.y };
  }
  return { version: 1, anchorMs, lastConfirmedMs, loops, importedLegacy: src.importedLegacy === true,
    knowledge: { opened: strings(old.opened), pins: strings(old.pins).slice(0, 6), connections: strings(old.connections), positions,
      notes: Array.isArray(old.notes) ? old.notes.filter((n): n is { source: 'legacy' | 'player'; text: string } => record(n) && (n.source === 'legacy' || n.source === 'player') && typeof n.text === 'string').slice(0, 40) : [],
    },
  };
}
