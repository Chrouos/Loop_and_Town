import { presentation } from '../presentation.config';
import type { LineKind } from '../script/types';

/**
 * How fast a line types in: characters per second (the settings slider, TEXT_CPS_MIN..TEXT_CPS_MAX), or 'instant':
 * the whole line is on screen at once, and it still stays up as long as reading it at INSTANT_READ_CPS takes.
 */
export type TextSpeed = number | 'instant';
export const TEXT_CPS_MIN = presentation.reading.minSpeed;
export const TEXT_CPS_MAX = presentation.reading.maxSpeed;
/** A scene's `pace:` may take the speed past the slider's ends, but never below this or above PACED_CPS_MAX. */
const PACED_CPS_MIN = presentation.reading.pacedMinSpeed;
const PACED_CPS_MAX = presentation.reading.pacedMaxSpeed;
/** A line shown whole stays up as long as typing it in at this many characters per second would have taken. */
export const INSTANT_READ_CPS = presentation.reading.instantReadSpeed;
/** `br`: start a new row after this phrase (a sentence ended inside the line; not on the phone). */
export type Phrase = { text: string; at: number; br?: boolean; charMs?: number };
export type LineTiming = { phrases: Phrase[]; revealMs: number; holdMs: number };

/** Milliseconds per character; 'instant' reads at INSTANT_READ_CPS. */
function charMsOf(speed: TextSpeed): number {
  const cps = speed === 'instant' ? INSTANT_READ_CPS : speed;
  return 1000 / Math.max(PACED_CPS_MIN, Math.min(PACED_CPS_MAX, Number.isFinite(cps) ? cps : INSTANT_READ_CPS));
}

/** The player's speed with a scene's `pace:` added (characters per second); 'instant' stays instant. */
export function pacedSpeed(speed: TextSpeed, pace: number): TextSpeed {
  if (speed === 'instant' || !pace) return speed;
  return Math.max(PACED_CPS_MIN, Math.min(PACED_CPS_MAX, speed + pace));
}

/** How far a scene's `pace:` stretches the pauses between phrases (commas, …, a new row), not only the characters:
 *  the breaks are most of a line's time, so typing faster alone barely shows. 1 at her own speed; under 1 is faster. */
const PACE_BREATH_MIN = 0.4;
const PACE_BREATH_MAX = 2.5;
export function paceBreath(speed: TextSpeed, pace: number): number {
  if (speed === 'instant' || !pace) return 1;
  const paced = pacedSpeed(speed, pace) as number;
  return Math.max(PACE_BREATH_MIN, Math.min(PACE_BREATH_MAX, speed / paced));
}

const FULL_SPACE = '　';

/** Every new row waits this long after the last character before it, whatever the mark there (。！？… or |): a
 *  sentence ended inside narration or thought, and a line's last character before the next line comes in. The line
 *  was read as it typed in, and it stays above as an echo; a comma, which keeps to its row, keeps its own pause. */
const { pauseMs } = presentation.reading;
export const NEW_ROW_PAUSE = pauseMs.newRow;

function pauseAfter(mark: string): number {
  if (mark === '|' || mark.includes('…')) return pauseMs.writtenBeat;
  if (mark.includes('—')) return pauseMs.dash;
  if (/[。！？]/.test(mark)) return pauseMs.sentence;
  if (mark.includes('，')) return pauseMs.comma;
  if (/[、；：]/.test(mark)) return pauseMs.list;
  return 0;
}

/** `beat`: ends on a written beat (| or …), which a short fragment never merges across. */
type Part = { text: string; pause: number; br: boolean; beat?: boolean };

// Split at punctuation so each phrase can surface on its own beat (Rhythmic Text, core spec §12).
// On the black stage the line itself is the sentence, so full stops are not drawn: one that ends the line
// is dropped, one inside narration, thought or speech becomes a new row, one inside a phone line becomes a
// breath (a full-width space: its readouts come in short bits that would stack into a column). ？！ keep their
// mark since they carry tone. The script keeps every 。 and the screen-reader text is the raw line.
export function splitPhrases(text: string, kind: LineKind = 'char'): { text: string; pause: number; br?: boolean }[] {
  const rows = kind !== 'phone';
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
    const pause = br ? NEW_ROW_PAUSE : pauseAfter(marks);
    if (shown) parts.push({ text: shown, pause, br, beat });
    else if (parts.length && marks) {
      const prev = parts[parts.length - 1];
      prev.br ||= br;
      prev.pause = prev.br ? NEW_ROW_PAUSE : prev.pause + pause;
      prev.beat ||= beat;
    }
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

const MIN_REVEAL_MS = 380;
const THOUGHT_CHAR_MS_SCALE = 1.1;
const PHONE_CHAR_MS_SCALE = 0.9;

/** `breath`: the pauses between phrases and before the next line, scaled with a scene's pace (paceBreath). */
export function lineTiming(text: string, kind: LineKind, speed: TextSpeed, breath = 1): LineTiming {
  if (speed === 'instant') {
    // Shown whole; the time it would have taken to type in is added to how long it stays.
    const fast = lineTiming(text, kind, INSTANT_READ_CPS);
    return { phrases: fast.phrases.map((phrase) => ({ ...phrase, at: 0 })), revealMs: 0, holdMs: fast.revealMs + fast.holdMs };
  }
  const charMsScale = kind === 'think' ? THOUGHT_CHAR_MS_SCALE : kind === 'phone' ? PHONE_CHAR_MS_SCALE : 1;
  const charMs = charMsOf(speed) * charMsScale;
  const phrases: Phrase[] = [];
  let at = 0;
  let typed = 0;
  for (const part of splitPhrases(text, kind)) {
    phrases.push({ text: part.text, at, charMs, ...(part.br && { br: true }) });
    typed = at + [...part.text].length * charMs;
    at = typed + part.pause * breath;
  }
  // Done when the last character is in; the next line follows NEW_ROW_PAUSE later, whatever mark this one ends on.
  return { phrases, revealMs: Math.max(MIN_REVEAL_MS, typed), holdMs: NEW_ROW_PAUSE * breath };
}

const TALK_BASE_HOLD_MS = 1300;
const TALK_HOLD_MS_PER_CHAR = 46;
const THOUGHT_EXTRA_HOLD_MS = 300;

/**
 * How long a line someone is saying off to the side lasts once its words are out, while she is not listening to it:
 * the time it takes to say, so a conversation in another direction goes on long enough for her to turn toward it.
 */
export function talkHoldMs(text: string, kind: LineKind): number {
  const chars = [...text.replace(/\|/g, '')].length;
  return TALK_BASE_HOLD_MS + chars * TALK_HOLD_MS_PER_CHAR + (kind === 'think' ? THOUGHT_EXTRA_HOLD_MS : 0);
}

const CHOICE_CHAR_MS_SCALE = 2;
const CHOICE_MS_PER_OPTION = 400;
const CHOICE_BASE_READ_MS = 1500;

/** How long reading every option of a choice takes at this text speed (a timed choice never runs out sooner). */
export function readingMs(texts: string[], speed: TextSpeed): number {
  const chars = texts.reduce((sum, text) => sum + [...text.replace(/[|「」（）]/g, '')].length, 0);
  const charMs = charMsOf(speed) * CHOICE_CHAR_MS_SCALE;
  return chars * charMs + texts.length * CHOICE_MS_PER_OPTION + CHOICE_BASE_READ_MS;
}

/** A line heard on an earlier loop, with 聽過的話自動放快 on: it comes and goes at this fraction of its time. */
export const HEARD_SCALE = presentation.reading.heardLineTimeScale;
export function scaleTiming(timing: LineTiming, scale: number): LineTiming {
  return { phrases: timing.phrases.map((phrase) => ({ ...phrase, at: phrase.at * scale, charMs: (phrase.charMs ?? 0) * scale })), revealMs: timing.revealMs * scale, holdMs: timing.holdMs * scale };
}

const SKIM_BASE_MS = 600;
const SKIM_CHAR_MS_SCALE = 0.79;
const SKIM_EXTRA_MS_PER_CHAR = 12;

/** A line heard before comes in at HEARD_SCALE, but stays long enough to skim, however long it is: scaling the hold
 *  too would leave a long line on screen for less time than it takes to read it. Never longer than the first time. */
export function heardTiming(timing: LineTiming, text: string, speed: TextSpeed): LineTiming {
  const fast = scaleTiming(timing, HEARD_SCALE);
  const chars = [...text.replace(/\|/g, '')].length;
  const charMs = charMsOf(speed) * SKIM_CHAR_MS_SCALE + SKIM_EXTRA_MS_PER_CHAR;
  const skim = SKIM_BASE_MS + chars * charMs;
  return { ...fast, holdMs: Math.min(timing.holdMs, Math.max(fast.holdMs, skim)) };
}

/** When her phone's reader clip is talking: [first word, end of the last, [quiet spots between words]] in seconds. */
export type SpeechTimes = readonly [number, number, readonly number[]];
/** How far a phrase's estimated start may move to land on a quiet spot in the voice. */
const SNAP_S = 0.2;
/** A phrase starts typing in this much ahead so it is legible as it is said. */
const LEAD_MS = 150;

/**
 * Her phone's line as its reader says it: each phrase comes in when the voice gets to it, and the line is all in
 * when the voice is done. Where a phrase starts is guessed from how much was said before it (a mark counts for a
 * short pause), then moved onto the nearest quiet spot between words, and starts a moment early (LEAD_MS).
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
  const revealMs = Math.max(last, Math.round(end * 1000));
  // Each phrase types out over the stretch of voice that says it, never slower than it would type on its own.
  const typed = phrases.map((phrase, i) => {
    if (!phrase.charMs) return phrase;
    const span = (i + 1 < phrases.length ? phrases[i + 1].at : revealMs) - phrase.at;
    return { ...phrase, charMs: Math.max(1, Math.min(phrase.charMs, span / [...phrase.text].length)) };
  });
  return { phrases: typed, revealMs, holdMs: timing.holdMs };
}
