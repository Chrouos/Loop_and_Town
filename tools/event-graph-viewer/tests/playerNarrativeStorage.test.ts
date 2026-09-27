import { describe, expect, it } from 'vitest';
import { freezeForeground } from '../src/playerNarrative/clock';
import { createInitialPlayerSession } from '../src/playerNarrative/model';
import { readPlayerSession, writePlayerSession } from '../src/playerNarrative/storage';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe('player narrative storage', () => {
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
});
