import { expect, it } from 'vitest';
import { compareWorldlines } from '../src/simulator/worldlineDiff';
import { simulateNamedWorldline } from '../src/simulator/storySimulation';
import { loadRealStory } from './helpers/loadRealStory';

const story = loadRealStory();
const wl00 = simulateNamedWorldline(story, 'WL-00');
const wl03 = simulateNamedWorldline(story, 'WL-03');
const wl01 = simulateNamedWorldline(story, 'WL-01');

it('author diff shows the hidden reporter movements', () => {
  const titles = compareWorldlines(wl00, wl03, 'author').flatMap((row) => [row.left?.title, row.right?.title]);
  expect(titles).toContain('reporter_return_hotel');
  expect(titles).toContain('reporter_enter_old_lab');
});

it('player diff hides reporter movements but keeps reporter_missing', () => {
  const rows = compareWorldlines(wl00, wl03, 'player');
  const titles = rows.flatMap((row) => [row.left?.title, row.right?.title]);
  expect(titles).not.toContain('reporter_return_hotel');
  expect(titles).not.toContain('reporter_enter_old_lab');
  expect(rows.some((row) => row.right?.variantId === 'reporter_missing')).toBe(true);
});

it('Yuan diff exposes station sighting versus postal anomaly', () => {
  const rows = compareWorldlines(wl00, wl01, 'author');
  expect(rows.some((row) => row.left?.variantId === 'saw_reporter' && row.right?.variantId === 'yuan_absent')).toBe(true);
  expect(rows.some((row) => row.right?.variantId === 'postal_anomaly')).toBe(true);
});

it('player diff contains only observable history rows', () => {
  const rows = compareWorldlines(wl00, wl03, 'player');
  expect(rows.flatMap((row) => [row.left, row.right]).filter(Boolean)
    .every((entry) => entry?.visibility === 'observable')).toBe(true);
});
