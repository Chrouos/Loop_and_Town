import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { GameApp } from '../src/GameApp';
import type { BacklogEntry, Director, View } from '../src/engine/director';
import { NEWER_KEY, SAVE_KEY, SAVE_VERSION, freshSave, writeSave } from '../src/engine/save';

vi.mock('../src/audio/engine', async () => ({ createAudioEngine: (await import('./harness')).silentAudio }));

type Game = { director: Director; setScreen: (screen: string) => void };

let container: HTMLDivElement;
let root: Root;

function render(): Game {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => root.render(<GameApp storage={localStorage} />));
  return (window as unknown as { __game: Game }).__game;
}

function mountPlaying(): Game {
  writeSave(localStorage, { ...freshSave(), started: true, calibrated: true });
  const game = render();
  flushSync(() => game.setScreen('play'));
  game.director.setPaused(true);
  Object.assign(game.director.view, { phase: 'scene', center: null, echo: null, choice: null, periph: [], ripples: [] } satisfies Partial<View>);
  flushSync(() => game.director.updateSettings({}));
  return game;
}

function show(game: Game, patch: Partial<View>) {
  Object.assign(game.director.view, patch);
  flushSync(() => game.director.updateSettings({}));
}

const press = (key: string, target: EventTarget = document.activeElement ?? window) => {
  flushSync(() => { target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
};
const release = (key: string, target: EventTarget = document.activeElement ?? window) => {
  flushSync(() => { target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true })); });
};
function pointer(type: string, id: number, target: EventTarget = container.querySelector('.lt-stage')!) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: id, pointerType: 'touch' });
  flushSync(() => { target.dispatchEvent(event); });
}
const button = (name: string) => {
  const found = [...container.querySelectorAll<HTMLElement>('button')].find((el) => el.textContent === name || el.getAttribute('aria-label') === name);
  expect(found, name).toBeDefined();
  return found!;
};
const settle = async () => { for (let i = 0; i < 3; i++) await new Promise((resolve) => window.setTimeout(resolve, 0)); };

afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
  localStorage.clear();
});

describe('剛剛聽到的', () => {
  const entries: BacklogEntry[] = [
    { key: 1, kind: 'narr', text: '雨打在窗外的鐵殼上。', clock: '06:12', place: '列車上', loop: 1 },
    { key: 2, kind: 'char', label: '予安', text: '妳醒了嗎？', clock: '06:13', place: '列車上', loop: 1 },
    { key: 3, kind: 'think', text: '他的聲音比平常低。', clock: '06:20', place: '月台', loop: 1 },
    { key: 4, kind: 'me', text: '好。', clock: '06:21', place: '月台', loop: 1 },
  ];

  it('H opens it: a heading for each place, a list item for each line, focus on the newest; H or Esc closes it', async () => {
    const game = mountPlaying();
    (game.director as unknown as { log: BacklogEntry[] }).log.push(...entries);
    press('h');
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toBe('剛剛聽到的');
    expect([...dialog.querySelectorAll('h3')].map((head) => head.textContent)).toEqual(['06:12 · 列車上', '06:20 · 月台']);
    const items = [...dialog.querySelectorAll('section ul li')];
    expect(items).toHaveLength(4);
    expect(items[1].textContent).toBe('予安：妳醒了嗎？');
    expect(items[2].textContent).toBe('心裡想：他的聲音比平常低');
    expect(items[3].textContent).toBe('「好」');
    expect(document.activeElement).toBe(items[3]);
    // Each place's section is named by its heading.
    const section = dialog.querySelector('section')!;
    expect(document.getElementById(section.getAttribute('aria-labelledby')!)?.textContent).toBe('06:12 · 列車上');
    press('Escape');
    await settle();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    press('H', window);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    press('H');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('says so when nothing has been heard yet', () => {
    mountPlaying();
    press('h', window);
    expect(container.querySelector('[role="tabpanel"]')!.textContent).toContain('還沒有聽清楚任何一句');
  });

  it('names the day too once there has been more than one', () => {
    const game = mountPlaying();
    game.director.save.loop = 2;
    (game.director as unknown as { log: BacklogEntry[] }).log.push({ ...entries[0], loop: 2 });
    press('h', window);
    expect(container.querySelector('h3')?.textContent).toBe('第二次 · 06:12 · 列車上');
  });
});

describe('fast-forward controls', () => {
  it('holding F fast-forwards; letting go, or any other key, stops it', () => {
    const game = mountPlaying();
    game.director.setPaused(false);
    press('f', window);
    expect(game.director.view.skipping).toBe(true);
    expect(container.querySelector('.lt-skip')!.getAttribute('role')).toBe('status');
    expect(container.querySelector('.lt-skip')!.textContent).toBe('快轉中');
    release('f', window);
    expect(game.director.view.skipping).toBe(false);
    press('F', window);
    expect(game.director.view.skipping).toBe(true);
    press('ArrowLeft', window);
    expect(game.director.view.skipping).toBe(false);
  });

  it('a two-finger tap fast-forwards and is not also a tap; a one-finger tap stops it', () => {
    const game = mountPlaying();
    game.director.setPaused(false);
    const hurry = vi.spyOn(game.director, 'hurry');
    pointer('pointerdown', 1);
    pointer('pointerdown', 2);
    expect(game.director.view.skipping).toBe(true);
    pointer('pointerup', 1);
    pointer('pointerup', 2);
    expect(hurry).not.toHaveBeenCalled();
    expect(game.director.view.skipping).toBe(true);
    return settle().then(() => {
      pointer('pointerdown', 3);
      expect(game.director.view.skipping).toBe(false);
    });
  });

  it('a hidden-until-focused button does it too, and says when there is nothing heard to go past', () => {
    const game = mountPlaying();
    game.director.setPaused(false);
    const forward = button('快轉聽過的話');
    expect(forward.getAttribute('aria-keyshortcuts')).toBe('F');
    show(game, { choice: { key: 9, options: [{ text: '「好。」', index: 0 }], startedAt: 0 } });
    flushSync(() => forward.click());
    expect(game.director.view.skipping).toBe(false);
    expect([...container.querySelectorAll('[aria-live="polite"]')].some((el) => el.textContent === '這裡還沒聽過，不能快轉')).toBe(true);
  });
});

describe('a timed choice says what running out does', () => {
  it('to a screen reader, through the question group', () => {
    const game = mountPlaying();
    show(game, { focus: 'main', choice: { key: 3, options: [{ text: '「好。」', index: 0 }, { text: '「我自己去。」', index: 1 }], startedAt: 0, timeout: 6, fallback: '「我自己去。」' } });
    const group = container.querySelector('.lt-choices')!;
    expect(document.getElementById(group.getAttribute('aria-describedby')!)?.textContent).toBe('時間到了還沒選，就會選「我自己去」');
    show(game, { focus: 'main', choice: { key: 4, options: [{ text: '「好。」', index: 0 }], startedAt: 0, timeout: 6, fallback: 'silence' } });
    const silent = container.querySelector('.lt-choices')!;
    expect(document.getElementById(silent.getAttribute('aria-describedby')!)?.textContent).toBe('時間到了還沒選，就當作沉默');
    show(game, { focus: 'main', choice: { key: 5, options: [{ text: '「好。」', index: 0 }], startedAt: 0 } });
    expect(container.querySelector('.lt-choices')!.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('save notice on the title', () => {
  it('a newer build’s save: says progress will not be kept, and can start over here', () => {
    const raw = JSON.stringify({ ...freshSave(), version: SAVE_VERSION + 1, started: true });
    localStorage.setItem(SAVE_KEY, raw);
    const game = render();
    const note = container.querySelector('.lt-save-note')!;
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toContain('這份存檔來自比較新的版本，這次的進度不會存。');
    // Not inside the title's whole-screen button: its own controls stay reachable.
    expect(note.closest('[role="button"]')).toBeNull();
    flushSync(() => button('用這一版重新開始').click());
    expect(localStorage.getItem(NEWER_KEY)).toBe(raw);
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).version).toBe(SAVE_VERSION);
    expect(game.director.view.saveProblem).toBeNull();
    expect(container.querySelector('.lt-save-note')).toBeNull();
  });

  it('an unreadable save: one sentence and 知道了', () => {
    localStorage.setItem(SAVE_KEY, '{not json');
    const game = render();
    const note = container.querySelector('.lt-save-note')!;
    expect(note.textContent).toContain('存檔讀不出來，只好從頭開始。');
    flushSync(() => button('知道了').click());
    expect(game.director.view.saveProblem).toBeNull();
    expect(container.querySelector('.lt-save-note')).toBeNull();
  });

  it('a save restored from the backup is news, not an alarm', () => {
    writeSave(localStorage, { ...freshSave(), started: true, chapter: '2', reached: ['1', '2'] });
    // A clean load keeps a backup; then the main copy goes bad.
    render();
    flushSync(() => root.unmount());
    container.remove();
    localStorage.setItem(SAVE_KEY, '{broken');
    render();
    const note = container.querySelector('.lt-save-note')!;
    expect(note.getAttribute('role')).toBe('status');
    expect(note.textContent).toContain('換回了上一次的備份');
  });

  it('a write that fails mid-play is said once, and 知道了 puts it away for the session', () => {
    const game = mountPlaying();
    const full = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    flushSync(() => game.director.updateSettings({ volume: 0.5 }));
    const note = container.querySelector('.lt-save-note')!;
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toContain('進度存不下來');
    flushSync(() => button('知道了').click());
    expect(container.querySelector('.lt-save-note')).toBeNull();
    // Still failing: not said again on every line.
    flushSync(() => game.director.updateSettings({ volume: 0.6 }));
    expect(container.querySelector('.lt-save-note')).toBeNull();
    // Working again, then failing again: that is new, and said.
    full.mockRestore();
    flushSync(() => game.director.updateSettings({ volume: 0.7 }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    flushSync(() => game.director.updateSettings({ volume: 0.8 }));
    expect(container.querySelector('.lt-save-note')).not.toBeNull();
    vi.restoreAllMocks();
  });
});
