import type { LifeEvent } from '../engine/life';
import type { AmbienceId, Direction, Distance, SfxId, VibrationId, VoiceId } from '../audio/catalog';

export type Pos = { dir: Direction | 'center'; dist: Distance };

export type LineKind = 'narr' | 'me' | 'think' | 'phone' | 'char';
export type EndKind = 'reset' | 'ending_a' | 'ending_b' | 'ending_c';
/** Her body on screen: a one-off jolt of the whole stage. */
export const SHAKE_LEVELS = ['light', 'hard'] as const;
export type ShakeLevel = (typeof SHAKE_LEVELS)[number];
/** Her heart, held until changed or the scene ends: the stage pulses with it. */
export const HEART_LEVELS = ['off', 'slow', 'fast', 'pound'] as const;
export type HeartLevel = (typeof HEART_LEVELS)[number];
/** Pain or shock, held until changed or the scene ends: the stage blurs and sways, the world sounds far away. */
export const DAZE_LEVELS = ['off', 'light', 'heavy'] as const;
export type DazeLevel = (typeof DAZE_LEVELS)[number];

export const NOISE_LEVELS = ['off', 'light', 'heavy'] as const;
export type NoiseLevel = (typeof NOISE_LEVELS)[number];
/** Hidden tension, 0–100, carried across chapters: how wound up her body is from what has happened so far. */
export const TENSION_MAX = 100;
/** A single `tension:` beat moves it by at most this much. */
export const TENSION_STEP_MAX = 40;

export type Cond =
  | { op: 'true' }
  | { op: 'false' }
  | { op: 'know' | 'flag' | 'mem' | 'seen'; id: string; later?: boolean }
  | { op: 'cmp'; left: 'loop' | 'chloop'; cmp: '>=' | '<=' | '==' | '>' | '<'; value: number }
  | { op: 'not'; arg: Cond }
  | { op: 'and' | 'or'; args: Cond[] };

export type LineBeat = {
  k: 'line';
  kind: LineKind;
  speaker: VoiceId | 'me';
  text: string;
  at?: Pos;
  /** The voice moves while it speaks, from `at` to here. */
  to?: Pos;
  label?: string;
  learn?: string;
  mem?: string;
  shake?: ShakeLevel;
};

/** Memory Input: she says a remembered line out loud. Only the accepted memories change anything. */
export type RecallAccept = { mem: string; then: Beat[]; goto?: string };
export type Recall = { accept: RecallAccept[]; miss: Beat[] };
export type ChoiceOption = { text: string; cond?: Cond; disabledCond?: Cond; then: Beat[]; goto?: string; recall?: Recall };

export type Beat =
  | LineBeat
  | { k: 'sfx'; id: SfxId; pos: Pos; to?: Pos; variant?: number; text?: string; vib?: VibrationId; gain?: number; shake?: ShakeLevel; src?: string }
  | { k: 'amb'; ids: AmbienceId[]; fade?: number }
  | { k: 'move'; moves: Record<string, Pos> }
  | { k: 'pause'; seconds: number }
  | { k: 'wait'; seconds: number; clock?: string; until?: string }
  | { k: 'vib'; id: VibrationId }
  | { k: 'shake'; level: ShakeLevel }
  | { k: 'heart'; level: HeartLevel }
  | { k: 'daze'; level: DazeLevel }
  /** Panic: the noise around her comes faster and louder until it crowds the voice she is trying to hear. */
  | { k: 'noise'; level: NoiseLevel; speed?: number; loud?: number; with?: LifeEvent[] }
  /** What just happened winds her up (+) or lets her breathe (−); see Director TENSION_BANDS. */
  | { k: 'tension'; delta: number }
  | { k: 'clock'; time: string }
  | { k: 'cue'; thread: string; pos: Pos; text: string; sfx?: SfxId; grab: boolean; src?: string }
  | { k: 'choice'; timeout?: number; default?: number; options: ChoiceOption[] }
  /** 摸讀: drag a finger left to right across cells; each one surfaces only when touched slowly enough. */
  | { k: 'touch'; cells: string[]; style: 'braille' | 'groove' | 'engrave'; prompt?: string; timeout: number }
  /** 聽聲辨位: a sound repeats from one direction (with decoys); she points to it. */
  | { k: 'locate'; sfx: SfxId; at: Direction; decoys: { sfx: SfxId; at: Direction }[]; tries: number; exact?: boolean; lag?: number; timeout?: number; interval?: number; gain?: number; prompt?: string; success: Beat[]; fail: Beat[] }
  /** 聽距離: a sound walks toward her from `at`, one step at a time; she speaks up when it reaches her. Too early it cannot hear her, too late it has gone past. */
  | { k: 'approach'; sfx: SfxId; at: Direction; past: Direction; steps: number; interval: number; text?: string; prompt?: string; hit: Beat[]; early: Beat[]; late: Beat[] }
  /** 點字板: punch braille cells from the back of the paper (mirrored); cells are dot numbers as they will be read. */
  | { k: 'punch'; cells: number[][]; label?: string; prompt?: string; timeout: number }
  | { k: 'if'; cond: Cond; then: Beat[]; else: Beat[] }
  | { k: 'set'; flags: string[] }
  | { k: 'learn'; ids: string[] }
  | { k: 'goto'; scene: string }
  | { k: 'end'; kind: EndKind };

export type Scene = {
  id: string;
  chapter: string;
  time?: string;
  place?: string;
  ambience?: AmbienceId[];
  cast: Record<string, Pos>;
  beats: Beat[];
  threads: Record<string, Beat[]>;
  next?: string;
  /** Extra background life for this scene only, or 'off' to keep it silent. */
  life?: LifeEvent[] | 'off';
};

export type Chapter = {
  key: string; // '1'..'7' | 'final'
  title: string;
  start: string;
  /** Morning entry for chapter selection and subsequent loops; defaults to start. */
  restart?: string;
  advance: { cond: Cond; to: string }[];
  scenes: Scene[];
};

export type GameScript = {
  chapters: Chapter[];
  scenes: Map<string, Scene>;
  order: string[]; // chapter keys in play order
};

export const CHAPTER_ORDER = ['1', '2', '3', '4', '5', '6', '7', 'final'] as const;

export const SPEAKER_LABELS: Record<string, string> = {
  yuan: '予安',
  ruoqing: '若晴',
  boxun: '陳醫生',
  tingan: '庭安',
  zhiyuan: '周警官',
  zhixia: '知夏',
  man: '男人的聲音',
  woman: '女人的聲音',
  child: '小孩',
  old_man: '老先生',
  old_woman: '老太太',
  announcer: '廣播',
  phone: '手機',
};

export const CHAPTER_NUMERALS: Record<string, string> = {
  '1': '第一章',
  '2': '第二章',
  '3': '第三章',
  '4': '第四章',
  '5': '第五章',
  '6': '第六章',
  '7': '第七章',
  final: '最終章',
};
