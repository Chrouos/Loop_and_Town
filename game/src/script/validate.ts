import { AMBIENCE_LANDMARKS } from '../audio/ambience';
import { isDirection, type AmbienceId, type AmbienceList } from '../audio/catalog';
import { condRefs } from './conditions';
import { parseChapter } from './parse';
import { CHAPTER_ORDER, type Beat, type Chapter, type ChoiceOption, type Cond, type GameScript, type Scene } from './types';

export type ScriptReport = { script: GameScript; errors: string[]; warnings: string[] };

const MAX_LINE_CHARS = 48;
/** How loud a locate sound (or one of its decoys) may be written, relative to an ordinary sound effect. */
export const LOCATE_GAIN = { min: 0.05, max: 1.5 };
const locateGainOk = (gain: number) => Number.isFinite(gain) && gain >= LOCATE_GAIN.min && gain <= LOCATE_GAIN.max;

function walk(beats: Beat[], visit: (beat: Beat, depth: number) => void, depth = 0) {
  for (const beat of beats) {
    visit(beat, depth);
    if (beat.k === 'if') { walk(beat.then, visit, depth + 1); walk(beat.else, visit, depth + 1); }
    if (beat.k === 'locate' || beat.k === 'hold') { walk(beat.success, visit, depth + 1); walk(beat.fail, visit, depth + 1); }
    if (beat.k === 'approach') { walk(beat.hit, visit, depth + 1); walk(beat.early, visit, depth + 1); walk(beat.late, visit, depth + 1); }
    if (beat.k === 'choice') {
      beat.options.forEach((option) => {
        walk(option.then, visit, depth + 1);
        option.recall?.accept.forEach((entry) => walk(entry.then, visit, depth + 1));
        if (option.recall) walk(option.recall.miss, visit, depth + 1);
      });
    }
  }
}

const recallTerminates = (option: ChoiceOption) =>
  Boolean(option.recall && option.recall.accept.every((entry) => entry.goto || terminates(entry.then)));

// True when every path through these beats ends in goto / end.
function terminates(beats: Beat[]): boolean {
  for (const beat of beats) {
    if (beat.k === 'goto' || beat.k === 'end') return true;
    if (beat.k === 'if' && terminates(beat.then) && terminates(beat.else)) return true;
    if ((beat.k === 'locate' || beat.k === 'hold') && terminates(beat.success) && terminates(beat.fail)) return true;
    if (beat.k === 'approach' && terminates(beat.hit) && terminates(beat.early) && terminates(beat.late)) return true;
    // A missed recall returns to the same choice, so a recall option ends the path only if every accepted memory does.
    if (beat.k === 'choice' && beat.options.every((option) => (option.recall ? recallTerminates(option) : option.goto || terminates(option.then)))) return true;
  }
  return false;
}

function targets(scene: Scene): string[] {
  const out: string[] = [];
  if (scene.next) out.push(scene.next);
  walk(scene.beats, (beat) => {
    if (beat.k === 'goto') out.push(beat.scene);
    if (beat.k === 'choice') {
      beat.options.forEach((option) => {
        if (option.goto) out.push(option.goto);
        option.recall?.accept.forEach((entry) => entry.goto && out.push(entry.goto));
      });
    }
  });
  return out;
}

/** Knowledge (kept across loops) is named k_… for a clue or lead_… for how a gate failed; anything else is this loop's flag. */
const PERMANENT = /^(k|lead)_/;

/**
 * Flags / knowledge that game code reads by name instead of a story condition, so a script with no `flag.X` / `know.X`
 * for them is still fine. Empty today: the engine never branches on a particular id. Add an id here only together
 * with the code that reads it.
 */
const READ_OUTSIDE_SCRIPT = new Set<string>([]);

/**
 * Choices that look like they could run out of options but cannot, for a reason that lives outside the scene.
 * - f_hub_pick: every visit option hides once its f_v_* flag is set, and "先站一下" disables itself after three tries.
 *   f_hub goes straight to f_meeting once all five f_v_* are set, and those flags are only set inside the visit scenes
 *   (which return through f_hub), so whenever f_hub_pick is on screen at least one visit is still open.
 */
const CHOICE_EXIT_PROVEN_ELSEWHERE = new Set<string>(['f_hub_pick']);

/** Most distinct condition atoms a "can this choice get stuck" proof will enumerate (2^n assignments). */
const MAX_PROOF_ATOMS = 14;

type Atom = { key: string; ref: Cond };

function atomsOf(cond: Cond, out = new Map<string, Cond>()): Map<string, Cond> {
  switch (cond.op) {
    case 'know': case 'flag': case 'mem': case 'seen': out.set(`${cond.op}.${cond.id}`, cond); break;
    case 'cmp': out.set(`${cond.left}${cond.cmp}${cond.value}`, cond); break;
    case 'not': atomsOf(cond.arg, out); break;
    case 'and': case 'or': cond.args.forEach((arg) => atomsOf(arg, out)); break;
    default: break;
  }
  return out;
}

function atomKey(cond: Cond): string | null {
  if (cond.op === 'know' || cond.op === 'flag' || cond.op === 'mem' || cond.op === 'seen') return `${cond.op}.${cond.id}`;
  if (cond.op === 'cmp') return `${cond.left}${cond.cmp}${cond.value}`;
  return null;
}

/** Every atom is treated as an independent yes/no, so this only says "true" when it holds for every combination. */
function evalAssigned(cond: Cond, value: Map<string, boolean>): boolean {
  switch (cond.op) {
    case 'true': return true;
    case 'false': return false;
    case 'not': return !evalAssigned(cond.arg, value);
    case 'and': return cond.args.every((arg) => evalAssigned(arg, value));
    case 'or': return cond.args.some((arg) => evalAssigned(arg, value));
    default: return value.get(atomKey(cond)!) ?? false;
  }
}

/** True when `goal` holds in every state that satisfies all of `assume`; false when it cannot be shown. */
function proves(assume: Cond[], goal: Cond): boolean {
  const atoms = new Map<string, Cond>();
  [...assume, goal].forEach((cond) => atomsOf(cond, atoms));
  const list: Atom[] = [...atoms].map(([key, ref]) => ({ key, ref }));
  if (list.length > MAX_PROOF_ATOMS) return false;
  for (let bits = 0; bits < 1 << list.length; bits++) {
    const value = new Map(list.map((atom, index) => [atom.key, Boolean(bits & (1 << index))]));
    if (assume.every((cond) => evalAssigned(cond, value)) && !evalAssigned(goal, value)) return false;
  }
  return true;
}

/** The state ids a run of beats may change: flags it sets, knowledge it learns, memories it offers to keep. */
function writesOf(beats: Beat[]): Set<string> {
  const out = new Set<string>();
  walk(beats, (beat) => {
    if (beat.k === 'set') beat.flags.forEach((id) => out.add(`flag.${id}`));
    if (beat.k === 'learn') beat.ids.forEach((id) => out.add(`know.${id}`));
    if (beat.k === 'line' && beat.learn) out.add(`know.${beat.learn}`);
    if (beat.k === 'line' && beat.mem) out.add(`mem.${beat.mem}`);
  });
  return out;
}

const NOT = (cond: Cond): Cond => ({ op: 'not', arg: cond });

/**
 * Visits each choice with what the enclosing `if`s and picked options guarantee at that point.
 * A guarantee is dropped as soon as a beat before the choice could change one of its ids.
 */
function walkChoices(beats: Beat[], assume: Cond[], visit: (beat: Extract<Beat, { k: 'choice' }>, assume: Cond[]) => void) {
  let current = assume;
  for (const beat of beats) {
    if (beat.k === 'if') { walkChoices(beat.then, [...current, beat.cond], visit); walkChoices(beat.else, [...current, NOT(beat.cond)], visit); }
    if (beat.k === 'locate' || beat.k === 'hold') { walkChoices(beat.success, current, visit); walkChoices(beat.fail, current, visit); }
    if (beat.k === 'approach') { walkChoices(beat.hit, current, visit); walkChoices(beat.early, current, visit); walkChoices(beat.late, current, visit); }
    if (beat.k === 'choice') {
      visit(beat, current);
      for (const option of beat.options) {
        const picked = [...current, ...(option.cond ? [option.cond] : []), ...(option.disabledCond ? [NOT(option.disabledCond)] : [])];
        walkChoices(option.then, picked, visit);
        option.recall?.accept.forEach((entry) => walkChoices(entry.then, current, visit));
        if (option.recall) walkChoices(option.recall.miss, current, visit);
      }
    }
    const changed = writesOf([beat]);
    if (changed.size) current = current.filter((cond) => ![...atomsOf(cond).keys()].some((key) => changed.has(key)));
  }
}

/** A choice always lets her out when a shown, enabled option is guaranteed, or when silence has a branch and a clock. */
function choiceHasExit(beat: Extract<Beat, { k: 'choice' }>, assume: Cond[]): boolean {
  if (beat.timeout !== undefined && beat.options.some((option) => option.silent)) return true;
  const open = beat.options
    .filter((option) => !option.recall && !option.silent)
    .map((option): Cond => ({ op: 'and', args: [option.cond ?? { op: 'true' }, option.disabledCond ? NOT(option.disabledCond) : { op: 'true' }] }));
  return open.length > 0 && proves(assume, { op: 'or', args: open });
}

/** `at:` on an ambience entry may only move a landmark that place has, to a real direction. */
function checkLandmarks(ids: AmbienceList | undefined, where: string, errors: string[]): void {
  for (const [id, at] of Object.entries(ids?.landmarks ?? {}) as [AmbienceId, Readonly<Record<string, string>>][]) {
    const known = AMBIENCE_LANDMARKS[id] ?? {};
    for (const [name, dir] of Object.entries(at)) {
      if (!(name in known)) errors.push(`${where}：${id} 沒有「${name}」這個定點聲音（可用：${Object.keys(known).join(', ') || '無'}）`);
      if (!isDirection(dir)) errors.push(`${where}：${id}.${name} 未知方位「${dir}」`);
    }
  }
}

export function buildScript(files: { name: string; source: string }[]): ScriptReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const chapters: Chapter[] = [];
  for (const file of files) {
    const chapter = parseChapter(file.source, file.name, errors);
    if (chapter) chapters.push(chapter);
  }
  chapters.sort((a, b) => CHAPTER_ORDER.indexOf(a.key as never) - CHAPTER_ORDER.indexOf(b.key as never));
  const scenes = new Map<string, Scene>();
  for (const chapter of chapters) {
    if (!(CHAPTER_ORDER as readonly string[]).includes(chapter.key)) errors.push(`未知章節「${chapter.key}」`);
    for (const scene of chapter.scenes) {
      if (scenes.has(scene.id)) errors.push(`場景 id 重複：${scene.id}`);
      scenes.set(scene.id, scene);
    }
  }
  const script: GameScript = { chapters, scenes, order: chapters.map((chapter) => chapter.key) };

  const learned = new Set<string>();
  /** Where each knowledge id is first learned, for the "learned but never read" warning. */
  const learnedAt = new Map<string, string>();
  const knowRead = new Set<string>();
  const memIds = new Set<string>();
  // Earliest chapter (play order) in which each knowledge id can be learned.
  const firstLearned = new Map<string, number>();
  const firstMem = new Map<string, number>();
  const orderOf = (key: string) => CHAPTER_ORDER.indexOf(key as never);
  for (const scene of scenes.values()) {
    const all = [scene.beats, ...Object.values(scene.threads)];
    const sceneTag = `${scene.chapter === 'final' ? '最終章' : `第 ${scene.chapter} 章`}#${scene.id}`;
    checkLandmarks(scene.ambience, `${sceneTag}.ambience`, errors);
    for (const beats of all) walk(beats, (beat) => { if (beat.k === 'amb') checkLandmarks(beat.ids, `${sceneTag} amb`, errors); });
    const note = (id: string) => {
      // The name says how long it lasts: only k_ (a clue) and lead_ (how a gate failed) survive midnight.
      if (!PERMANENT.test(id)) errors.push(`${sceneTag}：learn「${id}」要用 k_ 或 lead_ 開頭（跨輪保留的線索）；好感、關係這類每輪歸零的狀態用 set`);
      learned.add(id);
      if (!learnedAt.has(id)) learnedAt.set(id, sceneTag);
      const at = orderOf(scene.chapter);
      if (!firstLearned.has(id) || at < firstLearned.get(id)!) firstLearned.set(id, at);
    };
    for (const beats of all) {
      walk(beats, (beat) => {
        if (beat.k === 'learn') beat.ids.forEach(note);
        if (beat.k === 'line' && beat.learn) note(beat.learn);
        if (beat.k === 'line' && beat.mem) {
          memIds.add(beat.mem);
          const at = orderOf(scene.chapter);
          if (!firstMem.has(beat.mem) || at < firstMem.get(beat.mem)!) firstMem.set(beat.mem, at);
        }
      });
    }
  }

  for (const chapter of chapters) {
    const tag = `第 ${chapter.key} 章`;
    const local = new Map(chapter.scenes.map((scene) => [scene.id, scene]));
    if (!local.has(chapter.start)) errors.push(`${tag}：start「${chapter.start}」不存在`);
    if (chapter.restart !== undefined && !local.has(chapter.restart)) errors.push(`${tag}：restart「${chapter.restart}」不存在`);
    for (const rule of chapter.advance) {
      if (!(CHAPTER_ORDER as readonly string[]).includes(rule.to)) errors.push(`${tag}：advance 目標「${rule.to}」不是章節`);
    }
    const flagsSet = new Set<string>();
    const flagSetAt = new Map<string, string>();
    const flagsRead = new Set<string>();
    for (const scene of chapter.scenes) {
      for (const beats of [scene.beats, ...Object.values(scene.threads)]) {
        walk(beats, (beat) => {
          if (beat.k !== 'set') return;
          beat.flags.forEach((flag) => {
            if (PERMANENT.test(flag)) errors.push(`${tag}#${scene.id}：set「${flag}」是這一輪的狀態，不要用 k_／lead_ 開頭（那是跨輪保留的線索）`);
            flagsSet.add(flag);
            if (!flagSetAt.has(flag)) flagSetAt.set(flag, `${tag}#${scene.id}`);
          });
        });
      }
    }

    const checkRefs = (cond: Parameters<typeof condRefs>[0], where: string) => {
      for (const ref of condRefs(cond)) {
        if (ref.op === 'know') knowRead.add(ref.id);
        if (ref.op === 'flag') flagsRead.add(ref.id);
        if (ref.op === 'know' && !learned.has(ref.id)) errors.push(`${where}：know.${ref.id} 從未被 learn`);
        // A condition can only lean on something the player could already have heard, unless it says it is
        // meant for replaying this day with what a later chapter taught (later.X), and then it must really be later.
        const later = learned.has(ref.id) && firstLearned.get(ref.id)! > orderOf(chapter.key);
        if (ref.op === 'know' && !ref.later && later) errors.push(`${where}：know.${ref.id} 要到後面的章節才學得到（重玩才會知道的，寫 later.${ref.id}）`);
        if (ref.op === 'know' && ref.later && learned.has(ref.id) && !later) errors.push(`${where}：later.${ref.id} 本章以前就學得到，寫 know.${ref.id}`);
        if (ref.op === 'flag' && !flagsSet.has(ref.id)) errors.push(`${where}：flag.${ref.id} 本章從未被 set`);
        if (ref.op === 'seen' && !scenes.has(ref.id)) errors.push(`${where}：seen.${ref.id} 場景不存在`);
        if (ref.op === 'mem' && !memIds.has(ref.id)) errors.push(`${where}：mem.${ref.id} 沒有任何台詞標記這個 mem`);
        if (ref.op === 'mem' && memIds.has(ref.id) && firstMem.get(ref.id)! > orderOf(chapter.key)) errors.push(`${where}：mem.${ref.id} 要到後面的章節才記得到`);
      }
    };
    chapter.advance.forEach((rule, index) => checkRefs(rule.cond, `${tag}.advance[${index}]`));

    let hasEnd = false;
    for (const scene of chapter.scenes) {
      const where = `${tag}#${scene.id}`;
      if (!scene.next && !terminates(scene.beats)) errors.push(`${where}：主線沒有 next，也不保證以 goto/end 結束`);
      for (const target of targets(scene)) {
        if (!local.has(target)) errors.push(`${where}：目標場景「${target}」不在本章`);
      }
      const usedThreads = new Set<string>();
      walk(scene.beats, (beat, depth) => {
        if (beat.k === 'end') hasEnd = true;
        if (beat.k === 'wait' && depth > 0) errors.push(`${where}：wait 只能放在主線最外層`);
        if (beat.k === 'locate') {
          // A sound to find, and the ones in the way: loud enough to hear, never so loud they swamp the room.
          if (beat.gain !== undefined && !locateGainOk(beat.gain)) errors.push(`${where}：locate 的 gain 是 ${LOCATE_GAIN.min} 到 ${LOCATE_GAIN.max}`);
          beat.decoys.forEach((decoy, n) => {
            if (decoy.gain !== undefined && !locateGainOk(decoy.gain)) errors.push(`${where}：locate 的 decoys[${n}].gain 是 ${LOCATE_GAIN.min} 到 ${LOCATE_GAIN.max}`);
          });
        }
        if (beat.k === 'cue') {
          usedThreads.add(beat.thread);
          if (!scene.threads[beat.thread]) errors.push(`${where}：cue 指向不存在的 thread「${beat.thread}」`);
        }
        if (beat.k === 'if') checkRefs(beat.cond, where);
        if (beat.k === 'choice') {
          beat.options.forEach((option) => {
            if (option.cond) checkRefs(option.cond, where);
            if (option.disabledCond) checkRefs(option.disabledCond, where);
          });
          beat.options.forEach((option) => option.recall?.accept.forEach((entry) => {
            if (!memIds.has(entry.mem)) errors.push(`${where}：recall 接受的 ${entry.mem} 沒有任何台詞標記這個 mem`);
            else if (firstMem.get(entry.mem)! > orderOf(chapter.key)) errors.push(`${where}：recall 接受的 ${entry.mem} 要到後面的章節才記得到`);
          }));
          if (beat.timeout !== undefined && beat.timeout < 3) warnings.push(`${where}：choice timeout 太短（${beat.timeout}s）`);
        }
        if (beat.k === 'line' && beat.kind === 'char' && !beat.at && !scene.cast[beat.speaker]) {
          warnings.push(`${where}：${beat.speaker} 沒有在 cast 指定方位（預設前方）`);
        }
        if (beat.k === 'line' && [...beat.text.replace(/\|/g, '')].length > MAX_LINE_CHARS) {
          warnings.push(`${where}：台詞太長（${[...beat.text].length} 字）：${beat.text.slice(0, 20)}…`);
        }
      });
      for (const [name, beats] of Object.entries(scene.threads)) {
        if (!usedThreads.has(name)) errors.push(`${where}：thread「${name}」沒有被 cue`);
        walk(beats, (beat) => {
          if (['choice', 'goto', 'end', 'wait', 'cue', 'amb', 'touch', 'locate', 'approach', 'punch', 'hold'].includes(beat.k)) errors.push(`${where}.threads.${name}：thread 裡不能有 ${beat.k}`);
          if (beat.k === 'if') checkRefs(beat.cond, `${where}.threads.${name}`);
        });
      }
    }
    if (!hasEnd) errors.push(`${tag}：沒有任何 end`);

    // Static reachability: a new game enters at start, later loops and chapter select at restart (when set).
    const flood = (entry: string) => {
      const reached = new Set<string>();
      const queue = [entry];
      while (queue.length) {
        const id = queue.shift()!;
        if (reached.has(id) || !local.has(id)) continue;
        reached.add(id);
        queue.push(...targets(local.get(id)!));
      }
      return reached;
    };
    const entries = [chapter.start, ...(chapter.restart !== undefined && chapter.restart !== chapter.start ? [chapter.restart] : [])];
    const reached = new Set<string>();
    for (const entry of entries) {
      if (!local.has(entry)) continue;
      const fromEntry = flood(entry);
      fromEntry.forEach((id) => reached.add(id));
      const ends = [...fromEntry].some((id) => { let found = false; walk(local.get(id)!.beats, (beat) => { if (beat.k === 'end') found = true; }); return found; });
      if (hasEnd && !ends) errors.push(`${tag}：從 ${entry === chapter.start ? 'start' : 'restart'}「${entry}」走不到任何 end`);
    }
    for (const scene of chapter.scenes) if (!reached.has(scene.id)) errors.push(`${tag}#${scene.id}：從 start${chapter.restart ? '／restart' : ''} 都無法到達`);

    // A choice must always leave her a way out: a shown option that is surely there, or silence on a clock.
    for (const scene of chapter.scenes) {
      if (CHOICE_EXIT_PROVEN_ELSEWHERE.has(scene.id)) continue;
      walkChoices(scene.beats, [], (beat, assume) => {
        if (!choiceHasExit(beat, assume)) {
          const shown = beat.options.filter((option) => !option.recall && !option.silent).map((option) => option.text).join('／');
          warnings.push(`${tag}#${scene.id}：選擇可能卡住：沒有一定會出現、又沒被停用的選項，也沒有 silence＋timeout（${shown}）`);
        }
      });
    }

    // Loop state nobody reads is dead weight: it looks like it matters and changes nothing.
    for (const [flag, where] of flagSetAt) {
      if (!flagsRead.has(flag) && !READ_OUTSIDE_SCRIPT.has(flag)) warnings.push(`${where}：set「${flag}」之後本章沒有任何條件讀它（刪掉 set，或讓它真的改變點什麼）`);
    }
  }

  for (const [id, where] of learnedAt) {
    if (!knowRead.has(id) && !READ_OUTSIDE_SCRIPT.has(id)) warnings.push(`${where}：learn「${id}」從來沒有被 know.／later. 讀過（刪掉 learn，或讓它真的改變點什麼）`);
  }

  return { script, errors, warnings };
}
