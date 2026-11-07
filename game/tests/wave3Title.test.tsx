import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { GameApp } from '../src/GameApp';
import { ATTRIBUTION_CREDITS } from '../src/audio/credits';
import type { Director, View } from '../src/engine/director';
import { freshSave, writeSave, type GameSave } from '../src/engine/save';

vi.mock('../src/audio/engine', async () => ({ createAudioEngine: (await import('./harness')).silentAudio }));

const broken = vi.hoisted(() => ({ errors: [] as string[] }));
vi.mock('../src/script/load', async (original) => {
  const actual = await original<typeof import('../src/script/load')>();
  return { loadGameScript: () => { const report = actual.loadGameScript(); return broken.errors.length ? { ...report, errors: broken.errors } : report; } };
});

type Game = { director: Director; setScreen: (screen: string) => void };

let container: HTMLDivElement;
let root: Root;

function render(save?: Partial<GameSave>): Game {
  if (save) writeSave(localStorage, { ...freshSave(), started: true, calibrated: true, ...save });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => root.render(<GameApp storage={localStorage} />));
  return (window as unknown as { __game: Game }).__game;
}

function mountPlaying(save: Partial<GameSave>): Game {
  const game = render(save);
  flushSync(() => game.setScreen('play'));
  game.director.setPaused(true);
  Object.assign(game.director.view, { phase: 'scene', center: null, echo: null, choice: null, periph: [], ripples: [] } satisfies Partial<View>);
  flushSync(() => game.director.updateSettings({}));
  return game;
}

const buttons = () => [...container.querySelectorAll<HTMLElement>('button')];
const button = (name: string) => {
  const found = buttons().find((el) => el.textContent === name || el.getAttribute('aria-label') === name);
  expect(found, name).toBeDefined();
  return found!;
};
// Leaving the title waits out its fade (unless motion is reduced), so the title tests say motion is reduced.
const reduceMotion = () => vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
const settle = async () => { for (let i = 0; i < 3; i++) await new Promise((resolve) => window.setTimeout(resolve, 0)); };

afterEach(() => {
  flushSync(() => root.unmount());
  container.remove();
  localStorage.clear();
  broken.errors = [];
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const finished: Partial<GameSave> = { finished: true, chapter: 'final', reached: ['1', 'final'], loop: 9, endings: ['c'], knowledge: ['k_sig_mei'] };

describe('the title after an ending (H-01)', () => {
  beforeEach(() => { if (!window.matchMedia) window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia; reduceMotion(); });
  it('offers two ways back instead of one silent wipe', () => {
    render(finished);
    expect(container.querySelector('.lt-title[role="button"]')).toBeNull();
    expect(document.activeElement?.textContent).toBe('回到最終章的早上');
    button('從第一個十月三日重新開始');
  });

  it('goes back to the final morning keeping what she knows', async () => {
    const game = render(finished);
    flushSync(() => button('回到最終章的早上').click());
    await settle();
    expect(game.director.save.chapter).toBe('final');
    expect(game.director.save.finished).toBe(false);
    expect(game.director.save.knowledge).toContain('k_sig_mei');
    expect(container.querySelector('.lt-title')).toBeNull();
  });

  it('forgets everything only on the second press', async () => {
    const game = render(finished);
    flushSync(() => button('從第一個十月三日重新開始').click());
    expect(game.director.save.knowledge).toContain('k_sig_mei');
    const sure = button('確定，全部忘記');
    expect(document.activeElement).toBe(sure);
    flushSync(() => sure.click());
    await settle();
    expect(game.director.save.knowledge).toEqual([]);
    expect(game.director.save.chapter).toBe('1');
  });
});

describe('從早上重來 in the chapter list (H-02)', () => {
  const openChapters = () => {
    flushSync(() => button('選單').click());
    flushSync(() => container.querySelector<HTMLElement>('#lt-tab-chapters')!.click());
  };

  it('is not offered before the first midnight', () => {
    mountPlaying({ chapter: '1', reached: ['1'], loop: 1 });
    openChapters();
    expect(buttons().some((el) => el.textContent?.includes('從早上重來'))).toBe(false);
  });

  it('asks once more before starting the day over', () => {
    const game = mountPlaying({ chapter: '1', reached: ['1'], loop: 2, chLoop: 2 });
    openChapters();
    flushSync(() => button('從早上重來').click());
    expect(game.director.save.loop).toBe(2);
    const sure = button('確定，從早上重來');
    expect(document.activeElement).toBe(sure);
    flushSync(() => sure.click());
    expect(game.director.save.loop).toBe(3);
  });
});

describe('a broken script (H-22)', () => {
  it('shows players one plain sentence and logs the errors', () => {
    vi.stubEnv('DEV', false);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    broken.errors = ['ch01.yaml: scene x has no lines'];
    render();
    expect(container.textContent).toBe('這一天沒辦法開始。請重新整理，或稍後再來。');
    expect(log).toHaveBeenCalledWith('script errors:', broken.errors);
  });

  it('lists the raw errors while developing', () => {
    broken.errors = ['ch01.yaml: scene x has no lines'];
    render();
    expect(container.textContent).toContain('ch01.yaml: scene x has no lines');
  });
});

describe('the ending (H-16)', () => {
  it('says the day, the mark and the credits, with focus on its heading', () => {
    const game = mountPlaying({ chapter: 'final', reached: ['final'], loop: 9 });
    Object.assign(game.director.view, { phase: 'ending', ending: 'a' } satisfies Partial<View>);
    flushSync(() => game.director.updateSettings({}));
    const heading = container.querySelector('.lt-ending h1')!;
    expect(heading.textContent).toBe('十月四日');
    expect(document.activeElement).toBe(heading);
    const text = container.querySelector('.lt-ending')!.textContent!;
    expect(text).toContain('舊車站的牆裡，還有一點點聲音');
    expect([...container.querySelectorAll('.lt-ending-mark')].map((el) => el.textContent)).toEqual(['結局 A', '灰潮鎮：第七封信']);
    for (const credit of ATTRIBUTION_CREDITS) expect(text).toContain(credit.author);
    expect(text).toContain('其餘錄音來自 Freesound（CC0）');
    expect(text).toContain('霞鶩文楷 TC（SIL OFL 1.1）');
    const credits = text.indexOf('聲音');
    expect(credits).toBeGreaterThan(-1);
    expect(text.indexOf('回到標題')).toBeGreaterThan(text.indexOf('字體'));
  });

  it('ending C is the day alone', () => {
    const game = mountPlaying({ chapter: 'final', reached: ['final'], loop: 9 });
    Object.assign(game.director.view, { phase: 'ending', ending: 'c' } satisfies Partial<View>);
    flushSync(() => game.director.updateSettings({}));
    expect([...container.querySelectorAll('.lt-ending-line')].map((el) => el.textContent)).toEqual(['十月四日']);
    expect(container.querySelector('.lt-ending-mark')!.textContent).toBe('結局 C');
  });
});
