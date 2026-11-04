// The body and the room: her phone reads out loud, she hears herself breathe when wound up, and every place has its echo.
import { Director } from '../src/engine/director';
import { freshSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { roomFor } from '../src/audio/rooms';
import { readable } from '../src/audio/reader';
import { silentAudio } from './harness';

const SCRIPT = `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    time: "18:20"
    place: 測試
    ambience: [old_station_hall]
    beats:
      - phone: 十八點三十一分。
      - narr: 等。
      - { wait: 20 }
      - end: reset
`;

function run(opts: { tension?: number; reader?: boolean }) {
  const { script, errors } = buildScript([{ name: 'a.yaml', source: SCRIPT }]);
  expect(errors).toEqual([]);
  const said: string[] = [];
  const log: string[] = [];
  const audio = { ...silentAudio(log), speak: (text: string) => { said.push(text); }, hush: () => { log.push('hush'); } };
  const save = freshSave();
  save.settings.reader = opts.reader ?? true;
  save.tension = opts.tension ?? 0;
  const director = new Director(script!, save, { audio, vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 }, { speed: 1 });
  director.start();
  for (let i = 0; i < 600 && director.view.phase !== 'reset'; i++) director.tick(100);
  return { said, breaths: log.filter((l) => l === 'sfx:breath').length, log };
}

describe('immersion', () => {
  it('the screen reader reads phone lines, and stays quiet when turned off', () => {
    expect(run({}).said).toEqual(['十八點三十一分。']);
    expect(run({ reader: false }).said).toEqual([]);
  });

  it('calm, she does not hear herself breathe; wound up, she does, and faster in a panic', () => {
    expect(run({ tension: 0 }).breaths).toBe(0);
    const tense = run({ tension: 60 }).breaths;
    const panic = run({ tension: 90 }).breaths;
    expect(tense).toBeGreaterThan(0);
    expect(panic).toBeGreaterThan(tense);
  });

  it('walls beat weather, and weather alone keeps the last room', () => {
    expect(roomFor(['old_station_hall', 'wind_open'])).toBe('hall');
    expect(roomFor(['wind_open', 'street_evening'])).toBe('open');
    expect(roomFor(['house_night', 'night_insects'])).toBe('home');
    expect(roomFor(['night_insects'])).toBeNull();
  });

  it('marks meant for the eye are not read', () => {
    expect(readable('「拍。」|十八點')).toBe('拍。十八點');
  });
});
