import type { AudioEngine } from '../audio/engine';
import { DIRECTIONS, DIRECTION_ANGLE, DISTANCES, SFX_SOURCE, type AmbienceId, type Direction, type SfxId, type VibrationId } from '../audio/catalog';
import { condRefs, evalCond, type CondContext } from '../script/conditions';
import { CHAPTER_NUMERALS, SPEAKER_LABELS, TENSION_MAX, type Beat, type Chapter, type Cond, type ChoiceOption, type EndKind, type DazeLevel, type GameScript, type HeartLevel, type LineBeat, type NoiseLevel, type LineKind, type Pos, type Scene, type ShakeLevel } from '../script/types';
import { driftClock, heardClock, planClock, type ClockPlan } from './clock';
import { lineTiming, type Phrase } from './text';
import { HUSH_MS, HUSH_SFX, isVoice, lifeOf, type LifeEvent } from './life';
import { MEMORY_CAPACITY, freshSave, type GameSave, type Memory, type Settings } from './save';

// Presentation timings (scene-clock ms). Prototype parameters, core spec §26.
export const SHIFT_MS = 700;
const OUT_MS = 1100;
const CARD_MS = 2600;
const CHAPTER_CARD_MS = 4200;
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
const TENSION_AUTO = { locateWrong: 4, locateMiss: 12, locateFound: -4, approachMiss: 10, approachHit: -4, froze: 5, recallMiss: 4, newPlace: -2 };
/** Midnight: she wakes on the train with some of it still in her chest. */
const TENSION_SLEEP = 0.6;
/** Per band: the world's background comes this much more often (interval ×) and louder. */
const TENSION_LIFE = [{ every: 1, loud: 1, voices: 1 }, { every: 0.85, loud: 1.1, voices: 1 }, { every: 0.65, loud: 1.3, voices: 1.4 }, { every: 0.5, loud: 1.5, voices: 2 }];
/** Per band: a scripted panic comes faster and louder still. */
const TENSION_NOISE = [{ speed: 1, loud: 1 }, { speed: 1, loud: 1 }, { speed: 1.25, loud: 1.1 }, { speed: 1.5, loud: 1.2 }];
/** Per band, while she points at a sound: how loud the one she wants is, how loud the others are, and her own heart in the way. */
const TENSION_EARS = [{ target: 1, decoy: 0.8, heart: 0 }, { target: 1, decoy: 0.8, heart: 0 }, { target: 0.8, decoy: 1, heart: 0.35 }, { target: 0.65, decoy: 1.15, heart: 0.5 }];
/** Panic with no scripted heart: she still hears her own, faintly, under everything (sound only, the screen stays still). */
const UNDERTONE = { ms: 760, gain: 0.16, rate: 1.2 };
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
};

/** `src`: what she hears it as (紙, 衣服, 風), shown small under the onomatopoeia. */
export type Peripheral = { key: number; kind: 'sfx' | 'murmur' | 'cue' | 'life'; text: string; src?: string; pos: Pos; thread?: string; born: number; until: number };

export type Card = { chapter?: string; title?: string; time?: string; place?: string; loopText?: string };

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
  echo: (CenterLine & { until: number }) | null;
  periph: Peripheral[];
  ripples: { key: number; pos: Pos }[];
  choice: { key: number; options: { text: string; index: number; recall?: boolean; disabled?: boolean }[]; startedAt: number; timeout?: number } | null;
  /** Memory Input picker: which remembered lines she could say right now. */
  recall: { key: number; memories: Memory[] } | null;
  /** A hands-or-ears moment the scene is waiting on. */
  interact: InteractView | null;
  focus: string | null;
  shiftingTo: Pos | null;
  waiting: { startedAt: number; seconds: number; clock?: string; until?: string } | null;
  keep: Memory | null;
  memoryCount: number;
  ending?: 'a' | 'c';
  /** Bumped once per jolt; Stage plays the shake when it changes. */
  shake: number;
  shakeLevel: ShakeLevel;
  /** Her heart while it is loud enough to feel; `beat` counts up with every beat so Stage can pulse in time. */
  heart: { level: Exclude<HeartLevel, 'off'>; beat: number } | null;
  /** Pain or shock: the stage blurs and the world goes muffled. */
  daze: Exclude<DazeLevel, 'off'> | null;
  /** Panic: the background floods in around the centre line. */
  noise: { level: Exclude<NoiseLevel, 'off'>; speed: number; loud: number } | null;
  /** Hidden tension band (0 calm … 3 panic): words lose their edges, the background crowds in. */
  tension: TensionBand;
  chapterKey: string;
  loop: number;
};

export type TensionBand = 0 | 1 | 2 | 3;

export type InteractView =
  | { type: 'touch'; key: number; cells: string[]; style: 'braille' | 'groove' | 'engrave'; prompt?: string }
  | { type: 'locate'; key: number; prompt?: string; triesLeft: number; hint: Direction | null; wrong: Direction[] }
  | { type: 'approach'; key: number; prompt?: string }
  | { type: 'punch'; key: number; cells: number[][]; label?: string; prompt?: string };

export type DirectorOutput = {
  audio: AudioEngine;
  vibrate: (pattern: VibrationId) => void;
  persist: (save: GameSave) => void;
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
  pendingInteract?: { beat: InteractBeat; deadline: number; triesLeft: number; start: number };
  pendingChoice?: { beat: Extract<Beat, { k: 'choice' }>; options: ChoiceOption[]; deadline: number; fallback: number; recallIndex?: number; remaining?: number };
};

const CENTER: Pos = { dir: 'center', dist: 'near' };

type InteractBeat = Extract<Beat, { k: 'touch' | 'locate' | 'approach' | 'punch' }>;
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
  private cast: Record<string, Pos> = {};
  private shift: { to: string; until: number } | null = null;
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
  private undertoneGen = 0;
  private noiseGen = 0;
  // The corner clock creeps along the main line between the times the script names.
  private clockPlan: ClockPlan | null = null;
  private clockFrom: { clock?: string; step: number } = { step: 0 };
  private mainStep = 0;

  constructor(script: GameScript, save: GameSave, out: DirectorOutput, options: { speed?: number } = {}) {
    this.script = script;
    this.save = save;
    this.out = out;
    this.speed = options.speed ?? 1;
    this.knowledge = new Set(save.knowledge);
    this.view = this.emptyView();
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
  get threadsRunning(): string[] { return [...this.runs.values()].filter((run) => !run.done && run.id !== 'main').map((run) => run.id); }

  /** Start or resume from the save. */
  start(): void {
    if (!this.save.started) {
      this.save.started = true;
      this.beginChapter(this.save.chapter, true);
      return;
    }
    const chapter = this.chapter(this.save.chapter);
    const sceneId = this.save.scene ?? (this.save.chLoop > 1 ? chapter.restart ?? chapter.start : chapter.start);
    this.flags = new Set(this.save.flags);
    this.seen = new Set(this.save.seen);
    const resumeWait = this.save.wait && this.save.wait.scene === sceneId ? this.save.wait : undefined;
    this.transition(sceneId, resumeWait);
  }

  newGame(): void {
    this.save = freshSave(this.save);
    this.knowledge = new Set();
    this.flags = new Set();
    this.recallTried = new WeakMap();
    this.seen = new Set();
    this.persist();
    this.start();
  }

  /** Jump to a chapter for testing / chapter select. Grants knowledge learned in earlier chapters when asked. */
  jumpToChapter(key: string, grantEarlierKnowledge: boolean): void {
    this.save = { ...freshSave(this.save), started: true, chapter: key };
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
   * and any loop flags the scene expects (?flags=yuan_with_me). Flags the chapter would have set on the way stay unset.
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
  /** Testing (?tension=70): put her straight into a band without playing up to it. */
  setTension(value: number): void { this.addTension(Math.round(value) - this.save.tension, true); }
  updateSettings(patch: Partial<Settings>): void {
    this.save.settings = { ...this.save.settings, ...patch };
    this.out.audio.setEnabled(this.save.settings.audio);
    this.out.audio.setVolume(this.save.settings.volume);
    this.out.audio.setAmbienceVolume(this.save.settings.ambience);
    this.out.audio.setSfxVolume(this.save.settings.sfx);
    this.out.audio.setVoiceVolume(this.save.settings.voice);
    this.persist();
    this.bump();
  }

  tick(realDtMs: number): void {
    if (this.paused || this.view.phase === 'idle' || this.view.phase === 'ending') return;
    let target = this.view.t + Math.max(0, Math.min(realDtMs, 250)) * this.speed;
    const focused = this.focusedLine();
    if (focused && !this.settings.autoAdvance && focused.end === Infinity) target = Math.min(target, Math.max(this.view.t, focused.revealEnd));
    this.advanceTo(target);
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
    if (!option) return;
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
    const option = pending.options[pending.recallIndex];
    this.view.recall = null;
    if (memoryKey === null || !option?.recall) {
      // Back to the choice; its clock starts again where it stopped.
      pending.deadline = this.view.t + (pending.remaining ?? Infinity);
      pending.recallIndex = undefined;
      this.bump();
      return;
    }
    const memory = this.save.memories.find((candidate) => candidate.key === memoryKey);
    if (!memory) { this.bump(); return; }
    this.triedRecall(pending.beat).add(memory.key);
    const accepted = option.recall.accept.find((entry) => entry.mem === memory.id);
    if (!accepted) this.addTension(TENSION_AUTO.recallMiss);
    main.pendingChoice = undefined;
    main.blocked = false;
    this.view.choice = null;
    const beats: Beat[] = accepted
      ? [...accepted.then, ...(accepted.goto ? [{ k: 'goto', scene: accepted.goto } as Beat] : [])]
      // A line that doesn't fit: she stops before saying it, and the question is still there.
      : [...(option.recall.miss.length ? option.recall.miss : [{ k: 'line', kind: 'think', speaker: 'me', text: '……不對。不是這一句。' } as Beat]), pending.beat];
    main.stack.push({ beats, i: 0 });
    main.busyUntil = this.view.t;
    this.bump();
    this.advanceTo(this.view.t);
  }

  private openRecall(run: Run, index: number): void {
    const pending = run.pendingChoice!;
    const memories = this.recallable(pending.beat);
    if (memories.length === 0) return;
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

  /** 聽距離: she speaks up. Whether it lands depends on how close the steps are right now. */
  approachCall(): void {
    const main = this.runs.get('main');
    const pending = main?.pendingInteract;
    if (!main || !pending || pending.beat.k !== 'approach' || this.view.interact?.type !== 'approach') return;
    const beat = pending.beat;
    const stepAt = (i: number) => pending.start + i * beat.interval * 1000;
    const now = this.view.t;
    const branch = now < stepAt(beat.steps - 2) - beat.interval * 350 ? beat.early
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
    // An approach lasts as long as the walk: every step toward her, then three going away.
    const timeoutMs = beat.k === 'approach' ? (beat.steps + APPROACH_PAST.length) * beat.interval * 1000
      : beat.k === 'locate' ? (beat.timeout !== undefined ? beat.timeout * 1000 : Infinity) : beat.timeout * 1000;
    run.blocked = true;
    run.pendingInteract = { beat, deadline: t + timeoutMs + SHIFT_MS, triesLeft: beat.k === 'locate' ? beat.tries : 1, start: t + SHIFT_MS };
    if (this.view.focus !== 'main' && this.shift?.to !== 'main') this.beginShift('main');
    const key = this.keyCounter++;
    if (beat.k === 'touch') this.view.interact = { type: 'touch', key, cells: beat.cells, style: beat.style, prompt: beat.prompt };
    if (beat.k === 'punch') this.view.interact = { type: 'punch', key, cells: beat.cells, label: beat.label, prompt: beat.prompt };
    if (beat.k === 'locate') {
      this.view.interact = { type: 'locate', key, prompt: beat.prompt, triesLeft: beat.tries, hint: null, wrong: [] };
      this.repeatLocate(key, beat, t);
    }
    if (beat.k === 'approach') {
      this.view.interact = { type: 'approach', key, prompt: beat.prompt };
      this.walkUp(key, beat, t + SHIFT_MS);
    }
    this.bump();
  }

  /** Each step lands closer and louder; past her, the same steps fade the other way. */
  private walkUp(key: number, beat: Extract<Beat, { k: 'approach' }>, start: number): void {
    const n = beat.steps;
    const steps = [
      ...Array.from({ length: n }, (_, i) => ({ dir: beat.at, r: APPROACH_FAR - (APPROACH_FAR - APPROACH_NEAR) * (i / (n - 1)), gain: 0.35 + 0.65 * (i / (n - 1)), close: i >= n - 2 })),
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
      beat.decoys.forEach((decoy) => this.out.audio.play(decoy.sfx, { dir: decoy.at, dist: 'mid' }, { gain: ears.decoy }));
      this.schedule(t + beat.lag * 1000, () => { if (this.view.interact?.key === key) this.out.audio.play(beat.sfx, { dir: beat.at, dist: 'mid' }, { gain: target * 0.8 }); });
      this.maskWithHeart(key, t + 600);
      this.schedule(t + 1000, () => this.repeatLocate(key, beat, t + 1000));
      return;
    }
    this.out.audio.play(beat.sfx, { dir: beat.at, dist: 'mid' }, { gain: target });
    beat.decoys.forEach((decoy, index) => this.schedule(t + 500 + index * 420, () => {
      if (this.view.interact?.key === key) this.out.audio.play(decoy.sfx, { dir: decoy.at, dist: 'mid' }, { gain: ears.decoy });
    }));
    this.maskWithHeart(key, t + 250);
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
    if (pending.beat.k === 'locate') run.stack.push({ beats: ok ? pending.beat.success : pending.beat.fail, i: 0 });
    // Nobody spoke up in time: the steps went past and she calls after them.
    if (pending.beat.k === 'approach') run.stack.push({ beats: branch ?? pending.beat.late, i: 0 });
    run.busyUntil = this.view.t;
    this.bump();
  }

  /** Long-press: keep the line that is (or just was) heard clearly. */
  capture(): boolean {
    const candidate = this.view.center?.perceived ? this.view.center : this.view.echo?.perceived ? this.view.echo : null;
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

  private chapter(key: string): Chapter {
    const chapter = this.script.chapters.find((candidate) => candidate.key === key) ?? this.script.chapters[0];
    if (!chapter) throw new Error('沒有任何章節');
    return chapter;
  }

  private beginChapter(key: string, firstOfChapter: boolean, restart = !firstOfChapter): void {
    const chapter = this.chapter(key);
    const entry = restart ? chapter.restart ?? chapter.start : chapter.start;
    this.save.scene = entry;
    this.save.chapter = chapter.key;
    if (!this.save.reached.includes(chapter.key)) this.save.reached.push(chapter.key);
    this.flags = new Set();
    this.recallTried = new WeakMap();
    this.seen = new Set();
    this.clearScene();
    this.shownArea = undefined;
    const card: Card = firstOfChapter
      ? { chapter: CHAPTER_NUMERALS[chapter.key] ?? '', title: chapter.title }
      : { loopText: `第 ${toChineseNumber(this.save.loop)} 次的十月三日` };
    this.view.chapterKey = chapter.key;
    this.view.loop = this.save.loop;
    this.setPhase('card', firstOfChapter ? CHAPTER_CARD_MS : CARD_MS, () => this.transition(entry), card);
  }

  private transition(sceneId: string, resumeWait?: GameSave['wait']): void {
    const scene = this.script.scenes.get(sceneId);
    if (!scene) throw new Error(`找不到場景 ${sceneId}`);
    // A scene without its own time/place continues the moment: barely a breath between them, and her heart
    // does not stop for it.
    const continuous = !scene.time && !scene.place;
    this.clearScene(continuous && !resumeWait);
    const outMs = continuous ? 280 : OUT_MS;
    if (!continuous) this.out.audio.duck(0.5, OUT_MS);
    this.view.brief = continuous;
    this.setPhase('out', outMs, () => {
      // Only a continuous scene carries the old echo (and sounds still dying away) across; anywhere else they went with the faded world.
      if (!continuous) { this.view.echo = null; this.view.periph = []; this.view.ripples = []; }
      if (scene.ambience) this.out.audio.setAmbience(scene.ambience, 2600);
      // Only a new area earns the full card; a new room or a later hour just updates the corner.
      const area = scene.place ? areaOf(scene.place) : undefined;
      const showCard = area !== undefined && area !== this.shownArea && !resumeWait;
      if (area !== undefined) this.shownArea = area;
      if (showCard) this.setPhase('card', CARD_MS, () => this.enterScene(scene, resumeWait), { time: scene.time, place: scene.place });
      else this.enterScene(scene, resumeWait);
    });
  }

  private enterScene(scene: Scene, resumeWait?: GameSave['wait']): void {
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
    if (!resumeWait) delete this.save.wait;
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
    this.view.phase = phase;
    this.view.card = card ?? (phase === 'card' ? this.view.card : undefined);
    this.phaseUntil = this.view.t + durationMs;
    this.afterPhase = after;
    this.bump();
  }

  private endLoop(kind: EndKind): void {
    this.clearScene();
    if (kind === 'ending_a' || kind === 'ending_c') {
      const letter = kind === 'ending_a' ? 'a' : 'c';
      if (!this.save.endings.includes(letter)) this.save.endings.push(letter);
      this.save.finished = true;
      this.save.scene = null;
      this.persist();
      this.out.audio.setAmbience([], 6000);
      this.view.phase = 'ending';
      this.view.ending = letter;
      this.bump();
      return;
    }
    if (kind === 'ending_b' && !this.save.endings.includes('b')) this.save.endings.push('b');
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
    this.persist();
    this.out.audio.silence(400);
    this.view.loop = this.save.loop;
    this.setPhase('reset', RESET_MS, () => this.beginChapter(nextKey, advanced), { loopText: `第 ${toChineseNumber(this.save.loop)} 次的十月三日` });
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
      if (run.pendingInteract && run.pendingInteract.deadline <= t) this.resolveInteract(run, run.pendingInteract.beat.k !== 'locate' && run.pendingInteract.beat.k !== 'approach');
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
        if (beat.text) this.addPeripheral('sfx', beat.text, beat.pos, t + SFX_TEXT_MS * (beat.pos.dist === 'far' ? 1.25 : 1), undefined, beat.src ?? SFX_SOURCE[beat.id]);
        if (beat.to) this.trail(beat.pos, beat.to, t, SFX_TEXT_MS);
        else this.ripple(beat.pos);
        const jolt = beat.shake ?? (beat.vib === 'crash' ? 'hard' : beat.vib === 'thud' ? 'light' : undefined);
        if (jolt) this.jolt(jolt);
        if (HUSH_SFX.has(beat.id)) this.lifeHushUntil = t + HUSH_MS;
        run.busyUntil = t + (beat.text ? 650 : 150);
        this.bump();
        return;
      }
      case 'amb': this.out.audio.setAmbience(beat.ids, beat.fade !== undefined ? beat.fade * 1000 : 2400); this.ambience = beat.ids; this.startLife(); run.busyUntil = t; return;
      case 'move': Object.assign(this.cast, beat.moves); run.busyUntil = t; return;
      case 'pause': run.busyUntil = t + beat.seconds * 1000; return;
      case 'wait': this.startWait(run, beat, t, beat.seconds * 1000, topLevelIndex); return;
      case 'vib': this.vibrate(beat.id); run.busyUntil = t; return;
      case 'shake': this.jolt(beat.level); this.vibrate(beat.level === 'hard' ? 'crash' : 'thud'); run.busyUntil = t; this.bump(); return;
      case 'heart': this.setHeart(beat.level); run.busyUntil = t; return;
      case 'daze': this.setDaze(beat.level); run.busyUntil = t; return;
      case 'noise': this.setNoise(beat.level, beat.speed, beat.loud, beat.with); run.busyUntil = t; return;
      case 'tension': this.addTension(beat.delta); run.busyUntil = t; return;
      case 'clock': this.setClock(beat.time); run.busyUntil = t; this.bump(); return;
      case 'cue': this.startThread(beat, t); run.busyUntil = t + 400; return;
      case 'choice': this.offerChoice(run, beat, t); return;
      case 'touch': case 'locate': case 'approach': case 'punch': this.startInteract(run, beat, t); return;
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
    const timing = lineTiming(text, beat.kind, this.settings.textSpeed);
    if (beat.shake) this.jolt(beat.shake);
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
    };
    const revealEnd = t + timing.revealMs;
    const manualHold = !this.settings.autoAdvance && focused;
    run.line = { beat, center, revealEnd, end: manualHold ? Infinity : revealEnd + timing.holdMs, learnChecked: false };
    run.busyUntil = run.line.end;
    // Her phone reading the time out loud is the time.
    const spoken = beat.kind === 'phone' ? heardClock(text, this.view.clock) : null;
    if (spoken) this.setClock(spoken);
    if (beat.kind === 'char' || beat.kind === 'me' || beat.kind === 'phone') {
      this.out.audio.voice(beat.speaker === 'me' ? 'me' : beat.speaker, beat.kind === 'me' ? CENTER : pos, timing.revealMs);
    }
    if (glide) this.trail(pos, glide, t, glideMs);
    else if (beat.kind === 'char') this.ripple(pos);
    if (focused) this.showCenter(center);
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
    if (line.beat.learn) this.learn(line.beat.learn);
    this.bump();
  }

  private finishLine(run: Run): void {
    const line = run.line;
    if (!line) return;
    if (!line.learnChecked) this.checkPerception(run);
    run.line = null;
    if (this.view.center?.key === line.center.key) {
      this.view.echo = { ...this.view.center, until: this.view.t + ECHO_MS };
      this.view.center = null;
      this.bump();
    }
  }

  private startWait(run: Run, beat: Extract<Beat, { k: 'wait' }>, t: number, durationMs: number, index: number): void {
    run.busyUntil = t + durationMs;
    this.view.waiting = { startedAt: t, seconds: durationMs / 1000, clock: beat.clock, until: beat.until };
    if (beat.clock) this.setClock(beat.clock);
    if (index >= 0 && this.scene) {
      this.save.wait = { scene: this.scene.id, index, endsAt: this.out.wallNow() + durationMs / this.speed };
      this.persist();
    }
    const finish = () => {
      if (this.view.waiting?.startedAt !== t) return;
      this.view.waiting = null;
      if (beat.until) this.setClock(beat.until);
      delete this.save.wait;
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
    const run: Run = { id: beat.thread, stack: [{ beats, i: 0 }], busyUntil: t + (beat.grab ? SHIFT_MS + 200 : CUE_LEAD_MS), line: null, blocked: false, done: false, pos: beat.pos };
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
    if (this.shift?.to === run.id) {
      // It went quiet while she was still turning: the same turn simply comes back, no second shift.
      this.shift.to = 'main';
      this.view.shiftingTo = null;
    } else if (this.view.focus === run.id) this.beginShift('main');
    this.bump();
  }

  private offerChoice(run: Run, beat: Extract<Beat, { k: 'choice' }>, t: number): void {
    const ctx = this.condContext();
    const canRecall = this.recallable(beat).length > 0;
    const options = beat.options.filter((option) => (!option.cond || evalCond(option.cond, ctx)) && (!option.recall || canRecall));
    const original = beat.default !== undefined ? beat.options[beat.default] : undefined;
    // Silence falls back to the default, or the last ordinary option; never to "想起一句話".
    const disabled = options.map((option) => Boolean(option.disabledCond && evalCond(option.disabledCond, ctx)));
    const lastPlain = options.map((option, index) => !option.recall && !disabled[index]).lastIndexOf(true);
    const preferred = original ? options.indexOf(original) : -1;
    const fallback = preferred >= 0 && !disabled[preferred] ? preferred : lastPlain;
    const timeoutMs = beat.timeout !== undefined && fallback >= 0 ? beat.timeout * 1000 : Infinity;
    run.blocked = true;
    run.pendingChoice = { beat, options, deadline: t + timeoutMs + SHIFT_MS, fallback };
    // Someone is asking her something: attention comes back.
    if (this.view.focus !== 'main' && this.shift?.to !== 'main') this.beginShift('main');
    this.view.choice = {
      key: this.keyCounter++,
      options: options.map((option, index) => ({ text: option.text, index, recall: option.recall ? true : undefined, disabled: disabled[index] || undefined })),
      startedAt: t,
      timeout: beat.timeout,
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
      const life = scene?.life === 'off' ? null : lifeOf(this.ambience, scene?.life);
      if (!life) return;
      const busy = this.view.center !== null || this.view.choice !== null || this.view.periph.some((item) => item.kind !== 'cue' && item.until > t + 400);
      if (busy) this.lifeBusyAt = t;
      const hushed = t < this.lifeHushUntil;
      const empty = t - this.lifeBusyAt >= LIFE_EMPTY_MS;
      if (!hushed && (t >= this.lifeNextAt || empty)) {
        // Thinner while someone is talking to her; busier while she waits.
        if (!this.focusedLine() || Math.random() < 0.5) { this.lifeBeat(life.events, t); this.lifeBusyAt = t; }
        const [min, max] = life.every;
        this.lifeNextAt = t + (min + Math.random() * (max - min)) * 1000 * (this.view.waiting ? 0.45 : 1) * TENSION_LIFE[this.view.tension].every;
      }
      this.checkLife(gen);
    });
  }

  private lifeBeat(events: LifeEvent[], t: number, noise?: { speed: number; loud: number }): void {
    const wound = TENSION_LIFE[this.view.tension];
    const event = this.pickLife(events, t, (noise ? LIFE_VOICE_GAP_MS / (noise.speed * 2) : LIFE_VOICE_GAP_MS) / wound.voices);
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
      this.out.audio.voice(event.voice, pos, ms, 'life');
      this.addPeripheral('life', event.say, pos, t + ms + 2600);
      // The rest of the exchange, one turn after another, from the same spot.
      const turns = event.reply === undefined ? [] : Array.isArray(event.reply) ? event.reply : [event.reply];
      const gen = this.lifeGen;
      let at = t + ms + 500;
      for (const turn of turns) {
        const turnMs = Math.max(900, [...turn.say].length * 110);
        this.schedule(at, () => {
          if (gen !== this.lifeGen || this.view.phase !== 'scene' || this.view.t < this.lifeHushUntil) return;
          this.out.audio.voice(turn.voice, pos, turnMs, 'life');
          this.addPeripheral('life', turn.say, pos, this.view.t + turnMs + 2600);
          this.lifeVoiceAt = this.view.t;
          this.bump();
        });
        at += turnMs + 500;
      }
      this.lifeVoiceAt = at;
    } else {
      this.out.audio.play(event.sfx, pos, { gain: (pos.dist === 'far' ? 0.12 : 0.16) * (noise?.loud ?? 1) * wound.loud });
      this.addPeripheral('sfx', event.text, pos, t + SFX_TEXT_MS * (pos.dist === 'far' ? 1.25 : 1), undefined, event.src ?? (event.sfx && SFX_SOURCE[event.sfx]));
    }
    this.bump();
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
    this.shift = { to, until: this.view.t + SHIFT_MS };
    this.view.focus = null;
    const target = to === 'main' ? null : this.runs.get(to)?.pos ?? null;
    this.view.shiftingTo = target;
    if (this.view.center) { this.view.echo = { ...this.view.center, until: this.view.t + ECHO_MS }; this.view.center = null; }
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
    if (live) {
      this.view.periph = this.view.periph.filter((item) => !(item.kind === 'murmur' && item.thread === this.view.focus));
      live.learnChecked = true;
      this.showCenter({ ...live.center, perceived: false });
    }
    this.bump();
  }

  private focusRun(): Run | undefined { return this.view.focus ? this.runs.get(this.view.focus) : undefined; }
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
   * each level beats.
   */
  private setHeart(level: HeartLevel): void {
    this.heartAsked = level;
    const felt = this.feltHeart(level);
    if ((this.view.heart?.level ?? 'off') === felt) return;
    const gen = ++this.heartGen;
    if (felt === 'off') { this.view.heart = null; this.startUndertone(); this.bump(); return; }
    const beatOnce = () => {
      if (gen !== this.heartGen || !this.view.heart) return;
      const heart = HEART[this.view.heart.level];
      const wound = this.save.tension / 100;
      this.out.audio.play('heartbeat', CENTER, { gain: Math.min(1, heart.gain * (1 + wound * 0.3)), rate: heart.rate });
      if (heart.vib) this.vibrate('heartbeat');
      this.view.heart = { ...this.view.heart, beat: this.view.heart.beat + 1 };
      this.bump();
      this.schedule(this.view.t + heart.ms * (1 - wound * 0.18), beatOnce);
    };
    this.view.heart = { level: felt, beat: this.view.heart?.beat ?? 0 };
    beatOnce();
  }

  /** Wound up, a racing heart races harder; an uneasy one stays uneasy (only quicker), so it does not keep jumping. */
  private feltHeart(level: HeartLevel): HeartLevel {
    return level === 'fast' && this.view.tension >= 2 ? 'pound' : level;
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
    if (rose && !quiet && this.view.phase === 'scene') {
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
    if (this.heartAsked !== 'off') { const asked = this.heartAsked; this.heartAsked = 'off'; this.setHeart(asked); }
    if (band === 3) this.startUndertone();
    return rose;
  }

  /** What her phone reads off her wrist right now. */
  private bpm(): number {
    return Math.round(BPM[this.view.heart?.level ?? 'off'] + this.save.tension * 0.3);
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
      const life = scene?.life === 'off' ? null : lifeOf(this.ambience, scene?.life);
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

  private persist(): void { this.out.persist(this.save); }

  private bump(): void {
    this.version += 1;
    this.view.memoryCount = this.save.memories.length;
    for (const listener of this.listeners) listener();
  }

  private emptyView(): View {
    return {
      phase: 'idle', brief: false, t: 0, center: null, echo: null, periph: [], ripples: [], choice: null, focus: null, shiftingTo: null,
      waiting: null, clockMark: 0, keep: null, recall: null, interact: null, memoryCount: this.save.memories.length, shake: 0, shakeLevel: 'light', heart: null, daze: null, noise: null, tension: 0, chapterKey: this.save.chapter, loop: this.save.loop,
    };
  }

  /** Test / automation helper: play sfx id without a scene. */
  playUi(id: SfxId): void { this.out.audio.play(id, CENTER); }
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
      if (beat.k === 'locate') { visit(beat.success); visit(beat.fail); }
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
function directionsClose(picked: Direction, target: Direction): boolean {
  const diff = (x: number, y: number) => { const d = Math.abs(x - y) % 360; return Math.min(d, 360 - d); };
  const a = DIRECTION_ANGLE[picked];
  const b = DIRECTION_ANGLE[target];
  return diff(a, b) <= 45 || diff(a, (540 - b) % 360) === 0;
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
