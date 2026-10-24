import { Director, SHIFT_MS } from '../src/engine/director';
import { freshSave, MEMORY_CAPACITY, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { splitPhrases } from '../src/engine/text';
import { silentAudio } from './harness';

const SCRIPT = `
chapter: 1
title: 測試
start: s1
advance:
  - if: know.k_heard
    to: 2
scenes:
  - id: s1
    time: "06:12"
    place: 測試
    cast: { yuan: right }
    beats:
      - { cue: side, at: back-left, text: 窸窸窣窣 }
      - { yuan: 第一句話很長很長很長很長很長。, learn: k_main_one }
      - { yuan: 第二句話也很長很長很長很長。, learn: k_main_two }
      - choice:
          timeout: 5
          options:
            - text: 「好。」
              then:
                - set: said_yes
            - text: （沉默）
      - { wait: 4 }
      - learn: k_heard
      - end: reset
    threads:
      side:
        beats:
          - { woman: 旁邊的人在說一件事。, learn: k_side }
`;

const NEXT = `
chapter: 2
title: 第二
start: t1
advance:
  - if: "true"
    to: 2
scenes:
  - id: t1
    beats:
      - narr: 下一輪。
      - end: reset
`;

function make(speed = 1) {
  const { script, errors } = buildScript([{ name: 'a.yaml', source: SCRIPT }, { name: 'b.yaml', source: NEXT }]);
  expect(errors).toEqual([]);
  let save: GameSave = freshSave();
  let wall = 0;
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => wall }, { speed });
  const run = (ms: number, step = 50) => { for (let t = 0; t < ms; t += step) { wall += step; director.tick(step); } };
  return { director, run, getSave: () => save };
}

function enterScene(director: Director, run: (ms: number) => void) {
  director.start();
  for (let i = 0; i < 400 && director.view.phase !== 'scene'; i++) run(50);
  expect(director.view.phase).toBe('scene');
}

describe('director', () => {
  it('splits text into rhythmic phrases', () => {
    expect(splitPhrases('你……|你怎麼會知道，這件事？').map((part) => part.text)).toEqual(['你……', '你怎麼會知道，', '這件事？']);
  });

  it('only learns what was heard while focused', () => {
    const { director, run } = make();
    enterScene(director, run);
    // Turn away immediately: the main conversation goes on without us.
    director.attend('side');
    expect(director.view.focus).toBeNull();
    run(SHIFT_MS + 50);
    expect(director.view.focus).toBe('side');
    run(8000);
    expect(director.knows.has('k_side')).toBe(true);
    expect(director.knows.has('k_main_one')).toBe(false);
  });

  it('returns attention to the main thread after the side thread ends (elastic attention)', () => {
    const { director, run } = make();
    enterScene(director, run);
    director.attend('side');
    run(12000);
    expect(director.view.focus).toBe('main');
  });

  it('a question pulls attention back and a timed choice falls back to its default', () => {
    const { director, run } = make();
    enterScene(director, run);
    run(30000);
    expect(director.view.choice).toBeNull();
    expect(director.loopFlags.has('said_yes')).toBe(false); // default = last option (silence)
  });

  it('hurrying finishes a phrase reveal, then moves on, but never skips a wait', () => {
    const { director, run } = make();
    enterScene(director, run);
    run(100);
    const first = director.view.center?.key;
    director.hurry();
    director.hurry();
    run(50);
    expect(director.view.center?.key).not.toBe(first);
    // reach the wait
    for (let i = 0; i < 100 && !director.view.waiting; i++) { director.hurry(); if (director.view.choice) director.choose(0); run(50); }
    expect(director.view.waiting).not.toBeNull();
    const before = director.view.t;
    director.hurry();
    expect(director.view.t - before).toBeLessThan(100);
  });

  it('resets at midnight and advances chapters from what the player learned', () => {
    const { director, run, getSave } = make();
    enterScene(director, run);
    for (let i = 0; i < 2000 && getSave().loop === 1; i++) { director.hurry(); if (director.view.choice) director.choose(0); run(100); }
    expect(getSave().loop).toBe(2);
    expect(getSave().chapter).toBe('2');
    expect(director.loopFlags.size).toBe(0);
  });

  it('tapping the cue being listened to turns her back to herself', () => {
    const { director, run } = make();
    enterScene(director, run);
    director.attend('side');
    run(SHIFT_MS + 50);
    expect(director.view.focus).toBe('side');
    director.attend('side');
    run(SHIFT_MS + 50);
    expect(director.view.focus).toBe('main');
  });

  it('lets the sound she turned to finish before the scene moves on, and says a spoken option before leaving', () => {
    const SIDE = `
chapter: 1
title: 側聽
start: a1
scenes:
  - id: a1
    beats:
      - { cue: side, at: left, text: 窸窣 }
      - narr: 短。
    threads:
      side:
        beats:
          - { woman: 第一句很長很長很長很長很長很長。, learn: k_side_one }
          - { woman: 第二句也很長很長很長很長很長。, learn: k_side_two }
    next: a2
  - id: a2
    beats:
      - choice:
          options:
            - text: 「我留下來。」
              goto: a3
  - id: a3
    beats: [{ narr: 留下來了。 }, { end: reset }]
`;
    const { script, errors } = buildScript([{ name: 'a.yaml', source: SIDE }]);
    expect(errors).toEqual([]);
    const director = new Director(script, freshSave(), { audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 }, { speed: 1 });
    const tick = (ms: number) => { for (let t = 0; t < ms; t += 50) director.tick(50); };
    director.start();
    for (let i = 0; i < 400 && director.view.phase !== 'scene'; i++) tick(50);
    tick(450);
    director.attend('side');
    for (let i = 0; i < 400 && director.view.sceneId === 'a1'; i++) tick(50);
    expect(director.knows.has('k_side_two')).toBe(true);
    for (let i = 0; i < 400 && !director.view.choice; i++) tick(50);
    director.choose(0);
    const said: string[] = [];
    for (let i = 0; i < 400 && director.view.sceneId !== 'a3'; i++) { if (director.view.center) said.push(director.view.center.text); tick(50); }
    expect(said).toContain('我留下來。');
  });

  it('shows the place card only when the area changes', () => {
    const AREAS = `
chapter: 1
title: 地點
start: a1
scenes:
  - id: a1
    time: "08:00"
    place: 林家老屋
    beats: [{ narr: 客廳。 }]
    next: a2
  - id: a2
    time: "08:25"
    place: 林家老屋，知夏的房間
    beats: [{ narr: 房間。 }]
    next: a3
  - id: a3
    time: "11:20"
    place: 老街
    beats: [{ narr: 街上。 }, { end: reset }]
`;
    const { script, errors } = buildScript([{ name: 'a.yaml', source: AREAS }]);
    expect(errors).toEqual([]);
    const director = new Director(script, freshSave(), { audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => 0 }, { speed: 1 });
    director.start();
    const cards: string[] = [];
    const corner: string[] = [];
    for (let i = 0; i < 2000 && director.view.phase !== 'reset'; i++) {
      const view = director.view;
      if (view.phase === 'card' && view.card?.place && cards.at(-1) !== view.card.place) cards.push(view.card.place);
      if (view.phase === 'scene' && view.place && corner.at(-1) !== view.place) corner.push(view.place);
      director.hurry();
      director.tick(50);
    }
    expect(cards).toEqual(['林家老屋', '老街']);
    expect(corner).toEqual(['林家老屋', '林家老屋，知夏的房間', '老街']);
  });

  it('captures only perceived lines and caps memories', () => {
    const { director, run, getSave } = make();
    enterScene(director, run);
    run(2500);
    expect(director.view.center?.perceived).toBe(true);
    expect(director.capture()).toBe(true);
    expect(getSave().memories).toHaveLength(1);
    expect(director.capture()).toBe(false); // same line twice
    for (let i = 0; i < MEMORY_CAPACITY; i++) getSave().memories.push({ ...getSave().memories[0], key: `x${i}`, text: `x${i}` });
    run(4000);
    if (director.view.center?.perceived) {
      director.capture();
      expect(director.view.keep).not.toBeNull();
    }
  });

  it('the last line lingers as an echo through a scene change, and only crosses into a continuous scene', () => {
    const { script, errors } = buildScript([{ name: 'c.yaml', source: `
chapter: 1
title: 換場
start: a
scenes:
  - id: a
    time: "06:12"
    place: 房間
    beats:
      - narr: 房間裡的最後一句。
      - goto: b
  - id: b
    beats:
      - narr: 同一刻，接著說。
      - goto: c
  - id: c
    time: "07:00"
    place: 別處
    beats:
      - narr: 換了地方。
      - end: reset
` }]);
    expect(errors).toEqual([]);
    let wall = 0;
    const director = new Director(script, freshSave(), { audio: silentAudio(), vibrate: () => undefined, persist: () => undefined, wallNow: () => wall }, { speed: 1 });
    const run = (ms: number) => { for (let t = 0; t < ms; t += 50) { wall += 50; director.tick(50); } };
    const until = (done: () => boolean) => { for (let i = 0; i < 1000 && !done(); i++) run(50); expect(done()).toBe(true); };
    director.start();

    until(() => director.view.center?.text === '房間裡的最後一句。');
    until(() => director.view.phase === 'out');
    expect(director.view.center).toBeNull();
    expect(director.view.echo?.text).toBe('房間裡的最後一句。');

    // b has no time/place: the echo is still there when it begins.
    until(() => director.view.center?.text === '同一刻，接著說。');
    expect(director.view.echo?.text).toBe('房間裡的最後一句。');

    // c is somewhere else: by the time it begins the old echo is gone.
    until(() => director.view.phase === 'out');
    expect(director.view.echo?.text).toBe('同一刻，接著說。');
    until(() => director.view.center?.text === '換了地方。');
    expect(director.view.echo).toBeNull();
  });
});
