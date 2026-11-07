import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { Director, InteractView } from '../src/engine/director';
import { ARROW_CHORD_MS, INTERACT_LESSON, Interaction, arrowChord, keyedDirection } from '../src/ui/Interactions';

let container: HTMLDivElement | undefined;
let root: Root | undefined;

function fakeDirector() {
  return { locatePick: vi.fn(), punchDot: vi.fn(), punchMiss: vi.fn(), punchDone: vi.fn(), approachCall: vi.fn(), holdStart: vi.fn(), holdEnd: vi.fn() };
}

function mount(interact: InteractView) {
  const director = fakeDirector();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  flushSync(() => root!.render(<Interaction director={director as unknown as Director} interact={interact} />));
  return director;
}

const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  flushSync(() => { target.dispatchEvent(event); });
  return event;
};

const LOCATE: InteractView = { type: 'locate', key: 1, triesLeft: 2, hint: null, wrong: [] };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  if (root) flushSync(() => root!.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('pointing with the keyboard', () => {
  it('maps the keypad, the letters round S and nothing for S itself', () => {
    const at = (key: string, code = '', mods: Partial<KeyboardEvent> = {}) => keyedDirection({ key, code, ctrlKey: false, metaKey: false, altKey: false, ...mods });
    expect(at('8')).toBe('front');
    expect(at('ArrowUp', 'Numpad8')).toBe('front');
    expect(at('Home', 'Numpad7')).toBe('front-left');
    expect(at('q')).toBe('front-left');
    expect(at('Process', 'KeyC')).toBe('back-right');
    expect(at('d', 'KeyD')).toBe('right');
    expect(at('s', 'KeyS')).toBeUndefined();
    expect(at('w', 'KeyW', { metaKey: true })).toBeUndefined();
    expect(at('ArrowUp', 'ArrowUp')).toBeUndefined();
    expect(arrowChord('front', 'right')).toBe('front-right');
    expect(arrowChord('left', 'back')).toBe('back-left');
    expect(arrowChord('front', 'back')).toBeNull();
  });

  it('one arrow points that way once the chord window has passed', () => {
    const director = mount(LOCATE);
    press('ArrowDown');
    expect(director.locatePick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(ARROW_CHORD_MS + 10);
    expect(director.locatePick).toHaveBeenCalledTimes(1);
    expect(director.locatePick).toHaveBeenCalledWith('back');
  });

  it('two arrows together point between them, once', () => {
    const director = mount(LOCATE);
    press('ArrowUp');
    vi.advanceTimersByTime(80);
    press('ArrowRight');
    vi.advanceTimersByTime(400);
    expect(director.locatePick.mock.calls).toEqual([['front-right']]);
  });

  it('two arrows far apart are two turns; a held arrow does not repeat', () => {
    const director = mount(LOCATE);
    press('ArrowLeft');
    vi.advanceTimersByTime(300);
    press('ArrowLeft', { repeat: true });
    press('ArrowDown');
    vi.advanceTimersByTime(300);
    expect(director.locatePick.mock.calls).toEqual([['left'], ['back']]);
  });

  it('the keypad and the letters answer at once', () => {
    const director = mount(LOCATE);
    press('9');
    press('z', { code: 'KeyZ' });
    press('ArrowRight', { code: 'Numpad6' });
    expect(director.locatePick.mock.calls).toEqual([['front-right'], ['back-left'], ['right']]);
  });

  it('the arrows are hers while she points: nothing behind the moment hears them', () => {
    const director = mount(LOCATE);
    const behind = vi.fn();
    window.addEventListener('keydown', behind);
    const event = press('ArrowDown');
    window.removeEventListener('keydown', behind);
    expect(event.defaultPrevented).toBe(true);
    expect(behind).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(director.locatePick).toHaveBeenCalledWith('back');
  });

  it('keys inside an open dialog stay the dialog\'s', () => {
    const director = mount(LOCATE);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const inside = document.createElement('button');
    dialog.append(inside);
    document.body.append(dialog);
    expect(press('ArrowDown', {}, inside).defaultPrevented).toBe(false);
    expect(press('8', {}, inside).defaultPrevented).toBe(false);
    vi.advanceTimersByTime(300);
    expect(director.locatePick).not.toHaveBeenCalled();
  });

  it('each spot names its keys, on screen and for a screen reader', () => {
    mount(LOCATE);
    const front = container!.querySelector('[aria-label="指向前方"]')!;
    expect(front.getAttribute('aria-keyshortcuts')).toBe('ArrowUp 8 W');
    expect(front.textContent).toBe('↑ 8 W');
    expect(container!.querySelector('[aria-label="指向右前方"]')!.getAttribute('aria-keyshortcuts')).toBe('ArrowUp+ArrowRight 9 E');
  });
});

describe('first-time lessons on screen', () => {
  it('shows the lesson only when the moment carries one', () => {
    mount({ ...LOCATE, lesson: true });
    expect(container!.querySelector('.lt-interact-lesson')!.textContent).toBe(INTERACT_LESSON.locate);
    expect(container!.querySelector('.lt-interact-lesson')!.getAttribute('role')).toBe('status');
    flushSync(() => root!.render(<Interaction director={fakeDirector() as unknown as Director} interact={{ type: 'approach', key: 2, lesson: true }} />));
    expect(container!.querySelector('.lt-interact-lesson')!.textContent).toBe('腳步會越來越近。等到最近的那一兩步，再開口。');
    flushSync(() => root!.render(<Interaction director={fakeDirector() as unknown as Director} interact={{ type: 'hold', key: 3, seconds: 4, since: null }} />));
    expect(container!.querySelector('.lt-interact-lesson')).toBeNull();
  });
});

describe('the braille slate', () => {
  // Read as [1, 4, 5]: punched from the back, mirrored to [1, 2, 4].
  const PUNCH: InteractView = { type: 'punch', key: 4, cells: [[1, 4, 5]] };

  it('says which dots are to be punched, as the screen shows them', () => {
    mount(PUNCH);
    const labels = [...container!.querySelectorAll('.lt-punch-dot')].map((dot) => dot.getAttribute('aria-label'));
    expect(labels).toEqual(['第 1 點，要打', '第 2 點，要打', '第 3 點', '第 4 點，要打', '第 5 點', '第 6 點']);
  });

  it('a wrong dot slips (sound and buzz from the director) and the note says so; a punched dot is not punched twice', () => {
    const director = mount(PUNCH);
    press('3');
    expect(director.punchMiss).toHaveBeenCalledTimes(1);
    expect(director.punchDot).not.toHaveBeenCalled();
    expect(container!.querySelector('.lt-interact-note')!.textContent).toBe('這一點不用打');
    press('1');
    expect(director.punchDot).toHaveBeenCalledTimes(1);
    expect(container!.querySelector('.lt-interact-note')!.textContent).not.toBe('這一點不用打');
    expect(container!.querySelector('.lt-punch-dot.d1')!.getAttribute('aria-label')).toBe('第 1 點');
    press('1');
    expect(director.punchDot).toHaveBeenCalledTimes(1);
    expect(director.punchMiss).toHaveBeenCalledTimes(1);
  });
});
