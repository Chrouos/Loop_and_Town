import { describe, expect, it } from 'vitest';
import { freezeForeground } from '../src/playerNarrative/clock';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { LEGACY_SAVE_KEY, SAVE_KEY, readPlayerSession, resetPlayerSession, writePlayerSession } from '../src/playerNarrative/storage';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

describe('player narrative storage', () => {
  it('migrates a v2 save from the legacy key without losing player state', () => {
    const storage = new MemoryStorage();
    storage.data.set(LEGACY_SAVE_KEY, JSON.stringify({
      ...createInitialPlayerSession(1_000),
      version: 2,
      submittedActionIds: ['old-action'],
      knownFactIds: ['known-fact'],
      foregroundFreeze: { sceneId: 'scene-a', frozenMinute: 900 },
    }));

    const loaded = readPlayerSession(storage, 2_000);
    expect(loaded.version).toBe(3);
    expect(loaded.knownInsightIds).toEqual([]);
    expect(loaded.submittedActionIds).toEqual(['old-action']);
    expect(loaded.knownFactIds).toEqual(['known-fact']);
    expect(loaded.foregroundFreeze).toBeNull();
  });

  it('writes v3 saves to the new key', () => {
    const storage = new MemoryStorage();
    const session = createInitialPlayerSession(1_000);
    session.knownInsightIds.push('insight-a');
    expect(writePlayerSession(storage, session)).toBe(true);
    expect(JSON.parse(storage.data.get(SAVE_KEY) ?? '{}')).toMatchObject({ version: 3, knownInsightIds: ['insight-a'] });
    expect(storage.data.has(LEGACY_SAVE_KEY)).toBe(false);
  });

  it('stores player actions but not canonical victim results', () => {
    const storage = new MemoryStorage();
    const session = createInitialPlayerSession(1_000);
    session.submittedActionIds.push('send_yuan_to_post_office');
    expect(writePlayerSession(storage, session)).toBe(true);
    const loaded = readPlayerSession(storage, 2_000);
    expect(loaded.submittedActionIds).toEqual(['send_yuan_to_post_office']);
    expect(JSON.stringify(loaded)).not.toMatch(/wakaharuDies|doctorDies|victim/);
  });

  it('never restores foreground freeze after reload', () => {
    const storage = new MemoryStorage();
    const frozen = freezeForeground(createInitialPlayerSession(1_000), 'scene-a', 2_000);
    writePlayerSession(storage, frozen);
    expect(readPlayerSession(storage, 10_000).foregroundFreeze).toBeNull();
  });

  it('clears current and legacy saves when explicitly restarting', () => {
    const storage = new MemoryStorage();
    storage.data.set(SAVE_KEY, 'current');
    storage.data.set(LEGACY_SAVE_KEY, 'legacy');

    resetPlayerSession(storage);

    expect(storage.data.has(SAVE_KEY)).toBe(false);
    expect(storage.data.has(LEGACY_SAVE_KEY)).toBe(false);
  });
});
