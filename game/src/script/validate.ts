import { condRefs } from './conditions';
import { parseChapter } from './parse';
import { CHAPTER_ORDER, type Beat, type Chapter, type ChoiceOption, type GameScript, type Scene } from './types';

export type ScriptReport = { script: GameScript; errors: string[]; warnings: string[] };

const MAX_LINE_CHARS = 48;

function walk(beats: Beat[], visit: (beat: Beat, depth: number) => void, depth = 0) {
  for (const beat of beats) {
    visit(beat, depth);
    if (beat.k === 'if') { walk(beat.then, visit, depth + 1); walk(beat.else, visit, depth + 1); }
    if (beat.k === 'locate') { walk(beat.success, visit, depth + 1); walk(beat.fail, visit, depth + 1); }
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
    if (beat.k === 'locate' && terminates(beat.success) && terminates(beat.fail)) return true;
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
  const memIds = new Set<string>();
  // Earliest chapter (play order) in which each knowledge id can be learned.
  const firstLearned = new Map<string, number>();
  const firstMem = new Map<string, number>();
  const orderOf = (key: string) => CHAPTER_ORDER.indexOf(key as never);
  for (const scene of scenes.values()) {
    const all = [scene.beats, ...Object.values(scene.threads)];
    const note = (id: string) => {
      learned.add(id);
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
    for (const scene of chapter.scenes) {
      for (const beats of [scene.beats, ...Object.values(scene.threads)]) {
        walk(beats, (beat) => { if (beat.k === 'set') beat.flags.forEach((flag) => flagsSet.add(flag)); });
      }
    }

    const checkRefs = (cond: Parameters<typeof condRefs>[0], where: string) => {
      for (const ref of condRefs(cond)) {
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
          if (['choice', 'goto', 'end', 'wait', 'cue', 'amb', 'touch', 'locate', 'approach', 'punch'].includes(beat.k)) errors.push(`${where}.threads.${name}：thread 裡不能有 ${beat.k}`);
          if (beat.k === 'if') checkRefs(beat.cond, `${where}.threads.${name}`);
        });
      }
    }
    if (!hasEnd) errors.push(`${tag}：沒有任何 end`);

    // Static reachability from start.
    const reached = new Set<string>();
    const queue = [chapter.start];
    while (queue.length) {
      const id = queue.shift()!;
      if (reached.has(id) || !local.has(id)) continue;
      reached.add(id);
      queue.push(...targets(local.get(id)!));
    }
    for (const scene of chapter.scenes) if (!reached.has(scene.id)) errors.push(`${tag}#${scene.id}：從 start 無法到達`);
  }

  return { script, errors, warnings };
}
