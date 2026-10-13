import { getCorrectionSession, initialCorrectionSession } from './correctionSession';
import { cloneValue } from './state';
import type { WorldState } from './types';

export type RecoveryBoundaryResult<T> = {
  outcome: 'RETRY' | 'FORWARD' | 'SAFETY_HOLD';
  nextCheckpoint: string | null;
  nextWorldState: WorldState;
  /** External player-owned Captured Memory / Anchor experience, not NPC World State. */
  persistentPlayerState: T;
};

/**
 * Converts the 00:00 decision into a next-state snapshot without implicitly advancing
 * the simulation clock or granting unseen information to the player.
 *
 * The caller starts a new simulation instance only if it has a valid nextWorldState.
 * Player memory is a separate persistence channel, never copied into NPC state.
 */
export function materializeRecoveryBoundary<T>(
  current: WorldState,
  baseline: WorldState,
  persistentPlayerState: T,
): RecoveryBoundaryResult<T> {
  const session = getCorrectionSession(current);
  if (session.outcome === 'PENDING') throw new Error('Cannot transition before 00:00 adjudication');
  const memory = cloneValue(persistentPlayerState);

  if (session.outcome === 'RETRY') {
    const next = cloneValue(baseline);
    if ('correction' in next) next.correction = initialCorrectionSession();
    return {
      outcome: 'RETRY',
      nextCheckpoint: session.nextCheckpoint,
      nextWorldState: next,
      persistentPlayerState: memory,
    };
  }

  const next = cloneValue(current);
  if (session.outcome === 'FORWARD') {
    const clock = next.clock;
    if (clock && typeof clock === 'object' && !Array.isArray(clock)) {
      (clock as Record<string, unknown>).day = 1;
      (clock as Record<string, unknown>).time = '00:01';
    }
    return {
      outcome: 'FORWARD',
      nextCheckpoint: session.nextCheckpoint,
      nextWorldState: next,
      persistentPlayerState: memory,
    };
  }

  return {
    outcome: 'SAFETY_HOLD',
    nextCheckpoint: null,
    nextWorldState: next,
    persistentPlayerState: memory,
  };
}
