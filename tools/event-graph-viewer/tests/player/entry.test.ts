import { expect, it } from 'vitest';
import { entryPresentation, entryWindowFor } from '../../src/player/entry';

it.each([
  [372, 'dawn'], [539, 'dawn'], [540, 'morning'], [719, 'morning'],
  [720, 'afternoon'], [959, 'afternoon'], [960, 'evening'], [1110, 'evening'],
  [1111, 'post-convergence'], [1319, 'post-convergence'], [1320, 'late-night'], [1439, 'late-night'],
])('maps %i to the correct entry window', (minute, expected) => {
  expect(entryWindowFor(minute)).toBe(expected);
});

it('provides presentation copy for every entry window', () => {
  for (const window of ['dawn', 'morning', 'afternoon', 'evening', 'post-convergence', 'late-night'] as const) {
    expect(entryPresentation(window).label).toBeTruthy();
    expect(entryPresentation(window).lines.length).toBeGreaterThan(0);
  }
});
