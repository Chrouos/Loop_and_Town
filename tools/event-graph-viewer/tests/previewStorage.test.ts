import { describe, expect, it } from 'vitest';
import { previewNamespace, previewStorageForPath } from '../src/player/previewStorage';
import { normalizeSave } from '../src/player/model';
import { readSave, writeSave, SAVE_KEY } from '../src/player/storage';

describe('shareable preview storage isolation', () => {
  it('keeps PR progress away from production and other PR saves', () => {
    const original = window.localStorage; original.clear();
    const pr25 = previewStorageForPath(original, '/Loop_and_Town/previews/pr-25/player.html')!;
    const pr26 = previewStorageForPath(original, '/Loop_and_Town/previews/pr-26/player.html')!;
    expect(previewNamespace('/Loop_and_Town/player.html')).toBeNull();
    expect(previewNamespace('/Loop_and_Town/previews/pr-25/player.html')).toBe('loop-town-preview-pr-25:');
    const main = normalizeSave(null, 1000);
    main.knowledge.discoveredEvidence.push('production-only');
    writeSave(original, main);
    const test = normalizeSave(null, 2000);
    test.knowledge.discoveredEvidence.push('preview-only');
    writeSave(pr25, test);
    expect(readSave(original, 3000).knowledge.discoveredEvidence).toContain('production-only');
    expect(readSave(original, 3000).knowledge.discoveredEvidence).not.toContain('preview-only');
    expect(readSave(pr25, 3000).knowledge.discoveredEvidence).toContain('preview-only');
    expect(readSave(pr26, 3000).knowledge.discoveredEvidence).toEqual([]);
    pr25.clear();
    expect(original.getItem(SAVE_KEY)).not.toBeNull();
    expect(original.getItem('loop-town-preview-pr-25:' + SAVE_KEY)).toBeNull();
  });
});
