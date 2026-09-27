import yaml from 'js-yaml';
import { expect, it } from 'vitest';
import text from '../../../story/worldlines/loop_01_worldlines.yaml?raw';

it('defines the eight approved worldlines', () => {
  const doc = yaml.load(text) as { worldlines: Array<{ id: string; title: string; action_ids: string[] }> };
  expect(doc.worldlines.map((item) => item.id)).toEqual([
    'WL-00', 'WL-01', 'WL-02', 'WL-03', 'WL-04', 'WL-05', 'WL-06', 'WL-07',
  ]);
  expect(doc.worldlines.find((item) => item.id === 'WL-07')?.action_ids)
    .toEqual(['protect_wakaharu', 'confront_reporter']);
});

it('keeps every worldline as interventions rather than authored outcomes', () => {
  const doc = yaml.load(text) as { worldlines: Array<{ id: string; action_ids: string[] }> };
  expect(doc.worldlines).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'WL-00', action_ids: [] }),
    expect.objectContaining({ id: 'WL-01', action_ids: ['send_yuan_to_post_office'] }),
    expect.objectContaining({ id: 'WL-02', action_ids: ['show_letter_to_wakaharu'] }),
    expect.objectContaining({ id: 'WL-03', action_ids: ['confront_reporter'] }),
    expect.objectContaining({ id: 'WL-04', action_ids: ['protect_wakaharu'] }),
    expect.objectContaining({ id: 'WL-05', action_ids: ['stop_doctor'] }),
    expect.objectContaining({ id: 'WL-06', action_ids: ['protect_wakaharu', 'stop_doctor'] }),
  ]));
});
