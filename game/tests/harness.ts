import { DIRECTIONS } from '../src/audio/catalog';
import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { loadGameScript } from '../src/script/load';
import type { AudioEngine } from '../src/audio/engine';

// story/*.yaml through the same Vite glob the game uses.
export function loadScriptFromDisk() {
  return loadGameScript();
}

export function silentAudio(log: string[] = []): AudioEngine {
  const noop = () => undefined;
  return {
    ready: true,
    unlock: async () => undefined,
    setEnabled: noop,
    setVolume: noop,
    setVoiceVolume: noop,
    setAmbienceVolume: noop,
    setSfxVolume: noop,
    setAmbience: (ids) => { log.push(`amb:${ids.join(',')}`); },
    play: (id) => { log.push(`sfx:${id}`); },
    voice: noop,
    setAttention: noop,
    setDaze: (level: number) => { log.push(`daze:${level}`); },
    setNoise: (loud: number) => { log.push(`noise:${loud}`); },
    duck: noop,
    silence: noop,
    suspend: noop,
    resume: noop,
  } as AudioEngine;
}

function rng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
}

export type PlayResult = { chapters: string[]; endings: string[]; loops: number; scenes: Set<string>; knowledge: Set<string>; stuck?: string };

/** Plays with a random policy: random choices, sometimes turns toward cues, sometimes taps. */
export function autoplay(options: { seed: number; maxLoops: number; startChapter?: string; grantKnowledge?: boolean; stopAtChapter?: string; attendRate?: number; observe?: (director: Director) => void }): PlayResult {
  const { script, errors } = loadScriptFromDisk();
  if (errors.length) throw new Error(errors.join('\n'));
  const random = rng(options.seed);
  let wall = 0;
  let save: GameSave = freshSave();
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => wall }, { speed: 1 });
  if (options.observe) director.subscribe(() => options.observe!(director));
  if (options.startChapter) director.jumpToChapter(options.startChapter, options.grantKnowledge ?? true);
  else director.start();
  const chapters: string[] = [director.view.chapterKey];
  const scenes = new Set<string>();
  const attendRate = options.attendRate ?? 0.35;
  let lastProgress = 0;
  let steps = 0;
  while (steps++ < 400_000) {
    const view = director.view;
    if (view.phase === 'ending') break;
    if (director.save.loop > options.maxLoops) break;
    if (view.sceneId) scenes.add(view.sceneId);
    if (chapters[chapters.length - 1] !== director.save.chapter) {
      chapters.push(director.save.chapter);
      if (options.stopAtChapter && director.save.chapter === options.stopAtChapter) break;
    }
    if (view.choice && view.focus === 'main' && random() < 0.6) {
      director.choose(view.choice.options[Math.floor(random() * view.choice.options.length)].index);
    } else if (view.phase === 'scene' && random() < 0.02) {
      const cues = view.periph.filter((item) => item.kind === 'cue' && item.thread);
      if (cues.length && random() < attendRate) director.attend(cues[Math.floor(random() * cues.length)].thread!);
    } else if (random() < 0.3) {
      director.hurry();
    }
    if (view.keep) director.skipKeep();
    if (view.interact && random() < 0.3) {
      if (view.interact.type === 'touch') director.touchDone();
      else if (view.interact.type === 'punch') director.punchDone();
      else if (view.interact.type === 'approach') director.approachCall();
      else director.locatePick(DIRECTIONS[Math.floor(random() * DIRECTIONS.length)]);
    }
    if (view.recall) {
      const pick = view.recall.memories[Math.floor(random() * (view.recall.memories.length + 1))];
      director.recallPick(pick ? pick.key : null);
    }
    if (view.center?.perceived && random() < 0.01) director.capture();
    // Story progress only: background life keeps the view changing even when the story is stuck.
    const mark = () => `${director.view.phase}|${director.view.sceneId}|${director.view.center?.key}|${director.view.choice?.key}|${director.view.waiting?.startedAt}|${director.save.loop}`;
    const before = mark();
    wall += 200;
    director.tick(200);
    if (mark() !== before) lastProgress = steps;
    if (steps - lastProgress > 20_000) return { chapters, endings: director.save.endings, loops: director.save.loop, scenes, knowledge: new Set(director.save.knowledge), stuck: `${view.phase} ${view.sceneId}` };
  }
  return { chapters, endings: [...director.save.endings], loops: director.save.loop, scenes, knowledge: new Set(director.save.knowledge) };
}
