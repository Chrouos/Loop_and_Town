import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { GameApp } from '../src/GameApp';
import type { Director, View } from '../src/engine/director';
import { freshSave, loadSave, writeSave } from '../src/engine/save';

vi.mock('../src/audio/engine', async () => ({ createAudioEngine: (await import('./harness')).silentAudio }));

type Game = { director: Director; setScreen: (screen: string) => void };

let container: HTMLDivElement;
let root: Root;

function mountPlaying(): Game {
  writeSave(localStorage, { ...freshSave(), started: true, calibrated: true });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => root.render(<GameApp storage={localStorage} />));
  const game = (window as unknown as { __game: Game }).__game;
  flushSync(() => game.setScreen('play'));
  game.director.setPaused(true);
  Object.assign(game.director.view, { phase: 'scene', center: null, echo: null, choice: null, periph: [], ripples: [] } satisfies Partial<View>);
  flushSync(() => game.director.updateSettings({}));
  return game;
}

const button = (name: string) => {
  const found = [...container.querySelectorAll<HTMLElement>('button')].find((el) => el.textContent === name || el.getAttribute('aria-label') === name);
  expect(found, name).toBeDefined();
  return found!;
};
const openSettings = () => {
  flushSync(() => button('選單').click());
  flushSync(() => container.querySelector<HTMLElement>('#lt-tab-settings')!.click());
};

afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
  localStorage.clear();
  vi.useRealTimers();
});

describe('settings added after the playtest', () => {
  it('runs the sound test again over the paused scene and comes back to the menu', () => {
    vi.useFakeTimers();
    const game = mountPlaying();
    openSettings();
    flushSync(() => button('再聽一次').click());
    expect(container.querySelector('.lt-recalib [aria-label="聲音測試"]')).not.toBeNull();
    expect(game.director.view.phase).toBe('scene');
    flushSync(() => { vi.advanceTimersByTime(7100); });
    expect(container.querySelector('.lt-recalib')!.textContent).toContain('如果左右反了，耳機可能戴反了');
    flushSync(() => { vi.advanceTimersByTime(12000); });
    expect(container.querySelector('.lt-recalib')).toBeNull();
    expect(container.querySelector('[role="dialog"] [role="tablist"]')).not.toBeNull();
  });

  it('no longer teaches tapping and keeping in the sound test, before there is anything to tap or keep', () => {
    vi.useFakeTimers();
    mountPlaying();
    openSettings();
    flushSync(() => button('再聽一次').click());
    let seen = '';
    for (let i = 0; i < 40; i++) {
      flushSync(() => { vi.advanceTimersByTime(500); });
      seen += container.querySelector('.lt-recalib')?.textContent ?? '';
    }
    expect(seen).not.toContain('轉過去聽');
    expect(seen).not.toContain('記下來');
  });

  it('keeps the 讀屏 level it was set to across a reload', () => {
    const game = mountPlaying();
    openSettings();
    const slider = [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')].find((el) => document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent === '讀屏');
    expect(slider).toBeDefined();
    game.director.updateSettings({ voice: 0.2 });
    expect(loadSave(localStorage).save.settings.voice).toBeCloseTo(0.2);
  });

  it('offers 全螢幕 only where the browser has fullscreen', () => {
    mountPlaying();
    openSettings();
    // jsdom has no fullscreen, like iPhone Safari
    expect(container.textContent).not.toContain('全螢幕');
  });
});
