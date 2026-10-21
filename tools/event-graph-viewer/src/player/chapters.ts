import type { PlayerSave } from './model';

export type ChapterId = number | 'final';

/** Unlock checks read only what the player obtained in the finished loop, never Author world history. */
export type ChapterCondition =
  | { revealed: string }
  | { captured: string }
  | { always: true };

export type ChapterRule = {
  chapter: ChapterId;
  next: ChapterId;
  any?: ChapterCondition[];
  all?: ChapterCondition[];
};

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export function isChapterId(value: unknown): value is ChapterId {
  return value === 'final' || (typeof value === 'number' && Number.isInteger(value) && value >= 1);
}

function parseCondition(value: unknown): ChapterCondition {
  if (record(value) && typeof value.revealed === 'string') return { revealed: value.revealed };
  if (record(value) && typeof value.captured === 'string') return { captured: value.captured };
  if (record(value) && value.always === true) return { always: true };
  throw new Error(`Invalid chapter unlock condition: ${JSON.stringify(value)}`);
}

export function parseChapterProgression(value: unknown): ChapterRule[] {
  const chapters = record(value) && Array.isArray(value.chapters) ? value.chapters : undefined;
  if (!chapters) throw new Error('Invalid chapter progression: missing chapters');
  return chapters.map((item) => {
    if (!record(item) || !isChapterId(item.chapter) || !isChapterId(item.next)) throw new Error('Invalid chapter progression rule');
    const unlock = record(item.unlock) ? item.unlock : {};
    const any = Array.isArray(unlock.any) ? unlock.any.map(parseCondition) : undefined;
    const all = Array.isArray(unlock.all) ? unlock.all.map(parseCondition) : undefined;
    if (!any && !all) throw new Error(`Chapter ${String(item.chapter)} has no unlock condition`);
    return { chapter: item.chapter, next: item.next, any, all };
  });
}

/** Saves from before chapter progression played the chapter matching the loop number. */
export function chapterOf(save: PlayerSave, loop: number): ChapterId {
  return save.loops[loop]?.chapterId ?? loop;
}

function conditionMet(save: PlayerSave, loop: number, condition: ChapterCondition): boolean {
  if ('always' in condition) return true;
  if ('revealed' in condition) return save.loops[loop]?.revealedIds.includes(`${loop}:${condition.revealed}`) ?? false;
  return save.knowledge.memories.some(memory => memory.sourceLoop === loop && memory.sourceSceneId === condition.captured);
}

/** Chapter for the loop after `finishedLoop`: advance when the rule is met, otherwise replay the same chapter. */
export function nextChapter(save: PlayerSave, finishedLoop: number, rules: ChapterRule[]): ChapterId {
  const current = chapterOf(save, finishedLoop);
  const rule = rules.find(item => item.chapter === current);
  if (!rule) return current;
  const anyMet = rule.any ? rule.any.some(condition => conditionMet(save, finishedLoop, condition)) : true;
  const allMet = rule.all ? rule.all.every(condition => conditionMet(save, finishedLoop, condition)) : true;
  return anyMet && allMet ? rule.next : current;
}
