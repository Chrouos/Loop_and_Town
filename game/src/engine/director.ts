import type { AudioEngine } from '../audio/engine';
import { DIRECTIONS, DIRECTION_ANGLE, DISTANCES, SFX_SOURCE, type AmbienceId, type Direction, type SfxId, type VibrationId } from '../audio/catalog';
import { phoneMatters } from '../audio/reader';
import { condRefs, evalCond, type CondContext } from '../script/conditions';
import { CHAPTER_NUMERALS, SPEAKER_LABELS, TENSION_MAX, type Beat, type Chapter, type Cond, type ChoiceOption, type EndKind, type DazeLevel, type GameScript, type HeartLevel, type Lesson, type LineBeat, type NoiseLevel, type LineKind, type Pos, type Scene, type ShakeLevel } from '../script/types';
import { driftClock, heardClock, planClock, type ClockPlan } from './clock';
import { HEARD_SCALE, lineTiming, readingMs, scaleTiming, type LineTiming, type Phrase } from './text';
import { lineId } from '../script/parse';
import { HUSH_MS, HUSH_SFX, isVoice, isWhispered, lifeOf, type LifeEvent } from './life';
import { soundsAround } from './prefetch';
import { MEMORY_CAPACITY, freshSave, type Checkpoint, type GameSave, type Memory, type SaveProblem, type Settings } from './save';

// Presentation timings (scene-clock ms). Prototype parameters, core spec §26.
export const SHIFT_MS = 700;
const OUT_MS = 1100;
const CARD_MS = 2600;
const CHAPTER_CARD_MS = 4200;
/** A chapter card that also carries the opening place/time stays a little longer for them to fade in under the title. */
const CHAPTER_PLACE_EXTRA_MS = 800;
const ENDING_FADE_MS = 2500;
const ENDING_MARK_MS = 2000;
const RESET_MS = 6500;
export const ECHO_MS = 4800;
const SFX_TEXT_MS = 2600;
const LIFE_CHECK_MS = 1000;
/** Longest the stage may sit empty before the world fills it a little (unless hushed or silent by design). */
const LIFE_EMPTY_MS = 3500;
const CUE_LEAD_MS = 1800;
/** Strangers' voices are rarer than small sounds: at least this long between two of them. */
const LIFE_VOICE_GAP_MS = 15000;
/** Her heart: time between beats, how loud it is, how fast the recording plays. */
const HEART: Record<Exclude<HeartLevel, 'off'>, { ms: number; gain: number; rate: number; vib: boolean }> = {
  slow: { ms: 920, gain: 0.32, rate: 1, vib: false },
  fast: { ms: 580, gain: 0.48, rate: 1.15, vib: true },
  pound: { ms: 430, gain: 0.72, rate: 1.35, vib: true },
};
/** A heart never jumps: it climbs to a new level over HEART_RISE_MS (quick, but beat by beat), and calms (or stops) over HEART_EASE_MS. */
const HEART_RISE_MS = 5000;
const HEART_EASE_MS = 9000;
/** Where a heart starts from when it was not beating, and what it eases toward when it stops. */
const HEART_START = { ms: 1000, gain: 0.16, rate: 1 };
const HEART_REST = { ms: 1200, gain: 0, rate: 0.95 };
type HeartTone = { ms: number; gain: number; rate: number };
/** Panic noise: how many times faster the background comes, and how much louder. A script can override either. */
const NOISE: Record<Exclude<NoiseLevel, 'off'>, { speed: number; loud: number }> = {
  light: { speed: 2.5, loud: 1.5 },
  heavy: { speed: 5, loud: 2.2 },
};
/** At speed 1, one extra background beat every this long; speed divides it. */
const NOISE_BASE_MS = 2000;

/**
 * Hidden tension (save.tension, 0–100) falls into four bands: 0 calm, 1 uneasy, 2 tense, 3 panic.
 * Climbing past a line moves the band at once; coming back down needs TENSION_EASE below it, so it does not flicker.
 */
const TENSION_LINES = [30, 55, 80];
const TENSION_EASE = 6;
/** What the day does to her on its own; scripts add their own with `tension:`. */
/** Gap between the clicks of a locate sound that comes more than once (`times`). */
const LOCATE_REPEAT_MS = 260;
const TENSION_AUTO = { locateWrong: 4, locateMiss: 12, locateFound: -4, approachMiss: 10, approachHit: -4, holdLost: 4, holdMiss: 8, holdFound: -6, froze: 5, recallMiss: 4, newPlace: -2 };
/** Midnight: she wakes on the train with some of it still in her chest. */
const TENSION_SLEEP = 0.6;
/** Per band: the world's background comes this much more often (interval ×) and louder. */
const TENSION_LIFE = [{ every: 1, loud: 1, voices: 1 }, { every: 0.85, loud: 1.1, voices: 1 }, { every: 0.65, loud: 1.3, voices: 1.4 }, { every: 0.5, loud: 1.5, voices: 2 }];
/** Per band: a scripted panic comes faster and louder still. */
const TENSION_NOISE = [{ speed: 1, loud: 1 }, { speed: 1, loud: 1 }, { speed: 1.25, loud: 1.1 }, { speed: 1.5, loud: 1.2 }];
/** Per band, while she points at a sound: how loud the one she wants is, how loud the others are, and her own heart in the way. */
const TENSION_EARS = [{ target: 1, decoy: 0.8, heart: 0 }, { target: 1, decoy: 0.8, heart: 0 }, { target: 0.8, decoy: 1, heart: 0.35 }, { target: 0.65, decoy: 1.15, heart: 0.5 }];
/** A decoy that is the very same sound as the one she is after never comes louder than this share of it, or the louder one would be "it". */
export const DECOY_SAME_MAX = 0.7;
/** Per band above calm, a hold asks this many more seconds of her breath (and the window grows by as much, so it stays winnable). */
export const HOLD_PER_BAND = 0.75;
/** Approach: how many of the last steps toward her count as "just right"; in a panic only the very last one does. */
const APPROACH_CLOSE = [2, 2, 2, 1];
/** The first time a moment is taught on screen, the clock waits this long so the lesson can be read before it starts. */
const LESSON_LEAD_MS = 3000;
const INTERACT_LESSONS: readonly Lesson[] = ['locate', 'approach', 'hold'];
/** Panic with no scripted heart: she still hears her own, faintly, under everything (sound only, the screen stays still). */
const UNDERTONE = { ms: 760, gain: 0.16, rate: 1.2 };
/** Tense and up: she hears her own breathing, quicker and shallower the tighter she is. Waiting, with nothing to do, it is louder. */
const BREATH: Record<2 | 3, { ms: number; gain: number; rate: number }> = { 2: { ms: 4300, gain: 0.1, rate: 1 }, 3: { ms: 2700, gain: 0.17, rate: 1.15 } };
/** What `<心率>` in a line reads as: resting rate for the heart she has right now, plus what the day has wound up. */
const BPM: Record<HeartLevel, number> = { off: 78, slow: 74, fast: 112, pound: 142 };

export type CenterLine = {
  key: number;
  thread: string;
  kind: LineKind;
  label?: string;
  text: string;
  phrases: Phrase[];
  startedAt: number;
  revealMs: number;
  pos: Pos;
  /** A voice on the move ends up here, `glideMs` after it starts. */
  to?: Pos;
  glideMs?: number;
  perceived: boolean;
  captured: boolean;
  mem?: string;
  /** Heard on an earlier loop and played faster (聽過的話自動放快, or the fast-forward): drawn dimmer. */
  heard?: true;
  /** A voice from before: anything played off a tape, and Zhixia, who is only ever heard in recordings and memories.
   *  It is written in a hand of its own (docs/design.md §3.1). */
  past?: true;
};

/** `src`: what she hears it as (紙, 衣服, 風), shown small under the onomatopoeia. */
export type Peripheral = { key: number; kind: 'sfx' | 'murmur' | 'cue' | 'life'; text: string; src?: string; pos: Pos; thread?: string; born: number; until: number };

/** `mark`: a faint line above the loop text on a reset card (結局 B the first time), shown for `markMs`. */
export type Card = { chapter?: string; title?: string; time?: string; place?: string; loopText?: string; mark?: string; markMs?: number; recap?: { memory?: string } };

export type View = {
  phase: 'idle' | 'out' | 'card' | 'scene' | 'reset' | 'ending';
  /** The current 'out' is only a breath into a continuous scene, not a fade to black. */
  brief: boolean;
  t: number;
  sceneId?: string;
  clock?: string;
  /** Bumped when the script pins the clock (not while it creeps), so Stage re-announces only real changes. */
  clockMark: number;
  place?: string;
  card?: Card;
  center: CenterLine | null;
  /** A lesson waiting on the player: 'tap' = tap the screen, 'turn' = tap a sound, 'keep' = long-press the line, to go on. */
  teach: Lesson | null;
  echo: (CenterLine & { until: number }) | null;
  /** The main conversation's current line while she listens elsewhere: it keeps going in the middle, blurred. */
  away: CenterLine | null;
  periph: Peripheral[];
  ripples: { key: number; pos: Pos }[];
  /** `teach`: the first question that takes a memory; the memory button says what it is for. `first`: the first question ever. */
  /** `timeout` (s) is already stretched to give time to read every option; unset = it waits (選擇不倒數, or none set).
   *  `fallback`: what happens when the time runs out, for the countdown's description ('silence' = she says nothing). */
  choice: { key: number; options: { text: string; index: number; disabled?: boolean }[]; startedAt: number; timeout?: number; fallback?: string | 'silence'; teach?: boolean; first?: boolean } | null;
  /** Memory Input picker: which remembered lines she could say right now. */
  recall: { key: number; memories: Memory[] } | null;
  /** A hands-or-ears moment the scene is waiting on. */
  interact: InteractView | null;
  focus: string | null;
  shiftingTo: Pos | null;
  /** `first`: the first wait ever, which says it cannot be skipped. */
  waiting: { startedAt: number; seconds: number; clock?: string; until?: string; first?: boolean } | null;
  keep: Memory | null;
  memoryCount: number;
  ending?: 'a' | 'c';
  /** Bumped once per jolt; Stage plays the shake when it changes. */
  shake: number;
  shakeLevel: ShakeLevel;
  /**
   * Her heart while it is loud enough to feel; `beat` counts up with every beat so Stage can pulse in time.
   * `glow` (0–1) is how hard this beat lands on screen and `ms` how long until the next: both follow the sound.
   */
  heart: { level: Exclude<HeartLevel, 'off'>; glow: number; ms: number; beat: number } | null;
  /** Pain or shock: the stage blurs and the world goes muffled. */
  daze: Exclude<DazeLevel, 'off'> | null;
  /** Panic: the background floods in around the centre line. */
  noise: { level: Exclude<NoiseLevel, 'off'>; speed: number; loud: number } | null;
  /** Hidden tension band (0 calm … 3 panic): words lose their edges, the background crowds in. */
  tension: TensionBand;
  chapterKey: string;
  loop: number;
  /** The save is not keeping up: 'newer' (a newer build's save is on disk; nothing is written over it), 'failed' (the last
   *  write did not land), 'corrupt' (unreadable, started over; the raw copy is kept), 'restored' (loaded from the backup). */
  saveProblem: SaveProblem | null;
  /** Fast-forwarding to the next line she has not heard (or a choice, a task, a wait): F held, a two-finger tap. */
  skipping: boolean;
};

/** One line in 剛剛聽到的: what was heard clearly, where and when. */
export type BacklogEntry = { key: number; kind: LineKind; label?: string; text: string; clock?: string; place?: string; loop: number };

export type TensionBand = 0 | 1 | 2 | 3;

export type InteractView =
  | { type: 'touch'; key: number; cells: string[]; style: 'braille' | 'groove' | 'engrave'; prompt?: string }
  /** `lesson`: the first time ever, the moment says how it works (shown once, then remembered in save.taught). */
  | { type: 'locate'; key: number; prompt?: string; triesLeft: number; hint: Direction | null; wrong: Direction[]; lesson?: true }
  | { type: 'approach'; key: number; prompt?: string; lesson?: true }
  /** 屏息: hold on and breathe out slowly; `since` is when this hold began (null = not holding). `seconds` already counts her tension. */
  | { type: 'hold'; key: number; prompt?: string; seconds: number; since: number | null; lesson?: true }
  | { type: 'punch'; key: number; cells: number[][]; label?: string; prompt?: string };

export type DirectorOutput = {
  audio: AudioEngine;
  vibrate: (pattern: VibrationId) => void;
  /** false = not written; the view says so (saveProblem). */
  persist: (save: GameSave) => boolean | void;
  wallNow: () => number;
};

type ActiveLine = { beat: LineBeat; center: CenterLine; revealEnd: number; end: number; learnChecked: boolean };
type Frame = { beats: Beat[]; i: number };
type Run = {
  id: string;
  stack: Frame[];
  busyUntil: number;
  line: ActiveLine | null;
  blocked: boolean;
  done: boolean;
  pos: Pos;
  /** A thread of strangers talking under their breath. */
  whisper?: boolean;
  /** The last line this run said was one heard on an earlier loop: a `pause` after it is shortened too. */
  afterHeard?: boolean;
  // seconds: how long this hold has to last (her tension added); close: how many of the last steps toward her count.
  pendingInteract?: { beat: InteractBeat; deadline: number; triesLeft: number; start: number; heldFrom?: number; slips?: number; seconds?: number; close?: number };
  pendingChoice?: { beat: Extract<Beat, { k: 'choice' }>; options: ChoiceOption[]; deadline: number; fallback: number; recallIndex?: number; remaining?: number };
  // recallIndex: the open memory picker answers this option; -1 = this question takes no memory at all.
};

const CENTER: Pos = { dir: 'center', dist: 'near' };

type InteractBeat = Extract<Beat, { k: 'touch' | 'locate' | 'approach' | 'punch' | 'hold' }>;
/** 聽距離: how far each step lands (audio radius), from the far end of the street to right in front of her. */
const APPROACH_FAR = 6;
const APPROACH_NEAR = 0.9;
const APPROACH_PAST = [1.4, 2.8, 4.5];
const distOf = (r: number): Pos['dist'] => (r >= 4 ? 'far' : r >= 1.8 ? 'mid' : 'near');

export class Director {
  readonly script: GameScript;
  save: GameSave;
  view: View;
  version = 0;
  speed: number;
  private out: DirectorOutput;
  private listeners = new Set<() => void>();
  private flags = new Set<string>();
  private recallTried = new WeakMap<Beat, Set<string>>();
  private seen = new Set<string>();
  private knowledge = new Set<string>();
  private runs = new Map<string, Run>();
  private scene: Scene | null = null;
  /** The area the last full card announced; moving around inside it only updates the corner. */
  private shownArea: string | undefined;
  /** Continuing a save: the first card also says where she was and (after a midnight) the last line she kept. */
  private recap: Card['recap'];
  private cast: Record<string, Pos> = {};
  private shift: { to: string; until: number } | null = null;
  /** The line holding the keep lesson, until it is long-pressed. */
  private teachKey: number | null = null;
  private phaseUntil = 0;
  private afterPhase: (() => void) | null = null;
  private timeline: { at: number; fn: () => void }[] = [];
  private keyCounter = 1;
  private paused = false;
  private pendingGoto: string | null = null;
  private pendingEnd: EndKind | null = null;
  // Background life: strangers and small sounds around her, paced on the scene clock.
  private ambience: AmbienceId[] = [];
  private lifeGen = 0;
  private lifeHushUntil = 0;
  private lifeNextAt = 0;
  private lifeBusyAt = 0;
  private lifeRecent: LifeEvent[] = [];
  /** Strangers' lines already heard this session: none comes back until its whole pool has been heard. */
  private lifeSaid = new Set<LifeEvent>();
  private lifeVoiceAt = -Infinity;
  private heartGen = 0;
  /** The level the script asked for; the heart actually beating may be a step faster when she is wound up. */
  private heartAsked: HeartLevel = 'off';
  /** Where the beat is heading, what it sounded like last, and the glide between the two. */
  private heartTarget: HeartLevel = 'off';
  private heartTone: HeartTone | null = null;
  private heartGlide: { from: HeartTone; at: number; ms: number } | null = null;
  private undertoneGen = 0;
  private breathGen = 0;
  private noiseGen = 0;
  // The corner clock creeps along the main line between the times the script names.
  private clockPlan: ClockPlan | null = null;
  private clockFrom: { clock?: string; step: number } = { step: 0 };
  private mainStep = 0;
  /** Every line id heard clearly on any loop (save.heard), and the scenes those lines belong to. */
  private heard = new Set<string>();
  private heardScenes = new Set<string>();
  /** 剛剛聽到的: the last BACKLOG_SIZE lines heard clearly. Kept in memory only (see backlog). */
  private log: BacklogEntry[] = [];
  /** Why saves are not landing (newer build on disk, or a failed write), what loading found, and what was read. */
  private saveBlocked: 'newer' | 'failed' | null = null;
  private saveNotice: SaveProblem | null = null;
  private saveDismissed = new Set<SaveProblem>();

  constructor(script: GameScript, save: GameSave, out: DirectorOutput, options: { speed?: number; saveProblem?: SaveProblem | null } = {}) {
    this.script = script;
    this.save = save;
    this.out = out;
    this.speed = options.speed ?? 1;
    this.knowledge = new Set(save.knowledge);
    this.loadHeard();
    this.view = this.emptyView();
    const problem = options.saveProblem ?? null;
    if (problem === 'newer' || problem === 'failed') this.saveBlocked = problem;
    else this.saveNotice = problem;
    this.syncSaveProblem();
    this.save.tension ??= 0;
    this.syncTension();
  }

  // ───────────────────────── public API ─────────────────────────

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getVersion = () => this.version;

  get settings(): Settings { return this.save.settings; }
  get knows(): ReadonlySet<string> { return this.knowledge; }
  get loopFlags(): ReadonlySet<string> { return this.flags; }
  get currentScene(): Scene | null { return this.scene; }
  get tension(): number { return this.save.tension; }
  /**
   * 剛剛聽到的, oldest first. Not saved: a reload replays the scene from its resume point, which hears those lines
   * again and puts them back here, so a saved copy would only show them twice; and writing up to 200 lines on every
   * line would be the heaviest thing in the save.
   */
  get backlog(): readonly BacklogEntry[] { return this.log; }
  /** Whether this line id was heard clearly on some loop (or earlier on this one). */
  hasHeard(id: string): boolean { return this.heard.has(id); }
  get threadsRunning(): string[] { return [...this.runs.values()].filter((run) => !run.done && run.id !== 'main').map((run) => run.id); }

  /** Start or resume from the save. */
  start(): void {
    if (!this.save.started) {
      this.save.started = true;
      this.beginChapter(this.save.chapter, true);
      return;
    }
    // Ids the script no longer has (a chapter or scene renamed since this save): start that day over, never a dead screen.
    const chapter = this.chapter(this.save.chapter);
    if (chapter.key !== this.save.chapter) {
      console.warn(`save: chapter ${this.save.chapter} is gone, starting chapter ${chapter.key}`);
      this.save.chapter = chapter.key;
      this.save.chLoop = 1;
      this.dropProgressInDay();
    }
    if (!this.save.reached.includes(chapter.key)) this.save.reached.push(chapter.key);
    if (this.save.replay && !this.script.order.includes(this.save.replay.chapter)) this.save.replay = null;
    if (this.save.scene !== null && this.script.scenes.get(this.save.scene)?.chapter !== chapter.key) {
      console.warn(`save: scene ${this.save.scene} is not in chapter ${chapter.key}, starting the chapter's day over`);
      this.dropProgressInDay();
    }
    const sceneId = this.save.scene ?? (this.save.chLoop > 1 ? chapter.restart ?? chapter.start : chapter.start);
    const resumeWait = this.resumableWait(sceneId);
    if (!resumeWait) delete this.save.wait;
    // A reload replays from the resume point, so the story goes back to how it stood there (save.ts, Checkpoint).
    const back = resumeWait?.state ?? this.save.entry;
    if (back) this.restore(back);
    this.flags = new Set(this.save.flags);
    this.seen = new Set(this.save.seen);
    // The card already says where she is; from the second day on it also brings back the last line she kept.
    const lastMemory = this.save.loop > 1 ? this.save.memories.at(-1)?.text : undefined;
    this.recap = lastMemory ? { memory: lastMemory } : undefined;
    this.transition(sceneId, resumeWait);
  }

  /** The saved scene is gone: this loop's day starts over (what she knows and keeps stays). */
  private dropProgressInDay(): void {
    this.save.scene = null;
    this.save.flags = [];
    this.save.seen = [];
    delete this.save.entry;
    delete this.save.wait;
  }

  /** A saved wait resumes only while the beats up to it are the ones it was saved in; otherwise the scene starts over. */
  private resumableWait(sceneId: string): GameSave['wait'] {
    const wait = this.save.wait;
    if (!wait || wait.scene !== sceneId) return undefined;
    const beats = this.script.scenes.get(sceneId)?.beats ?? [];
    if (beats[wait.index]?.k === 'wait' && (wait.mark === undefined || wait.mark === markOf(beats, wait.index))) return wait;
    console.warn(`save: scene ${sceneId} changed above the saved wait, starting the scene over`);
    return undefined;
  }

  /** The story as it stood at a resume point (save.ts, Checkpoint). */
  private snapshot(): Checkpoint {
    return { tension: this.save.tension, knowledge: [...this.knowledge], memories: [...this.save.memories], flags: [...this.flags], seen: [...this.seen] };
  }

  private restore(back: Checkpoint): void {
    this.save.tension = back.tension;
    this.save.knowledge = [...back.knowledge];
    this.knowledge = new Set(back.knowledge);
    this.save.memories = [...back.memories];
    this.save.flags = [...back.flags];
    this.save.seen = [...back.seen];
    this.view.memoryCount = this.save.memories.length;
    this.syncTension();
  }

  newGame(): void {
    this.forget();
    this.persist();
    this.start();
  }

  /** A new game's save: lessons, endings and settings stay; the story, what she heard and what she knows go. */
  private forget(): void {
    this.save = freshSave(this.save);
    this.loadHeard();
    this.log = [];
    this.knowledge = new Set();
    this.flags = new Set();
    this.recallTried = new WeakMap();
    this.seen = new Set();
    this.view.memoryCount = 0;
  }

  /** Jump to a chapter for testing / chapter select. Grants knowledge learned in earlier chapters when asked. */
  jumpToChapter(key: string, grantEarlierKnowledge: boolean): void {
    this.save = { ...freshSave(this.save), started: true, chapter: key };
    this.loadHeard();
    this.log = [];
    this.knowledge = new Set();
    if (grantEarlierKnowledge) {
      for (const chapter of this.script.chapters) {
        if (this.script.order.indexOf(chapter.key) >= this.script.order.indexOf(key)) break;
        for (const id of learnIdsOf(chapter)) this.knowledge.add(id);
      }
    }
    this.save.knowledge = [...this.knowledge];
    this.flags = new Set();
    this.recallTried = new WeakMap();
    this.seen = new Set();
    this.beginChapter(key, true);
  }

  /**
   * Testing (?scene=c1_1752): start straight at one scene of its chapter, with earlier chapters' knowledge when asked,
   * and any loop flags the scene expects (?flags=c1_yuan_with_me). Flags the chapter would have set on the way stay unset.
   */
  jumpToScene(sceneId: string, grantEarlierKnowledge: boolean, flags: string[] = []): boolean {
    const scene = this.script.scenes.get(sceneId);
    if (!scene) return false;
    this.jumpToChapter(scene.chapter, grantEarlierKnowledge);
    this.flags = new Set(flags);
    this.afterPhase = () => this.transition(sceneId);
    return true;
  }

  /** Every chapter in play order, for the chapter list. */
  get chapterList(): { key: string; title: string }[] {
    return this.script.order.map((key) => ({ key, title: this.chapter(key).title }));
  }

  /** The chapter progress belongs to: where a replay returns at midnight, otherwise the current one. */
  get progressChapter(): string { return this.save.replay?.chapter ?? this.save.chapter; }

  /**
   * Chapter list. Earlier chapter: live one 10/3 of it, keeping everything heard and remembered, then return at midnight.
   * The progress chapter: start its day over (or stop replaying and go back to it). A later chapter (testing only): jump
   * there with every earlier chapter's knowledge added to what she already knows.
   */
  selectChapter(key: string): void {
    const order = this.script.order;
    const target = this.progressChapter;
    if (!order.includes(key)) return;
    this.save.loop += 1;
    this.save.scene = null;
    this.save.flags = [];
    this.save.seen = [];
    this.save.finished = false;
    delete this.save.wait;
    delete this.save.entry;
    if (key === target) {
      this.save.chLoop = this.save.replay ? this.save.replay.chLoop : this.save.chLoop + 1;
      this.save.replay = null;
      this.beginChapter(key, this.save.chLoop === 1, true);
    } else if (order.indexOf(key) < order.indexOf(target)) {
      this.save.replay ??= { chapter: target, chLoop: this.save.chLoop };
      this.save.chLoop = 1;
      this.beginChapter(key, true, true);
    } else {
      for (const chapter of this.script.chapters) {
        if (order.indexOf(chapter.key) >= order.indexOf(key)) break;
        for (const id of learnIdsOf(chapter)) this.knowledge.add(id);
      }
      this.save.knowledge = [...this.knowledge];
      this.save.replay = null;
      this.save.chLoop = 1;
      this.beginChapter(key, true, true);
    }
    this.persist();
  }

  setPaused(paused: boolean): void { this.paused = paused; }
  /** Testing (?tension=70): put her straight into a band without playing up to it (a reload's resume point too). */
  setTension(value: number): void {
    this.addTension(Math.round(value) - this.save.tension, true);
    for (const back of [this.save.entry, this.save.wait?.state]) if (back) back.tension = this.save.tension;
  }

  /** The player has read the save notice: it is not shown again this session (a new failure after a good write is). */
  dismissSaveProblem(): void {
    if (this.view.saveProblem) this.saveDismissed.add(this.view.saveProblem);
    this.syncSaveProblem();
    this.bump();
  }
  /** The player chose to start over in this build (save.ts setAsideNewerSave has moved the newer save aside). */
  startOverHere(): void {
    this.forget();
    this.persist();
    this.bump();
  }
  /** The sound check is done (or skipped): saved through persist, so a failed write shows as a save problem. */
  setCalibrated(): void { this.save.calibrated = true; this.persist(); }

  /**
   * Fast-forward: lines heard on an earlier loop go by at once, pauses shrink, until the next line she has not heard,
   * a choice, a task for her hands, a real-time wait, or midnight. Sounds still play; nothing is chosen for her and
   * no wait gets shorter (docs/design.md §7). Returns false when there is nothing heard to go past right now.
   */
  fastForward(): boolean {
    if (this.view.skipping) return true;
    if (!['scene', 'out', 'card'].includes(this.view.phase) || this.paused) return false;
    if (this.view.choice || this.view.interact || this.view.waiting || this.view.recall || this.view.keep || this.view.teach) return false;
    const line = this.focusedLine();
    if (line && !line.center.heard && !line.center.perceived) return false;
    this.view.skipping = true;
    if (this.view.phase !== 'scene') this.hurryInner();
    else if (line) {
      line.revealEnd = Math.min(line.revealEnd, this.view.t);
      line.end = Math.min(line.end, this.view.t + SKIP_LINE_MS);
      this.focusRun()!.busyUntil = line.end;
    }
    this.advanceTo(this.view.t);
    this.bump();
    return true;
  }

  /** Any input (or something new to hear) ends a fast-forward. */
  stopFastForward(): void {
    if (!this.view.skipping) return;
    this.view.skipping = false;
    this.bump();
  }
  updateSettings(patch: Partial<Settings>): void {
    this.save.settings = { ...this.save.settings, ...patch };
    this.out.audio.setEnabled(this.save.settings.audio);
    this.out.audio.setVolume(this.save.settings.volume);
    this.out.audio.setAmbienceVolume(this.save.settings.ambience);
    this.out.audio.setSfxVolume(this.save.settings.sfx);
    this.out.audio.setVoiceVolume(this.save.settings.voice);
    if (!this.save.settings.reader) this.out.audio.hush?.();
    this.persist();
    this.bump();
  }

  tick(realDtMs: number): void {
    if (this.paused || this.view.phase === 'idle' || this.view.phase === 'ending') return;
    let target = this.view.t + Math.max(0, Math.min(realDtMs, 250)) * this.speed;
    const focused = this.focusedLine();
    if (focused && !this.settings.autoAdvance && focused.end === Infinity) target = Math.min(target, Math.max(this.view.t, focused.revealEnd));
    this.advanceTo(target);
    this.checkSkip();
  }

  /** A fast-forward stops at anything that asks something of the player, and at midnight. */
  private checkSkip(): void {
    const view = this.view;
    if (view.skipping && (view.choice || view.interact || view.waiting || view.recall || view.keep || view.teach || (view.phase !== 'scene' && view.phase !== 'out' && view.phase !== 'card'))) this.stopFastForward();
  }

  /** Tap: finish the current phrase reveal, then move on. */
  hurry(): void {
    this.hurryInner();
    this.bump();
  }

  /** Coming back to the page: a real-time wait kept going while we were away (the world does not wait). */
  catchUpWait(wallMs: number): void {
    const waiting = this.view.waiting;
    if (!waiting || this.view.phase !== 'scene') return;
    const end = waiting.startedAt + waiting.seconds * 1000;
    this.advanceTo(Math.min(end, this.view.t + wallMs * this.speed));
    this.bump();
  }

  private hurryInner(): void {
    const t = this.view.t;
    if (this.view.phase === 'card' || this.view.phase === 'out') { this.advanceTo(Math.max(t, this.phaseUntil)); return; }
    if (this.view.phase !== 'scene' || this.view.waiting || this.view.choice || this.view.interact || this.shift) return;
    const line = this.focusedLine();
    if (line) {
      if (t < line.revealEnd) { this.advanceTo(line.revealEnd); return; }
      if (this.teachKey === line.center.key) {
        // Tapping is the whole lesson (and goes on past a line saying how a moment works); the others ask for something else.
        const lesson = this.view.teach;
        if (lesson !== 'tap' && !(lesson && INTERACT_LESSONS.includes(lesson))) return;
        this.dropLesson();
        if (lesson === 'tap') this.markTaught('tap');
      }
      if (line.end === Infinity) { line.end = t; this.focusRun()!.busyUntil = t; }
      this.advanceTo(Math.max(t, line.end));
      return;
    }
    const run = this.focusRun();
    if (run && !run.blocked && run.busyUntil > t && run.busyUntil - t < 4000) this.advanceTo(run.busyUntil);
  }

  /** Turn toward a sound. Turning toward the one already being listened to brings her back to herself. */
  attend(threadId: string): void {
    if (this.view.phase !== 'scene') return;
    const listening = this.shift ? this.shift.to : this.view.focus;
    if (threadId !== 'main' && listening === threadId) { this.beginShift('main'); this.bump(); return; }
    const target = this.runs.get(threadId);
    if (!target || (target.done && threadId !== 'main')) return;
    if (listening === threadId) return;
    if (threadId !== 'main' && (this.runs.get('main')?.pendingChoice || this.runs.get('main')?.pendingInteract)) return;
    this.beginShift(threadId);
    this.bump();
  }

  choose(index: number): void {
    const main = this.runs.get('main');
    const pending = main?.pendingChoice;
    if (!main || !pending || this.view.focus !== 'main') return;
    const option = pending.options[index];
    if (!option || (option.silent && !this.settings.untimedChoices)) return;
    if (option.disabledCond && evalCond(option.disabledCond, this.condContext())) return;
    if (option.recall) { this.openRecall(main, index); return; }
    this.applyChoice(main, option);
    this.advanceTo(this.view.t);
  }

  /** Memory Input: say one remembered line out loud (null = put it back and choose normally). */
  recallPick(memoryKey: string | null): void {
    const main = this.runs.get('main');
    const pending = main?.pendingChoice;
    if (!main || !pending || pending.recallIndex === undefined || !this.view.recall) return;
    const option = pending.recallIndex >= 0 ? pending.options[pending.recallIndex] : undefined;
    this.view.recall = null;
    if (memoryKey === null) {
      // Back to the choice; its clock starts again where it stopped.
      pending.deadline = this.view.t + (pending.remaining ?? Infinity);
      pending.recallIndex = undefined;
      this.bump();
      return;
    }
    const memory = this.save.memories.find((candidate) => candidate.key === memoryKey);
    if (!memory) { this.bump(); return; }
    this.triedRecall(pending.beat).add(memory.key);
    const accepted = option?.recall?.accept.find((entry) => entry.mem === memory.id);
    // Wrong where a memory was wanted stings a little; trying one where none was is just a thought.
    if (!accepted && option) this.addTension(TENSION_AUTO.recallMiss);
    main.pendingChoice = undefined;
    main.blocked = false;
    this.view.choice = null;
    const beats: Beat[] = accepted
      ? [...accepted.then, ...(accepted.goto ? [{ k: 'goto', scene: accepted.goto } as Beat] : [])]
      // A line that doesn't fit: she stops before saying it, and the question is still there.
      : [...(option?.recall?.miss.length ? option.recall.miss : [{ k: 'line', kind: 'think', speaker: 'me', text: option ? '……不對。不是這一句。' : '……不是現在。' } as Beat]), pending.beat];
    main.stack.push({ beats, i: 0 });
    main.busyUntil = this.view.t;
    this.bump();
    this.advanceTo(this.view.t);
  }

  /** Whether a question is open right now, so the memory she carries can be said instead of chosen. */
  canRemember(): boolean {
    return Boolean(this.runs.get('main')?.pendingChoice) && this.view.focus === 'main' && !this.view.recall;
  }

  /** The memory she can reach for at any question, whether or not this one takes a memory. */
  remember(): void {
    if (!this.canRemember()) return;
    const main = this.runs.get('main')!;
    this.openRecall(main, main.pendingChoice!.options.findIndex((option) => option.recall));
  }

  private openRecall(run: Run, index: number): void {
    const pending = run.pendingChoice!;
    const memories = this.recallable(pending.beat);
    pending.recallIndex = index;
    pending.remaining = Number.isFinite(pending.deadline) ? Math.max(3000, pending.deadline - this.view.t) : Infinity;
    pending.deadline = Infinity;
    this.view.recall = { key: this.keyCounter++, memories };
    this.out.audio.play('memory_keep', CENTER, { gain: 0.5 });
    this.bump();
  }

  private triedRecall(beat: Beat): Set<string> {
    let tried = this.recallTried.get(beat);
    if (!tried) { tried = new Set(); this.recallTried.set(beat, tried); }
    return tried;
  }

  private recallable(beat: Beat): Memory[] {
    const tried = this.triedRecall(beat);
    return this.save.memories.filter((memory) => !tried.has(memory.key));
  }

  /** 摸讀: a fingertip reached cell i (the UI decides whether it was slow enough to count). */
  touchCell(index: number, clear: boolean): void {
    if (this.view.interact?.type !== 'touch') return;
    this.out.audio.play(clear ? 'braille_stylus' : 'cloth_rustle', CENTER, { gain: clear ? 0.35 : 0.25, rate: 1 + index * 0.03 });
    if (clear) this.vibrate('tap');
  }

  touchDone(): void { this.finishInteract('touch', true); }

  punchDot(): void {
    if (this.view.interact?.type !== 'punch') return;
    this.out.audio.play('braille_stylus', CENTER, { gain: 0.6 });
    this.vibrate('tap');
  }

  /** A dot this cell does not need: the stylus slips on the paper, and the hand feels it. Nothing is punched. */
  punchMiss(): void {
    if (this.view.interact?.type !== 'punch') return;
    this.out.audio.play('cloth_rustle', CENTER, { gain: 0.3, rate: 1.15 });
    this.vibrate('buzz');
  }

  punchDone(): void { this.finishInteract('punch', true); }

  /** 聽聲辨位: she points toward where she thinks the sound is. */
  locatePick(dir: Direction): void {
    const main = this.runs.get('main');
    const pending = main?.pendingInteract;
    const view = this.view.interact;
    if (!main || !pending || pending.beat.k !== 'locate' || view?.type !== 'locate') return;
    if (pending.beat.exact ? dir === pending.beat.at : directionsClose(dir, pending.beat.at)) { this.resolveInteract(main, true); this.advanceTo(this.view.t); return; }
    pending.triesLeft -= 1;
    this.out.audio.play('focus_shift', { dir, dist: 'mid' }, { gain: 0.5 });
    if (pending.triesLeft <= 0) { this.resolveInteract(main, false); this.advanceTo(this.view.t); return; }
    this.addTension(TENSION_AUTO.locateWrong);
    // After a wrong turn the sound is drawn as a faint ripple where it really is (for anyone without headphones);
    // in a panic she cannot tell any more, so no ripple.
    const lost = this.view.tension >= 3;
    this.view.interact = { ...view, triesLeft: pending.triesLeft, wrong: [...view.wrong, dir], hint: lost ? null : pending.beat.at };
    if (!lost) this.ripple({ dir: pending.beat.at, dist: 'mid' });
    this.bump();
  }

  /**
   * 屏息: she holds still and lets the breath out slowly. The room falls away while she holds; held long enough, the
   * small sound she was listening for comes through. Letting go early, her own heart is all she hears; she can try again.
   */
  holdStart(): void {
    const main = this.runs.get('main');
    const pending = main?.pendingInteract;
    const view = this.view.interact;
    if (!main || !pending || pending.beat.k !== 'hold' || view?.type !== 'hold' || view.since !== null) return;
    const beat = pending.beat;
    const seconds = pending.seconds ?? beat.seconds;
    const from = this.view.t;
    pending.heldFrom = from;
    this.view.interact = { ...view, since: from };
    this.out.audio.play('breath', CENTER, { gain: 0.45, rate: 0.7 });
    this.out.audio.duck(0.6, seconds * 1000);
    if (beat.sfx) {
      const sfx = beat.sfx;
      const at = beat.at ?? 'front';
      this.schedule(from + seconds * 600, () => { if (main.pendingInteract === pending && pending.heldFrom === from) this.out.audio.play(sfx, { dir: at, dist: 'far' }, { gain: 0.35 }); });
    }
    this.schedule(from + seconds * 1000, () => {
      if (main.pendingInteract !== pending || pending.heldFrom !== from) return;
      if (beat.sfx) this.out.audio.play(beat.sfx, { dir: beat.at ?? 'front', dist: 'mid' }, { gain: 0.8 });
      this.resolveInteract(main, true);
      this.advanceTo(this.view.t);
    });
    this.bump();
  }

  holdEnd(): void {
    const main = this.runs.get('main');
    const pending = main?.pendingInteract;
    const view = this.view.interact;
    if (!main || !pending || pending.beat.k !== 'hold' || view?.type !== 'hold' || view.since === null) return;
    pending.heldFrom = undefined;
    this.view.interact = { ...view, since: null };
    // Too soon: the breath catches, the heart jumps back into her ears. Only the first few slips wind her up more.
    pending.slips = (pending.slips ?? 0) + 1;
    if (pending.slips <= HOLD_SLIPS_FELT) this.addTension(TENSION_AUTO.holdLost);
    this.out.audio.play('heartbeat', CENTER, { gain: 0.8, rate: 1.2 });
    this.bump();
  }

  /** 聽距離: she speaks up. Whether it lands depends on how close the steps are right now. */
  approachCall(): void {
    const main = this.runs.get('main');
    const pending = main?.pendingInteract;
    if (!main || !pending || pending.beat.k !== 'approach' || this.view.interact?.type !== 'approach') return;
    const beat = pending.beat;
    const stepAt = (i: number) => pending.start + i * beat.interval * 1000;
    const now = this.view.t;
    const close = pending.close ?? APPROACH_CLOSE[0];
    const branch = now < stepAt(beat.steps - close) - beat.interval * 350 ? beat.early
      : now > stepAt(beat.steps - 1) + beat.interval * 900 ? beat.late
        : beat.hit;
    this.resolveInteract(main, branch === beat.hit, branch);
    this.advanceTo(this.view.t);
  }

  private finishInteract(type: InteractView['type'], ok: boolean): void {
    const main = this.runs.get('main');
    if (!main?.pendingInteract || main.pendingInteract.beat.k !== type) return;
    this.resolveInteract(main, ok);
    this.advanceTo(this.view.t);
  }

  private startInteract(run: Run, beat: InteractBeat, t: number): void {
    // The first time ever (unless a line already said it), the moment says how it works. It counts as taught the
    // moment it is shown, like the first wait and the first question, so it can never be said twice; anything on a
    // clock waits a little so the lesson can be read before the steps start or the breath is timed.
    const lesson = (beat.k === 'locate' || beat.k === 'approach' || beat.k === 'hold') && !this.taught(beat.k);
    if (lesson) this.markTaught(beat.k);
    const lead = lesson ? LESSON_LEAD_MS : 0;
    // Wound up, the same moment is harder, never impossible: a hold asks for more breath (and its window grows by as much),
    // and in a panic only the very last step toward her is close enough.
    const band = this.view.tension;
    const holdExtra = beat.k === 'hold' ? HOLD_PER_BAND * band : 0;
    // An approach lasts as long as the walk: every step toward her, then three going away.
    const timeoutMs = beat.k === 'approach' ? (beat.steps + APPROACH_PAST.length) * beat.interval * 1000
      : beat.k === 'locate' ? (beat.timeout !== undefined ? beat.timeout * 1000 : Infinity) : (beat.timeout + holdExtra) * 1000;
    // (hold: the whole window to get her breath down)
    run.blocked = true;
    run.pendingInteract = {
      beat, deadline: t + timeoutMs + SHIFT_MS + lead, triesLeft: beat.k === 'locate' ? beat.tries : 1, start: t + SHIFT_MS + lead,
      ...(beat.k === 'hold' ? { seconds: beat.seconds + holdExtra } : {}),
      ...(beat.k === 'approach' ? { close: APPROACH_CLOSE[band] } : {}),
    };
    if (this.view.focus !== 'main' && this.shift?.to !== 'main') this.beginShift('main');
    const key = this.keyCounter++;
    const taught = lesson ? { lesson: true as const } : {};
    if (beat.k === 'touch') this.view.interact = { type: 'touch', key, cells: beat.cells, style: beat.style, prompt: beat.prompt };
    if (beat.k === 'punch') this.view.interact = { type: 'punch', key, cells: beat.cells, label: beat.label, prompt: beat.prompt };
    if (beat.k === 'locate') {
      this.view.interact = { type: 'locate', key, prompt: beat.prompt, triesLeft: beat.tries, hint: null, wrong: [], ...taught };
      if (beat.replay !== false) this.repeatLocate(key, beat, t);
    }
    if (beat.k === 'hold') this.view.interact = { type: 'hold', key, prompt: beat.prompt, seconds: beat.seconds + holdExtra, since: null, ...taught };
    if (beat.k === 'approach') {
      this.view.interact = { type: 'approach', key, prompt: beat.prompt, ...taught };
      this.walkUp(key, beat, t + SHIFT_MS + lead, APPROACH_CLOSE[band]);
    }
    this.bump();
  }

  /** Each step lands closer and louder; past her, the same steps fade the other way. */
  private walkUp(key: number, beat: Extract<Beat, { k: 'approach' }>, start: number, close: number): void {
    const n = beat.steps;
    const steps = [
      // The steps that count are felt in the hand too.
      ...Array.from({ length: n }, (_, i) => ({ dir: beat.at, r: APPROACH_FAR - (APPROACH_FAR - APPROACH_NEAR) * (i / (n - 1)), gain: 0.35 + 0.65 * (i / (n - 1)), close: i >= n - close })),
      ...APPROACH_PAST.map((r, j) => ({ dir: beat.past, r, gain: 0.8 - j * 0.2, close: false })),
    ];
    steps.forEach((step, i) => this.schedule(start + i * beat.interval * 1000, () => {
      if (this.view.interact?.key !== key) return;
      const pos: Pos = { dir: step.dir, dist: distOf(step.r) };
      this.out.audio.play(beat.sfx, pos, { gain: step.gain * TENSION_EARS[this.view.tension].target, radius: step.r });
      if (beat.text) this.addPeripheral('sfx', beat.text, pos, this.view.t + beat.interval * 900, undefined, SFX_SOURCE[beat.sfx]);
      this.ripple(pos);
      if (step.close) this.vibrate('tap');
      this.maskWithHeart(key, this.view.t + beat.interval * 500);
      this.bump();
    }));
  }

  /** Wound up, her own heartbeat lands between the sounds she is trying to follow. */
  private maskWithHeart(key: number, at: number): void {
    const gain = TENSION_EARS[this.view.tension].heart;
    if (!gain) return;
    this.schedule(at, () => { if (this.view.interact?.key === key) this.out.audio.play('heartbeat', CENTER, { gain, rate: 1.25 }); });
  }

  /** The sound keeps coming back until she points at it (or the moment passes). */
  private repeatLocate(key: number, beat: Extract<Beat, { k: 'locate' }>, t: number): void {
    if (this.view.interact?.key !== key) return;
    // lag: everything ticks together once a second, and the one she is after comes a little behind.
    const ears = TENSION_EARS[this.view.tension];
    const target = (beat.gain ?? 1) * ears.target;
    if (beat.lag !== undefined) {
      beat.decoys.forEach((decoy) => this.out.audio.play(decoy.sfx, { dir: decoy.at, dist: 'mid' }, { gain: decoyGain(beat, decoy, ears.decoy, target * 0.8) }));
      this.schedule(t + beat.lag * 1000, () => { if (this.view.interact?.key === key) this.out.audio.play(beat.sfx, { dir: beat.at, dist: 'mid' }, { gain: target * 0.8 }); });
      this.maskWithHeart(key, t + 600);
      this.schedule(t + 1000, () => this.repeatLocate(key, beat, t + 1000));
      return;
    }
    // times: a short sound (a clasp) comes as a little run of clicks, so there is something to follow.
    const times = beat.times ?? 1;
    this.out.audio.play(beat.sfx, { dir: beat.at, dist: 'mid' }, { gain: target });
    for (let n = 1; n < times; n++) this.schedule(t + n * LOCATE_REPEAT_MS, () => { if (this.view.interact?.key === key) this.out.audio.play(beat.sfx, { dir: beat.at, dist: 'mid' }, { gain: target }); });
    const after = (times - 1) * LOCATE_REPEAT_MS;
    beat.decoys.forEach((decoy, index) => this.schedule(t + after + 500 + index * 420, () => {
      if (this.view.interact?.key === key) this.out.audio.play(decoy.sfx, { dir: decoy.at, dist: 'mid' }, { gain: decoyGain(beat, decoy, ears.decoy, target) });
    }));
    this.maskWithHeart(key, t + after + 250);
    const intervalMs = Math.max(700, (beat.interval ?? 2.6) * 1000);
    this.schedule(t + intervalMs, () => this.repeatLocate(key, beat, t + intervalMs));
  }

  private resolveInteract(run: Run, ok: boolean, branch?: Beat[]): void {
    const pending = run.pendingInteract;
    if (!pending) return;
    run.pendingInteract = undefined;
    run.blocked = false;
    this.view.interact = null;
    if (pending.beat.k === 'locate') this.addTension(ok ? TENSION_AUTO.locateFound : TENSION_AUTO.locateMiss);
    if (pending.beat.k === 'approach') this.addTension(ok ? TENSION_AUTO.approachHit : TENSION_AUTO.approachMiss);
    if (pending.beat.k === 'hold') this.addTension(ok ? TENSION_AUTO.holdFound : TENSION_AUTO.holdMiss);
    if (pending.beat.k === 'locate' || pending.beat.k === 'hold') run.stack.push({ beats: ok ? pending.beat.success : pending.beat.fail, i: 0 });
    // Nobody spoke up in time: the steps went past and she calls after them.
    if (pending.beat.k === 'approach') run.stack.push({ beats: branch ?? pending.beat.late, i: 0 });
    run.busyUntil = this.view.t;
    this.bump();
  }

  /** Long-press: keep the line that is (or just was) heard clearly. */
  /**
   * Keep a line. `key` is the line under her finger; without one (the keyboard), what she is listening to,
   * else the echo above it. The line she is hearing right now counts even before it has finished.
   */
  capture(key?: number): boolean {
    const center = this.view.center;
    const live = this.focusedLine();
    const hearing = Boolean(center && !this.shift && live && !live.learnChecked);
    const keepable = (line: CenterLine | null | undefined): line is CenterLine => Boolean(line && (line.perceived || (line === center && hearing)));
    const held = key !== undefined ? [center, this.view.echo].find((line) => line?.key === key) : keepable(center) ? center : this.view.echo;
    const candidate = keepable(held) ? held : null;
    if (!candidate || candidate.captured || candidate.kind === 'phone' && candidate.text.length < 4) return false;
    if (this.save.memories.some((memory) => memory.text === candidate.text && memory.loop === this.save.loop)) return false;
    candidate.captured = true;
    const memory: Memory = {
      key: `${this.save.loop}-${candidate.key}`,
      id: candidate.mem,
      text: candidate.text.replace(/\|/g, ''),
      label: candidate.label,
      kind: candidate.kind,
      clock: this.view.clock,
      place: this.view.place,
      loop: this.save.loop,
      chapter: this.save.chapter,
    };
    this.out.audio.play('memory_keep', CENTER, { gain: 0.8 });
    this.out.vibrate('tap');
    if (this.save.memories.length >= MEMORY_CAPACITY) this.view.keep = memory;
    else this.addMemory(memory);
    // The lesson is learnt: the held line lets go a moment later, once the keep has been felt.
    if (candidate.key === this.teachKey && this.view.teach === 'keep' && live) {
      this.dropLesson();
      this.markTaught('keep');
      live.end = Math.max(live.revealEnd, this.view.t) + 1400;
      this.focusRun()!.busyUntil = live.end;
    }
    this.bump();
    return true;
  }

  releaseMemory(key: string): void {
    this.save.memories = this.save.memories.filter((memory) => memory.key !== key);
    if (this.view.keep) { this.addMemory(this.view.keep); this.view.keep = null; }
    this.view.memoryCount = this.save.memories.length;
    this.persist();
    this.bump();
  }

  skipKeep(): void { this.view.keep = null; this.bump(); }

  // ───────────────────────── chapters & scenes ─────────────────────────

  /** An unknown key falls back to the first chapter in play order; callers that keep the key (start, beginChapter) store the one returned. */
  private chapter(key: string): Chapter {
    const chapter = this.script.chapters.find((candidate) => candidate.key === key)
      ?? this.script.chapters.find((candidate) => candidate.key === this.script.order[0]) ?? this.script.chapters[0];
    if (!chapter) throw new Error('沒有任何章節');
    return chapter;
  }

  private beginChapter(key: string, firstOfChapter: boolean, restart = !firstOfChapter): void {
    const chapter = this.chapter(key);
    const entry = restart ? chapter.restart ?? chapter.start : chapter.start;
    this.save.scene = entry;
    this.save.chapter = chapter.key;
    // The day starts here: what she has now is its starting state, nothing to roll back to.
    delete this.save.entry;
    delete this.save.wait;
    if (!this.save.reached.includes(chapter.key)) this.save.reached.push(chapter.key);
    this.flags = new Set();
    this.recallTried = new WeakMap();
    this.seen = new Set();
    this.clearScene();
    this.shownArea = undefined;
    const card: Card = firstOfChapter
      ? { chapter: CHAPTER_NUMERALS[chapter.key] ?? '', title: chapter.title }
      : { loopText: `第${toChineseNumber(this.save.loop)}次的十月三日` };
    // A chapter that opens somewhere new says where and when under its own title, instead of a second card after it.
    const opening = firstOfChapter ? this.script.scenes.get(entry) : undefined;
    const merged = opening?.place !== undefined;
    if (merged) {
      card.place = opening!.place;
      if (opening!.time) card.time = opening!.time;
      this.shownArea = areaOf(opening!.place!);
    }
    this.view.chapterKey = chapter.key;
    this.view.loop = this.save.loop;
    this.prefetchAround(entry);
    this.setPhase('card', firstOfChapter ? CHAPTER_CARD_MS + (merged ? CHAPTER_PLACE_EXTRA_MS : 0) : CARD_MS, () => this.transition(entry, undefined, merged), card);
  }

  /** Fetch what this scene and the ones after it will play, so a slow connection does not swallow a cue. */
  private prefetchAround(sceneId: string): void {
    this.out.audio.prefetch?.(soundsAround(this.script, sceneId));
  }

  /** `arrived`: the chapter card already faded to this place, so there is no second fade-out and card. */
  private transition(sceneId: string, resumeWait?: GameSave['wait'], arrived = false): void {
    const scene = this.script.scenes.get(sceneId);
    if (!scene) throw new Error(`找不到場景 ${sceneId}`);
    this.prefetchAround(sceneId);
    this.out.audio.hush?.();
    this.startBreath();
    // A scene without its own time/place continues the moment: barely a breath between them, and her heart
    // does not stop for it.
    const continuous = !scene.time && !scene.place;
    this.clearScene(continuous && !resumeWait);
    const outMs = continuous ? 280 : OUT_MS;
    if (!continuous && !arrived) this.out.audio.duck(0.5, OUT_MS);
    this.view.brief = continuous;
    const arrive = (): void => {
      // Only a continuous scene carries the old echo (and sounds still dying away) across; anywhere else they went with the faded world.
      if (!continuous) { this.view.echo = null; this.view.periph = []; this.view.ripples = []; }
      if (scene.ambience) this.out.audio.setAmbience(scene.ambience, 2600);
      // Only a new area earns the full card; a new room or a later hour just updates the corner.
      const area = scene.place ? areaOf(scene.place) : undefined;
      const showCard = area !== undefined && area !== this.shownArea && !resumeWait;
      if (area !== undefined) this.shownArea = area;
      const recap = this.recap;
      this.recap = undefined;
      if (showCard) this.setPhase('card', CARD_MS, () => this.enterScene(scene, resumeWait), { time: scene.time, place: scene.place, recap });
      else this.enterScene(scene, resumeWait);
    };
    if (arrived) arrive();
    else this.setPhase('out', outMs, arrive);
  }

  private enterScene(scene: Scene, resumeWait?: GameSave['wait']): void {
    // Taken before anything here moves it: a reload enters the scene again and does it all once more.
    const entry = resumeWait ? undefined : this.snapshot();
    this.scene = scene;
    this.seen.add(scene.id);
    this.cast = { ...scene.cast };
    this.view.phase = 'scene';
    this.view.card = undefined;
    this.view.sceneId = scene.id;
    this.clockPlan = planClock(scene, this.script.scenes);
    this.mainStep = 0;
    this.setClock(scene.time ?? this.view.clock);
    this.view.place = scene.place ?? this.view.place;
    this.view.focus = 'main';
    // Somewhere new, a little later: the body comes down a notch on its own.
    if ((scene.time || scene.place) && !resumeWait) this.addTension(TENSION_AUTO.newPlace, true);
    this.syncTension();
    if (scene.ambience) this.ambience = scene.ambience;
    this.startLife();
    this.save.scene = scene.id;
    this.save.flags = [...this.flags];
    this.save.seen = [...this.seen];
    // Resuming a wait keeps the scene's own entry: if the wait is ever not resumable, the scene starts over from that.
    if (entry) { this.save.entry = entry; delete this.save.wait; }
    this.persist();
    const main: Run = { id: 'main', stack: [{ beats: scene.beats, i: 0 }], busyUntil: this.view.t, line: null, blocked: false, done: false, pos: CENTER };
    this.runs.set('main', main);
    if (resumeWait) {
      main.stack[0].i = resumeWait.index;
      this.mainStep = this.clockPlan!.after[resumeWait.index - 1] ?? 0;
      this.clockFrom.step = this.mainStep;
      const beat = scene.beats[resumeWait.index];
      if (beat?.k === 'wait') {
        main.stack[0].i += 1;
        const remainingMs = Math.max(0, resumeWait.endsAt - this.out.wallNow()) * this.speed;
        this.startWait(main, beat, this.view.t, remainingMs, resumeWait.index);
      }
    }
    this.bump();
  }

  private clearScene(keepHeart = false): void {
    this.view.recall = null;
    this.view.interact = null;
    if (!keepHeart) this.setHeart('off');
    this.setDaze('off');
    this.setNoise('off');
    // Leaving a live scene, the last line lingers as an echo so it fades out with the world instead of blinking off.
    const live = this.view.phase === 'scene';
    const lingering = !live ? null
      : this.view.center ? { ...this.view.center, until: this.view.t + ECHO_MS } : this.view.echo;
    this.runs.clear();
    this.shift = null;
    this.pendingGoto = null;
    this.pendingEnd = null;
    this.view.center = null;
    this.view.away = null;
    this.dropLesson();
    this.view.echo = lingering;
    // Sounds already in the air finish on their own; only what belonged to the scene's threads goes.
    this.view.periph = live ? this.view.periph.filter((item) => item.kind === 'sfx' || item.kind === 'life') : [];
    if (!live) this.view.ripples = [];
    this.view.choice = null;
    this.view.waiting = null;
    this.view.shiftingTo = null;
    this.view.focus = null;
  }

  private setPhase(phase: View['phase'], durationMs: number, after: () => void, card?: Card): void {
    // Fast-forwarding, the breath between scenes and a new place's card are short; a new chapter or day is not.
    if (this.view.skipping && (phase === 'out' || (phase === 'card' && !card?.chapter && !card?.loopText))) durationMs = Math.min(durationMs, SKIP_CARD_MS);
    this.view.phase = phase;
    this.view.card = card ?? (phase === 'card' ? this.view.card : undefined);
    this.phaseUntil = this.view.t + durationMs;
    this.afterPhase = after;
    this.bump();
  }

  private endLoop(kind: EndKind): void {
    this.view.skipping = false;
    this.clearScene();
    this.heartAsked = 'off';
    this.stopHeart();
    if (kind === 'ending_a' || kind === 'ending_c') {
      const letter = kind === 'ending_a' ? 'a' : 'c';
      if (!this.save.endings.includes(letter)) this.save.endings.push(letter);
      this.save.finished = true;
      this.save.scene = null;
      delete this.save.entry;
      delete this.save.wait;
      this.persist();
      this.out.audio.setAmbience([], 6000);
      // Black to black: the last scene fades out before the ending comes up, not a cut.
      this.setPhase('out', ENDING_FADE_MS, () => {
        this.view.phase = 'ending';
        this.view.ending = letter;
        this.bump();
      });
      return;
    }
    // The first time this day ends in B, the reset card says so, faintly, for a moment.
    const firstB = kind === 'ending_b' && !this.save.endings.includes('b');
    if (firstB) this.save.endings.push('b');
    // 00:00 Hard Reset: decide the next chapter from what the player actually learned this loop.
    const chapter = this.chapter(this.save.chapter);
    const ctx = this.condContext();
    const rule = chapter.advance.find((candidate) => evalCond(candidate.cond, ctx));
    // A replayed day from the chapter list goes back to where the player was, whatever this chapter's rule says.
    const back = this.save.replay;
    this.save.replay = null;
    const nextKey = back ? back.chapter : rule?.to ?? chapter.key;
    const advanced = nextKey !== chapter.key;
    this.save.loop += 1;
    this.save.tension = Math.round(this.save.tension * TENSION_SLEEP);
    this.save.chLoop = back ? back.chLoop : advanced ? 1 : this.save.chLoop + 1;
    this.save.chapter = nextKey;
    this.save.scene = null;
    this.flags = new Set();
    this.recallTried = new WeakMap();
    this.seen = new Set();
    this.save.flags = [];
    this.save.seen = [];
    delete this.save.wait;
    delete this.save.entry;
    this.persist();
    this.out.audio.silence(400);
    this.view.loop = this.save.loop;
    this.setPhase('reset', RESET_MS, () => this.beginChapter(nextKey, advanced), { loopText: `第${toChineseNumber(this.save.loop)}次的十月三日`, ...(firstB ? { mark: '結局 B', markMs: ENDING_MARK_MS } : {}) });
    this.schedule(this.view.t + 1500, () => { this.out.audio.play('heartbeat', CENTER, { gain: 0.9 }); this.vibrate('heartbeat'); });
    this.schedule(this.view.t + 2700, () => { this.out.audio.play('heartbeat', CENTER, { gain: 0.7 }); this.vibrate('heartbeat'); });
    this.schedule(this.view.t + 3800, () => this.out.audio.setAmbience(['train_interior'], 3000));
  }

  // ───────────────────────── clock ─────────────────────────

  private schedule(at: number, fn: () => void) { this.timeline.push({ at, fn }); this.timeline.sort((a, b) => a.at - b.at); }

  private advanceTo(target: number): void {
    let guard = 0;
    while (guard++ < 5000) {
      if (this.view.phase === 'scene' && (this.pendingGoto || this.pendingEnd) && !this.listeningAside()) { this.flushPending(); continue; }
      // Next due event at or before target.
      const phaseDue = this.view.phase !== 'scene' && this.afterPhase && this.phaseUntil <= target ? this.phaseUntil : Infinity;
      const timelineDue = this.timeline.length && this.timeline[0].at <= target ? this.timeline[0].at : Infinity;
      const sceneDue = this.view.phase === 'scene' ? this.nextSceneEvent(target) : Infinity;
      const next = Math.min(phaseDue, timelineDue, sceneDue);
      if (next === Infinity) break;
      this.view.t = Math.max(this.view.t, next);
      if (next === timelineDue) { this.timeline.shift()!.fn(); continue; }
      if (next === phaseDue) { const after = this.afterPhase!; this.afterPhase = null; after(); continue; }
      this.processScene();
    }
    this.view.t = Math.max(this.view.t, target);
    this.checkSkip();
    this.expire();
  }

  private nextSceneEvent(target: number): number {
    let next = Infinity;
    if (this.shift && this.shift.until <= target) next = Math.min(next, this.shift.until);
    for (const run of this.runs.values()) {
      if (run.done) continue;
      if (run.line && !run.line.learnChecked && run.line.revealEnd <= target) next = Math.min(next, run.line.revealEnd);
      if (run.pendingChoice && run.pendingChoice.deadline <= target) next = Math.min(next, run.pendingChoice.deadline);
      if (run.pendingInteract && run.pendingInteract.deadline <= target) next = Math.min(next, run.pendingInteract.deadline);
      if (!run.blocked && run.busyUntil <= target) next = Math.min(next, run.busyUntil);
    }
    return next;
  }

  private processScene(): void {
    const t = this.view.t;
    if (this.shift && this.shift.until <= t) this.finishShift();
    for (const run of [...this.runs.values()]) {
      if (this.view.phase !== 'scene') return;
      if (run.done) continue;
      if (run.line && !run.line.learnChecked && run.line.revealEnd <= t) this.checkPerception(run);
      if (run.pendingChoice && run.pendingChoice.deadline <= t) {
        const option = run.pendingChoice.options[run.pendingChoice.fallback];
        // Time ran out and she said nothing: freezing is its own kind of fright.
        this.addTension(TENSION_AUTO.froze);
        this.applyChoice(run, option);
      }
      // Hands and ears take their time, but the day does not stop: she gets there on her own, or misses it.
      if (run.pendingInteract && run.pendingInteract.deadline <= t) this.resolveInteract(run, run.pendingInteract.beat.k !== 'locate' && run.pendingInteract.beat.k !== 'approach' && run.pendingInteract.beat.k !== 'hold');
      while (!run.done && !run.blocked && run.busyUntil <= this.view.t && this.view.phase === 'scene') {
        this.finishLine(run);
        this.step(run);
        if (this.pendingGoto || this.pendingEnd) break;
      }
      if (this.pendingGoto || this.pendingEnd) {
        if (!this.listeningAside()) this.flushPending();
        return;
      }
    }
  }

  /** The scene is over, but she is still turned toward someone else: let that finish (or let her turn back) first. */
  private listeningAside(): boolean {
    const id = this.shift ? this.shift.to : this.view.focus;
    if (!id || id === 'main') return false;
    const run = this.runs.get(id);
    return Boolean(run && !run.done);
  }

  private flushPending(): void {
    if (this.pendingEnd) { const kind = this.pendingEnd; this.pendingEnd = null; this.pendingGoto = null; this.endLoop(kind); return; }
    if (this.pendingGoto) { const to = this.pendingGoto; this.pendingGoto = null; this.transition(to); }
  }

  private expire(): void {
    const t = this.view.t;
    let changed = false;
    const periph = this.view.periph.filter((item) => item.until > t);
    if (periph.length !== this.view.periph.length) { this.view.periph = periph; changed = true; }
    if (this.view.echo && this.view.echo.until <= t) { this.view.echo = null; changed = true; }
    if (this.view.ripples.length > 12) { this.view.ripples = this.view.ripples.slice(-12); changed = true; }
    if (changed) this.bump();
  }

  // ───────────────────────── beats ─────────────────────────

  private step(run: Run): void {
    const frame = run.stack[run.stack.length - 1];
    if (!frame) { this.completeRun(run); return; }
    if (frame.i >= frame.beats.length) {
      run.stack.pop();
      if (run.stack.length === 0) this.completeRun(run);
      return;
    }
    const topLevelIndex = run.stack.length === 1 ? frame.i : -1;
    const beat = frame.beats[frame.i++];
    const t = Math.max(run.busyUntil, 0);
    const main = run.id === 'main' && topLevelIndex >= 0 && this.clockPlan;
    if (main) this.mainStep = this.clockPlan!.after[topLevelIndex];
    const mark = this.view.clockMark;
    this.execute(run, beat, t, topLevelIndex);
    if (main && this.view.clockMark === mark && this.view.phase === 'scene') this.creepClock(topLevelIndex);
  }

  /** Between the times the script names, the corner clock walks with the story. */
  private creepClock(index: number): void {
    const crept = driftClock(this.clockPlan!, index, this.clockFrom.clock, this.clockFrom.step, this.view.clock);
    if (crept && crept !== this.view.clock) { this.view.clock = crept; this.bump(); }
  }

  /** The script names the time: the corner shows it, and the clock creeps on from here. */
  private setClock(time: string | undefined): void {
    if (time !== this.view.clock) this.view.clockMark += 1;
    this.view.clock = time;
    this.clockFrom = { clock: time, step: this.mainStep };
  }

  private execute(run: Run, beat: Beat, t: number, topLevelIndex: number): void {
    switch (beat.k) {
      case 'line': this.startLine(run, beat, t); return;
      case 'sfx': {
        // Loudness directs attention: anomalies and emphasized beats stand above everyday actions.
        const important = HUSH_SFX.has(beat.id) || beat.shake !== undefined || beat.vib !== undefined;
        this.out.audio.play(beat.id, beat.pos, { gain: beat.gain ?? (important ? 1 : 0.45), ...(beat.variant !== undefined ? { variant: beat.variant - 1 } : {}), ...(beat.to ? { to: beat.to } : {}) });
        if (beat.vib) this.vibrate(beat.vib);
        else if (beat.shake) this.vibrate(SHAKE_VIBRATION[beat.shake]);
        if (beat.text) this.addPeripheral('sfx', beat.text, beat.pos, t + SFX_TEXT_MS * (beat.pos.dist === 'far' ? 1.25 : 1), undefined, beat.src ?? SFX_SOURCE[beat.id]);
        if (beat.to) this.trail(beat.pos, beat.to, t, SFX_TEXT_MS);
        else this.ripple(beat.pos);
        const jolt = beat.shake ?? (beat.vib === 'crash' ? 'hard' : beat.vib === 'thud' ? 'light' : undefined);
        if (jolt) this.jolt(jolt);
        if (HUSH_SFX.has(beat.id)) this.lifeHushUntil = t + HUSH_MS;
        run.busyUntil = t + (this.view.skipping ? (beat.text ? SKIP_SFX_MS : 120) : beat.text ? 650 : 150);
        this.bump();
        return;
      }
      case 'amb': this.out.audio.setAmbience(beat.ids, beat.fade !== undefined ? beat.fade * 1000 : 2400); this.ambience = beat.ids; this.startLife(); run.busyUntil = t; return;
      case 'move': Object.assign(this.cast, beat.moves); run.busyUntil = t; return;
      case 'pause': run.busyUntil = t + this.pauseMs(run, beat.seconds * 1000); return;
      case 'wait': this.startWait(run, beat, t, beat.seconds * 1000, topLevelIndex); return;
      case 'vib': this.vibrate(beat.id); run.busyUntil = t; return;
      case 'shake': this.jolt(beat.level); this.vibrate(SHAKE_VIBRATION[beat.level]); run.busyUntil = t; this.bump(); return;
      case 'heart': this.setHeart(beat.level); run.busyUntil = t; return;
      case 'daze': this.setDaze(beat.level); run.busyUntil = t; return;
      case 'noise': this.setNoise(beat.level, beat.speed, beat.loud, beat.with); run.busyUntil = t; return;
      case 'tension': this.addTension(beat.delta); run.busyUntil = t; return;
      case 'clock': this.setClock(beat.time); run.busyUntil = t; this.bump(); return;
      case 'cue': this.startThread(beat, t); run.busyUntil = t + 400; return;
      case 'choice': this.offerChoice(run, beat, t); return;
      case 'touch': case 'locate': case 'approach': case 'punch': case 'hold': this.startInteract(run, beat, t); return;
      case 'if': run.stack.push({ beats: evalCond(beat.cond, this.condContext()) ? beat.then : beat.else, i: 0 }); run.busyUntil = t; return;
      case 'set': beat.flags.forEach((flag) => this.flags.add(flag)); run.busyUntil = t; return;
      case 'learn': beat.ids.forEach((id) => this.learn(id)); run.busyUntil = t; return;
      case 'goto': if (run.id === 'main') { this.pendingGoto = beat.scene; run.blocked = true; } run.busyUntil = t; return;
      case 'end': if (run.id === 'main') { this.pendingEnd = beat.kind; run.blocked = true; } run.busyUntil = t; return;
    }
  }

  private posFor(run: Run, beat: LineBeat): Pos {
    if (beat.at) return beat.at;
    if (beat.kind === 'char') return this.cast[beat.speaker] ?? (run.id === 'main' ? { dir: 'front', dist: 'mid' } : run.pos);
    return run.id === 'main' ? CENTER : run.pos;
  }

  private startLine(run: Run, beat: LineBeat, t: number): void {
    const text = beat.text.includes('<心率>') ? beat.text.split('<心率>').join(String(this.bpm())) : beat.text;
    const id = this.idOf(beat);
    const heardBefore = id !== undefined && this.heard.has(id);
    const focusedHere = this.view.focus === run.id && !this.shift;
    // Something she has not heard yet: a fast-forward stops here and it plays as written.
    if (!heardBefore && focusedHere) this.stopFastForward();
    const skipping = heardBefore && this.view.skipping;
    const fast = heardBefore && this.settings.fastHeard;
    run.afterHeard = heardBefore;
    let timing: LineTiming = lineTiming(text, beat.kind, this.settings.textSpeed);
    if (skipping) timing = { phrases: timing.phrases.map((phrase) => ({ ...phrase, at: 0 })), revealMs: 0, holdMs: SKIP_LINE_MS };
    else if (fast) timing = scaleTiming(timing, HEARD_SCALE);
    // A jolt is her body: the phone in her hand takes it too, as it does for a bare `shake` beat.
    if (beat.shake) { this.jolt(beat.shake); this.vibrate(SHAKE_VIBRATION[beat.shake]); }
    const pos = this.posFor(run, beat);
    const glide = beat.to && pos.dir !== 'center' ? beat.to : undefined;
    const glideMs = timing.revealMs + timing.holdMs;
    const focused = this.view.focus === run.id && !this.shift;
    const label = beat.kind === 'char' ? beat.label ?? SPEAKER_LABELS[beat.speaker] : beat.kind === 'phone' ? beat.label ?? SPEAKER_LABELS.phone : beat.label;
    const center: CenterLine = {
      key: this.keyCounter++,
      thread: run.id,
      kind: beat.kind,
      label,
      text,
      phrases: timing.phrases,
      startedAt: t,
      revealMs: timing.revealMs,
      pos,
      ...(glide ? { to: glide, glideMs } : {}),
      perceived: false,
      captured: false,
      mem: beat.mem,
      ...(beat.via === 'tape' || beat.speaker === 'zhixia' ? { past: true as const } : {}),
      ...(skipping || fast ? { heard: true as const } : {}),
    };
    const revealEnd = t + timing.revealMs;
    // A first-play lesson: the first time ever, this line waits until the player has done it once.
    // Turning is only taught while there is a sound to turn to.
    const teaching = beat.teach !== undefined && focused && !this.taught(beat.teach)
      && (beat.teach !== 'turn' || this.view.periph.some((item) => item.kind === 'cue' && item.thread !== run.id));
    if (teaching) {
      this.teachKey = center.key;
      this.view.teach = beat.teach!;
      // Saying how a moment works counts as teaching it, read or not: the moment itself will not say it again.
      if (INTERACT_LESSONS.includes(beat.teach!)) this.markTaught(beat.teach!);
      // Never stuck on a lesson: someone whose long-press the screen reader swallows still gets past it.
      this.schedule(revealEnd + TEACH_GIVE_UP_MS, () => { if (this.teachKey === center.key) this.releaseLesson(); });
    }
    const manualHold = (!this.settings.autoAdvance && focused && !skipping) || teaching;
    run.line = { beat, center, revealEnd, end: manualHold ? Infinity : revealEnd + timing.holdMs, learnChecked: false };
    run.busyUntil = run.line.end;
    // Her phone reading the time out loud is the time.
    const spoken = beat.kind === 'phone' ? heardClock(text, this.view.clock) : null;
    if (spoken) this.setClock(spoken);
    // Someone's message is only shown: the phone says who it is from (its sender line, or `announce`), not what they wrote.
    const reads = beat.message ? beat.announce : text;
    if (beat.kind === 'phone' && reads && focused && this.settings.reader && !skipping) this.out.audio.speak?.(reads, beat.loud ?? phoneMatters(reads));
    // Going past at once, a line is not voiced (a rustle every few hundred ms would be noise); sounds still play.
    if (!skipping && (beat.kind === 'char' || beat.kind === 'me' || beat.kind === 'phone')) {
      // Anyone whose words are on screen, a stranger too, is placed by the rustle of turning to talk: the text is their
      // voice, and a recorded voice under it would say something else. Recorded talk is only for the background.
      this.out.audio.voice(beat.speaker === 'me' ? 'me' : beat.speaker, beat.kind === 'me' ? CENTER : pos, Math.max(380, timing.revealMs), 'line', 1, beat.via);
    }
    if (glide) this.trail(pos, glide, t, glideMs);
    else if (beat.kind === 'char') this.ripple(pos);
    if (focused) this.showCenter(center);
    else if (run.id === 'main') this.view.away = center;
    else this.addPeripheral('murmur', murmurOf(text), beat.kind === 'char' ? pos : run.pos, run.line.end === Infinity ? t + timing.revealMs + timing.holdMs : run.line.end, run.id);
    this.bump();
  }

  private showCenter(center: CenterLine): void {
    if (this.view.center && this.view.center.key !== center.key) this.view.echo = { ...this.view.center, until: this.view.t + ECHO_MS };
    this.view.center = center;
  }

  private checkPerception(run: Run): void {
    const line = run.line!;
    line.learnChecked = true;
    const heard = this.view.focus === run.id && !this.shift && this.view.center?.key === line.center.key;
    if (!heard) return;
    line.center.perceived = true;
    this.hear(line);
    if (line.beat.learn) this.learn(line.beat.learn);
    this.bump();
  }

  /** A line heard clearly: it goes into 剛剛聽到的, and on later loops it counts as heard (save.heard). */
  private hear(line: ActiveLine): void {
    const center = line.center;
    this.log.push({ key: center.key, kind: center.kind, label: center.label, text: center.text.replace(/\|/g, ''), clock: this.view.clock, place: this.view.place, loop: this.save.loop });
    if (this.log.length > BACKLOG_SIZE) this.log.splice(0, this.log.length - BACKLOG_SIZE);
    const id = this.idOf(line.beat);
    if (id === undefined || this.heard.has(id)) return;
    this.heard.add(id);
    this.heardScenes.add(sceneOfLine(id));
    this.save.heard = [...(this.save.heard ?? []), id];
    this.persist();
  }

  private idOf(beat: LineBeat): string | undefined {
    return beat.id ?? (this.scene ? lineId(this.scene.id, beat) : undefined);
  }

  private loadHeard(): void {
    this.heard = new Set(this.save.heard ?? []);
    this.heardScenes = new Set([...this.heard].map(sceneOfLine));
  }

  /** A pause after a line heard before (or anywhere in a scene heard before, until a new line) is shorter. */
  private pauseMs(run: Run, ms: number): number {
    if (this.view.skipping) return Math.min(ms, SKIP_PAUSE_MS);
    const known = run.afterHeard ?? (this.scene ? this.heardScenes.has(this.scene.id) : false);
    return this.settings.fastHeard && known ? ms * HEARD_PAUSE_SCALE : ms;
  }

  private finishLine(run: Run): void {
    const line = run.line;
    if (!line) return;
    if (!line.learnChecked) this.checkPerception(run);
    run.line = null;
    if (this.view.away?.key === line.center.key) { this.view.away = null; this.bump(); }
    if (this.view.center?.key === line.center.key) {
      this.view.echo = { ...this.view.center, until: this.view.t + ECHO_MS };
      this.view.center = null;
      this.bump();
    }
  }

  private startWait(run: Run, beat: Extract<Beat, { k: 'wait' }>, t: number, durationMs: number, index: number): void {
    run.busyUntil = t + durationMs;
    // Taught only where she is listening: a wait that starts while she has turned away teaches on the next one.
    const first = !this.taught('wait') && this.view.focus === 'main';
    if (first) this.markTaught('wait');
    this.view.waiting = { startedAt: t, seconds: durationMs / 1000, clock: beat.clock, until: beat.until, ...(first ? { first: true } : {}) };
    if (beat.clock) this.setClock(beat.clock);
    if (index >= 0 && this.scene) {
      // A resume point of its own: a reload comes back here, with the story as it stood when the wait began.
      this.save.wait = { scene: this.scene.id, index, endsAt: this.out.wallNow() + durationMs / this.speed, mark: markOf(this.scene.beats, index), state: this.snapshot() };
      this.persist();
    }
    // Kept once it is over (until the next scene): a reload comes back just after it instead of waiting it all again.
    const finish = () => {
      if (this.view.waiting?.startedAt !== t) return;
      this.view.waiting = null;
      if (beat.until) this.setClock(beat.until);
      this.bump();
    };
    this.schedule(t + durationMs, finish);
    this.bump();
  }

  private startThread(beat: Extract<Beat, { k: 'cue' }>, t: number): void {
    const scene = this.scene;
    const beats = scene?.threads[beat.thread];
    if (!beats) return;
    const existing = this.runs.get(beat.thread);
    if (existing && !existing.done) return;
    // The sound comes first; whatever is being said there starts a moment later, so a quick turn catches it.
    const run: Run = { id: beat.thread, stack: [{ beats, i: 0 }], busyUntil: t + (beat.grab ? SHIFT_MS + 200 : CUE_LEAD_MS), line: null, blocked: false, done: false, pos: beat.pos, whisper: beat.whisper };
    this.runs.set(beat.thread, run);
    if (beat.sfx) this.out.audio.play(beat.sfx, beat.pos);
    this.addPeripheral('cue', beat.text, beat.pos, Infinity, beat.thread, beat.src ?? (beat.sfx && SFX_SOURCE[beat.sfx]));
    this.ripple(beat.pos);
    if (beat.grab) this.beginShift(beat.thread);
    this.bump();
  }

  private completeRun(run: Run): void {
    run.done = true;
    run.line = null;
    if (run.id === 'main') {
      const next = this.scene?.next;
      if (next) this.pendingGoto = next;
      return;
    }
    this.view.periph = this.view.periph.filter((item) => item.thread !== run.id);
    // The sound she was being shown how to turn to went quiet first: the lesson waits for another day.
    if (this.view.teach === 'turn' && !this.view.periph.some((item) => item.kind === 'cue')) this.releaseLesson();
    if (this.shift?.to === run.id) {
      // It went quiet while she was still turning: the same turn simply comes back, no second shift.
      this.shift.to = 'main';
      this.view.shiftingTo = null;
    } else if (this.view.focus === run.id) this.beginShift('main');
    this.bump();
  }

  private offerChoice(run: Run, beat: Extract<Beat, { k: 'choice' }>, t: number): void {
    const ctx = this.condContext();
    const options = beat.options.filter((option) => !option.cond || evalCond(option.cond, ctx));
    const original = beat.default !== undefined ? beat.options[beat.default] : undefined;
    // Silence falls back to the default, or the last ordinary option; never to "想起一句話".
    const disabled = options.map((option) => Boolean(option.disabledCond && evalCond(option.disabledCond, ctx)));
    const lastPlain = options.map((option, index) => !option.recall && !option.silent && !disabled[index]).lastIndexOf(true);
    const preferred = original ? options.indexOf(original) : -1;
    const silent = options.findIndex((option) => option.silent);
    const fallback = silent >= 0 ? silent : preferred >= 0 && !disabled[preferred] ? preferred : lastPlain;
    // Nothing she can pick and nothing that happens on its own: never hang (the script check should have caught it).
    const open = options.some((option, index) => !option.silent && !option.recall && !disabled[index]) || (options.some((option) => option.recall) && this.save.memories.length > 0);
    // A timed choice always leaves time to read every option at her text speed; a short one stays short.
    // 選擇不倒數 takes the clock away whenever there is something to pick, and silence becomes an option on screen.
    const shown = options.filter((option, index) => !option.silent && !option.recall && !disabled[index]).map((option) => option.text);
    const untimed = this.settings.untimedChoices && open;
    const timeoutMs = beat.timeout === undefined || fallback < 0 || untimed ? Infinity
      : Math.max(beat.timeout * 1000, readingMs(shown, this.settings.textSpeed));
    if (!open && timeoutMs === Infinity) {
      console.warn(`choice in ${this.scene?.id} has nothing to pick and no timeout: skipped`);
      if (fallback >= 0) this.applyChoice(run, options[fallback]);
      else run.busyUntil = t;
      return;
    }
    run.blocked = true;
    run.pendingChoice = { beat, options, deadline: t + timeoutMs + SHIFT_MS, fallback };
    const teach = options.some((option) => option.recall) && !this.taught('recall');
    if (teach) this.markTaught('recall');
    const first = !this.taught('choose');
    if (first) this.markTaught('choose');
    // Someone is asking her something: attention comes back.
    if (this.view.focus !== 'main' && this.shift?.to !== 'main') this.beginShift('main');
    this.view.choice = {
      key: this.keyCounter++,
      // Saying nothing and reaching for a memory are not options on screen: one is the timer, the other is always at hand.
      options: options.flatMap((option, index) => (option.silent && !untimed) || option.recall ? [] : [{ text: option.text, index, disabled: disabled[index] || undefined }]),
      startedAt: t,
      ...(Number.isFinite(timeoutMs) ? { timeout: timeoutMs / 1000, fallback: options[fallback].silent ? 'silence' as const : options[fallback].text } : {}),
      ...(teach ? { teach: true } : {}),
      ...(first ? { first: true } : {}),
    };
    this.out.audio.play('choice_appear', CENTER, { gain: 0.5 });
    this.bump();
  }

  private applyChoice(run: Run, option: ChoiceOption): void {
    const t = this.view.t;
    run.pendingChoice = undefined;
    run.blocked = false;
    this.view.choice = null;
    // A spoken option is said out loud first, even when it leads straight to another scene.
    const spoken = /^「(.+)」$/.exec(option.text.trim());
    const beats: Beat[] = [
      ...(spoken ? [{ k: 'line', kind: 'me', speaker: 'me', text: spoken[1] } as Beat] : []),
      ...option.then,
      ...(option.goto ? [{ k: 'goto', scene: option.goto } as Beat] : []),
    ];
    run.stack.push({ beats, i: 0 });
    run.busyUntil = t;
    this.bump();
  }

  // ───────────────────────── background life ─────────────────────────

  private startLife(): void {
    const gen = ++this.lifeGen;
    this.lifeHushUntil = 0;
    this.lifeNextAt = this.view.t + 1500 + Math.random() * 2500;
    this.lifeBusyAt = this.view.t;
    this.checkLife(gen);
  }

  /** Once a second: the next background beat is due, or the screen has gone empty for too long. */
  private checkLife(gen: number): void {
    this.schedule(this.view.t + LIFE_CHECK_MS, () => {
      if (gen !== this.lifeGen || this.view.phase !== 'scene') return;
      const t = this.view.t;
      const scene = this.scene;
      const life = scene?.life === 'off' ? null : lifeOf(this.ambience, scene?.life, { clock: this.view.clock, scene });
      if (!life) return;
      const busy = this.view.center !== null || this.view.choice !== null || this.view.interact !== null || this.view.periph.some((item) => item.kind !== 'cue' && item.until > t + 400);
      if (busy) this.lifeBusyAt = t;
      // While her hands or ears are on something, no stranger's sound starts beside the dots she is choosing between:
      // it would read as an answer or a decoy. The room comes back when the moment is over.
      if (this.view.interact) { this.checkLife(gen); return; }
      const hushed = t < this.lifeHushUntil;
      const empty = t - this.lifeBusyAt >= LIFE_EMPTY_MS;
      if (!hushed && (t >= this.lifeNextAt || empty)) {
        // Thinner while someone is talking to her; busier while she waits. Listening in on strangers (a thread),
        // the place keeps sounding as usual, only without other voices crossing the ones she is following.
        const aside = this.view.focus !== null && this.view.focus !== 'main';
        if (aside) {
          const sounds = life.events.filter((event) => !isVoice(event));
          if (sounds.length) { this.lifeBeat(sounds, t); this.lifeBusyAt = t; }
        } else if (!this.focusedLine() || Math.random() < 0.5) { this.lifeBeat(life.events, t); this.lifeBusyAt = t; }
        const [min, max] = life.every;
        this.lifeNextAt = t + (min + Math.random() * (max - min)) * 1000 * (this.view.waiting ? 0.45 : 1) * TENSION_LIFE[this.view.tension].every;
      }
      this.checkLife(gen);
    });
  }

  private lifeBeat(events: LifeEvent[], t: number, noise?: { speed: number; loud: number }): void {
    const wound = TENSION_LIFE[this.view.tension];
    // During a hands-and-ears moment only a scripted panic keeps sounding, unlabelled, and never with the sounds she
    // is sorting out (the one she is after, its decoys): those would be answers out of nowhere.
    const during = this.view.interact !== null;
    if (during && !noise) return;
    const kept = this.interactSounds();
    const allowed = kept.size ? events.filter((event) => isVoice(event) || !event.sfx || !kept.has(event.sfx)) : events;
    const event = this.pickLife(allowed, t, (noise ? LIFE_VOICE_GAP_MS / (noise.speed * 2) : LIFE_VOICE_GAP_MS) / wound.voices);
    if (!event) return;
    // Never on top of someone in the scene or a sound she could turn to — unless the scene put it there itself.
    const own = Array.isArray(this.scene?.life) && this.scene.life.includes(event);
    const taken = new Set<string>([
      ...(own ? [] : Object.values(this.cast).map((pos) => pos.dir)),
      ...this.view.periph.filter((item) => item.kind === 'cue').map((item) => item.pos.dir),
    ]);
    const wanted = (event.at ?? [...DIRECTIONS]).filter((dir) => !taken.has(dir));
    const open = wanted.length ? wanted : [...DIRECTIONS].filter((dir) => !taken.has(dir));
    if (!open.length) return;
    const dir: Direction = open[Math.floor(Math.random() * open.length)];
    const pos: Pos = { dir, dist: event.dist ?? (isVoice(event) ? 'far' : 'mid') };
    if (isVoice(event)) {
      const ms = Math.max(900, [...event.say].length * 110);
      // Heard as a real voice too far or muffled to make out; in a quiet place, a whisper. Panic brings it closer.
      const kind = isWhispered(event, this.ambience) ? 'whisper' : 'life';
      const loud = (noise?.loud ?? 1) * wound.loud;
      this.out.audio.voice(event.voice, pos, ms, kind, loud);
      if (!during) this.addPeripheral('life', event.say, pos, t + ms + 2600);
      // The rest of the exchange, one turn after another, from the same spot.
      const turns = event.reply === undefined ? [] : Array.isArray(event.reply) ? event.reply : [event.reply];
      const gen = this.lifeGen;
      let at = t + ms + 500;
      for (const turn of turns) {
        const turnMs = Math.max(900, [...turn.say].length * 110);
        this.schedule(at, () => {
          if (gen !== this.lifeGen || this.view.phase !== 'scene' || this.view.t < this.lifeHushUntil) return;
          // A moment for her hands began meanwhile: the rest of their talk trails off unheard.
          if (this.view.interact) return;
          // Someone is talking to her right now: the passers-by's next turn is lost under it, not laid on top.
          const spoken = this.focusedLine();
          if (spoken && spoken.beat.kind !== 'narr' && spoken.beat.kind !== 'think') return;
          this.out.audio.voice(turn.voice, pos, turnMs, kind, loud);
          this.addPeripheral('life', turn.say, pos, this.view.t + turnMs + 2600);
          this.lifeVoiceAt = this.view.t;
          this.bump();
        });
        at += turnMs + 500;
      }
      this.lifeVoiceAt = at;
    } else {
      // The engine lifts distance itself; one level here keeps a far sound far without losing it.
      this.out.audio.play(event.sfx, pos, { gain: 0.16 * (noise?.loud ?? 1) * wound.loud });
      if (!during) this.addPeripheral('sfx', event.text, pos, t + SFX_TEXT_MS * (pos.dist === 'far' ? 1.25 : 1), undefined, event.src ?? (event.sfx && SFX_SOURCE[event.sfx]));
    }
    this.bump();
  }

  /** The sounds the current hands-and-ears moment is made of (what she is after, and what is in the way). */
  private interactSounds(): Set<string> {
    const beat = this.runs.get('main')?.pendingInteract?.beat;
    if (!beat || !this.view.interact) return new Set();
    if (beat.k === 'locate') return new Set([beat.sfx, ...beat.decoys.map((decoy) => decoy.sfx)]);
    if (beat.k === 'approach') return new Set([beat.sfx]);
    if (beat.k === 'hold' && beat.sfx) return new Set([beat.sfx]);
    return new Set();
  }

  /**
   * Sounds may come back (a cup is set down more than once), just not the last few.
   * Voices are rarer and never repeat until every line in the pool has been heard.
   */
  private pickLife(events: LifeEvent[], t: number, voiceGap = LIFE_VOICE_GAP_MS): LifeEvent | undefined {
    const voices = events.filter(isVoice);
    if (voices.length && voices.every((event) => this.lifeSaid.has(event))) voices.forEach((event) => this.lifeSaid.delete(event));
    const voiceOk = t - this.lifeVoiceAt >= voiceGap;
    const pool = events.filter((event) => (isVoice(event) ? voiceOk && !this.lifeSaid.has(event) : !this.lifeRecent.includes(event)));
    const sounds = events.filter((event) => !isVoice(event));
    const from = pool.length ? pool : sounds;
    if (!from.length) return undefined;
    const event = from[Math.floor(Math.random() * from.length)];
    if (isVoice(event)) this.lifeSaid.add(event);
    else this.lifeRecent = [...this.lifeRecent, event].slice(-Math.min(4, Math.max(1, sounds.length - 2)));
    return event;
  }

  // ───────────────────────── attention ─────────────────────────

  private beginShift(to: string): void {
    const from = this.view.focus;
    // A line held for a manual tap must not freeze the conversation we are turning away from.
    const held = from ? this.runs.get(from)?.line : null;
    if (held && held.end === Infinity) { held.end = Math.max(held.revealEnd, this.view.t) + 1200; this.runs.get(from!)!.busyUntil = held.end; }
    if (this.view.teach === 'turn' && to !== 'main') this.markTaught('turn');
    this.dropLesson();
    this.shift = { to, until: this.view.t + SHIFT_MS };
    this.view.focus = null;
    const target = to === 'main' ? null : this.runs.get(to)?.pos ?? null;
    this.view.shiftingTo = target;
    // Turning away from the main conversation leaves its line where it is, only blurred; anything else becomes an echo.
    const mainLine = this.runs.get('main')?.line;
    if (this.view.center && to !== 'main' && this.view.center.key === mainLine?.center.key) this.view.away = this.view.center;
    else if (this.view.center) this.view.echo = { ...this.view.center, until: this.view.t + ECHO_MS };
    this.view.center = null;
    if (from !== null) this.out.audio.play('focus_shift', target ?? CENTER, { gain: 0.6 });
    this.out.audio.setAttention(1);
  }

  private finishShift(): void {
    const to = this.shift!.to;
    this.shift = null;
    this.view.shiftingTo = null;
    const run = this.runs.get(to);
    this.view.focus = run && !run.done ? to : 'main';
    this.out.audio.setAttention(0);
    // A line already in progress where we turned: only its tail is caught, and it is never "heard clearly".
    const live = this.runs.get(this.view.focus)?.line;
    if (this.view.focus === 'main') this.view.away = null;
    if (live) {
      this.view.periph = this.view.periph.filter((item) => !(item.kind === 'murmur' && item.thread === this.view.focus));
      live.learnChecked = true;
      this.showCenter({ ...live.center, perceived: false });
    }
    this.bump();
  }

  private focusRun(): Run | undefined { return this.view.focus ? this.runs.get(this.view.focus) : undefined; }
  /** Lessons, once given, are never given again: the in-story ones (tap, turn, keep, recall, choose, wait) and the
   *  corner notes the UI shows once (stored, menu). */
  taught(lesson: string): boolean { return (this.save.taught ?? []).includes(lesson); }

  markTaught(lesson: string): void {
    if (this.taught(lesson)) return;
    this.save.taught = [...(this.save.taught ?? []), lesson];
    this.persist();
  }

  private dropLesson(): void {
    this.teachKey = null;
    this.view.teach = null;
  }

  /** Let a held lesson line go on by itself, untaught. */
  private releaseLesson(): void {
    const run = this.runs.get('main');
    const line = run?.line;
    if (run && line && line.center.key === this.teachKey && line.end === Infinity) {
      line.end = Math.max(line.revealEnd, this.view.t) + 600;
      run.busyUntil = line.end;
    }
    this.dropLesson();
  }

  private focusedLine(): ActiveLine | null {
    const run = this.focusRun();
    return run?.line && this.view.center?.key === run.line.center.key ? run.line : null;
  }

  // ───────────────────────── helpers ─────────────────────────

  private condContext(): CondContext {
    return {
      know: (id) => this.knowledge.has(id),
      flag: (id) => this.flags.has(id),
      mem: (id) => this.save.memories.some((memory) => memory.id === id),
      seen: (id) => this.seen.has(id),
      loop: this.save.loop,
      chloop: this.save.chLoop,
    };
  }

  private learn(id: string): void {
    if (this.knowledge.has(id)) return;
    this.knowledge.add(id);
    this.save.knowledge = [...this.knowledge];
    this.persist();
  }

  private addMemory(memory: Memory): void {
    this.save.memories = [...this.save.memories, memory];
    this.view.memoryCount = this.save.memories.length;
    this.persist();
  }

  private addPeripheral(kind: Peripheral['kind'], text: string, pos: Pos, until: number, thread?: string, src?: string): void {
    this.view.periph = [...this.view.periph.filter((item) => !(kind === 'murmur' && item.kind === 'murmur' && item.thread === thread && thread !== undefined)), { key: this.keyCounter++, kind, text, src, pos, born: this.view.t, until, thread }];
  }

  private ripple(pos: Pos): void {
    if (pos.dir === 'center') return;
    this.view.ripples = [...this.view.ripples, { key: this.keyCounter++, pos }];
  }

  /** Something on the move: ripples step from where it started to where it ends up, one direction at a time. */
  private trail(from: Pos, to: Pos, t: number, ms: number): void {
    const path = pathBetween(from, to);
    const scene = this.scene;
    this.ripple(path[0]);
    path.slice(1).forEach((pos, i) => {
      this.schedule(t + (ms * 0.85 * (i + 1)) / (path.length - 1), () => {
        if (this.scene !== scene || this.view.phase !== 'scene') return;
        this.ripple(pos);
        this.bump();
      });
    });
  }

  private jolt(level: ShakeLevel): void {
    this.view.shake += 1;
    this.view.shakeLevel = level;
  }

  /**
   * Her heart keeps beating on the scene clock (so it pauses with the game) until changed or the scene ends.
   * Tense or panicking, a scripted `fast` comes as `pound`; and the more wound up she is, the quicker and louder
   * each level beats. Changes are never a jump: each beat moves a little further from how it sounded toward the
   * new level, quickly when it climbs, slowly when it calms, and stopping is a slow fade. The screen (the red at
   * the edges, the jolt) is drawn from the same beat, so it climbs and calms with the sound.
   */
  private setHeart(level: HeartLevel): void {
    this.heartAsked = level;
    const felt = this.feltHeart(level);
    if (this.heartTarget === felt) return;
    const rising = felt !== 'off' && (this.heartTarget === 'off' || HEART[felt].gain > HEART[this.heartTarget].gain);
    this.heartTarget = felt;
    this.heartGlide = { from: this.heartTone ?? HEART_START, at: this.view.t, ms: rising ? HEART_RISE_MS : HEART_EASE_MS };
    if (felt !== 'off') this.view.heart = { level: felt, glow: this.view.heart?.glow ?? 0, ms: this.view.heart?.ms ?? HEART_START.ms, beat: this.view.heart?.beat ?? 0 };
    if (!this.heartTone) this.beatHeart(++this.heartGen);
    this.bump();
  }

  private beatHeart(gen: number): void {
    if (gen !== this.heartGen) return;
    const glide = this.heartGlide;
    const goal = this.heartGoal();
    const p = glide ? Math.min(1, (this.view.t - glide.at) / glide.ms) : 1;
    const eased = p * p * (3 - 2 * p);
    const from = glide?.from ?? goal;
    const tone: HeartTone = { ms: from.ms + (goal.ms - from.ms) * eased, gain: from.gain + (goal.gain - from.gain) * eased, rate: from.rate + (goal.rate - from.rate) * eased };
    if (this.heartTarget === 'off' && (p >= 1 || tone.gain < 0.03)) { this.stopHeart(); return; }
    this.heartTone = tone;
    this.out.audio.play('heartbeat', CENTER, { gain: Math.min(1, tone.gain), rate: tone.rate });
    if (this.heartTarget !== 'off' && HEART[this.heartTarget].vib && tone.gain >= 0.4) this.vibrate('heartbeat');
    // The screen beats as hard as this beat sounds, so it never steps up or drops off on its own.
    const glow = Math.min(1, tone.gain / HEART.pound.gain);
    if (this.view.heart) this.view.heart = { ...this.view.heart, glow, ms: tone.ms, beat: this.view.heart.beat + 1 };
    this.bump();
    this.schedule(this.view.t + tone.ms, () => this.beatHeart(gen));
  }

  /** The level she is heading for, as wound up as she is right now. */
  private heartGoal(): HeartTone {
    if (this.heartTarget === 'off') return HEART_REST;
    const heart = HEART[this.heartTarget];
    const wound = this.save.tension / 100;
    return { ms: heart.ms * (1 - wound * 0.18), gain: heart.gain * (1 + wound * 0.3), rate: heart.rate };
  }

  /** Silence at once (midnight, a new game): no fade. */
  private stopHeart(): void {
    this.heartGen += 1;
    this.heartTarget = 'off';
    this.heartTone = null;
    this.heartGlide = null;
    this.view.heart = null;
    this.startUndertone();
    this.bump();
  }

  /** Wound up, a racing heart races harder; an uneasy one stays uneasy (only quicker), so it does not keep jumping. */
  private feltHeart(level: HeartLevel): HeartLevel {
    return level === 'fast' && this.view.tension >= 2 ? 'pound' : level;
  }

  /** Her breathing, from the tense band up: one breath at a time on the scene clock, so it pauses with the game. */
  private startBreath(): void {
    const gen = ++this.breathGen;
    const once = () => {
      if (gen !== this.breathGen || this.view.tension < 2) return;
      const breath = BREATH[this.view.tension as 2 | 3];
      const waiting = Boolean(this.view.waiting);
      if (this.view.phase === 'scene') this.out.audio.play('breath', CENTER, { gain: breath.gain * (waiting ? 1.4 : 1), rate: breath.rate });
      this.schedule(this.view.t + breath.ms * (0.85 + Math.random() * 0.3) * (waiting ? 0.85 : 1), once);
    };
    this.schedule(this.view.t + 1200, once);
  }

  /** In a panic with nothing scripted, her heart is still there under everything: sound only, no pulse on screen. */
  private startUndertone(): void {
    const gen = ++this.undertoneGen;
    const beatOnce = () => {
      if (gen !== this.undertoneGen || this.view.tension < 3) return;
      if (this.view.phase === 'scene' && !this.view.heart) this.out.audio.play('heartbeat', CENTER, { gain: UNDERTONE.gain, rate: UNDERTONE.rate });
      this.schedule(this.view.t + UNDERTONE.ms, beatOnce);
    };
    beatOnce();
  }

  /**
   * Tension moves; the band follows (with a little give on the way down). Crossing up into a new band is felt as
   * one hard beat, so the player knows something in her changed even when the script is quiet.
   */
  private addTension(delta: number, quiet = false): void {
    const before = this.save.tension;
    this.save.tension = Math.max(0, Math.min(TENSION_MAX, before + delta));
    if (this.save.tension === before) return;
    const rose = this.syncTension();
    // A heart already beating carries it (it climbs toward the new band); one more beat on top would stumble.
    if (rose && !quiet && this.view.phase === 'scene' && this.heartTarget === 'off') {
      this.out.audio.play('heartbeat', CENTER, { gain: 0.5 + this.view.tension * 0.15, rate: 1.1 });
      this.vibrate('heartbeat');
    }
    this.persist();
    this.bump();
  }

  /** Band from the stored value; returns whether it went up. */
  private syncTension(): boolean {
    const value = this.save.tension;
    let band = this.view.tension;
    while (band < 3 && value >= TENSION_LINES[band]) band += 1;
    while (band > 0 && value < TENSION_LINES[band - 1] - TENSION_EASE) band -= 1;
    if (band === this.view.tension) return false;
    const rose = band > this.view.tension;
    this.view.tension = band as TensionBand;
    // A heart already beating catches up with the band; panic starts the faint one underneath.
    if (this.heartAsked !== 'off') this.setHeart(this.heartAsked);
    if (band === 3) this.startUndertone();
    if (band >= 2) this.startBreath();
    return rose;
  }

  /** What her phone reads off her wrist right now. */
  private bpm(): number {
    return Math.round(BPM[this.heartTarget] + this.save.tension * 0.3);
  }

  private setDaze(level: DazeLevel): void {
    const next = level === 'off' ? null : level;
    if (this.view.daze === next) return;
    this.view.daze = next;
    this.out.audio.setDaze(level === 'heavy' ? 1 : level === 'light' ? 0.55 : 0);
    this.bump();
  }

  /** Panic: on top of the scene's usual background, extra beats of it keep coming, closer together and louder. */
  private setNoise(level: NoiseLevel, speed?: number, loud?: number, extra?: LifeEvent[]): void {
    const gen = ++this.noiseGen;
    if (level === 'off') {
      if (!this.view.noise) return;
      this.view.noise = null;
      this.out.audio.setNoise(1);
      this.bump();
      return;
    }
    const wound = TENSION_NOISE[this.view.tension];
    const noise = { level, speed: Math.min(10, (speed ?? NOISE[level].speed) * wound.speed), loud: Math.min(3, (loud ?? NOISE[level].loud) * wound.loud) };
    this.view.noise = noise;
    this.out.audio.setNoise(noise.loud);
    const pulse = () => {
      if (gen !== this.noiseGen || this.view.phase !== 'scene') return;
      const t = this.view.t;
      const scene = this.scene;
      const life = scene?.life === 'off' ? null : lifeOf(this.ambience, scene?.life, { clock: this.view.clock, scene });
      // The panic's own sounds come up more often than the room's.
      const events = extra?.length ? [...extra, ...extra, ...(life?.events ?? [])] : life?.events;
      // A hush (the power cut, a scream) quiets the everyday background, not her panic: the script asked for this.
      if (events?.length) { this.lifeBeat(events, t, noise); this.lifeBusyAt = t; }
      this.schedule(t + (NOISE_BASE_MS / noise.speed) * (0.6 + Math.random() * 0.8), pulse);
    };
    this.schedule(this.view.t + 300, pulse);
    this.bump();
  }

  private vibrate(id: VibrationId): void { if (this.settings.vibration) this.out.vibrate(id); }

  private persist(): void {
    const written = this.out.persist(this.save) !== false;
    // A newer build's save stays the reason until it is set aside; anything else not landing is a failed write.
    this.saveBlocked = written ? null : this.saveBlocked === 'newer' ? 'newer' : 'failed';
    if (written) this.saveDismissed.delete('failed');
    if (this.syncSaveProblem()) this.bump();
  }

  /** What the save notice says: why saving stops (newer, failed) before what happened at load (corrupt, restored). */
  private syncSaveProblem(): boolean {
    const shown = (problem: SaveProblem | null) => (problem && !this.saveDismissed.has(problem) ? problem : null);
    const problem = shown(this.saveBlocked) ?? shown(this.saveNotice);
    if (problem === this.view.saveProblem) return false;
    this.view.saveProblem = problem;
    return true;
  }

  private bump(): void {
    this.version += 1;
    this.view.memoryCount = this.save.memories.length;
    for (const listener of this.listeners) listener();
  }

  private emptyView(): View {
    return {
      phase: 'idle', brief: false, t: 0, center: null, teach: null, echo: null, away: null, periph: [], ripples: [], choice: null, focus: null, shiftingTo: null,
      waiting: null, clockMark: 0, keep: null, recall: null, interact: null, memoryCount: this.save.memories.length, shake: 0, shakeLevel: 'light', heart: null, daze: null, noise: null, tension: 0, chapterKey: this.save.chapter, loop: this.save.loop,
      saveProblem: null, skipping: false,
    };
  }

  /** Test / automation helper: play sfx id without a scene. */
  playUi(id: SfxId): void { this.out.audio.play(id, CENTER); }
}

/** Fingerprint of a scene's beats up to and including `index`: an edit above a saved wait changes it. */
function markOf(beats: Beat[], index: number): string {
  // A line's id (added after saves already had marks) is derived from the line itself: leave it out.
  const text = JSON.stringify(beats.slice(0, index + 1), function (this: Record<string, unknown>, key, value) { return key === 'id' && this.k === 'line' ? undefined : value; });
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `${index}:${(hash >>> 0).toString(36)}`;
}

function murmurOf(text: string): string {
  const chars = [...text.replace(/[|「」]/g, '')];
  return chars.length <= 3 ? `${chars.join('')}……` : `${chars.slice(0, 3).join('')}……`;
}

/** "林家老屋，知夏的房間" → "林家老屋": the part before the comma names the area. */
export function areaOf(place: string): string {
  return place.split(/[，,]/)[0].trim();
}

/** What a chapter can teach on the way through. Branches behind later.X only open when replaying with what a later chapter taught. */
export function learnIdsOf(chapter: Chapter): string[] {
  const ids: string[] = [];
  const replayOnly = (cond: Cond | undefined) => !!cond && condRefs(cond).some((ref) => ref.later);
  const visit = (beats: Beat[]) => {
    for (const beat of beats) {
      if (beat.k === 'learn') ids.push(...beat.ids);
      if (beat.k === 'line' && beat.learn) ids.push(beat.learn);
      if (beat.k === 'if') { if (!replayOnly(beat.cond)) visit(beat.then); visit(beat.else); }
      if (beat.k === 'locate' || beat.k === 'hold') { visit(beat.success); visit(beat.fail); }
      if (beat.k === 'approach') { visit(beat.hit); visit(beat.early); visit(beat.late); }
      if (beat.k === 'choice') beat.options.forEach((option) => { if (replayOnly(option.cond)) return; visit(option.then); option.recall?.accept.forEach((entry) => visit(entry.then)); });
    }
  };
  for (const scene of chapter.scenes) { visit(scene.beats); Object.values(scene.threads).forEach(visit); }
  return ids;
}

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
export function toChineseNumber(value: number): string {
  if (value < 10) return DIGITS[value];
  if (value < 20) return `十${value % 10 ? DIGITS[value % 10] : ''}`;
  if (value < 100) return `${DIGITS[Math.floor(value / 10)]}十${value % 10 ? DIGITS[value % 10] : ''}`;
  return String(value);
}

/** Pointing within 45° counts; so does the front/back mirror, which headphones often blur. */
/** In one hold, letting go too soon winds her up this many times at most (tapping must not spike her). */
const HOLD_SLIPS_FELT = 3;

/**
 * How loud a locate decoy plays: its own `gain` (default 1) times what her tension does to the others. One that is the
 * same sound as the target stays under DECOY_SAME_MAX of the target as it is actually played, however wound up she is.
 */
export function decoyGain(beat: { sfx: string }, decoy: { sfx: string; gain?: number }, ears: number, target: number): number {
  const gain = (decoy.gain ?? 1) * ears;
  return decoy.sfx === beat.sfx ? Math.min(gain, DECOY_SAME_MAX * target) : gain;
}

/** A lesson line waits this long for the player to try it, then goes on by itself (untaught, so it comes back once). */
const TEACH_GIVE_UP_MS = 25000;

const SHAKE_VIBRATION: Record<ShakeLevel, VibrationId> = { light: 'thud', hard: 'crash' };

/** 剛剛聽到的 keeps this many lines. */
export const BACKLOG_SIZE = 200;
/** 聽過的話自動放快: a `pause` in a stretch she has heard before takes this fraction of its time (lines: HEARD_SCALE). */
const HEARD_PAUSE_SCALE = 0.5;
/** Fast-forward: how long a heard line stays, the longest a pause or a sound with a word may hold it up, and the
 *  breath between scenes and a new place's card. Real-time waits are never touched. */
const SKIP_LINE_MS = 180;
const SKIP_PAUSE_MS = 120;
const SKIP_SFX_MS = 240;
const SKIP_CARD_MS = 600;

/** "c1_0612#1x2y3z" → "c1_0612". */
function sceneOfLine(id: string): string {
  const at = id.lastIndexOf('#');
  return at >= 0 ? id.slice(0, at) : id;
}

function directionsClose(picked: Direction, target: Direction): boolean {
  const diff = (x: number, y: number) => { const d = Math.abs(x - y) % 360; return Math.min(d, 360 - d); };
  const a = DIRECTION_ANGLE[picked];
  const b = DIRECTION_ANGLE[target];
  // The next direction round counts; the front/back mirror does not (pointing behind at a sound in front passed too easily).
  return diff(a, b) <= 45;
}

/** The stops on the short way round from one place to another, distance easing along with direction. */
export function pathBetween(from: Pos, to: Pos): Pos[] {
  const a = DIRECTIONS.indexOf(from.dir as Direction);
  const b = DIRECTIONS.indexOf(to.dir as Direction);
  let steps = (b - a + 8) % 8;
  if (steps > 4) steps -= 8;
  const n = Math.max(1, Math.abs(steps));
  const d0 = DISTANCES.indexOf(from.dist);
  const d1 = DISTANCES.indexOf(to.dist);
  return Array.from({ length: n + 1 }, (_, i) => ({
    dir: DIRECTIONS[(a + Math.sign(steps) * i + 8) % 8],
    dist: DISTANCES[Math.round(d0 + ((d1 - d0) * i) / n)],
  }));
}
