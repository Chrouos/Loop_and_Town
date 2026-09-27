import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSimulationStory } from '../src/lib/loadSimulationStory';

describe('GitHub Pages story asset paths', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads story assets with relative URLs so project Pages keeps the repository prefix', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, text: async () => 'characters: {}' })
      .mockResolvedValueOnce({ ok: true, text: async () => 'actions: []' })
      .mockResolvedValueOnce({ ok: true, text: async () => "id: event_1831\nat: '18:31'\nvariants: []" })
      .mockResolvedValueOnce({ ok: true, text: async () => "id: event_2114\nat: '21:14'\nvariants: []" });

    vi.stubGlobal('fetch', fetchMock);

    await loadSimulationStory();

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'story/world/day_01_initial.yaml',
      'story/actions/day_01_actions.yaml',
      'story/events/day_01_1831.yaml',
      'story/events/day_01_2114.yaml',
    ]);
  });
});
