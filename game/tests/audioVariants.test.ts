import { Director } from '../src/engine/director';
import { freshSave } from '../src/engine/save';
import { parseChapter } from '../src/script/parse';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

const source = (variant?: unknown) => `
chapter: 1
title: test
start: start
scenes:
  - id: start
    beats:
      - { sfx: laugh_soft, at: center, dist: near${variant === undefined ? '' : `, variant: ${JSON.stringify(variant)}`} }
      - pause: 10
      - end: reset
`;

describe('script sound variants', () => {
  it('accepts a one-based recording number and passes its zero-based index to audio', () => {
    const { script, errors } = buildScript([{ name: 'variant.yaml', source: source(1) }]);
    expect(errors).toEqual([]);
    const audio = silentAudio();
    const play = vi.spyOn(audio, 'play');
    const director = new Director(script, freshSave(), {
      audio, vibrate: () => undefined, persist: () => undefined, wallNow: () => 0,
    }, { speed: 1 });
    director.start();
    for (let i = 0; i < 200 && !play.mock.calls.some(([id]) => id === 'laugh_soft'); i++) director.tick(200);
    expect(play).toHaveBeenCalledWith('laugh_soft', { dir: 'center', dist: 'near' }, { gain: 0.45, variant: 0 });
  });

  it.each([0, -1, 1.5, 4, '1'])('rejects invalid recording number %j', (variant) => {
    const errors: string[] = [];
    parseChapter(source(variant), 'variant.yaml', errors);
    expect(errors.join('\n')).toContain('variant must be an integer');
  });

  it('leaves unspecified variants free to vary', () => {
    const errors: string[] = [];
    const chapter = parseChapter(source(), 'variant.yaml', errors);
    expect(errors).toEqual([]);
    expect(chapter?.scenes[0]?.beats[0]).not.toHaveProperty('variant', expect.any(Number));
  });
});
