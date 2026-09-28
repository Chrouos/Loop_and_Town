import { describe, expect, it } from 'vitest';
import {
  adjustRelationship,
  resetRelationshipState,
  resolveRelationshipOutcome,
  type RelationshipOutcome,
} from '../src/relationship/relationshipState';

const outcomes: RelationshipOutcome[] = [
  {
    id: 'yuan_stays_by_choice',
    when: {
      all: [
        { path: 'knowledge.convergence_known', op: 'eq', value: true },
        { path: 'relationships.yuan.trust', op: 'gte', value: 2 },
        { path: 'relationships.yuan.respect', op: 'gte', value: 1 },
        { path: 'relationships.yuan.pressure', op: 'lt', value: 3 },
      ],
    },
  },
  { id: 'yuan_declines_by_choice', fallback: true },
];

describe('relationship state engine', () => {
  it('accumulates relationship dimensions and lets NPC conditions resolve the decision', () => {
    const yuan = adjustRelationship(resetRelationshipState(), { trust: 2, respect: 2 });
    const context = {
      knowledge: { convergence_known: true },
      relationships: { yuan },
    };

    expect(yuan.trust).toBe(2);
    expect(yuan.respect).toBe(2);
    expect(yuan.pressure).toBe(0);
    expect(resolveRelationshipOutcome(outcomes, context)).toBe('yuan_stays_by_choice');
  });

  it('allows accumulated pressure to change the same NPC decision', () => {
    const trusted = adjustRelationship(resetRelationshipState(), { trust: 2, respect: 2 });
    const pressured = adjustRelationship(trusted, { pressure: 3 });
    const context = {
      knowledge: { convergence_known: true },
      relationships: { yuan: pressured },
    };

    expect(resolveRelationshipOutcome(outcomes, context)).toBe('yuan_declines_by_choice');
  });

  it('resets relationship state without erasing cross-loop insight data owned elsewhere', () => {
    const before = adjustRelationship(resetRelationshipState(), {
      trust: 3,
      closeness: 2,
      respect: 2,
      pressure: 1,
    });
    expect(before).toEqual({ trust: 3, closeness: 2, respect: 2, pressure: 1 });
    expect(resetRelationshipState()).toEqual({ trust: 0, closeness: 0, respect: 0, pressure: 0 });
  });
});
