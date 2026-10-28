import { Director } from '../src/engine/director';
import { LIFE, isVoice, type LifeSound } from '../src/engine/life';
import { freshSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { loadScriptFromDisk, silentAudio } from './harness';
import type { Beat } from '../src/script/types';

const customLife = (event: string) => buildScript([{ name: 'test.yaml', source: `
chapter: 1
title: 測試
start: s
scenes:
  - id: s
    life:
      - ${event}
    beats:
      - wait: 60
      - end: reset
` }]);

it.each([
  '{ text: 沙, src: 紙 }',
  '{ text: 沙, sfx: "" }',
  '{ text: 沙, sfx: unknown_sound }',
])('rejects custom sound captions without a playable binding: %s', (event) => {
  expect(customLife(event).errors.join('\n')).toMatch(/sfx|音效/);
});

it('accepts custom sounds and preserves the separate background dialogue contract', () => {
  expect(customLife('{ text: 喀沙, sfx: leaf_rustle, src: 枯葉 }').errors).toEqual([]);
  expect(customLife('{ say: 回來了？, voice: woman }').errors).toEqual([]);
});

it('all production scene sounds and attention cues have audible bindings', () => {
  const { script, errors } = loadScriptFromDisk();
  expect(errors).toEqual([]);
  const cues: Extract<Beat, { k: 'cue' }>[] = [];
  const visit = (beats: Beat[]) => {
    for (const beat of beats) {
      if (beat.k === 'cue') cues.push(beat);
      if (beat.k === 'if') { visit(beat.then); visit(beat.else); }
      if (beat.k === 'choice') for (const option of beat.options) {
        visit(option.then);
        if (option.recall) { for (const entry of option.recall.accept) visit(entry.then); visit(option.recall.miss); }
      }
      if (beat.k === 'locate') { visit(beat.success); visit(beat.fail); }
      if (beat.k === 'approach') { visit(beat.hit); visit(beat.early); visit(beat.late); }
    }
  };
  for (const scene of script.scenes.values()) {
    if (Array.isArray(scene.life)) for (const event of scene.life) {
      if (!isVoice(event)) expect(event.sfx, `${scene.id}: ${event.text}`).toBeDefined();
    }
    visit(scene.beats);
    for (const beats of Object.values(scene.threads)) visit(beats);
  }
  expect(cues.length).toBeGreaterThan(0);
  for (const cue of cues) expect(cue.sfx, `${cue.thread}: ${cue.text}`).toBeDefined();
});

const soundEvents = Object.entries(LIFE).flatMap(([ambience, life]) => life!.events
  .filter((event): event is LifeSound => !isVoice(event))
  .map((event) => ({ ambience, event })));

it.each(soundEvents)('$ambience sound caption $event.text triggers its bound audio', ({ event }) => {
  expect(event.sfx, `${event.src ?? event.text} needs an audible sound`).toBeDefined();
  const { script, errors } = buildScript([{ name: 'test.yaml', source: `
chapter: 1
title: 測試
start: s
scenes:
  - id: s
    beats:
      - wait: 60
      - end: reset
` }]);
  expect(errors).toEqual([]);
  script.scenes.get('s')!.life = [event];
  const log: string[] = [];
  const director = new Director(script, { ...freshSave(), started: true, scene: 's' }, {
    audio: silentAudio(log), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0,
  });
  director.start();
  for (let i = 0; i < 300 && !director.view.periph.some((item) => item.text === event.text); i++) director.tick(100);
  expect(director.view.periph.some((item) => item.text === event.text)).toBe(true);
  expect(log).toContain(`sfx:${event.sfx}`);
});

it.each([
  { ambience: 'old_house', source: '機車', text: '噗噗——', sfx: 'car_pass', distance: 'far' },
  { ambience: 'house_night', source: '機車', text: '噗噗——', sfx: 'car_pass', distance: 'far' },
  { ambience: 'old_house', source: '水管', text: '咕嚕咕嚕', sfx: 'pipe_gurgle', distance: 'mid' },
] as const)('$ambience plays $source audio when its caption appears', ({ ambience, source, text, sfx, distance }) => {
  const event = LIFE[ambience]!.events.find((entry) => !isVoice(entry) && entry.src === source);
  expect(event).toBeDefined();
  const { script, errors } = buildScript([{ name: 'test.yaml', source: `
chapter: 1
title: 測試
start: s
scenes:
  - id: s
    beats:
      - wait: 60
      - end: reset
` }]);
  expect(errors).toEqual([]);
  // Isolate the real event from each house's pool so random selection cannot hide the regression.
  script.scenes.get('s')!.life = [event!];
  const log: string[] = [];
  const director = new Director(script, { ...freshSave(), started: true, scene: 's' }, {
    audio: silentAudio(log), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0,
  });
  director.start();
  for (let i = 0; i < 300 && !director.view.periph.some((item) => item.text === text); i++) director.tick(100);
  const caption = director.view.periph.find((item) => item.text === text);
  expect(caption).toBeDefined();
  expect(caption!.pos.dist).toBe(distance);
  expect(log).toContain(`sfx:${sfx}`);
});

it.each([
  { ambience: 'library', event: '{ say: 這本可以借嗎？, voice: woman }', kind: 'whisper' },
  { ambience: 'hospital', event: '{ say: 請問抽血在哪裡？, voice: old_woman }', kind: 'whisper' },
  { ambience: 'library', event: '{ say: 有人跌倒了！, voice: man, whisper: false }', kind: 'life' },
  { ambience: 'train_interior', event: '{ say: 借過一下。, voice: man }', kind: 'life' },
  { ambience: 'train_interior', event: '{ say: 噓，他在睡。, voice: woman, whisper: true }', kind: 'whisper' },
])('a stranger in $ambience is heard as $kind: $event', ({ ambience, event, kind }) => {
  const { script, errors } = buildScript([{ name: 'test.yaml', source: `
chapter: 1
title: 測試
start: s
scenes:
  - id: s
    ambience: [${ambience}]
    life:
      - ${event}
    beats:
      - wait: 900
      - end: reset
` }]);
  expect(errors).toEqual([]);
  const own = script.scenes.get('s')!.life;
  const voices: string[] = [];
  const director = new Director(script, { ...freshSave(), started: true, scene: 's' }, {
    audio: { ...silentAudio(), voice: (speaker, _pos, _ms, voiceKind) => { voices.push(`${speaker}:${voiceKind}`); } },
    vibrate: () => undefined, persist: () => undefined, wallNow: () => 0,
  });
  director.start();
  const say = (own as { say?: string }[])[0]!.say!;
  // The place's own strangers take turns with this one; lines never repeat, so it comes up within a few minutes.
  for (let i = 0; i < 9000 && !director.view.periph.some((item) => item.text === say); i++) director.tick(100);
  expect(director.view.periph.some((item) => item.text === say)).toBe(true);
  const speaker = event.match(/voice: (\w+)/)![1];
  expect(voices).toContain(`${speaker}:${kind}`);
});

it('rejects a whisper that is not true or false', () => {
  expect(customLife('{ say: 噓, voice: woman, whisper: maybe }').errors.join('\n')).toMatch(/whisper/);
});

describe('voices through a device', () => {
  it('a line can say what it comes through, and only a known device', async () => {
    const { buildScript } = await import('../src/script/validate');
    const src = (via: string) => `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    beats:
      - { man: 下一站，灰潮鎮。, as: 廣播, via: ${via} }
      - end: reset
`;
    const ok = buildScript([{ name: 'a.yaml', source: src('speaker') }]);
    expect(ok.errors).toEqual([]);
    const line = ok.script.scenes.get('s1')!.beats[0];
    expect(line).toMatchObject({ k: 'line', via: 'speaker', label: '廣播' });
    expect(buildScript([{ name: 'a.yaml', source: src('megaphone') }]).errors.join('\n')).toContain('via');
  });
});
