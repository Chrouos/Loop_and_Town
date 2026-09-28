export type ResetTransitionPhase = 'settling' | 'message' | 'handoff' | 'fade' | 'midnight' | 'complete';

export const RESET_TRANSITION_PHASES = {
  settling: 500,
  message: 1200,
  fade: 500,
  midnight: 700,
} as const;

export function resetPhaseDelay(phase: keyof typeof RESET_TRANSITION_PHASES, reducedMotion = false): number {
  return reducedMotion ? 1 : RESET_TRANSITION_PHASES[phase];
}
