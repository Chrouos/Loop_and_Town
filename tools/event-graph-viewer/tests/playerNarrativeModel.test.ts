import { describe, expect, it } from 'vitest';
import { createInitialPlayerSession } from '../src/playerNarrative/model';

describe('player narrative session v3', () => {
  it('initializes the cross-loop insight collection', () => {
    const session = createInitialPlayerSession(1234);
    expect(session.version).toBe(3);
    expect(session.knownInsightIds).toEqual([]);
  });
});
