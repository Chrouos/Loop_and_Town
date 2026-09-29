import type { AttentionState } from './model';

export const ATTENTION_SHIFT_MS = 650;

export function beginAttention(
  primaryTargetId: string | undefined,
  targetId: string,
  nowMs: number,
): AttentionState {
  return {
    phase: 'shifting',
    primaryTargetId,
    targetId,
    startedAtMs: nowMs,
    shiftEndsAtMs: nowMs + ATTENTION_SHIFT_MS,
  };
}
