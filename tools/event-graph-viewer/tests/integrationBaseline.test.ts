import { describe, expect, it } from 'vitest';
import { PlayerApp } from '../src/player/PlayerApp';
import { loadRealStory } from './helpers/loadRealStory';

describe('player narrative integration baseline', () => {
  it('keeps the player entry while loading Narrative Foundation data', () => {
    expect(PlayerApp).toBeTypeOf('function');

    const story = loadRealStory();
    expect(story.narrative.characters.length).toBeGreaterThanOrEqual(7);
    expect(story.narrative.activities.length).toBeGreaterThan(0);
  });
});
