import type { LineKind } from '../script/types';

export type TextSpeed = 'slow' | 'normal' | 'fast';
/** `br`: start a new row after this phrase (a sentence ended inside narration or thought). */
export type Phrase = { text: string; at: number; br?: boolean };
export type LineTiming = { phrases: Phrase[]; revealMs: number; holdMs: number };

const CHAR_MS: Record<TextSpeed, number> = { slow: 105, normal: 72, fast: 42 };
const HOLD_SCALE: Record<TextSpeed, number> = { slow: 1.35, normal: 1, fast: 0.7 };
const FULL_SPACE = '　';

function pauseAfter(mark: string): number {
  if (mark === '|') return 460;
  if (mark.includes('…')) return 520;
  if (mark.includes('—')) return 320;
  if (/[。！？]/.test(mark)) return 360;
  if (/[，、；：]/.test(mark)) return 200;
  return 0;
}

type Part = { text: string; pause: number; br: boolean };

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
    const pause = pauseAfter(marks);
    const last = raw.slice(index + 1).every((rest) => !(rest.body + rest.marks).replace(/[|」』）》\s]/g, ''));
    const core = marks.replace(/[|」』）》]/g, '');
    const stop = core.endsWith('。') && !core.includes('…');
    const sentence = stop || /[！？]$/.test(core);
    let shown = (body + (stop ? marks.replace(/。(?=[|」』）》]*$)/, '') : marks).replace(/\|/g, '')).trim();
    const br = rows && sentence && !last;
    if (stop && !rows && !last && shown) shown += FULL_SPACE;
    if (shown) parts.push({ text: shown, pause, br });
    else if (parts.length && marks) { parts[parts.length - 1].pause += pause; parts[parts.length - 1].br ||= br; }
  });
  // Very short fragments read better merged with the following phrase.
  const merged: Part[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (prev && !prev.br && [...prev.text.trim()].length <= 1 && prev.pause < 400) { prev.text += part.text; prev.pause = part.pause; prev.br = part.br; }
    else merged.push({ ...part });
  }
  if (!merged.length) return [{ text: text.replace(/\|/g, ''), pause: 0 }];
  return merged.map(({ text: shown, pause, br }) => (br ? { text: shown, pause, br } : { text: shown, pause }));
}

export function lineTiming(text: string, kind: LineKind, speed: TextSpeed): LineTiming {
  const charMs = CHAR_MS[speed] * (kind === 'think' ? 1.1 : kind === 'phone' ? 0.9 : 1);
  const phrases: Phrase[] = [];
  let at = 0;
  for (const part of splitPhrases(text, kind)) {
    phrases.push(part.br ? { text: part.text, at, br: true } : { text: part.text, at });
    at += [...part.text].length * charMs + part.pause;
  }
  const chars = [...text.replace(/\|/g, '')].length;
  const revealMs = Math.max(380, at - (phrases.length ? 0 : 0));
  const holdMs = (1000 + chars * 38 + (kind === 'think' ? 300 : 0)) * HOLD_SCALE[speed];
  return { phrases, revealMs, holdMs };
}
