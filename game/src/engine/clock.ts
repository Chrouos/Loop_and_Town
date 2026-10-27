import type { Beat, Scene } from '../script/types';

// The corner clock. Scenes, `clock` beats, waits and her phone reading the time out loud pin it;
// in between it creeps forward with the story, never reaching the next time the script names.

/** Story minutes one line (or pause, choice…) may take on the way to the next scene. */
const MINUTES_PER_STEP = 0.5;

/** "HH:MM" → minutes after midnight; anything else ("五年前", "10月2日 22:40") does not drift. */
export function parseClock(value: string | undefined): number | null {
  const match = value ? /^(\d{1,2}):(\d{2})$/.exec(value) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function formatClock(minutes: number): string {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const DIGITS: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 0–99 in Chinese numerals: 十, 十八, 二十三, 五十九, 零三. */
function chineseNumber(text: string): number | null {
  if (!text) return null;
  const ten = text.indexOf('十');
  if (ten < 0) return [...text].reduce<number | null>((sum, ch) => (sum === null || DIGITS[ch] === undefined ? null : sum * 10 + DIGITS[ch]), 0);
  const tens = ten === 0 ? 1 : DIGITS[text.slice(0, ten)];
  const ones = ten === text.length - 1 ? 0 : DIGITS[text.slice(ten + 1)];
  return tens === undefined || ones === undefined ? null : tens * 10 + ones;
}

/** How far ahead of the corner a time her phone says can be and still be the time now, not something it is reading. */
const HEARD_AHEAD_MINUTES = 60;

/**
 * A time read out as nothing but a time: 「十八點三十分。」「十月三日。六點十二分。」「八點。」 → "HH:MM".
 * A message that mentions a time does not count.
 * A 12-hour reading takes whichever half of the day is nearer the clock it interrupts.
 */
export function spokenClock(text: string, current?: string): string | null {
  // What made it speak may come first (鬧鐘。／心率過高，已記錄。); a message (名字：……) never counts.
  const match = /^(?:[^：。]+。)?(?:十月[一二三四五六七八九十]+日[。；])?([零〇一二兩三四五六七八九十]+)點(?:([零〇一二三四五六七八九十]+)分)?。?$/.exec(text.trim());
  if (!match) return null;
  let hour = chineseNumber(match[1]);
  const minute = match[2] ? chineseNumber(match[2]) : 0;
  if (hour === null || minute === null || hour > 23 || minute > 59) return null;
  const now = parseClock(current);
  if (hour < 12 && now !== null && Math.abs(now - (hour + 12) * 60) < Math.abs(now - hour * 60)) hour += 12;
  return formatClock(hour * 60 + minute);
}

/**
 * Her phone telling her the time: a spoken time at or a little after the corner clock.
 * (Reading out a note that says 十八點三十一分 in the morning is not the time.)
 */
export function heardClock(text: string, current: string | undefined): string | null {
  const now = parseClock(current);
  const spoken = spokenClock(text, current);
  const at = parseClock(spoken ?? undefined);
  if (now === null || at === null || at < now || at - now > HEARD_AHEAD_MINUTES) return null;
  return spoken;
}

/** Beats that take story time; bookkeeping (sounds, flags, ambience) does not move the clock. */
function steps(beat: Beat): number {
  switch (beat.k) {
    case 'line': case 'pause': case 'choice': case 'touch': case 'locate': case 'approach': case 'punch': return 1;
    case 'if': return Math.max(stepsOf(beat.then), stepsOf(beat.else)) > 0 ? 1 : 0;
    default: return 0;
  }
}
const stepsOf = (beats: Beat[]) => beats.reduce((sum, beat) => sum + steps(beat), 0);

/** The earliest time anything inside `beat` would pin the clock to (any branch), given the clock `known` before it. */
function pinnedIn(beat: Beat, known: string | undefined): number | null {
  const times: (number | null)[] = [];
  const visit = (b: Beat) => {
    if (b.k === 'clock') times.push(parseClock(b.time));
    else if (b.k === 'wait') times.push(parseClock(b.clock ?? b.until));
    else if (b.k === 'line' && b.kind === 'phone') times.push(parseClock(heardClock(b.text, known) ?? undefined));
    else if (b.k === 'if') [...b.then, ...b.else].forEach(visit);
    else if (b.k === 'choice') b.options.forEach((option) => { option.then.forEach(visit); option.recall?.accept.forEach((a) => a.then.forEach(visit)); option.recall?.miss.forEach(visit); });
    else if (b.k === 'locate') [...b.success, ...b.fail].forEach(visit);
    else if (b.k === 'approach') [...b.hit, ...b.early, ...b.late].forEach(visit);
  };
  visit(beat);
  const found = times.filter((time): time is number => time !== null);
  return found.length ? Math.min(...found) : null;
}

/** Scenes this one can hand over to. */
function exits(scene: Scene): string[] {
  const out = new Set<string>(scene.next ? [scene.next] : []);
  const visit = (b: Beat) => {
    if (b.k === 'goto') out.add(b.scene);
    else if (b.k === 'if') [...b.then, ...b.else].forEach(visit);
    else if (b.k === 'choice') b.options.forEach((option) => { if (option.goto) out.add(option.goto); option.then.forEach(visit); option.recall?.accept.forEach((a) => { if (a.goto) out.add(a.goto); a.then.forEach(visit); }); option.recall?.miss.forEach(visit); });
    else if (b.k === 'locate') [...b.success, ...b.fail].forEach(visit);
    else if (b.k === 'approach') [...b.hit, ...b.early, ...b.late].forEach(visit);
  };
  scene.beats.forEach(visit);
  return [...out];
}

/** When a scene starts: its own time, or a clock it sets before anything happens. */
function startOf(scene: Scene): number | null {
  if (scene.time) return parseClock(scene.time);
  for (const beat of scene.beats) {
    if (beat.k === 'clock') return parseClock(beat.time);
    if (steps(beat) > 0) return null;
  }
  return null;
}

/** Per top-level beat of a scene: how far along it is, and the next time the story will name. */
export type ClockPlan = {
  /** Steps taken once beat i has run. */
  after: number[];
  /** For beat i: the index and time of the next beat (from i+1 on) that pins the clock, or the scene's end. */
  ahead: ({ index: number; at: number; end: boolean } | null)[];
  /** Beat i may pin the clock itself (in some branch): it does not creep, it waits to see. */
  pins: boolean[];
};

export function planClock(scene: Scene, scenes: Map<string, Scene>): ClockPlan {
  const beats = scene.beats;
  const after: number[] = [];
  let total = 0;
  for (const beat of beats) { total += steps(beat); after.push(total); }
  const nextStarts = exits(scene).map((id) => scenes.get(id)).filter((s): s is Scene => Boolean(s)).map(startOf).filter((t): t is number => t !== null);
  const endAt = nextStarts.length ? Math.min(...nextStarts) : null;
  const pinned: (number | null)[] = [];
  let known = scene.time;
  for (const beat of beats) {
    const at = pinnedIn(beat, known);
    pinned.push(at);
    if (at !== null) known = formatClock(at);
  }
  const ahead: ClockPlan['ahead'] = new Array(beats.length).fill(null);
  let next: ClockPlan['ahead'][number] = endAt === null ? null : { index: beats.length, at: endAt, end: true };
  for (let i = beats.length - 1; i >= 0; i -= 1) {
    ahead[i] = next;
    const at = pinned[i];
    if (at !== null) next = { index: i, at, end: false };
  }
  return { after, ahead, pins: pinned.map((at) => at !== null) };
}

/**
 * Where the clock has crept to after top-level beat `index`, starting from `from` at step `fromStep`.
 * Toward a pinned time it walks evenly; toward the next scene it walks at most MINUTES_PER_STEP a step.
 * Either way it stays at least a minute short, so the pinned time is still news when it comes.
 */
export function driftClock(plan: ClockPlan, index: number, from: string | undefined, fromStep: number, shown?: string): string | undefined {
  const start = parseClock(from);
  if (plan.pins[index]) return undefined;
  const target = plan.ahead[index];
  if (start === null || !target || target.at - start < 2) return undefined;
  const walked = plan.after[index] - fromStep;
  const span = (target.index >= plan.after.length ? plan.after[plan.after.length - 1] ?? 0 : plan.after[target.index - 1] ?? 0) - fromStep;
  if (walked <= 0 || span <= 0) return undefined;
  const even = (target.at - start) * Math.min(1, walked / (span + 1));
  const minutes = target.end ? Math.min(even, walked * MINUTES_PER_STEP) : even;
  const at = Math.min(start + Math.floor(minutes), target.at - 1);
  // A branch that was not taken can leave a nearer target behind; creeping never walks back.
  const now = parseClock(shown) ?? start;
  return at > now ? formatClock(at) : undefined;
}
