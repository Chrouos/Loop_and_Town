import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../src/simulator/conditionEvaluator';

const state = {
  characters: {
    wakaharu: { location: 'old_station', status: 'alive' },
  },
  flags: { protected: false },
};

describe('evaluateCondition', () => {
  it('evaluates eq, neq, exists and not_exists', () => {
    expect(evaluateCondition({ path: 'characters.wakaharu.status', op: 'eq', value: 'alive' }, state)).toBe(true);
    expect(evaluateCondition({ path: 'characters.wakaharu.location', op: 'neq', value: 'home' }, state)).toBe(true);
    expect(evaluateCondition({ path: 'flags.protected', op: 'exists' }, state)).toBe(true);
    expect(evaluateCondition({ path: 'characters.doctor', op: 'not_exists' }, state)).toBe(true);
  });

  it('evaluates nested all, any and not groups', () => {
    expect(evaluateCondition({
      all: [
        { path: 'characters.wakaharu.status', op: 'eq', value: 'alive' },
        { any: [
          { path: 'flags.protected', op: 'eq', value: true },
          { not: { path: 'characters.wakaharu.location', op: 'eq', value: 'home' } },
        ] },
      ],
    }, state)).toBe(true);
  });

  it('throws for missing paths used by eq or neq', () => {
    expect(() => evaluateCondition({ path: 'characters.doctor.status', op: 'eq', value: 'alive' }, state))
      .toThrow('Unknown state path: characters.doctor.status');
  });
});
