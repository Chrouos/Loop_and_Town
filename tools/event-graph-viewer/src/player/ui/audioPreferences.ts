export const AUDIO_PREFERENCE_KEY = 'loop-town.presentation.audio';

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function getAudioPreference(storage: PreferenceStorage): boolean {
  try {
    return storage.getItem(AUDIO_PREFERENCE_KEY) === 'on';
  } catch {
    return false;
  }
}
export function setAudioPreference(storage: PreferenceStorage, enabled: boolean): boolean {
  try {
    storage.setItem(AUDIO_PREFERENCE_KEY, enabled ? 'on' : 'off');
  } catch {
    // A private browsing context may reject preference writes; muted remains safe.
  }
  return enabled;
}
