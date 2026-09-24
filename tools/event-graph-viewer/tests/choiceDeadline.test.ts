import { describe, expect, it } from 'vitest';
import { availableChoicesForScene } from '../src/playerNarrative/choices';
import type { PlayerChoiceDefinition } from '../src/narrative/types';

const choices: PlayerChoiceDefinition[] = [
  { id: 'reply', sceneId: 'msg', label: '回她', availableUntil: 1080, effects: [] },
  { id: 'call', sceneId: 'msg', label: '打給她', effects: [] },
];

describe('choice deadlines', () => {
  it('removes an expired unopened response', () => {
    expect(availableChoicesForScene(choices, 'msg', 1075, []).map((x) => x.id)).toEqual(['reply', 'call']);
    expect(availableChoicesForScene(choices, 'msg', 1088, []).map((x) => x.id)).toEqual(['call']);
  });
});
