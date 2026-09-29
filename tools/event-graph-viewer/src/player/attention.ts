import type { AttentionState } from './model';

export const ATTENTION_SHIFT_MS = 650;
export const ATTENTION_OBSERVATION_MS = 900;

export type AttentionAdvance = {
  state: AttentionState;
  completedTargetId?: string;
};

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

export function redirectAttention(
  current: AttentionState,
  targetId: string,
  nowMs: number,
): AttentionState {
  return beginAttention(current.primaryTargetId, targetId, nowMs);
}

export function advanceAttention(state: AttentionState, nowMs: number): AttentionAdvance {
  if (state.phase === 'idle' || !state.targetId) return { state: { phase: 'idle' } };

  const shiftEndsAtMs = state.shiftEndsAtMs ?? ((state.startedAtMs ?? nowMs) + ATTENTION_SHIFT_MS);
  const observationEndsAtMs = state.observationEndsAtMs ?? (shiftEndsAtMs + ATTENTION_OBSERVATION_MS);

  if (nowMs < shiftEndsAtMs) return { state };

  if (nowMs < observationEndsAtMs) {
    return {
      state: {
        ...state,
        phase: 'observing',
        shiftEndsAtMs,
        observationEndsAtMs,
      },
    };
  }

  return {
    state: { phase: 'idle' },
    completedTargetId: state.targetId,
  };
}
