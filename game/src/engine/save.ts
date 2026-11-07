import { CHAPTER_ORDER, TENSION_MAX, type LineKind } from '../script/types';
import { TEXT_SPEEDS, type TextSpeed } from './text';

export const MEMORY_CAPACITY = 10;
/** The key stays `-v1` for good: the schema version lives inside the save (`version`), not in its name. */
export const SAVE_KEY = 'listening-town-save-v1';
/** Last save that loaded cleanly, copied once per session; tried when the main one cannot be read. */
export const BACKUP_KEY = `${SAVE_KEY}.bak`;
/** An unreadable save, kept as it was before starting over. */
export const CORRUPT_KEY = `${SAVE_KEY}.corrupt`;
/** A save from a newer build, set aside only when the player chooses to start over here. */
export const NEWER_KEY = `${SAVE_KEY}.newer`;
export const SAVE_VERSION = 1;

export type Memory = {
  key: string;
  id?: string;
  text: string;
  label?: string;
  kind: LineKind;
  clock?: string;
  place?: string;
  loop: number;
  chapter: string;
};

export const FONT_SIZES = {
  small: { label: '小', scale: 0.9 },
  normal: { label: '標準', scale: 1 },
  large: { label: '大', scale: 1.2 },
  extraLarge: { label: '特大', scale: 1.4 },
  // Up to twice the standard size (Xbox Accessibility Guideline 101); a phone-sized stage caps it (game.css --ts).
  huge: { label: '超大', scale: 1.7 },
  double: { label: '最大', scale: 2 },
} as const;
export type FontSize = keyof typeof FONT_SIZES;

export type Settings = {
  audio: boolean;
  volume: number;
  /** Ambience beds (rain, rooms, streets); 1 = the level they were mixed at. */
  ambience: number;
  /** Sound effects and interface sounds. */
  sfx: number;
  voice: number;
  vibration: boolean;
  /** Her phone's screen reader says the phone lines out loud (a synthesized voice). */
  reader: boolean;
  /** Shaking and pulsing of the stage (her body); off keeps the screen still. */
  motion: boolean;
  /** A small caption under each sound saying what it is (紙, 衣服, 風). */
  soundLabels: boolean;
  textSpeed: TextSpeed;
  fontSize: FontSize;
  autoAdvance: boolean;
  /** 聽過的話自動放快: a line heard on an earlier loop comes and goes faster (and dimmer). */
  fastHeard: boolean;
  /** 選擇不倒數: a choice waits for as long as it takes (WCAG 2.2.1); its silence becomes an option on screen. */
  untimedChoices: boolean;
};

/**
 * What a reload puts back: the story state as of a resume point (entering the scene, or its latest wait).
 * Tension, knowledge and memories change mid-scene and are written at once, but a reload replays from the resume
 * point, so without this the replay would count them twice and take the other side of an `if: !know.x`.
 */
export type Checkpoint = { tension: number; knowledge: string[]; memories: Memory[]; flags: string[]; seen: string[] };

/** Why the save on disk is not (or no longer) this session's: shown once, so progress is never lost silently. */
export type SaveProblem = 'newer' | 'corrupt' | 'restored' | 'failed';

export type GameSave = {
  version: typeof SAVE_VERSION;
  started: boolean;
  chapter: string;
  loop: number;
  chLoop: number;
  knowledge: string[];
  memories: Memory[];
  endings: string[];
  scene: string | null;
  flags: string[];
  seen: string[];
  /** A real-time wait in progress (or the scene's last one): `mark` fingerprints the beats up to it, `state` is the story then. */
  wait?: { scene: string; index: number; endsAt: number; mark?: string; state?: Checkpoint };
  /** The story as she entered `scene`; a reload without a usable wait starts the scene over from this. */
  entry?: Checkpoint;
  calibrated: boolean;
  finished: boolean;
  settings: Settings;
  /** Chapters this save has entered; the chapter list only offers these. */
  reached: string[];
  /** Set while replaying an earlier chapter from the chapter list: where (and on which loop of it) to return at midnight. */
  replay: { chapter: string; chLoop: number } | null;
  /** Hidden tension 0–100: carried from chapter to chapter (it is one long day for her), eased a little each midnight. */
  tension: number;
  /** Lessons already given ('keep' = long-press a line, 'recall' = say a memory): each is taught once, then never again. */
  taught?: string[];
  /** Ids of every line heard clearly, on any loop (script/parse.ts lineId): kept across loops and reloads, gone with a
   *  new game. Not part of a Checkpoint: replaying from a resume point does not un-hear anything. */
  heard?: string[];
};

export const DEFAULT_SETTINGS: Settings = { audio: true, volume: 0.8, ambience: 0.7, sfx: 0.85, voice: 0.45, vibration: true, reader: true, motion: true, soundLabels: true, textSpeed: 'normal', fontSize: 'normal', autoAdvance: true, fastHeard: true, untimedChoices: false };

export function freshSave(previous?: Pick<GameSave, 'settings' | 'endings' | 'calibrated' | 'taught'>): GameSave {
  return {
    version: SAVE_VERSION,
    started: false,
    chapter: '1',
    loop: 1,
    chLoop: 1,
    knowledge: [],
    memories: [],
    endings: previous?.endings ?? [],
    scene: null,
    flags: [],
    seen: [],
    calibrated: previous?.calibrated ?? false,
    finished: false,
    settings: { ...DEFAULT_SETTINGS, ...(previous?.settings ?? {}) },
    reached: [],
    replay: null,
    tension: 0,
    taught: previous?.taught ?? [],
    heard: [],
  };
}

/**
 * 2026-10-29: knowledge ids took the k_ / lead_ prefixes, so a name says it lasts across loops (docs/design.md §11.2).
 * Saves from before keep what she knew under the new names.
 */
const UNPREFIXED_FLAGS = new Set(['yuan_postoffice', 'yuan_with_me', 'ruoqing_closed', 'ruoqing_number', 'ruoqing_trust', 'tingan_pressed', 'ruoqing_goes', 'ruoqing_safe', 'boxun_stays', 'dispersed', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'v_tingan', 'v_yuan', 'v_ruoqing', 'v_boxun', 'v_zhiyuan']);
const RENAMED_KNOWLEDGE: Record<string, string> = {
  c1_tingan_lied: 'k_c1_tingan_lied',
  c1_message: 'k_c1_message',
  c1_postoffice: 'k_c1_postoffice',
  c1_tingan_institute: 'k_c1_tingan_institute',
  c2_pushed: 'k_c2_pushed',
  c2_lead_notice: 'lead_c2_notice',
  c2_ruoqing_died_again: 'k_c2_ruoqing_died_again',
  c3_boxun_died_again: 'k_c3_boxun_died_again',
  c4_lead_drawer: 'lead_c4_drawer',
  c4_lead_drawer_lost: 'lead_c4_drawer_lost',
  c4_lead_count: 'lead_c4_count',
  c4_heard_goals: 'k_c4_heard_goals',
  c4_lead_promise: 'lead_c4_promise',
  c4_let_it_happen: 'k_c4_let_it_happen',
  c5_lead_kit: 'lead_c5_kit',
  c5_lead_arranged: 'lead_c5_arranged',
  c5_lead_unsaid: 'lead_c5_unsaid',
  c6_two_records: 'k_c6_two_records',
  c7_lead_boxun: 'lead_c7_boxun',
  c7_lead_ruoqing: 'lead_c7_ruoqing',
  c7_lead_zhiyuan: 'lead_c7_zhiyuan',
  c7_lead_tingan: 'lead_c7_tingan',
  f_lead_tingan: 'lead_f_tingan',
  // Split in two later the same day; the one the train recalled was the quiet one.
  f_lead_yuan: 'lead_f_yuan_quiet',
  f_lead_ruoqing: 'lead_f_ruoqing',
  f_lead_boxun: 'lead_f_boxun',
  f_lead_zhiyuan: 'lead_f_zhiyuan',
  f_lead_cabinet: 'lead_f_cabinet',
  f_again: 'k_f_again',
};

/** v → v+1, in order, forever (an old save may come from any shipped version). None yet: v1 is the first schema. */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

type Loaded = { save: GameSave; problem: SaveProblem | null };

/** Read the save: migrate, normalize, validate. A damaged one falls back to the backup; a newer one is never written over. */
export function loadSave(storage: Storage | undefined): Loaded {
  let raw: string | null = null;
  try { raw = storage?.getItem(SAVE_KEY) ?? null; } catch { return { save: freshSave(), problem: null }; }
  if (!raw) return { save: freshSave(), problem: null };
  const primary = parseSave(raw);
  if (primary.save) {
    try { storage?.setItem(BACKUP_KEY, raw); } catch { /* quota: the main save is fine anyway */ }
    return { save: primary.save, problem: null };
  }
  // From a newer build: play on without saving rather than write over it (writeSave refuses while it is there).
  if (primary.newer) return { save: freshSave(), problem: 'newer' };
  try { storage?.setItem(CORRUPT_KEY, raw); } catch { /* nowhere to keep it */ }
  let backup: string | null = null;
  try { backup = storage?.getItem(BACKUP_KEY) ?? null; } catch { /* none */ }
  const restored = backup ? parseSave(backup).save : undefined;
  if (restored) return { save: restored, problem: 'restored' };
  return { save: freshSave(), problem: 'corrupt' };
}

export function readSave(storage: Storage | undefined): GameSave {
  return loadSave(storage).save;
}

/** The player chose to start over here: keep the newer save aside, then this build may write again. */
export function setAsideNewerSave(storage: Storage | undefined): void {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (raw) storage?.setItem(NEWER_KEY, raw);
    storage?.removeItem(SAVE_KEY);
  } catch { /* nothing to do */ }
}

/** false = not written (private mode, quota, or a newer build's save is there): the player should be told. */
export function writeSave(storage: Storage | undefined, save: GameSave): boolean {
  if (!storage) return false;
  try {
    if (fromNewerBuild(storage.getItem(SAVE_KEY))) return false;
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch { return false; }
}

function fromNewerBuild(raw: string | null): boolean {
  if (!raw) return false;
  try { const data = JSON.parse(raw) as unknown; return isObject(data) && typeof data.version === 'number' && data.version > SAVE_VERSION; } catch { return false; }
}

function parseSave(raw: string | null): { save?: GameSave; newer?: true } {
  if (!raw) return {};
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return {}; }
  if (!isObject(data)) return {};
  let version = data.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return {};
  if (version > SAVE_VERSION) return { newer: true };
  try {
    while (version < SAVE_VERSION) {
      data = { ...MIGRATIONS[version](data as Record<string, unknown>), version: version + 1 };
      version += 1;
    }
    return { save: normalize(data as Partial<GameSave>) };
  } catch { return {}; }
}

/** Current-schema data → a save the game can trust: renamed ids, then every field type- and range-checked. */
function normalize(parsed: Partial<GameSave>): GameSave {
  const base = freshSave();
  const save = { ...base, ...parsed, version: SAVE_VERSION } as GameSave;
  save.started = bool(parsed.started, base.started);
  save.calibrated = bool(parsed.calibrated, base.calibrated);
  save.finished = bool(parsed.finished, base.finished);
  save.chapter = typeof parsed.chapter === 'string' && parsed.chapter ? parsed.chapter : base.chapter;
  save.loop = count(parsed.loop);
  save.chLoop = count(parsed.chLoop);
  save.scene = typeof parsed.scene === 'string' && parsed.scene ? parsed.scene : null;
  save.tension = level(parsed.tension);
  save.endings = strings(parsed.endings);
  save.seen = strings(parsed.seen);
  save.taught = strings(parsed.taught);
  save.heard = [...new Set(strings(parsed.heard))];
  save.memories = memories(parsed.memories);
  save.settings = settings(parsed.settings);
  // 予安's promise to pick her up is a relationship, kept only as a memory line now.
  save.knowledge = knowledge(parsed.knowledge);
  // This loop's flags that had no chapter prefix took the one of the chapter they belong to.
  const prefix = save.chapter === 'final' ? 'f' : `c${save.chapter}`;
  save.flags = strings(parsed.flags).map((id) => (UNPREFIXED_FLAGS.has(id) ? `${prefix}_${id}` : id));
  // 讀屏 (the phone's reader) has its own slider again, so the saved level stays (settings() clamps it to 0–1).
  // Saves from before the chapter list: every chapter up to the current one counts as reached.
  if (!Array.isArray(parsed.reached)) {
    const index = CHAPTER_ORDER.indexOf(save.chapter as never);
    save.reached = save.started && index >= 0 ? CHAPTER_ORDER.slice(0, index + 1) : [];
  } else save.reached = strings(parsed.reached).filter((key) => CHAPTER_ORDER.includes(key as never));
  const replay = parsed.replay;
  save.replay = isObject(replay) && typeof replay.chapter === 'string' ? { chapter: replay.chapter, chLoop: count(replay.chLoop) } : null;
  const entry = checkpoint(parsed.entry);
  if (entry) save.entry = entry; else delete save.entry;
  const wait = parsed.wait;
  if (isObject(wait) && typeof wait.scene === 'string' && Number.isInteger(wait.index) && wait.index >= 0 && Number.isFinite(wait.endsAt)) {
    const state = checkpoint(wait.state);
    save.wait = { scene: wait.scene, index: wait.index, endsAt: wait.endsAt, ...(typeof wait.mark === 'string' ? { mark: wait.mark } : {}), ...(state ? { state } : {}) };
  } else delete save.wait;
  return save;
}

function checkpoint(value: unknown): Checkpoint | undefined {
  if (!isObject(value)) return undefined;
  return { tension: level(value.tension), knowledge: knowledge(value.knowledge), memories: memories(value.memories), flags: strings(value.flags), seen: strings(value.seen) };
}

function knowledge(value: unknown): string[] {
  return [...new Set(strings(value).filter((id) => id !== 'c1_yuan_pickup').map((id) => RENAMED_KNOWLEDGE[id] ?? id))];
}

function settings(value: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!isObject(value)) return out;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const given = value[key];
    if (typeof given !== typeof DEFAULT_SETTINGS[key]) continue;
    if (typeof given === 'number' && !Number.isFinite(given)) continue;
    (out as Record<string, unknown>)[key] = typeof given === 'number' ? Math.max(0, Math.min(1, given)) : given;
  }
  if (!TEXT_SPEEDS.includes(out.textSpeed)) out.textSpeed = DEFAULT_SETTINGS.textSpeed;
  if (!Object.prototype.hasOwnProperty.call(FONT_SIZES, out.fontSize)) out.fontSize = 'normal';
  return out;
}

const LINE_KINDS: LineKind[] = ['narr', 'me', 'think', 'phone', 'char'];

function memories(value: unknown): Memory[] {
  if (!Array.isArray(value)) return [];
  return value.filter((memory): memory is Memory => isObject(memory) && typeof memory.key === 'string' && typeof memory.text === 'string'
    && LINE_KINDS.includes(memory.kind as LineKind) && typeof memory.chapter === 'string' && Number.isFinite(memory.loop));
}

const isObject = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
/** loop / chLoop: whole and from 1. */
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1);
const level = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(TENSION_MAX, value)) : 0);
