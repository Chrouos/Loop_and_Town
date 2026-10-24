import type { LineKind } from '../script/types';

export type TextSpeed = 'slow' | 'normal' | 'fast';
export type Phrase = { text: string; at: number };
export type LineTiming = { phrases: Phrase[]; revealMs: number; holdMs: number };

const CHAR_MS: Record<TextSpeed, number> = { slow: 105, normal: 72, fast: 42 };
const HOLD_SCALE: Record<TextSpeed, number> = { slow: 1.35, normal: 1, fast: 0.7 };

function pauseAfter(mark: string): number {
  if (mark === '|') return 460;
  if (mark.includes('…')) return 520;
  if (mark.includes('—')) return 320;
  if (/[。！？]/.test(mark)) return 360;
  if (/[，、；：]/.test(mark)) return 200;
  return 0;
}

// Split at punctuation so each phrase can surface on its own beat (Rhythmic Text, core spec §12).
export function splitPhrases(text: string): { text: string; pause: number }[] {
  const parts: { text: string; pause: number }[] = [];
  const pattern = /([^，。！？；：、…—|]*)([，。！？；：、…—|]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[0] === '') { pattern.lastIndex += 1; if (pattern.lastIndex > text.length) break; continue; }
    const body = match[1];
    const marks = match[2];
    const visible = (body + marks.replace(/\|/g, '')).trim();
    if (visible) parts.push({ text: visible, pause: pauseAfter(marks) });
    else if (parts.length && marks) parts[parts.length - 1].pause += pauseAfter(marks);
  }
  // Very short fragments read better merged with the following phrase.
  const merged: { text: string; pause: number }[] = [];
  for (const part of parts) {
    const last = merged[merged.length - 1];
    if (last && [...last.text].length <= 1 && last.pause < 400) { last.text += part.text; last.pause = part.pause; }
    else merged.push({ ...part });
  }
  return merged.length ? merged : [{ text: text.replace(/\|/g, ''), pause: 0 }];
}

export function lineTiming(text: string, kind: LineKind, speed: TextSpeed): LineTiming {
  const charMs = CHAR_MS[speed] * (kind === 'think' ? 1.1 : kind === 'phone' ? 0.9 : 1);
  const phrases: Phrase[] = [];
  let at = 0;
  for (const part of splitPhrases(text)) {
    phrases.push({ text: part.text, at });
    at += [...part.text].length * charMs + part.pause;
  }
  const chars = [...text.replace(/\|/g, '')].length;
  const revealMs = Math.max(380, at - (phrases.length ? 0 : 0));
  const holdMs = (1000 + chars * 38 + (kind === 'think' ? 300 : 0)) * HOLD_SCALE[speed];
  return { phrases, revealMs, holdMs };
}
