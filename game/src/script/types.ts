import type { LifeEvent } from '../engine/life';
import type { AmbienceId, Direction, Distance, SfxId, VibrationId, VoiceId } from '../audio/catalog';

export type Pos = { dir: Direction | 'center'; dist: Distance };

export type LineKind = 'narr' | 'me' | 'think' | 'phone' | 'char';
export type EndKind = 'reset' | 'ending_a' | 'ending_b' | 'ending_c';

export type Cond =
  | { op: 'true' }
  | { op: 'false' }
  | { op: 'know' | 'flag' | 'mem' | 'seen'; id: string }
  | { op: 'cmp'; left: 'loop' | 'chloop'; cmp: '>=' | '<=' | '==' | '>' | '<'; value: number }
  | { op: 'not'; arg: Cond }
  | { op: 'and' | 'or'; args: Cond[] };

export type LineBeat = {
  k: 'line';
  kind: LineKind;
  speaker: VoiceId | 'me';
  text: string;
  at?: Pos;
  label?: string;
  learn?: string;
  mem?: string;
};

export type ChoiceOption = { text: string; cond?: Cond; then: Beat[]; goto?: string };

export type Beat =
  | LineBeat
  | { k: 'sfx'; id: SfxId; pos: Pos; text?: string; vib?: VibrationId; gain?: number }
  | { k: 'amb'; ids: AmbienceId[] }
  | { k: 'move'; moves: Record<string, Pos> }
  | { k: 'pause'; seconds: number }
  | { k: 'wait'; seconds: number; clock?: string; until?: string }
  | { k: 'vib'; id: VibrationId }
  | { k: 'clock'; time: string }
  | { k: 'cue'; thread: string; pos: Pos; text: string; sfx?: SfxId; grab: boolean }
  | { k: 'choice'; timeout?: number; default?: number; options: ChoiceOption[] }
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
