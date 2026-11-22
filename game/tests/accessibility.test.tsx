import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { GameApp } from '../src/GameApp';
import type { Director, View } from '../src/engine/director';
import { DEFAULT_SETTINGS, FONT_SIZES, freshSave, writeSave } from '../src/engine/save';

vi.mock('../src/audio/engine', async () => ({ createAudioEngine: (await import('./harness')).silentAudio }));

type Game = { director: Director; setScreen: (screen: string) => void };

let container: HTMLDivElement;
let root: Root;

function mount(screen: 'title' | 'play' = 'play') {
  writeSave(localStorage, { ...freshSave(), started: true, calibrated: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => root.render(<GameApp storage={localStorage} />));
  const game = (window as unknown as { __game: Game }).__game;
  if (screen === 'play') {
    flushSync(() => game.setScreen('play'));
    // A quiet stage: nothing scripted is running, so only what a test puts on it is there.
    game.director.setPaused(true);
    Object.assign(game.director.view, { phase: 'scene', center: null, echo: null, choice: null, periph: [], ripples: [] } satisfies Partial<View>);
    flushSync(() => game.director.updateSettings({}));
  }
  return game;
}

/** Puts something on the director's view and lets the stage re-render. */
function show(game: Game, patch: Partial<View>) {
  Object.assign(game.director.view, patch);
  flushSync(() => game.director.updateSettings({}));
}

const button = (name: string) => {
  const found = [...container.querySelectorAll<HTMLElement>('button, [role="button"]')].find((el) => el.textContent === name || el.getAttribute('aria-label') === name);
  expect(found, name).toBeDefined();
  return found!;
};
const press = (target: EventTarget, key: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  flushSync(() => { target.dispatchEvent(event); });
  return event;
};
const release = (target: EventTarget, key: string) => {
  const event = new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true });
  flushSync(() => { target.dispatchEvent(event); });
  return event;
};
const nameOf = (el: Element) => (el.getAttribute('aria-labelledby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
/** Lets effects' own updates (the announcer, focus given back) land. */
const settle = async () => { for (let i = 0; i < 3; i++) await new Promise((resolve) => window.setTimeout(resolve, 0)); };

afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('settings menu for a screen reader', () => {
  it('names every switch, slider and option group by its row, and says which is on', () => {
    const game = mount();
    flushSync(() => button('選單').click());
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const tabs = [...dialog.querySelectorAll('[role="tablist"] [role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['章節', '設定', '參考資料']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(dialog.querySelector('[role="tabpanel"]')!.getAttribute('aria-labelledby')).toBe(tabs[1].id);

    const sections = [...dialog.querySelectorAll('section[aria-labelledby]')];
    expect(sections.map(nameOf)).toEqual(['音量', '顯示', '操作與閱讀', '遊戲進度']);
    expect([...sections[0].querySelectorAll('input[type="range"]')].map(nameOf)).toEqual(['總音量', '環境音', '音效', '讀屏']);
    expect([...sections[1].querySelectorAll('[role="group"]')].map(nameOf)).toEqual(['字體大小']);

    const switches = [...dialog.querySelectorAll('[role="switch"]')];
    expect(switches.map(nameOf)).toEqual(['聲音', '畫面晃動', '聲音來源', '震動', '手機讀屏念出來', '聽過的話自動放快', '選擇不倒數']);
    // 聽過的話自動放快 starts off: a heard line plays at its own pace until the player asks otherwise.
    // 選擇不倒數 starts off: a choice's countdown is part of the story unless the player takes it away.
    expect(switches.map((el) => el.getAttribute('aria-checked'))).toEqual(['true', 'true', 'true', 'true', 'true', 'false', 'false']);
    const motion = switches.find((el) => nameOf(el) === '畫面晃動') as HTMLElement;
    flushSync(() => motion.click());
    expect(game.director.settings.motion).toBe(false);
    expect(motion.getAttribute('aria-checked')).toBe('false');
    // A click on a word sets that word, it does not flip: 關 on an off switch stays off.
    flushSync(() => motion.querySelector<HTMLElement>('[data-value="off"]')!.click());
    expect(game.director.settings.motion).toBe(false);

    const sliders = [...dialog.querySelectorAll<HTMLInputElement>('input[type="range"]')];
    expect(sliders.map(nameOf)).toEqual(['總音量', '環境音', '音效', '讀屏', '文字速度']);
    expect(sliders[0].getAttribute('aria-valuetext')).toBe(`${Math.round(game.director.settings.volume * 100)}%`);
    // Text speed: characters per second, its far right end all at once.
    const speed = sliders[4];
    expect(speed.getAttribute('aria-valuetext')).toBe(`每秒 ${DEFAULT_SETTINGS.textSpeed} 字`);
    const slide = (to: number) => flushSync(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(speed, String(to));
      speed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    slide(8);
    expect(game.director.settings.textSpeed).toBe(8);
    slide(Number(speed.max));
    expect(game.director.settings.textSpeed).toBe('instant');
    expect(speed.getAttribute('aria-valuetext')).toBe('立即');

    const groups = [...dialog.querySelectorAll('[role="group"]')];
    expect(groups.map(nameOf)).toEqual(['字體大小', '自動閱讀']);
    const pressed = (group: Element) => [...group.querySelectorAll('button[aria-pressed="true"]')].map((el) => el.textContent);
    expect(groups.map(pressed)).toEqual([['標準'], ['自動']]);
    flushSync(() => [...groups[1].querySelectorAll<HTMLElement>('button')].find((el) => el.textContent === '手動')!.click());
    expect(pressed(dialog.querySelectorAll('[role="group"]')[1])).toEqual(['手動']);
  });

  it('shows each volume percentage and updates it when the slider changes', () => {
    mount();
    flushSync(() => button('選單').click());
    const sliders = [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')];
    for (const slider of sliders.slice(0, 4)) {
      expect(slider.parentElement?.querySelector('.lt-range-value')?.textContent).toBe(slider.getAttribute('aria-valuetext'));
    }
    flushSync(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(sliders[0], '0');
      sliders[0].dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(sliders[0].parentElement?.querySelector('.lt-range-value')?.textContent).toBe('0%');
  });

  it('mutes each volume independently and restores it after reopening settings', () => {
    const { director } = mount();
    flushSync(() => director.updateSettings({ volume: 0.35, ambience: 0.6 }));
    flushSync(() => button('選單').click());
    flushSync(() => button('總音量靜音').click());
    expect(director.settings.volume).toBe(0);
    expect(director.settings.ambience).toBe(0.6);
    expect(button('總音量靜音').getAttribute('aria-pressed')).toBe('true');
    flushSync(() => button('環境音靜音').click());
    expect(director.settings.ambience).toBe(0);

    flushSync(() => button('返回').click());
    flushSync(() => button('選單').click());
    flushSync(() => button('總音量靜音').click());
    expect(director.settings.volume).toBe(0.35);
    expect(director.settings.ambience).toBe(0);
    expect(button('總音量靜音').getAttribute('aria-pressed')).toBe('false');
    flushSync(() => button('環境音靜音').click());
    expect(director.settings.ambience).toBe(0.6);
  });

  it('moves between tabs with the arrow keys', () => {
    mount();
    flushSync(() => button('選單').click());
    const settings = container.querySelector<HTMLElement>('#lt-tab-settings')!;
    expect(document.activeElement).toBe(settings);
    press(settings, 'ArrowRight');
    expect(document.activeElement?.id).toBe('lt-tab-refs');
    expect(document.activeElement?.getAttribute('aria-selected')).toBe('true');
    press(document.activeElement!, 'ArrowRight');
    expect(document.activeElement?.id).toBe('lt-tab-chapters');
  });

  it('starts references collapsed and skips closed links in the tab order', () => {
    mount();
    flushSync(() => button('選單').click());
    const tab = button('參考資料');
    flushSync(() => tab.click());
    const sections = [...container.querySelectorAll<HTMLDetailsElement>('details')];
    expect(sections.length).toBeGreaterThanOrEqual(4);
    expect(sections.every((section) => !section.open)).toBe(true);

    const first = sections[0].querySelector('summary')!;
    const second = sections[1].querySelector('summary')!;
    tab.focus();
    press(tab, 'Tab');
    expect(document.activeElement).toBe(first);
    press(first, 'Tab');
    expect(document.activeElement).toBe(second);
    first.click();
    expect(sections[0].open).toBe(true);
    first.focus();
    press(first, 'Tab');
    expect(document.activeElement).toBe(sections[0].querySelector('a'));
    first.click();
    expect(sections[0].open).toBe(false);
  });

  it('offers text up to twice the standard size', () => {
    expect(Math.max(...Object.values(FONT_SIZES).map((size) => size.scale))).toBe(2);
  });
});

describe('dialogs', () => {
  it('takes focus in, keeps Tab inside, makes the stage inert, and gives focus back on close', async () => {
    mount();
    const corner = button('選單');
    corner.focus();
    flushSync(() => corner.click());
    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(container.querySelector('.lt-stage')!.hasAttribute('inert')).toBe(true);
    expect(corner.hasAttribute('inert')).toBe(true);
    expect(button('記憶').hasAttribute('inert')).toBe(true);

    const close = button('返回');
    close.focus();
    press(close, 'Tab');
    expect(document.activeElement).toBe(container.querySelector('#lt-tab-settings'));
    press(document.activeElement!, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(close);
    // Tab never reaches anything behind the menu.
    for (let i = 0; i < 40; i++) {
      press(document.activeElement!, 'Tab');
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    press(document.activeElement!, 'Escape');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    await settle();
    expect(document.activeElement).toBe(corner);
    expect(corner.hasAttribute('inert')).toBe(false);
  });

  it('focuses the memory panel heading, never a 放下', () => {
    mount();
    flushSync(() => button('記憶').click());
    expect(document.activeElement?.id).toBe('lt-memory-head');
    expect(container.querySelector('[role="dialog"]')!.getAttribute('aria-labelledby')).toBe('lt-memory-head');
  });

  it('Esc lets go of the full-memory prompt instead of opening the menu over it', () => {
    const game = mount();
    show(game, { keep: { key: 'k', text: '再見', kind: 'char', loop: 1, chapter: '1' } });
    const dialog = container.querySelector('.lt-keep')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.textContent).toBe('這次不記了');
    expect(container.querySelector('.lt-world')!.hasAttribute('inert')).toBe(true);
    press(document.activeElement!, 'Escape');
    expect(game.director.view.keep).toBeNull();
    expect(container.querySelector('.lt-overlay')).toBeNull();
  });

  it('the recall picker takes focus on its first line', () => {
    const game = mount();
    show(game, { recall: { key: 1, memories: [{ key: 'a', text: '十八點三十一分', kind: 'narr', loop: 1, chapter: '1' }] } });
    const dialog = container.querySelector('.lt-recall')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement?.classList.contains('lt-recall-item')).toBe(true);
  });
});

describe('keys on the stage', () => {
  it('Space and Enter on a control the keyboard reached press that control, not the stage', () => {
    const game = mount();
    const hurry = vi.spyOn(game.director, 'hurry');
    const corner = button('選單');
    corner.focus();
    expect(press(corner, ' ').defaultPrevented).toBe(false);
    expect(release(corner, ' ').defaultPrevented).toBe(false);
    expect(press(corner, 'Enter').defaultPrevented).toBe(false);
    expect(hurry).not.toHaveBeenCalled();
  });

  it('Space and Enter on the stage (or on a button the pointer left focused) hurry the story', () => {
    const game = mount();
    const hurry = vi.spyOn(game.director, 'hurry');
    (document.activeElement as HTMLElement | null)?.blur();
    expect(press(document.body, 'Enter').defaultPrevented).toBe(true);
    expect(hurry).toHaveBeenCalledTimes(1);
    expect(press(document.body, ' ').defaultPrevented).toBe(true);
    release(document.body, ' ');
    expect(hurry).toHaveBeenCalledTimes(2);

    const memory = button('記憶');
    flushSync(() => { memory.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
    memory.focus();
    expect(press(memory, 'Enter').defaultPrevented).toBe(true);
    expect(hurry).toHaveBeenCalledTimes(3);
    expect(press(memory, ' ').defaultPrevented).toBe(true);
    expect(release(memory, ' ').defaultPrevented).toBe(true);
  });

  it('K keeps the line she is hearing, and a hidden 記住這句 button does the same', () => {
    const game = mount();
    const capture = vi.spyOn(game.director, 'capture').mockReturnValue(true);
    press(document.body, 'k');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('記下來了');
    flushSync(() => button('記住這句').click());
    expect(capture).toHaveBeenCalledTimes(2);
    press(document.body, 'k', { metaKey: true });
    expect(capture).toHaveBeenCalledTimes(2);
  });
});

describe('a question', () => {
  const choice = (key: number): View['choice'] => ({
    key, startedAt: 0, options: [{ text: '離開。', index: 0 }, { text: '聽完了', index: 1, disabled: true }, { text: '再問一次', index: 2 }],
  });

  it('is announced once with every option, and focus moves to the question for a keyboard', async () => {
    const game = mount();
    press(document.body, 'Shift');
    show(game, { choice: choice(7), focus: 'main' });
    await settle();
    const group = container.querySelector('.lt-choices')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('要回答了');
    expect(document.activeElement).toBe(group);
    // A Space meant to hurry the line before lands on the question, not on an answer.
    const hurry = vi.spyOn(game.director, 'hurry');
    const choose = vi.spyOn(game.director, 'choose');
    expect(press(group, ' ').defaultPrevented).toBe(true);
    release(group, ' ');
    expect(hurry).toHaveBeenCalled();
    expect(choose).not.toHaveBeenCalled();
    const live = [...container.querySelectorAll('[aria-live]')].map((el) => el.textContent);
    expect(live.filter((text) => text?.startsWith('要回答了'))).toEqual(['要回答了：1，離開。2，聽完了（已經做過了）。3，再問一次']);
    // The struck-out option says why, beyond its colour.
    expect(group.querySelectorAll('.lt-choice')[1].textContent).toContain('（已經做過了）');
  });

  it('a key still held from before does not pick the first answer the moment it appears', () => {
    const game = mount();
    const choose = vi.spyOn(game.director, 'choose');
    show(game, { choice: choice(8), focus: 'main' });
    const first = container.querySelector<HTMLButtonElement>('.lt-choice')!;
    first.focus();
    flushSync(() => { first.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })); });
    expect(choose).not.toHaveBeenCalled();
    flushSync(() => { first.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })); });
    expect(choose).toHaveBeenCalledWith(0);
  });

  it('arrow keys move between the answers she can give', () => {
    const game = mount();
    show(game, { choice: choice(9), focus: 'main' });
    press(document.activeElement!, 'ArrowDown');
    expect(document.activeElement?.textContent).toContain('離開');
    press(document.activeElement!, 'ArrowDown');
    expect(document.activeElement?.textContent).toContain('再問一次');
    press(document.activeElement!, 'ArrowDown');
    expect(document.activeElement?.textContent).toContain('離開');
    // From anywhere else on the page, an arrow steps into the answers too.
    (document.activeElement as HTMLElement).blur();
    press(document.body, 'ArrowUp');
    expect(document.activeElement?.textContent).toContain('再問一次');
  });
});

describe('cards and places', () => {
  it('a card is said once, by the announcer, and the card itself is hidden from a screen reader', async () => {
    const game = mount();
    show(game, { phase: 'card', card: { chapter: '第一章', title: '十月三日', time: '06:12', place: '老屋' }, place: '老屋', clock: '06:12' });
    await settle();
    const live = [...container.querySelectorAll('[aria-live]')].map((el) => el.textContent);
    expect(live).toContain('第一章，十月三日，06:12，老屋');
    expect(container.querySelector('.lt-card')!.getAttribute('aria-hidden')).toBe('true');
    // Walking on into the scene does not say the place again.
    show(game, { phase: 'scene' });
    await settle();
    expect([...container.querySelectorAll('[aria-live]')].map((el) => el.textContent)).toContain('第一章，十月三日，06:12，老屋');
  });

  it('a hands-on moment says what to do, including the keys', async () => {
    const game = mount();
    show(game, { interact: { type: 'approach', key: 3 } });
    await settle();
    const live = [...container.querySelectorAll('[aria-live]')].map((el) => el.textContent);
    expect(live).toContain('等聲音到面前，再開口。聲音到面前時，按空白鍵或點畫面開口');
  });
});

describe('title and calibration', () => {
  it('the title has focus from the start', () => {
    mount('title');
    expect(document.activeElement).toBe(container.querySelector('.lt-title'));
  });

  it('waits for a choice, then runs the test without advancing on a background click', () => {
    vi.useFakeTimers();
    try {
      const game = mount('title');
      const start = vi.spyOn(game.director, 'start').mockImplementation(() => undefined);
      flushSync(() => game.setScreen('calibrate'));
      const stage = container.querySelector<HTMLElement>('.lt-calib')!;
      flushSync(() => stage.click());
      flushSync(() => { vi.advanceTimersByTime(18000); });
      expect(start).not.toHaveBeenCalled();

      const test = button('測試');
      const skip = button('跳過');
      press(stage, 'ArrowRight');
      expect(document.activeElement).toBe(skip);
      press(skip, 'ArrowLeft');
      expect(document.activeElement).toBe(test);
      expect(start).not.toHaveBeenCalled();

      flushSync(() => test.click());
      flushSync(() => stage.click());
      flushSync(() => { vi.advanceTimersByTime(2700); });
      expect(stage.textContent).toContain('左邊');
      expect(start).not.toHaveBeenCalled();
      flushSync(() => { vi.advanceTimersByTime(15000); });
      expect(start).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts the story when the player chooses 跳過', () => {
    const game = mount('title');
    const start = vi.spyOn(game.director, 'start').mockImplementation(() => undefined);
    flushSync(() => game.setScreen('calibrate'));
    flushSync(() => button('跳過').click());
    expect(start).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.lt-calib')).toBeNull();
  });

  it('Esc skips the sound check', () => {
    const game = mount('title');
    flushSync(() => game.setScreen('calibrate'));
    expect(container.querySelector('.lt-calib')).not.toBeNull();
    expect(button('跳過').getAttribute('aria-keyshortcuts')).toBe('Escape');
    const start = vi.spyOn(game.director, 'start').mockImplementation(() => undefined);
    press(document.body, 'Escape');
    expect(start).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.lt-calib')).toBeNull();
  });
});

describe('developer data panel', () => {
  it.each([
    ['?debug', '.lt-dev-panel'],
    ['?dev', '.lt-dev-tension'],
  ])('keeps the menu version clear in %s mode', (search, selector) => {
    history.replaceState(null, '', `/${search}`);
    try {
      mount();
      expect(container.querySelector(selector)).not.toBeNull();
      flushSync(() => button('選單').click());
      expect(container.querySelector('.lt-version')?.textContent).toContain('版本');
      expect(container.querySelector(selector)).toBeNull();
      flushSync(() => button('返回').click());
      expect(container.querySelector(selector)).not.toBeNull();
    } finally {
      history.replaceState(null, '', '/');
    }
  });

  it.each(['', '?dev'])('requires the debug parameter (%s)', (search) => {
    history.replaceState(null, '', `/${search}`);
    try {
      mount();
      expect(container.querySelector('.lt-dev-panel')).toBeNull();
    } finally {
      history.replaceState(null, '', '/');
    }
  });

  it('shows live text speed, tension and heartbeat', () => {
    history.replaceState(null, '', '/?debug&dev');
    try {
      const game = mount();
      const panel = container.querySelector('.lt-dev-panel');
      expect(panel).not.toBeNull();
      expect(panel?.textContent).toContain('11 字/秒');
      expect(panel?.textContent).toContain('off');

      flushSync(() => {
        game.director.updateSettings({ textSpeed: 'instant' });
        game.director.setTension(70);
      });
      show(game, { heart: { level: 'fast', ms: 600, beat: 3, glow: 0.5 } });
      expect(panel?.textContent).toContain('即時');
      expect(panel?.textContent).toContain('70/100');
      expect(panel?.textContent).toContain('100 BPM');
      expect(container.querySelector('.lt-dev-tension')).toBeNull();
    } finally {
      history.replaceState(null, '', '/');
    }
  });
});
