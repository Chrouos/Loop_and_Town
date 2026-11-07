import { BACKLOG_SIZE, Director } from '../src/engine/director';
import { DEFAULT_SETTINGS, SAVE_KEY, freshSave, loadSave, writeSave, type GameSave } from '../src/engine/save';
import { lineTiming, readingMs } from '../src/engine/text';
import { lineId } from '../src/script/parse';
import { buildScript } from '../src/script/validate';
import type { Beat, GameScript, LineBeat } from '../src/script/types';
import { silentAudio } from './harness';

// One day: lines, a pause, a timed question, a real-time wait. `end: reset` with no advance rule, so it repeats.
const DAY = `
chapter: 1
title: 測試
start: s1
advance: []
scenes:
  - id: s1
    time: "06:12"
    place: 車站
    beats:
      - narr: 雨打在窗外冷氣機的鐵殼上，一聲一聲，很慢。
      - yuan: 妳醒了嗎？車快到了，等一下要下車喔。
      - pause: 2
      - think: 他的聲音比平常低一點，像是怕吵到誰。
      - narr: 車廂晃了一下，有人的行李箱滑過走道，撞到椅腳。
      - yuan: 小心，前面那個箱子還沒停下來，妳腳先收一下。
      - think: 我把腳收回來，鞋底蹭過地板，聲音比我以為的還大。
      - narr: 廣播響了，念的是下一站的站名，尾音被雜訊吃掉一半。
      - yuan: 是這站沒錯，我記得旁邊有一間麵包店，味道很香。
      - think: 麵包的味道還沒到，可是我好像已經聞得到了。
      - if: chloop >= 2 && flag.c1_new
        then:
          - narr: 這次，她先聽見了月台上的廣播。
      - yuan: 我們先去郵局，再去找若晴，好不好？
      - choice:
          timeout: 4
          options:
            - text: 「好。」
              then:
                - yuan: 那走吧。
            - text: （點頭）
              then:
                - set: c1_new
      - { wait: 3 }
      - narr: 列車停了下來，門打開，外面的風灌進來。
      - pause: 1
      - end: reset
`;

function build(source = DAY): GameScript {
  const { script, errors } = buildScript([{ name: 'a.yaml', source }]);
  expect(errors).toEqual([]);
  return script;
}

function play(script: GameScript, save: GameSave = freshSave(), storage?: Storage) {
  let wall = 0;
  let current = save;
  const director = new Director(script, save, {
    audio: silentAudio(),
    vibrate: () => undefined,
    persist: (next) => { current = next; return storage ? writeSave(storage, next) : undefined; },
    wallNow: () => wall,
  });
  const tick = (ms = 50) => { wall += ms; director.tick(ms); };
  const until = (done: () => boolean, max = 20000) => { for (let i = 0; i < max && !done(); i++) tick(); expect(done()).toBe(true); };
  return { director, tick, until, saved: () => current };
}

/** Plays one whole loop (answering at once), from the first scene to midnight; returns how long the scene part took. */
function liveLoop(director: Director, tick: (ms?: number) => void): number {
  const loop = director.save.loop;
  let from = -1;
  for (let i = 0; i < 40000; i++) {
    const view = director.view;
    if (view.phase === 'scene' && from < 0) from = view.t;
    if (view.phase === 'reset' && director.save.loop > loop) return view.t - from;
    if (view.choice) director.choose(view.choice.options[0].index);
    tick();
  }
  throw new Error('the loop never ended');
}

function lines(beats: Beat[]): LineBeat[] {
  const found: LineBeat[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    if ((node as Beat).k === 'line') found.push(node as LineBeat);
    Object.values(node).forEach(walk);
  };
  walk(beats);
  return found;
}

describe('line ids', () => {
  it('every line, nested or not, has an id from its scene and its words, not its place in the scene', () => {
    const script = build();
    const all = lines(script.scenes.get('s1')!.beats);
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((line) => line.id?.startsWith('s1#'))).toBe(true);
    // Nested in an if and in a choice too.
    expect(all.find((line) => line.text === '那走吧。')?.id).toBe(lineId('s1', { kind: 'char', speaker: 'yuan', text: '那走吧。' }));
    // A beat added above leaves the ids below as they were.
    const edited = build(DAY.replace('      - pause: 2\n', '      - pause: 2\n      - narr: 加在中間的一句新的話。\n'));
    const before = new Map(all.map((line) => [line.text, line.id]));
    for (const line of lines(edited.scenes.get('s1')!.beats)) if (before.has(line.text)) expect(line.id).toBe(before.get(line.text));
    // The same words said by someone else are another line.
    expect(lineId('s1', { kind: 'narr', speaker: 'me', text: '好。' })).not.toBe(lineId('s1', { kind: 'char', speaker: 'yuan', text: '好。' }));
  });
});

describe('聽過的話自動放快', () => {
  it('a second loop of the same day takes less than half the time; the wait in it does not get shorter', () => {
    const { director, tick } = play(build());
    director.start();
    const first = liveLoop(director, tick);
    let waited = 0;
    director.subscribe(() => { if (director.view.waiting) waited = director.view.waiting.seconds; });
    const second = liveLoop(director, tick);
    expect(second).toBeLessThan(first * 0.5);
    expect(waited).toBe(3);
  });

  it('with the setting off, a second loop takes as long as the first', () => {
    const { director, tick } = play(build(), { ...freshSave(), settings: { ...DEFAULT_SETTINGS, fastHeard: false } });
    director.start();
    const first = liveLoop(director, tick);
    const second = liveLoop(director, tick);
    expect(second).toBeGreaterThan(first * 0.9);
  });

  it('a heard line is marked for the screen (drawn dimmer); an unheard one is not, and keeps its full time', () => {
    const { director, tick, until } = play(build());
    director.start();
    liveLoop(director, tick);
    until(() => director.view.center?.text === '雨打在窗外冷氣機的鐵殼上，一聲一聲，很慢。');
    expect(director.view.center?.heard).toBe(true);
    const full = lineTiming('雨打在窗外冷氣機的鐵殼上，一聲一聲，很慢。', 'narr', 'normal').revealMs;
    expect(director.view.center!.revealMs).toBeCloseTo(full * 0.35, 0);
  });
});

describe('fast-forward', () => {
  it('goes past heard lines and stops at an unheard one, which plays at its own pace', () => {
    const { director, tick, until } = play(build());
    director.start();
    liveLoop(director, tick);
    until(() => director.view.phase === 'scene' && Boolean(director.view.center));
    // On this loop a line she has never heard waits in the middle.
    (director.loopFlags as Set<string>).add('c1_new');
    expect(director.fastForward()).toBe(true);
    expect(director.view.skipping).toBe(true);
    const startedAt = director.view.t;
    until(() => !director.view.skipping);
    expect(director.view.center?.text).toBe('這次，她先聽見了月台上的廣播。');
    expect(director.view.center?.heard).toBeUndefined();
    expect(director.view.center?.revealMs).toBe(lineTiming('這次，她先聽見了月台上的廣播。', 'narr', 'normal').revealMs);
    // Nine heard lines and a two-second pause went by in a couple of seconds.
    expect(director.view.t - startedAt).toBeLessThan(3000);
    // Not heard yet: nothing to go past until it has been.
    expect(director.fastForward()).toBe(false);
  });

  it('stops at a choice without choosing, and at a wait without shortening it', () => {
    const { director, tick, until } = play(build());
    director.start();
    liveLoop(director, tick);
    until(() => director.view.phase === 'scene' && Boolean(director.view.center));
    expect(director.fastForward()).toBe(true);
    until(() => !director.view.skipping);
    expect(director.view.choice).not.toBeNull();
    const choice = director.view.choice!;
    tick(500);
    expect(director.view.choice?.key).toBe(choice.key);
    expect(director.fastForward()).toBe(false);
    director.choose(choice.options[0].index);
    until(() => director.view.center?.text === '好。');
    expect(director.fastForward()).toBe(true);
    until(() => !director.view.skipping);
    expect(director.view.waiting?.seconds).toBe(3);
    const waitStart = director.view.waiting!.startedAt;
    expect(director.fastForward()).toBe(false);
    until(() => !director.view.waiting);
    expect(director.view.t - waitStart).toBeGreaterThanOrEqual(3000);
  });

  it('any input stops it', () => {
    const { director, tick, until } = play(build());
    director.start();
    liveLoop(director, tick);
    until(() => director.view.phase === 'scene' && Boolean(director.view.center));
    director.fastForward();
    tick();
    director.stopFastForward();
    expect(director.view.skipping).toBe(false);
  });
});

describe('heard lines are kept', () => {
  it('across a reload, and are gone with a new game', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } } as unknown as Storage;
    const script = build();
    const first = play(script, freshSave(), storage);
    first.director.start();
    liveLoop(first.director, first.tick);
    const id = lineId('s1', { kind: 'narr', speaker: 'me', text: '雨打在窗外冷氣機的鐵殼上，一聲一聲，很慢。' });
    expect(first.director.hasHeard(id)).toBe(true);

    const { save, problem } = loadSave(storage);
    expect(problem).toBeNull();
    expect(save.heard).toContain(id);
    const second = play(script, save, storage);
    expect(second.director.hasHeard(id)).toBe(true);
    second.director.newGame();
    expect(second.director.hasHeard(id)).toBe(false);
    expect(JSON.parse(data.get(SAVE_KEY)!).heard).toEqual([]);
  });

  it('an old save without them loads with none, and duplicates are dropped', () => {
    const old = JSON.parse(JSON.stringify(freshSave())) as Record<string, unknown>;
    delete old.heard;
    delete (old.settings as Record<string, unknown>).fastHeard;
    const storage = { getItem: () => JSON.stringify(old), setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const loaded = loadSave(storage).save;
    expect(loaded.heard).toEqual([]);
    expect(loaded.settings.fastHeard).toBe(true);
    expect(loaded.settings.untimedChoices).toBe(false);
    const doubled = { getItem: () => JSON.stringify({ ...old, heard: ['a#1', 'a#1', 7, 'b#2'], settings: { textSpeed: 'instant' } }), setItem: () => undefined, removeItem: () => undefined } as unknown as Storage;
    const again = loadSave(doubled).save;
    expect(again.heard).toEqual(['a#1', 'b#2']);
    expect(again.settings.textSpeed).toBe('instant');
  });
});

describe('剛剛聽到的', () => {
  it('keeps each line heard clearly, with who said it, where and when', () => {
    const { director, tick } = play(build());
    director.start();
    liveLoop(director, tick);
    const log = director.backlog;
    expect(log[0]).toMatchObject({ kind: 'narr', text: '雨打在窗外冷氣機的鐵殼上，一聲一聲，很慢。', place: '車站', clock: '06:12', loop: 1 });
    expect(log.find((entry) => entry.text === '妳醒了嗎？車快到了，等一下要下車喔。')?.label).toBe('予安');
    expect(log.some((entry) => entry.kind === 'me' && entry.text === '好。')).toBe(true);
    expect(log[log.length - 1].text).toBe('列車停了下來，門打開，外面的風灌進來。');
  });

  it(`keeps the last ${BACKLOG_SIZE}`, () => {
    const many = Array.from({ length: BACKLOG_SIZE + 15 }, (_, i) => `      - narr: 第${i}句。`).join('\n');
    const { director, tick, until } = play(build(`
chapter: 1
title: 測試
start: s1
advance: []
scenes:
  - id: s1
    beats:
${many}
      - pause: 5
      - end: reset
`));
    director.start();
    until(() => director.backlog.some((entry) => entry.text === `第${BACKLOG_SIZE + 14}句。`), 200000);
    expect(director.backlog.length).toBe(BACKLOG_SIZE);
    expect(director.backlog[0].text).toBe('第15句。');
    tick();
  });
});

describe('choice timeouts', () => {
  const question = (options: string[], extra = '') => `
chapter: 1
title: 測試
start: s1
advance: []
scenes:
  - id: s1
    beats:
      - narr: 有人在問她。
      - choice:
          timeout: 4
${extra}
          options:
${options.map((text) => `            - text: ${text}\n              then:\n                - narr: 選了。`).join('\n')}
      - narr: 結束了。
      - pause: 30
      - end: reset
`;

  it('a short one keeps its own time; a long one gets as long as reading every option takes', () => {
    const short = play(build(question(['「好。」', '「不要。」'])));
    short.director.start();
    short.until(() => Boolean(short.director.view.choice));
    expect(short.director.view.choice!.timeout).toBe(4);
    expect(short.director.view.choice!.fallback).toBe('「不要。」');

    const options = [
      '「妳剛剛說的那個地方，是在郵局後面那條巷子，還是另外一條更窄的？」',
      '「我想先回去拿傘，外面的雨好像越下越大了，妳等我一下好不好？」',
      '「如果我現在說我記得那封信的內容，妳會相信我嗎，還是會覺得我在亂講？」',
    ];
    const long = play(build(question(options)));
    long.director.start();
    long.until(() => Boolean(long.director.view.choice));
    const timeout = long.director.view.choice!.timeout!;
    expect(timeout * 1000).toBeCloseTo(readingMs(options, 'normal'), 3);
    expect(timeout).toBeGreaterThan(14);
  });

  it('選擇不倒數: it waits as long as it takes, and silence is on screen to pick', () => {
    const source = question(['「好。」']).replace('          options:', '          silence:\n            - narr: 她沒有說話。\n          options:');
    const { director, tick, until } = play(build(source), { ...freshSave(), settings: { ...DEFAULT_SETTINGS, untimedChoices: true } });
    director.start();
    until(() => Boolean(director.view.choice));
    expect(director.view.choice!.timeout).toBeUndefined();
    for (let i = 0; i < 1200; i++) tick();
    expect(director.view.choice).not.toBeNull();
    const silent = director.view.choice!.options.find((option) => option.text === '（沉默）');
    expect(silent).toBeDefined();
    director.choose(silent!.index);
    until(() => director.view.center?.text === '她沒有說話。');
  });

  it('with the countdown on, silence is never an option on screen and is said as what time running out does', () => {
    const source = question(['「好。」']).replace('          options:', '          silence:\n            - narr: 她沒有說話。\n          options:');
    const { director, until } = play(build(source));
    director.start();
    until(() => Boolean(director.view.choice));
    expect(director.view.choice!.options.map((option) => option.text)).toEqual(['「好。」']);
    expect(director.view.choice!.fallback).toBe('silence');
  });
});

describe('text speed 立即', () => {
  it('shows the whole line at once and stays as long as reading it at 快 would take', () => {
    const text = '雨打在窗外冷氣機的鐵殼上，一聲一聲，很慢。';
    const instant = lineTiming(text, 'narr', 'instant');
    const fast = lineTiming(text, 'narr', 'fast');
    expect(instant.revealMs).toBe(0);
    expect(instant.phrases.every((phrase) => phrase.at === 0)).toBe(true);
    expect(instant.phrases.map((phrase) => phrase.text)).toEqual(fast.phrases.map((phrase) => phrase.text));
    expect(instant.holdMs).toBe(fast.revealMs + fast.holdMs);
  });
});
