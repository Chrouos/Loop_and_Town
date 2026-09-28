import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TYPEWRITER_TIMING,
  isTypewriterComplete,
  nextRevealDelay,
} from '../src/playerNarrative/typewriter';

describe('player narrative typewriter timing', () => {
  it('uses the character delay for an ordinary CJK character', () => {
    expect(nextRevealDelay('八點', 0)).toBe(DEFAULT_TYPEWRITER_TIMING.characterMs);
  });

  it('adds the comma pause after a comma-like punctuation mark', () => {
    expect(nextRevealDelay('八點，', 2, {
      characterMs: 40,
      commaPauseMs: 100,
      terminalPauseMs: 220,
    })).toBe(140);
  });

  it('adds the terminal pause after terminal punctuation', () => {
    expect(nextRevealDelay('沒事。', 2, {
      characterMs: 40,
      commaPauseMs: 100,
      terminalPauseMs: 220,
    })).toBe(260);
  });

  it('returns no delay for an empty or out-of-range reveal', () => {
    expect(nextRevealDelay('', 0)).toBe(0);
    expect(nextRevealDelay('短句', 2)).toBe(0);
  });

  it('is complete only after every character is revealed', () => {
    expect(isTypewriterComplete('短句', 1)).toBe(false);
    expect(isTypewriterComplete('短句', 2)).toBe(true);
    expect(isTypewriterComplete('', 0)).toBe(true);
  });
});
