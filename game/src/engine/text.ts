import type { LineKind } from '../script/types';

/** 'instant': the whole line is on screen at once; it still stays up as long as reading it at 'fast' takes. */
export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant';
export const TEXT_SPEEDS: TextSpeed[] = ['slow', 'normal', 'fast', 'instant'];
/** `br`: start a new row after this phrase (a sentence ended inside narration or thought). */
export type Phrase = { text: string; at: number; br?: boolean };
export type LineTiming = { phrases: Phrase[]; revealMs: number; holdMs: number };

const CHAR_MS: Record<Exclude<TextSpeed, 'instant'>, number> = { slow: 105, normal: 72, fast: 42 };
const HOLD_SCALE: Record<Exclude<TextSpeed, 'instant'>, number> = { slow: 1.35, normal: 1, fast: 0.7 };
/** Reading a choice's options takes longer than hearing a line: about twice the reveal pace, per character. */
const READ_MS: Record<TextSpeed, number> = { slow: 210, normal: 144, fast: 84, instant: 84 };
const FULL_SPACE = '　';

/** A sentence ended inside narration or thought: the next one comes in on its own row, which already sets it apart,
 *  so it follows sooner than after a full stop in speech. A written beat (| or …) still keeps its own pause. */
const NEW_ROW_PAUSE = 400;

function pauseAfter(mark: string): number {
  if (mark === '|') return 760;
  if (mark.includes('…')) return 760;
  if (mark.includes('—')) return 420;
  if (/[。！？]/.test(mark)) return 800;
  if (/[，、；：]/.test(mark)) return 500;
  return 0;
}

/** `beat`: ends on a written beat (| or …), which a short fragment never merges across. */
type Part = { text: string; pause: number; br: boolean; beat?: boolean };

// Split at punctuation so each phrase can surface on its own beat (Rhythmic Text, core spec §12).
// On the black stage the line itself is the sentence, so full stops are not drawn: one that ends the line
// is dropped, one inside narration or thought becomes a new row, one inside speech becomes a breath (a
// full-width space, as in subtitles). ？！ keep their mark since they carry tone. The script keeps every 。
// and the screen-reader text is the raw line.
export function splitPhrases(text: string, kind: LineKind = 'char'): { text: string; pause: number; br?: boolean }[] {
  const rows = kind === 'narr' || kind === 'think';
  const raw: { body: string; marks: string }[] = [];
  const pattern = /([^，。！？；：、…—|]*)((?:[，。！？；：、…—|]+[」』）》]*)*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[0] === '') { pattern.lastIndex += 1; if (pattern.lastIndex > text.length) break; continue; }
    raw.push({ body: match[1], marks: match[2] });
  }
  const parts: Part[] = [];
  raw.forEach(({ body, marks }, index) => {
    const last = raw.slice(index + 1).every((rest) => !(rest.body + rest.marks).replace(/[|」』）》\s]/g, ''));
    const core = marks.replace(/[|」』）》]/g, '');
    const stop = core.endsWith('。') && !core.includes('…');
    const sentence = stop || /[！？]$/.test(core);
    let shown = (body + (stop ? marks.replace(/。(?=[|」』）》]*$)/, '') : marks).replace(/\|/g, '')).trim();
    const br = rows && sentence && !last;
    if (stop && !rows && !last && shown) shown += FULL_SPACE;
    const beat = /[|…]/.test(marks);
    const pause = br && !beat ? NEW_ROW_PAUSE : pauseAfter(marks);
    if (shown) parts.push({ text: shown, pause, br, beat });
    else if (parts.length && marks) { const prev = parts[parts.length - 1]; prev.pause += pause; prev.br ||= br; prev.beat ||= beat; }
  });
  // Very short fragments read better merged with the following phrase (not across a written beat: | or …).
  const merged: Part[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (prev && !prev.br && !prev.beat && [...prev.text.trim()].length <= 1) { prev.text += part.text; prev.pause = part.pause; prev.br = part.br; prev.beat = part.beat; }
    else merged.push({ ...part });
  }
  if (!merged.length) return [{ text: text.replace(/\|/g, ''), pause: 0 }];
  return merged.map(({ text: shown, pause, br }) => (br ? { text: shown, pause, br } : { text: shown, pause }));
}

/** Marks that may never begin a row (a line that wraps before a 「，」 leaves it dangling at the left edge). */
const NO_ROW_START = /[，。、；：！？…—」』）》〉】]/u;

/**
 * A phrase cut into pieces for the screen: each run of closing marks is glued to the character before it
 * (`glue`, drawn in a white-space:nowrap span), so the row breaks before that character, never between it
 * and its 「，」. Joined back together the pieces are the phrase unchanged.
 */
export function gluePunctuation(text: string): { text: string; glue?: true }[] {
  const chars = [...text];
  const out: { text: string; glue?: true }[] = [];
  let plain = '';
  let i = 0;
  while (i < chars.length) {
    if (i + 1 < chars.length && NO_ROW_START.test(chars[i + 1]) && !/\s/u.test(chars[i])) {
      let end = i + 1;
      while (end < chars.length && NO_ROW_START.test(chars[end])) end += 1;
      if (plain) { out.push({ text: plain }); plain = ''; }
      out.push({ text: chars.slice(i, end).join(''), glue: true });
      i = end;
    } else {
      plain += chars[i];
      i += 1;
    }
  }
  if (plain) out.push({ text: plain });
  return out;
}

export function lineTiming(text: string, kind: LineKind, speed: TextSpeed): LineTiming {
  if (speed === 'instant') {
    // Shown whole; the time it would have taken to come in at 'fast' is added to how long it stays.
    const fast = lineTiming(text, kind, 'fast');
    return { phrases: fast.phrases.map((phrase) => ({ ...phrase, at: 0 })), revealMs: 0, holdMs: fast.revealMs + fast.holdMs };
  }
  const charMs = CHAR_MS[speed] * (kind === 'think' ? 1.1 : kind === 'phone' ? 0.9 : 1);
  const phrases: Phrase[] = [];
  let at = 0;
  for (const part of splitPhrases(text, kind)) {
    phrases.push(part.br ? { text: part.text, at, br: true } : { text: part.text, at });
    at += [...part.text].length * charMs + part.pause;
  }
  const chars = [...text.replace(/\|/g, '')].length;
  const revealMs = Math.max(380, at - (phrases.length ? 0 : 0));
  const holdMs = (1300 + chars * 46 + (kind === 'think' ? 300 : 0)) * HOLD_SCALE[speed];
  return { phrases, revealMs, holdMs };
}

/** How long reading every option of a choice takes at this text speed (a timed choice never runs out sooner). */
export function readingMs(texts: string[], speed: TextSpeed): number {
  const chars = texts.reduce((sum, text) => sum + [...text.replace(/[|「」（）]/g, '')].length, 0);
  return chars * READ_MS[speed] + texts.length * 400 + 1500;
}

/** A line heard on an earlier loop, with 聽過的話自動放快 on: it comes and goes at this fraction of its time. */
export const HEARD_SCALE = 0.35;
export function scaleTiming(timing: LineTiming, scale: number): LineTiming {
  return { phrases: timing.phrases.map((phrase) => ({ ...phrase, at: phrase.at * scale })), revealMs: timing.revealMs * scale, holdMs: timing.holdMs * scale };
}

/** Skimming a line read before: per character, on top of a short look (SKIM_BASE_MS). */
const SKIM_MS: Record<TextSpeed, number> = { slow: 95, normal: 70, fast: 45, instant: 45 };
const SKIM_BASE_MS = 600;
/** A line heard before comes in at HEARD_SCALE, but stays long enough to skim, however long it is: scaling the hold
 *  too would leave a long line on screen for less time than it takes to read it. Never longer than the first time. */
export function heardTiming(timing: LineTiming, text: string, speed: TextSpeed): LineTiming {
  const fast = scaleTiming(timing, HEARD_SCALE);
  const chars = [...text.replace(/\|/g, '')].length;
  const skim = SKIM_BASE_MS + chars * SKIM_MS[speed];
  return { ...fast, holdMs: Math.min(timing.holdMs, Math.max(fast.holdMs, skim)) };
}

/** When her phone's reader clip is talking: [first word, end of the last, [quiet spots between words]] in seconds. */
export type SpeechTimes = readonly [number, number, readonly number[]];
/** How far a phrase's estimated start may move to land on a quiet spot in the voice. */
const SNAP_S = 0.2;
/** A phrase surfaces out of a blur (.lt-phrase, 620 ms): it starts this much ahead so it is legible as it is said. */
const LEAD_MS = 150;

/**
 * Her phone's line as its reader says it: each phrase comes in when the voice gets to it, and the line is all in
 * when the voice is done. Where a phrase starts is guessed from how much was said before it (a mark counts for a
 * short pause), then moved onto the nearest quiet spot between words, and starts its fade a moment early (LEAD_MS).
 * How long it then stays is unchanged.
 */
export function voicedTiming(timing: LineTiming, [start, end, gaps]: SpeechTimes): LineTiming {
  const weight = (text: string) => [...text].reduce((sum, ch) => sum + (/[\p{L}\p{N}]/u.test(ch) ? 1 : /[\p{P}\s]/u.test(ch) ? 0.6 : 0), 0);
  const total = timing.phrases.reduce((sum, phrase) => sum + weight(phrase.text), 0) || 1;
  let said = 0;
  let last = 0;
  const phrases = timing.phrases.map((phrase) => {
    let at = start + ((end - start) * said) / total;
    const near = said > 0 ? gaps.reduce<number | undefined>((best, gap) => (Math.abs(gap - at) <= SNAP_S && (best === undefined || Math.abs(gap - at) < Math.abs(best - at)) ? gap : best), undefined) : undefined;
    if (near !== undefined) at = near;
    said += weight(phrase.text);
    last = Math.max(last, Math.round(at * 1000) - LEAD_MS, 0);
    return { ...phrase, at: last };
  });
  return { phrases, revealMs: Math.max(last, Math.round(end * 1000)), holdMs: timing.holdMs };
}
