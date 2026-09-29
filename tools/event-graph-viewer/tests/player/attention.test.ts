import { expect, it } from 'vitest';
import {
  ATTENTION_OBSERVATION_MS,
  ATTENTION_SHIFT_MS,
  advanceAttention,
  beginAttention,
  redirectAttention,
} from '../../src/player/attention';

it('does not perceive a target until shift and observation both finish', () => {
  const started = beginAttention('nurse', 'door', 1_000);

  expect(started).toMatchObject({ phase: 'shifting', primaryTargetId: 'nurse', targetId: 'door' });
  expect(advanceAttention(started, 1_000 + ATTENTION_SHIFT_MS - 1).completedTargetId).toBeUndefined();

  const observing = advanceAttention(started, 1_000 + ATTENTION_SHIFT_MS);
  expect(observing.state).toMatchObject({ phase: 'observing', primaryTargetId: 'nurse', targetId: 'door' });
  expect(observing.completedTargetId).toBeUndefined();

  const completed = advanceAttention(
    observing.state,
    1_000 + ATTENTION_SHIFT_MS + ATTENTION_OBSERVATION_MS,
  );
  expect(completed.completedTargetId).toBe('door');
  expect(completed.state).toEqual({ phase: 'idle' });
});

it('lets a rhythmic observation remain focused until its authored presentation finishes', () => {
  const observationMs = 3_200;
  const started = beginAttention('nurse', 'door', 1_000, observationMs);

  expect(started.observationEndsAtMs).toBe(1_000 + ATTENTION_SHIFT_MS + observationMs);
  expect(advanceAttention(started, 1_000 + ATTENTION_SHIFT_MS + 900).completedTargetId).toBeUndefined();
  expect(advanceAttention(started, 1_000 + ATTENTION_SHIFT_MS + observationMs).completedTargetId).toBe('door');
});

it('redirects Single Focus instead of running two observations in parallel', () => {
  const first = beginAttention('nurse', 'door', 1_000);
  const redirected = redirectAttention(first, 'window', 1_200);

  expect(redirected).toMatchObject({
    phase: 'shifting',
    primaryTargetId: 'nurse',
    targetId: 'window',
    startedAtMs: 1_200,
  });
  expect(redirected.targetId).not.toBe('door');

  const completed = advanceAttention(
    redirected,
    1_200 + ATTENTION_SHIFT_MS + ATTENTION_OBSERVATION_MS,
  );
  expect(completed.completedTargetId).toBe('window');
  expect(completed.state).toEqual({ phase: 'idle' });
});
