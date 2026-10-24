import type { AudioEngine } from '../audio/engine';
import { DIRECTIONS, type AmbienceId, type Direction, type SfxId, type VibrationId } from '../audio/catalog';
import { evalCond, type CondContext } from '../script/conditions';
import { CHAPTER_NUMERALS, SPEAKER_LABELS, type Beat, type Chapter, type ChoiceOption, type EndKind, type GameScript, type LineBeat, type LineKind, type Pos, type Scene } from '../script/types';
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
  perceived: boolean;
  captured: boolean;
  mem?: string;
};

export type Peripheral = { key: number; kind: 'sfx' | 'murmur' | 'cue' | 'life'; text: string; pos: Pos; thread?: string; born: number; until: number };

export type Card = { chapter?: string; title?: string; time?: string; place?: string; loopText?: string };

export type View = {
  phase: 'idle' | 'out' | 'card' | 'scene' | 'reset' | 'ending';
  /** The current 'out' is only a breath into a continuous scene, not a fade to black. */
  brief: boolean;
  t: number;
  sceneId?: string;
  clock?: string;
  place?: string;
  card?: Card;
  center: CenterLine | null;
  echo: (CenterLine & { until: number }) | null;
  periph: Peripheral[];
  ripples: { key: number; pos: Pos }[];
  choice: { key: number; options: { text: string; index: number }[]; startedAt: number; timeout?: number } | null;
  focus: string | null;
  shiftingTo: Pos | null;
  waiting: { startedAt: number; seconds: number; clock?: string; until?: string } | null;
  keep: Memory | null;
  memoryCount: number;
  ending?: 'a' | 'c';
  shake: number;
  chapterKey: string;
  loop: number;
};

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
  pendingChoice?: { options: ChoiceOption[]; deadline: number; fallback: number };
};

const CENTER: Pos = { dir: 'center', dist: 'near' };

export class Director {
  readonly script: GameScript;
  save: GameSave;
  view: View;
  version = 0;
  speed: number;
  private out: DirectorOutput;
  private listeners = new Set<() => void>();
  private flags = new Set<string>();
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

  constructor(script: GameScript, save: GameSave, out: DirectorOutput, options: { speed?: number } = {}) {
    this.script = script;
    this.save = save;
    this.out = out;
    this.speed = options.speed ?? 1;
    this.knowledge = new Set(save.knowledge);
    this.view = this.emptyView();
  }

  // ───────────────────────── public API ─────────────────────────

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  getVersion = () => this.version;

  get settings(): Settings { return this.save.settings; }
  get knows(): ReadonlySet<string> { return this.knowledge; }
  get loopFlags(): ReadonlySet<string> { return this.flags; }
  get currentScene(): Scene | null { return this.scene; }
  get threadsRunning(): string[] { return [...this.runs.values()].filter((run) => !run.done && run.id !== 'main').map((run) => run.id); }

  /** Start or resume from the save. */
  start(): void {
    if (!this.save.started) {
      this.save.started = true;
      this.beginChapter(this.save.chapter, true);
      return;
    }
    const sceneId = this.save.scene ?? this.chapter(this.save.chapter).start;
    this.flags = new Set(this.save.flags);
    this.seen = new Set(this.save.seen);
    const resumeWait = this.save.wait && this.save.wait.scene === sceneId ? this.save.wait : undefined;
    this.transition(sceneId, resumeWait);
  }

  newGame(): void {
    this.save = freshSave(this.save);
    this.knowledge = new Set();
    this.flags = new Set();
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
    this.seen = new Set();
    this.beginChapter(key, true);
  }

  setPaused(paused: boolean): void { this.paused = paused; }
  updateSettings(patch: Partial<Settings>): void {
    this.save.settings = { ...this.save.settings, ...patch };
    this.out.audio.setEnabled(this.save.settings.audio);
    this.out.audio.setVolume(this.save.settings.volume);
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
    if (this.view.phase !== 'scene' || this.view.waiting || this.view.choice || this.shift) return;
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
    if (threadId !== 'main' && this.runs.get('main')?.pendingChoice) return;
    this.beginShift(threadId);
    this.bump();
  }

  choose(index: number): void {
    const main = this.runs.get('main');
    const pending = main?.pendingChoice;
    if (!main || !pending || this.view.focus !== 'main') return;
    const option = pending.options[index];
    if (!option) return;
    this.applyChoice(main, option);
    this.advanceTo(this.view.t);
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

  private beginChapter(key: string, firstOfChapter: boolean): void {
    const chapter = this.chapter(key);
    this.save.chapter = chapter.key;
    this.flags = new Set();
    this.seen = new Set();
    this.clearScene();
    this.shownArea = undefined;
    const card: Card = firstOfChapter
      ? { chapter: CHAPTER_NUMERALS[chapter.key] ?? '', title: chapter.title }
      : { loopText: `第 ${toChineseNumber(this.save.loop)} 次的十月三日` };
    this.view.chapterKey = chapter.key;
    this.view.loop = this.save.loop;
    this.setPhase('card', firstOfChapter ? CHAPTER_CARD_MS : CARD_MS, () => this.transition(chapter.start), card);
  }

  private transition(sceneId: string, resumeWait?: GameSave['wait']): void {
    const scene = this.script.scenes.get(sceneId);
    if (!scene) throw new Error(`找不到場景 ${sceneId}`);
    this.clearScene();
    // A scene without its own time/place continues the moment: barely a breath between them.
    const continuous = !scene.time && !scene.place;
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
    this.view.clock = scene.time ?? this.view.clock;
    this.view.place = scene.place ?? this.view.place;
    this.view.focus = 'main';
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
      const beat = scene.beats[resumeWait.index];
      if (beat?.k === 'wait') {
        main.stack[0].i += 1;
        const remainingMs = Math.max(0, resumeWait.endsAt - this.out.wallNow()) * this.speed;
        this.startWait(main, beat, this.view.t, remainingMs, resumeWait.index);
      }
    }
    this.bump();
  }

  private clearScene(): void {
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
    const nextKey = rule?.to ?? chapter.key;
    const advanced = nextKey !== chapter.key;
    this.save.loop += 1;
    this.save.chLoop = advanced ? 1 : this.save.chLoop + 1;
    this.save.chapter = nextKey;
    this.save.scene = null;
    this.flags = new Set();
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
        this.applyChoice(run, option);
      }
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
    this.execute(run, beat, t, topLevelIndex);
  }

  private execute(run: Run, beat: Beat, t: number, topLevelIndex: number): void {
    switch (beat.k) {
      case 'line': this.startLine(run, beat, t); return;
      case 'sfx': {
        this.out.audio.play(beat.id, beat.pos, { gain: beat.gain });
        if (beat.vib) this.vibrate(beat.vib);
        if (beat.text) this.addPeripheral('sfx', beat.text, beat.pos, t + SFX_TEXT_MS * (beat.pos.dist === 'far' ? 1.25 : 1));
        this.ripple(beat.pos);
        if (beat.vib === 'crash' || beat.vib === 'thud') this.view.shake += 1;
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
      case 'clock': this.view.clock = beat.time; run.busyUntil = t; this.bump(); return;
      case 'cue': this.startThread(beat, t); run.busyUntil = t + 400; return;
      case 'choice': this.offerChoice(run, beat, t); return;
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
    const timing = lineTiming(beat.text, beat.kind, this.settings.textSpeed);
    const pos = this.posFor(run, beat);
    const focused = this.view.focus === run.id && !this.shift;
    const label = beat.kind === 'char' ? beat.label ?? SPEAKER_LABELS[beat.speaker] : beat.kind === 'phone' ? beat.label ?? SPEAKER_LABELS.phone : beat.label;
    const center: CenterLine = {
      key: this.keyCounter++,
      thread: run.id,
      kind: beat.kind,
      label,
      text: beat.text,
      phrases: timing.phrases,
      startedAt: t,
      revealMs: timing.revealMs,
      pos,
      perceived: false,
      captured: false,
      mem: beat.mem,
    };
    const revealEnd = t + timing.revealMs;
    const manualHold = !this.settings.autoAdvance && focused;
    run.line = { beat, center, revealEnd, end: manualHold ? Infinity : revealEnd + timing.holdMs, learnChecked: false };
    run.busyUntil = run.line.end;
    if (beat.kind === 'char' || beat.kind === 'me' || beat.kind === 'phone') {
      this.out.audio.voice(beat.speaker === 'me' ? 'me' : beat.speaker, beat.kind === 'me' ? CENTER : pos, timing.revealMs);
    }
    if (beat.kind === 'char') this.ripple(pos);
    if (focused) this.showCenter(center);
    else this.addPeripheral('murmur', murmurOf(beat.text), beat.kind === 'char' ? pos : run.pos, run.line.end === Infinity ? t + timing.revealMs + timing.holdMs : run.line.end, run.id);
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
    if (beat.clock) this.view.clock = beat.clock;
    if (index >= 0 && this.scene) {
      this.save.wait = { scene: this.scene.id, index, endsAt: this.out.wallNow() + durationMs / this.speed };
      this.persist();
    }
    const finish = () => {
      if (this.view.waiting?.startedAt !== t) return;
      this.view.waiting = null;
      if (beat.until) this.view.clock = beat.until;
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
    this.addPeripheral('cue', beat.text, beat.pos, Infinity, beat.thread);
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
    const options = beat.options.filter((option) => !option.cond || evalCond(option.cond, ctx));
    const original = beat.default !== undefined ? beat.options[beat.default] : undefined;
    const fallback = original ? Math.max(0, options.indexOf(original)) : options.length - 1;
    const timeoutMs = beat.timeout !== undefined ? beat.timeout * 1000 : Infinity;
    run.blocked = true;
    run.pendingChoice = { options, deadline: t + timeoutMs + SHIFT_MS, fallback };
    // Someone is asking her something: attention comes back.
    if (this.view.focus !== 'main' && this.shift?.to !== 'main') this.beginShift('main');
    this.view.choice = {
      key: this.keyCounter++,
      options: options.map((option, index) => ({ text: option.text, index })),
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
        this.lifeNextAt = t + (min + Math.random() * (max - min)) * 1000 * (this.view.waiting ? 0.45 : 1);
      }
      this.checkLife(gen);
    });
  }

  private lifeBeat(events: LifeEvent[], t: number): void {
    const fresh = events.filter((event) => !this.lifeRecent.includes(event));
    const pool = fresh.length ? fresh : events;
    const event = pool[Math.floor(Math.random() * pool.length)];
    this.lifeRecent = [...this.lifeRecent, event].slice(-Math.min(4, Math.max(1, events.length - 2)));
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
      this.out.audio.voice(event.voice, pos, ms);
      this.addPeripheral('life', event.say, pos, t + ms + 2600);
      if (event.reply) {
        const reply = event.reply;
        const gen = this.lifeGen;
        this.schedule(t + ms + 500, () => {
          if (gen !== this.lifeGen || this.view.phase !== 'scene' || this.view.t < this.lifeHushUntil) return;
          const replyMs = Math.max(900, [...reply.say].length * 110);
          this.out.audio.voice(reply.voice, pos, replyMs);
          this.addPeripheral('life', reply.say, pos, this.view.t + replyMs + 2600);
          this.bump();
        });
      }
    } else {
      if (event.sfx) this.out.audio.play(event.sfx, pos, { gain: pos.dist === 'far' ? 0.45 : 0.6 });
      this.addPeripheral('sfx', event.text, pos, t + SFX_TEXT_MS * (pos.dist === 'far' ? 1.25 : 1));
    }
    this.bump();
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

  private addPeripheral(kind: Peripheral['kind'], text: string, pos: Pos, until: number, thread?: string): void {
    this.view.periph = [...this.view.periph.filter((item) => !(kind === 'murmur' && item.kind === 'murmur' && item.thread === thread && thread !== undefined)), { key: this.keyCounter++, kind, text, pos, born: this.view.t, until, thread }];
  }

  private ripple(pos: Pos): void {
    if (pos.dir === 'center') return;
    this.view.ripples = [...this.view.ripples, { key: this.keyCounter++, pos }];
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
      waiting: null, keep: null, memoryCount: this.save.memories.length, shake: 0, chapterKey: this.save.chapter, loop: this.save.loop,
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

export function learnIdsOf(chapter: Chapter): string[] {
  const ids: string[] = [];
  const visit = (beats: Beat[]) => {
    for (const beat of beats) {
      if (beat.k === 'learn') ids.push(...beat.ids);
      if (beat.k === 'line' && beat.learn) ids.push(beat.learn);
      if (beat.k === 'if') { visit(beat.then); visit(beat.else); }
      if (beat.k === 'choice') beat.options.forEach((option) => visit(option.then));
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
