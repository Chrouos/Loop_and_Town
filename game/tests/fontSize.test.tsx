import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { GameApp } from '../src/GameApp';
import { freshSave, readSave, SAVE_KEY, writeSave } from '../src/engine/save';

vi.mock('../src/audio/engine', async () => ({ createAudioEngine: (await import('./harness')).silentAudio }));

afterEach(() => localStorage.clear());

it('uses standard font size for fresh and older saves, and invalid stored values', () => {
  expect(freshSave().settings.fontSize).toBe('normal');
  const old = JSON.parse(JSON.stringify(freshSave()));
  delete old.settings.fontSize;
  localStorage.setItem(SAVE_KEY, JSON.stringify(old));
  expect(readSave(localStorage).settings.fontSize).toBe('normal');
  old.settings.fontSize = 'invalid';
  localStorage.setItem(SAVE_KEY, JSON.stringify(old));
  expect(readSave(localStorage).settings.fontSize).toBe('normal');
});

it('changes font size immediately from settings and retains it after remounting', () => {
  writeSave(localStorage, { ...freshSave(), started: true, calibrated: true });
  const container = document.createElement('div');
  document.body.append(container);
  let root = createRoot(container);
  const click = (name: string) => {
    const button = [...container.querySelectorAll('button')].find((el) => el.textContent === name || el.getAttribute('aria-label') === name);
    expect(button, name).toBeDefined();
    flushSync(() => button!.click());
  };
  try {
    flushSync(() => root.render(<GameApp storage={localStorage} />));
    const game = (window as unknown as { __game: { setScreen: (screen: string) => void } }).__game;
    flushSync(() => game.setScreen('play'));
    click('記憶與設定');
    click('設定');
    expect(container.textContent).toContain('字體大小');
    click('特大');
    expect(container.querySelector<HTMLElement>('.lt-app')!.style.getPropertyValue('--text-scale')).toBe('1.4');
    expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toBe('特大');
    expect(readSave(localStorage).settings.fontSize).toBe('extraLarge');
    flushSync(() => root.unmount());
    root = createRoot(container);
    flushSync(() => root.render(<GameApp storage={localStorage} />));
    // The title also respects the saved font size before gameplay starts.
    expect(container.querySelector<HTMLElement>('.lt-app')!.style.getPropertyValue('--text-scale')).toBe('1.4');
    expect(container.querySelector('.lt-title')).not.toBeNull();
  } finally {
    flushSync(() => root.unmount());
    container.remove();
  }
});
