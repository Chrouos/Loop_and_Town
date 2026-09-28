export type TypewriterTiming = {
  characterMs: number;
  commaPauseMs: number;
  terminalPauseMs: number;
};

export const DEFAULT_TYPEWRITER_TIMING: TypewriterTiming = {
  characterMs: 38,
  commaPauseMs: 100,
  terminalPauseMs: 220,
};

const COMMA_PUNCTUATION = new Set(['，', '、', ',']);
const TERMINAL_PUNCTUATION = new Set(['。', '！', '？', '!', '?', '……', '…']);

export function nextRevealDelay(
  text: string,
  index: number,
  timing: TypewriterTiming = DEFAULT_TYPEWRITER_TIMING,
): number {
  if (index < 0 || index >= text.length) return 0;

  const character = text[index];
  if (TERMINAL_PUNCTUATION.has(character)) return timing.characterMs + timing.terminalPauseMs;
  if (COMMA_PUNCTUATION.has(character)) return timing.characterMs + timing.commaPauseMs;
  return timing.characterMs;
}

export function isTypewriterComplete(text: string, revealedCharacters: number): boolean {
  return revealedCharacters >= text.length;
}
