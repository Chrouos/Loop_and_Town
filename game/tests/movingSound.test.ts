import { Director, pathBetween } from '../src/engine/director';
import { freshSave } from '../src/engine/save';
import { parseChapter } from '../src/script/parse';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

const source = (beat: string) => `
chapter: 1
title: test
start: start
scenes:
  - id: start
    beats:
      - ${beat}
      - pause: 10
      - end: reset
`;

describe('sounds on the move', () => {
  it('reads to: on lines and sounds, keeping the starting distance unless given', () => {
    const errors: string[] = [];
    const line = parseChapter(source('{ man: 說明會今晚七點, at: left, to: back:far }'), 'move.yaml', errors)?.scenes[0]?.beats[0];
    const sfx = parseChapter(source('{ sfx: car_pass, at: left, dist: near, to: back }'), 'move.yaml', errors)?.scenes[0]?.beats[0];
    expect(errors).toEqual([]);
    expect(line).toMatchObject({ at: { dir: 'left', dist: 'mid' }, to: { dir: 'back', dist: 'far' } });
    expect(sfx).toMatchObject({ pos: { dir: 'left', dist: 'near' }, to: { dir: 'back', dist: 'near' } });
  });

  it('needs somewhere to start from and somewhere outside her head to go', () => {
    const errors: string[] = [];
    parseChapter(source('{ man: 說明會, to: back }'), 'move.yaml', errors);
    parseChapter(source('{ sfx: car_pass, at: left, to: center }'), 'move.yaml', errors);
    expect(errors.join('\n')).toContain('to 需要先有 at 方位');
    expect(errors.join('\n')).toContain('to 不能是 center');
  });

  it('steps the short way round, easing the distance along', () => {
    expect(pathBetween({ dir: 'left', dist: 'mid' }, { dir: 'back', dist: 'far' })).toEqual([
      { dir: 'left', dist: 'mid' }, { dir: 'back-left', dist: 'far' }, { dir: 'back', dist: 'far' },
    ]);
    expect(pathBetween({ dir: 'front-left', dist: 'near' }, { dir: 'front-right', dist: 'near' }).map((pos) => pos.dir)).toEqual(['front-left', 'front', 'front-right']);
    expect(pathBetween({ dir: 'left', dist: 'near' }, { dir: 'left', dist: 'far' })).toEqual([{ dir: 'left', dist: 'near' }, { dir: 'left', dist: 'far' }]);
  });

  it('sends the sound on its way and leaves ripples along the path', () => {
    const { script, errors } = buildScript([{ name: 'move.yaml', source: source('{ sfx: car_pass, at: left, to: back:far }') }]);
    expect(errors).toEqual([]);
    const audio = silentAudio();
    const play = vi.spyOn(audio, 'play');
    const director = new Director(script, freshSave(), {
      audio, vibrate: () => undefined, persist: () => undefined, wallNow: () => 0,
    }, { speed: 1 });
    director.start();
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      director.tick(100);
      director.view.ripples.forEach((ripple) => seen.add(`${ripple.pos.dir}:${ripple.pos.dist}`));
    }
    expect(play).toHaveBeenCalledWith('car_pass', { dir: 'left', dist: 'mid' }, expect.objectContaining({ to: { dir: 'back', dist: 'far' } }));
    expect([...seen]).toEqual(expect.arrayContaining(['left:mid', 'back-left:far', 'back:far']));
  });
});
