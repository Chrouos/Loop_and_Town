import { describe, expect, it } from 'vitest';
import { simulate } from '../src/simulator/simulator';
import type { SimulationDefinition, WorldState } from '../src/simulator/types';

const initialState: WorldState = {
  clock: { day: 0, time: '16:50' },
  relationships: {
    yuan: { trust: 0, closeness: 0, respect: 0, pressure: 0 },
  },
  knowledge: { convergence_known: true },
};

const definition = {
  actions: [
    {
      id: 'share_truth_without_ordering',
      at: '17:10',
      label: '把真相告訴予安，但讓他自己決定',
      effects: [
        { adjust: { path: 'relationships.yuan.trust', by: 2 } },
        { adjust: { path: 'relationships.yuan.respect', by: 2 } },
      ],
    },
    {
      id: 'pressure_yuan',
      at: '17:20',
      label: '命令予安一定要留下',
      effects: [
        { adjust: { path: 'relationships.yuan.pressure', by: 3 } },
      ],
    },
  ],
  events: [
    {
      id: 'evt_yuan_final_decision',
      title: '予安決定是否留下',
      at: '17:58',
      variants: [
        {
          id: 'yuan_stays_by_choice',
          priority: 100,
          when: {
            all: [
              { path: 'knowledge.convergence_known', op: 'eq', value: true },
              { path: 'relationships.yuan.trust', op: 'gte', value: 2 },
              { path: 'relationships.yuan.respect', op: 'gte', value: 1 },
              { path: 'relationships.yuan.pressure', op: 'lt', value: 3 },
            ],
          },
          effects: [],
        },
        { id: 'yuan_declines_by_choice', priority: 0, fallback: true, effects: [] },
      ],
    },
  ],
} as unknown as SimulationDefinition;

describe('relationship state engine', () => {
  it('accumulates relationship dimensions and lets NPC conditions resolve the decision', () => {
    const result = simulate({
      definition,
      initialState,
      actions: ['share_truth_without_ordering'],
      until: '18:00',
    });

    const yuan = (result.state.relationships as Record<string, Record<string, number>>).yuan;
    expect(yuan.trust).toBe(2);
    expect(yuan.respect).toBe(2);
    expect(yuan.pressure).toBe(0);
    expect(result.history.find((entry) => entry.eventId === 'evt_yuan_final_decision')?.variantId)
      .toBe('yuan_stays_by_choice');
  });

  it('allows accumulated pressure to change the same NPC decision', () => {
    const result = simulate({
      definition,
      initialState,
      actions: ['share_truth_without_ordering', 'pressure_yuan'],
      until: '18:00',
    });

    expect(result.history.find((entry) => entry.eventId === 'evt_yuan_final_decision')?.variantId)
      .toBe('yuan_declines_by_choice');
  });
});
