import { expect, it } from 'vitest';
import { projectStoryGraph } from '../src/simulator/storyGraph';
import { loadRealStory } from './helpers/loadRealStory';

it('projects the reporter chain from authored state dependencies', () => {
  const graph = projectStoryGraph(loadRealStory());
  expect(graph.nodes.map((node) => node.id)).toEqual(expect.arrayContaining([
    'action:confront_reporter',
    'schedule:reporter_return_hotel',
    'schedule:reporter_enter_old_lab',
    'event:evt_2114_reporter_status',
  ]));
  expect(graph.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({
      source: 'action:confront_reporter',
      target: 'schedule:reporter_return_hotel',
      label: 'characters.reporter.route',
    }),
    expect.objectContaining({
      source: 'schedule:reporter_enter_old_lab',
      target: 'event:evt_2114_reporter_status',
      label: 'characters.reporter.location',
    }),
  ]));
});

it('projects event variants as structural children of 18:31', () => {
  const graph = projectStoryGraph(loadRealStory());
  for (const variantId of ['wakaharu_dies', 'doctor_dies', 'no_death']) {
    expect(graph.edges).toContainEqual(expect.objectContaining({
      source: 'event:evt_1831_station',
      target: `variant:evt_1831_station:${variantId}`,
    }));
  }
});

it('keeps consecutive schedules for one character connected chronologically', () => {
  const graph = projectStoryGraph(loadRealStory());
  expect(graph.edges).toContainEqual(expect.objectContaining({
    source: 'schedule:reporter_return_hotel',
    target: 'schedule:reporter_enter_old_lab',
    label: 'schedule',
  }));
});
