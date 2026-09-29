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
  observationMs = ATTENTION_OBSERVATION_MS,
): AttentionState {
  const shiftEndsAtMs = nowMs + ATTENTION_SHIFT_MS;
  return {
    phase: 'shifting',
    primaryTargetId,
    targetId,
    startedAtMs: nowMs,
    shiftEndsAtMs,
    observationEndsAtMs: shiftEndsAtMs + Math.max(1, observationMs),
  };
}

export function redirectAttention(
  current: AttentionState,
  targetId: string,
  nowMs: number,
  observationMs = ATTENTION_OBSERVATION_MS,
): AttentionState {
  return beginAttention(current.primaryTargetId, targetId, nowMs, observationMs);
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
