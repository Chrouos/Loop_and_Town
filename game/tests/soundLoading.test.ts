import { Director } from '../src/engine/director';
import { soundsAround } from '../src/engine/prefetch';
import { DEFAULT_SETTINGS, freshSave, readSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

const SOURCE = `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    time: "06:12"
    place: 測試
    ambience: [train_interior]
    beats:
      - { sfx: envelope, at: front, dist: near, text: 沙 }
      - choice:
          options:
            - text: 「走吧。」
              goto: s2
            - text: 「再等一下。」
              then:
                - locate: { sfx: phone_buzz, at: right, decoys: [{ sfx: dog_bark, at: left }], success: [], fail: [] }
    next: s2
  - id: s2
    ambience: [street_morning]
    beats:
      - { sfx: door_slam, at: left, dist: mid, text: 碰 }
      - end: reset
`;

function make() {
  const { script, errors } = buildScript([{ name: 'a.yaml', source: SOURCE }]);
  expect(errors).toEqual([]);
  return script;
}

describe('loading sounds before they are needed', () => {
  it("puts the scene's own story sounds first, then its life and the scenes it leads to", () => {
    const sounds = soundsAround(make(), 's1');
    expect(sounds.now).toEqual(['envelope', 'phone_buzz', 'dog_bark']);
    expect(sounds.soon).toContain('rail_clack'); // the train's background life
    expect(sounds.soon).toContain('door_slam'); // the next scene
    expect(sounds.soon).not.toContain('envelope');
    expect(sounds.amb).toEqual(['train_interior', 'street_morning']);
  });

  it('asks the engine for them as a chapter opens, before its first scene plays', () => {
    const asked: string[][] = [];
    const audio = { ...silentAudio(), prefetch: (sounds: { now: readonly string[] }) => { asked.push([...sounds.now]); } };
    const director = new Director(make(), freshSave(), { audio, vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 });
    director.start();
    expect(asked[0]).toEqual(['envelope', 'phone_buzz', 'dog_bark']);
  });
});

describe('settings from older saves', () => {
  it('does not keep a voice level the settings page can no longer change', () => {
    const save = { ...freshSave(), settings: { ...DEFAULT_SETTINGS, voice: 0 } };
    const storage = { getItem: () => JSON.stringify(save) } as unknown as Storage;
    expect(readSave(storage).settings.voice).toBe(DEFAULT_SETTINGS.voice);
  });
});
