import { describe, expect, it } from 'vitest';
import { deriveScene } from '../../src/player/presentation/deriveScene';

describe('deriveScene', () => {
  const base = { loop: 2, time: '18:31', worldline: '02-B' };

  it('projects a reset boundary as a reset scene', () => {
    const scene = deriveScene({ ...base, state: { kind: 'reset' } });

    expect(scene).toMatchObject({ kind: 'reset', loop: 2, time: '18:31', worldline: '02-B' });
  });

  it('projects an unopened initial letter as an opening scene', () => {
    const scene = deriveScene({
      ...base,
      state: { kind: 'opening', title: '第七封信', text: '回來一趟。' },
    });

    expect(scene).toMatchObject({ kind: 'opening', title: '第七封信', text: '回來一趟。' });
  });

  it('keeps readable records as documentary scenes until dialogue is proven', () => {
    const scene = deriveScene({
      ...base,
      state: { kind: 'document', recordId: 'letter', title: '第七封信', body: ['回來一趟。'] },
    });

    expect(scene).toMatchObject({ kind: 'document', recordId: 'letter', body: ['回來一趟。'] });
  });

  it('projects an authoritative activity as an idle scene', () => {
    const scene = deriveScene({
      ...base,
      state: {
        kind: 'idle',
        actor: '庭安',
        activity: '還在回旅館的路上。',
        canIntervene: false,
        eta: { kind: 'unknown' },
      },
    });

    expect(scene).toMatchObject({ kind: 'idle', actor: '庭安', activity: '還在回旅館的路上。', eta: { kind: 'unknown' } });
    expect(scene).not.toHaveProperty('eta.minutes');
  });

  it('does not invent a worldline identifier when runtime has none', () => {
    const scene = deriveScene({ loop: 1, time: '06:12', state: { kind: 'opening', title: '第七封信', text: '回來一趟。' } });

    expect(scene).not.toHaveProperty('worldline');
  });

  it('keeps unknown ETA unknown instead of fabricating a number', () => {
    const scene = deriveScene({
      ...base,
      state: { kind: 'idle', activity: '等待消息。', canIntervene: false, eta: { kind: 'unknown' } },
    });

    expect(scene.kind).toBe('idle');
    if (scene.kind === 'idle') expect(scene.eta).toEqual({ kind: 'unknown' });
  });
});
