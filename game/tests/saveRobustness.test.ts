import { Director } from '../src/engine/director';
import { BACKUP_KEY, CORRUPT_KEY, DEFAULT_SETTINGS, NEWER_KEY, SAVE_KEY, SAVE_VERSION, freshSave, loadSave, readSave, setAsideNewerSave, writeSave, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import type { GameScript } from '../src/script/types';
import { silentAudio } from './harness';

const SCRIPT = `
chapter: 1
title: 測試
start: s1
restart: s2
advance: []
scenes:
  - id: s1
    time: "06:12"
    place: 測試
    beats:
      - if: "!know.k_seen"
        then:
          - narr: 第一次聽到。
        else:
          - narr: 又聽到了。
      - tension: 30
      - learn: k_seen
      - set: c1_here
      - pause: 10
      - { wait: 4 }
      - narr: 等完了。
      - goto: s2
  - id: s2
    beats:
      - narr: 下一個地方。
      - pause: 60
      - end: reset
`;

function build(source = SCRIPT): GameScript {
  const { script, errors } = buildScript([{ name: 'a.yaml', source }]);
  expect(errors).toEqual([]);
  return script;
}

/** A Map-backed Storage; `full` makes every write throw (quota). */
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    full: false,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { if (storage.full) throw new Error('quota'); data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  return { storage: storage as unknown as Storage & { full: boolean }, data };
}

function play(script: GameScript, save: GameSave, storage?: Storage) {
  let wall = 0;
  const lines: string[] = [];
  const director = new Director(script, save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => (storage ? writeSave(storage, next) : undefined), wallNow: () => wall });
  director.subscribe(() => { const text = director.view.center?.text; if (text && lines[lines.length - 1] !== text) lines.push(text); });
  const tick = (ms = 50) => { wall += ms; director.tick(ms); director.hurry(); };
  const until = (done: () => boolean, max = 2000) => { for (let i = 0; i < max && !done(); i++) tick(); expect(done()).toBe(true); };
  return { director, lines, tick, until };
}

describe('resuming saved ids the script no longer has', () => {
  it('an unknown scene starts its chapter over (the restart scene after the first loop) and drops a stale wait', () => {
    const script = build();
    const save: GameSave = { ...freshSave(), started: true, chapter: '1', chLoop: 2, scene: 'gone', flags: ['c1_old'], wait: { scene: 'gone', index: 3, endsAt: 0 } };
    const { director, until } = play(script, save);
    director.start();
    until(() => director.view.phase === 'scene');
    expect(director.view.sceneId).toBe('s2');
    expect(director.save.scene).toBe('s2');
    expect(director.save.wait).toBeUndefined();
    expect(director.loopFlags.has('c1_old')).toBe(false);
  });

  it('an unknown chapter falls back to the first chapter, and the save says so', () => {
    const script = build();
    const save: GameSave = { ...freshSave(), started: true, chapter: '9', chLoop: 3, scene: 'x9_1', reached: ['1'] };
    const { director, until } = play(script, save);
    director.start();
    until(() => director.view.phase === 'scene');
    expect(director.save.chapter).toBe('1');
    expect(director.save.chLoop).toBe(1);
    expect(director.view.sceneId).toBe('s1');
  });
});

describe('reading a save', () => {
  it('a save from a newer build is never written over; setting it aside lets this build save again', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION + 1, started: true, chapter: '3', shiny: true });
    const { storage, data } = memoryStorage({ [SAVE_KEY]: raw });
    const { save, problem } = loadSave(storage);
    expect(problem).toBe('newer');
    expect(save.started).toBe(false);
    expect(writeSave(storage, save)).toBe(false);
    expect(data.get(SAVE_KEY)).toBe(raw);
    setAsideNewerSave(storage);
    expect(data.get(NEWER_KEY)).toBe(raw);
    expect(writeSave(storage, save)).toBe(true);
  });

  it('a newer save shows on the director as saveProblem, and the game plays on without writing', () => {
    const raw = JSON.stringify({ version: SAVE_VERSION + 1 });
    const { storage, data } = memoryStorage({ [SAVE_KEY]: raw });
    const { save, problem } = loadSave(storage);
    const director = new Director(build(), save, { audio: silentAudio(), vibrate: () => undefined, persist: (next) => writeSave(storage, next), wallNow: () => 0 }, { saveProblem: problem });
    director.start();
    for (let i = 0; i < 200; i++) director.tick(50);
    expect(director.view.saveProblem).toBe('newer');
    expect(data.get(SAVE_KEY)).toBe(raw);
  });

  it('an unreadable save is kept aside; the last good one is loaded instead when there is one', () => {
    const good = JSON.stringify({ ...freshSave(), started: true, chapter: '2', reached: ['1', '2'] });
    const first = memoryStorage({ [SAVE_KEY]: good });
    expect(loadSave(first.storage).problem).toBeNull();
    expect(first.data.get(BACKUP_KEY)).toBe(good);

    const broken = memoryStorage({ [SAVE_KEY]: '{"version":1,"started":tr', [BACKUP_KEY]: good });
    const restored = loadSave(broken.storage);
    expect(restored.problem).toBe('restored');
    expect(restored.save.chapter).toBe('2');
    expect(broken.data.get(CORRUPT_KEY)).toBe('{"version":1,"started":tr');

    const lost = memoryStorage({ [SAVE_KEY]: 'not json' });
    const fresh = loadSave(lost.storage);
    expect(fresh.problem).toBe('corrupt');
    expect(fresh.save.started).toBe(false);
    expect(lost.data.get(CORRUPT_KEY)).toBe('not json');
  });

  it('every field is checked: out-of-range numbers clamp, wrong types fall back, unknown chapters drop', () => {
    const stored = {
      version: 1, started: 'yes', chapter: '2', loop: 0, chLoop: 2.7, tension: 250,
      knowledge: ['k_a', 3, null], flags: 'c2_x', seen: [1], endings: ['b', {}], reached: ['1', '2', '99'],
      memories: [{ key: 'm', text: '話', kind: 'char', loop: 1, chapter: '1' }, { key: 'bad' }, 'x'],
      settings: { volume: 'loud', sfx: 4, audio: 1, textSpeed: 'warp', fontSize: 'gigantic', vibration: false },
      replay: { chapter: 3 }, wait: { scene: 's1', index: -1, endsAt: 0 },
    };
    const save = readSave(memoryStorage({ [SAVE_KEY]: JSON.stringify(stored) }).storage);
    expect(save.started).toBe(false);
    expect(save.loop).toBe(1);
    expect(save.chLoop).toBe(2);
    expect(save.tension).toBe(100);
    expect(save.knowledge).toEqual(['k_a']);
    expect(save.flags).toEqual([]);
    expect(save.seen).toEqual([]);
    expect(save.endings).toEqual(['b']);
    expect(save.reached).toEqual(['1', '2']);
    expect(save.memories.map((memory) => memory.key)).toEqual(['m']);
    expect(save.settings).toEqual({ ...DEFAULT_SETTINGS, sfx: 1, vibration: false });
    expect(save.replay).toBeNull();
    expect(save.wait).toBeUndefined();
    expect(readSave(memoryStorage({ [SAVE_KEY]: JSON.stringify({ version: 1, tension: -5 }) }).storage).tension).toBe(0);
    expect(readSave(memoryStorage({ [SAVE_KEY]: JSON.stringify({ version: 1, tension: 'x' }) }).storage).tension).toBe(0);
  });
});

describe('a reload replays the scene from where the save stands', () => {
  it('tension, knowledge and branches come out the same as playing straight through', () => {
    const script = build();
    const { storage, data } = memoryStorage();
    const first = play(script, { ...freshSave(), started: true, tension: 10 }, storage);
    first.director.start();
    first.until(() => first.director.knows.has('k_seen'));
    expect(first.director.tension).toBe(38);
    // Gone mid-scene, before the wait: the save on disk replays s1 from its entry.
    expect(readSave(storage).wait).toBeUndefined();
    const again = play(script, readSave(storage));
    again.director.start();
    again.until(() => again.director.view.waiting !== null);
    expect(again.director.tension).toBe(38);
    expect(again.lines).toContain('第一次聽到。');
    expect(again.lines).not.toContain('又聽到了。');
    expect(JSON.parse(data.get(SAVE_KEY)!).entry.tension).toBe(10);
  });

  it('a reload during a wait comes back to the wait with what she had then, flags too', () => {
    const script = build();
    const { storage } = memoryStorage();
    const first = play(script, { ...freshSave(), started: true }, storage);
    first.director.start();
    first.until(() => first.director.view.waiting !== null);
    const saved = readSave(storage);
    expect(saved.wait?.state?.flags).toContain('c1_here');
    const again = play(script, saved);
    again.director.start();
    again.until(() => again.director.view.phase === 'scene');
    expect(again.director.view.waiting).not.toBeNull();
    expect(again.director.loopFlags.has('c1_here')).toBe(true);
    expect(again.director.knows.has('k_seen')).toBe(true);
    expect(again.director.tension).toBe(30);
    again.until(() => again.lines.includes('等完了。'));
    expect(again.lines).not.toContain('第一次聽到。');
  });

  it('a wait whose scene was edited above it is not resumed: the scene starts over from its entry', () => {
    const { storage } = memoryStorage();
    const first = play(build(), { ...freshSave(), started: true }, storage);
    first.director.start();
    first.until(() => first.director.view.waiting !== null);
    const edited = build(SCRIPT.replace('      - set: c1_here\n', '      - set: c1_here\n      - learn: k_new\n'));
    const again = play(edited, readSave(storage));
    again.director.start();
    again.until(() => again.director.view.phase === 'scene');
    again.until(() => again.director.view.waiting !== null);
    expect(again.lines).toContain('第一次聽到。');
    expect(again.director.knows.has('k_new')).toBe(true);
    expect(again.director.tension).toBe(30);
  });
});

describe('a question with nothing to pick', () => {
  it('is skipped instead of hanging', () => {
    const script = build(`
chapter: 1
title: 測試
start: s1
advance: []
scenes:
  - id: s1
    beats:
      - narr: 有人問她。
      - choice:
          options:
            - text: （點頭）
              then:
                - narr: 不該出現。
      - narr: 問題過去了。
      - pause: 60
      - end: reset
`);
    const beat = script.scenes.get('s1')!.beats[1];
    if (beat.k !== 'choice') throw new Error('expected a choice');
    beat.options[0].disabledCond = { op: 'true' } as never;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { director, lines, until } = play(script, { ...freshSave(), started: true });
    director.start();
    until(() => lines.includes('問題過去了。'));
    expect(lines).not.toContain('不該出現。');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('a save that does not land', () => {
  it('the director says so, and clears it once saving works again', () => {
    const { storage } = memoryStorage();
    storage.full = true;
    const { director, tick } = play(build(), { ...freshSave(), started: true }, storage);
    director.start();
    for (let i = 0; i < 100 && director.view.phase !== 'scene'; i++) tick();
    expect(director.view.saveProblem).toBe('failed');
    storage.full = false;
    director.updateSettings({ volume: 0.5 });
    expect(director.view.saveProblem).toBeNull();
  });
});
