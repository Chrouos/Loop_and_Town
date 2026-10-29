import { CHAPTER_ORDER, type LineKind } from '../script/types';
import type { TextSpeed } from './text';

export const MEMORY_CAPACITY = 10;
export const SAVE_KEY = 'listening-town-save-v1';

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
  /** Shaking and pulsing of the stage (her body); off keeps the screen still. */
  motion: boolean;
  /** A small caption under each sound saying what it is (紙, 衣服, 風). */
  soundLabels: boolean;
  textSpeed: TextSpeed;
  fontSize: FontSize;
  autoAdvance: boolean;
};

export type GameSave = {
  version: 1;
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
  wait?: { scene: string; index: number; endsAt: number };
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
};

export const DEFAULT_SETTINGS: Settings = { audio: true, volume: 0.8, ambience: 0.7, sfx: 0.85, voice: 0.45, vibration: true, motion: true, soundLabels: true, textSpeed: 'normal', fontSize: 'normal', autoAdvance: true };

export function freshSave(previous?: Pick<GameSave, 'settings' | 'endings' | 'calibrated' | 'taught'>): GameSave {
  return {
    version: 1,
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

export function readSave(storage: Storage | undefined): GameSave {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<GameSave>;
    if (parsed.version !== 1) return freshSave();
    const base = freshSave();
    const save = { ...base, ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) } } as GameSave;
    // 予安's promise to pick her up is a relationship, kept only as a memory line now.
    save.knowledge = [...new Set((save.knowledge ?? []).filter((id) => id !== 'c1_yuan_pickup').map((id) => RENAMED_KNOWLEDGE[id] ?? id))];
    // This loop's flags that had no chapter prefix took the one of the chapter they belong to.
    const prefix = save.chapter === 'final' ? 'f' : `c${save.chapter}`;
    save.flags = (save.flags ?? []).map((id) => (UNPREFIXED_FLAGS.has(id) ? `${prefix}_${id}` : id));
    if (!Object.prototype.hasOwnProperty.call(FONT_SIZES, save.settings.fontSize)) save.settings.fontSize = 'normal';
    // Saves from before the chapter list: every chapter up to the current one counts as reached.
    if (!parsed.reached) {
      const index = CHAPTER_ORDER.indexOf(save.chapter as never);
      save.reached = save.started && index >= 0 ? CHAPTER_ORDER.slice(0, index + 1) : [];
    }
    return save;
  } catch {
    return freshSave();
  }
}

export function writeSave(storage: Storage | undefined, save: GameSave): void {
  try { storage?.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode / quota: play on without saving */ }
}
