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

describe('屏息 (hold)', () => {
  const HOLD = `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    beats:
      - hold:
          seconds: 3
          timeout: 12
          sfx: hum_rise
          at: right
          prompt: 按住，慢慢吐氣
          success:
            - narr: 聽到了。
          fail:
            - narr: 只聽到自己的心跳。
      - end: reset
`;
  function play(act: (d: Director, held: number) => void) {
    const { script, errors } = buildScript([{ name: 'a.yaml', source: HOLD }]);
    expect(errors).toEqual([]);
    const said: string[] = [];
    const d = new Director(script!, freshSave(), { audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 }, { speed: 1 });
    d.start();
    let held = 0;
    for (let i = 0; i < 400 && d.view.phase !== 'reset'; i++) {
      if (d.view.center && said.at(-1) !== d.view.center.text) said.push(d.view.center.text);
      if (d.view.interact?.type === 'hold') { act(d, held); held += 100; }
      else if (!d.view.interact) d.hurry();
      d.tick(100);
    }
    return said;
  }

  it('held long enough, the sound comes through', () => {
    expect(play((d) => d.holdStart())).toContain('聽到了。');
  });

  it('letting go too soon every time, the window closes on her heartbeat', () => {
    expect(play((d, held) => (held % 1000 === 0 ? d.holdStart() : d.holdEnd()))).toContain('只聽到自己的心跳。');
  });
});

describe('a lesson never holds the game forever', () => {
  it('a keep lesson nobody performs lets the line go on by itself', () => {
    const { script } = buildScript([{ name: 'a.yaml', source: `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    beats:
      - { narr: 長按這一句。, teach: keep }
      - narr: 下一句。
      - end: reset
` }]);
    const d = new Director(script!, freshSave(), { audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 }, { speed: 1 });
    d.start();
    const said: string[] = [];
    for (let i = 0; i < 800 && d.view.phase !== 'reset'; i++) {
      if (d.view.center && said.at(-1) !== d.view.center.text) said.push(d.view.center.text);
      d.tick(100);
    }
    expect(said).toContain('下一句。');
  });
});

describe('voices from before', () => {
  it('a tape and Zhixia are written in their own hand; a call or someone beside her is not', () => {
    const { script, errors } = buildScript([{ name: 'a.yaml', source: `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    cast: { zhixia: front, tingan: right }
    beats:
      - { tingan: 錄音, via: tape }
      - zhixia: 走了
      - { tingan: 電話, via: phone }
      - tingan: 旁邊
      - end: reset
` }]);
    expect(errors).toEqual([]);
    const director = new Director(script!, freshSave(), { audio: silentAudio([]), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 }, { speed: 1 });
    director.start();
    const past = new Map<string, boolean>();
    for (let i = 0; i < 400 && director.view.phase !== 'reset'; i++) {
      director.tick(100);
      const line = director.view.center;
      if (line) past.set(line.text, Boolean(line.past));
    }
    expect(Object.fromEntries(past)).toEqual({ 錄音: true, 走了: true, 電話: false, 旁邊: false });
  });
});
