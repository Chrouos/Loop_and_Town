import { describe, expect, it } from 'vitest';
import { parseEventGraphText } from '../src/lib/loadStory';
import { buildEventGraph } from '../src/lib/eventGraph';

const yaml = `
id: evt_1831_station
title: "18:31 車站事件"
time: "18:31"
location: old_station
variants:
  - id: wakaharu_dies
    priority: 100
    when:
      all:
        - characters.wakaharu.location == old_station
    effects:
      - set: characters.wakaharu.status
        value: dead
    delayed_effects:
      - id: reporter_missing
        delay_minutes: 163
        effects:
          - emit_event: evt_2114_reporter_missing
  - id: doctor_dies
    priority: 90
    when:
      all:
        - characters.doctor.location == old_station
    effects:
      - set: characters.doctor.status
        value: dead
  - id: no_death
    when:
      all:
        - characters.wakaharu.location != old_station
    effects:
      - add_flag: world.anomaly_1831_observed
`;

describe('Event Graph loader', () => {
  it('normalizes variants and delayed effects', () => {
    const doc = parseEventGraphText(yaml);
    expect(doc.id).toBe('evt_1831_station');
    expect(doc.variants.map((variant) => variant.id)).toEqual([
      'wakaharu_dies',
      'doctor_dies',
      'no_death',
    ]);
    expect(doc.variants[0].delayedEffects[0].delayMinutes).toBe(163);
    expect(doc.variants[2].priority).toBe(0);
  });

  it('tolerates missing optional fields', () => {
    const doc = parseEventGraphText(`id: e\ntitle: T\ntime: "01:02"\nvariants:\n  - id: v\n    when: {}\n    effects: []\n`);
    expect(doc.location).toBeUndefined();
    expect(doc.variants[0].delayedEffects).toEqual([]);
    expect(doc.variants[0].conditions).toEqual([]);
  });
});

describe('Event Graph projection', () => {
  it('keeps event, variants and delayed effects connected', () => {
    const graph = buildEventGraph(parseEventGraphText(yaml));
    expect(graph.nodes.filter((node) => node.role === 'event')).toHaveLength(1);
    expect(graph.nodes.filter((node) => node.role === 'variant')).toHaveLength(3);
    expect(graph.nodes.filter((node) => node.role === 'delayed')).toHaveLength(1);
    expect(graph.edges.filter((edge) => edge.source === 'evt_1831_station')).toHaveLength(3);
    expect(graph.edges.some((edge) => edge.label === '+163m')).toBe(true);
    expect(
      graph.nodes
        .filter((node) => node.role === 'variant')
        .every((node) => node.parentEventId === 'evt_1831_station'),
    ).toBe(true);
  });
});
