import { CHAPTER_ORDER, type LineKind } from '../script/types';
import type { TextSpeed } from './text';

export const MEMORY_CAPACITY = 7;
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
};

export const DEFAULT_SETTINGS: Settings = { audio: true, volume: 0.8, ambience: 0.7, sfx: 0.85, voice: 0.45, vibration: true, motion: true, soundLabels: true, textSpeed: 'normal', fontSize: 'normal', autoAdvance: true };

export function freshSave(previous?: Pick<GameSave, 'settings' | 'endings' | 'calibrated'>): GameSave {
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
  };
}

export function readSave(storage: Storage | undefined): GameSave {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<GameSave>;
    if (parsed.version !== 1) return freshSave();
    const base = freshSave();
    const save = { ...base, ...parsed, settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) } } as GameSave;
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
