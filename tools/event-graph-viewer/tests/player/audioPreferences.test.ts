import { describe, expect, it } from 'vitest';
import { AUDIO_PREFERENCE_KEY, getAudioPreference, setAudioPreference } from '../../src/player/ui/audioPreferences';

describe('audio presentation preference', () => {
  it('defaults to muted and persists only the presentation toggle', () => {
    const storage = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } as Pick<Storage, 'getItem' | 'setItem'>;

    expect(getAudioPreference(fakeStorage)).toBe(false);
    expect(setAudioPreference(fakeStorage, true)).toBe(true);
    expect(getAudioPreference(fakeStorage)).toBe(true);
    expect(storage.get(AUDIO_PREFERENCE_KEY)).toBe('on');
  });

  it('ignores malformed values without touching gameplay state', () => {
    const fakeStorage = {
      getItem: () => 'storyDags:enabled',
      setItem: () => undefined,
    } as Pick<Storage, 'getItem' | 'setItem'>;
    expect(getAudioPreference(fakeStorage)).toBe(false);
  });
});
