import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdleProgressScene } from '../../src/player/scenes/IdleProgressScene';
import { PlayerApp } from '../../src/player/PlayerApp';
import { MINUTE } from '../../src/player/clock';
import { normalizeSave } from '../../src/player/model';
import { SAVE_KEY, readSave } from '../../src/player/storage';
import type { SimulationDefinition, WorldState } from '../../src/simulator/types';

const initial: WorldState = { clock: { day: 0, time: '06:12' }, characters: { wakaharu: { location: 'old_station', status: 'alive' }, doctor: { location: 'old_station', status: 'alive' }, reporter: { location: 'hotel', status: 'alive' } }, world: { anomaly_1831_observed: false }, flags: { player_protected_wakaharu: false, player_stopped_doctor: false } };
const definition: SimulationDefinition = { actions: [], events: [] };

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, media: '(prefers-reduced-motion: reduce)', onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(() => false) } as MediaQueryList);
});

describe('Player immersive UI acceptance flow', () => {
  it('enters the first loop through a scene and an explicit letter', async () => {
    render(<PlayerApp now={() => 1000} storage={window.localStorage} loadStory={async () => ({ definition, initialState: initial })} />);
    const user = userEvent.setup();

    expect(screen.getByTestId('scene-frame')).toBeDefined();
    await user.click(await screen.findByRole('button', { name: /拆開信封/ }));
    expect(screen.getByText('回來一趟。')).toBeDefined();
  });

  it('records an existing choice and reflects its consequence in the scene', async () => {
    let current = 1000;
    render(<PlayerApp now={() => current} storage={window.localStorage} loadStory={async () => ({ definition, initialState: initial })} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /拆開信封/ }));
    current += Math.ceil((1080 - 372) / 12) * MINUTE;
    fireEvent(document, new Event('visibilitychange'));
    await user.click(await screen.findByRole('button', { name: /讀予安的留言/ }));
    await user.click(await screen.findByRole('button', { name: /保護若晴/ }));

    expect(readSave(window.localStorage, current).loops[1].actionIds).toContain('protect_wakaharu');
    expect(screen.getByText(/若晴回了訊息/)).toBeDefined();
  });

  it('renders authoritative waiting copy without inventing an ETA', () => {
    render(<IdleProgressScene actor="庭安" activity="還沒有回來。" canIntervene={false} eta={{ kind: 'unknown' }} />);

    expect(screen.getByText('還沒有回來。')).toBeDefined();
    expect(screen.getByText('...... ▌')).toBeDefined();
    expect(screen.queryByText(/分鐘|預計完成/)).toBeNull();
  });

  it('performs reset before exposing mode choice and creates one next loop', async () => {
    const now = 1_000;
    const save = normalizeSave(null, now);
    save.loops[1].clock.anchor.realStartedAtMs = now - ((1440 - 372) / 12) * MINUTE;
    save.loops[1].clock.lastProcessedMinute = 1440;
    save.loops[1].clock.pendingCriticalBoundary = 'reset';
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    render(<PlayerApp now={() => now} storage={window.localStorage} loadStory={async () => ({ definition, initialState: initial })} />);
    const user = userEvent.setup();

    expect(await screen.findByText('世界接手了這一輪。')).toBeDefined();
    expect(screen.queryByRole('button', { name: /回到記憶開始的地方/ })).toBeNull();
    await user.click(await screen.findByRole('button', { name: '將記憶交還給世界' }));
    await user.click(await screen.findByRole('button', { name: /回到記憶開始的地方/ }));
    expect(readSave(window.localStorage, now).currentLoopId).toBe(2);
    expect(Object.keys(readSave(window.localStorage, now).loops)).toEqual(['1', '2']);
  });

  it('reloading during reset replays presentation without advancing the runtime', async () => {
    const now = 1_000;
    const save = normalizeSave(null, now);
    save.loops[1].clock.pendingCriticalBoundary = 'reset';
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    const first = render(<PlayerApp now={() => now} storage={window.localStorage} loadStory={async () => ({ definition, initialState: initial })} />);
    expect(await screen.findByText('世界接手了這一輪。')).toBeDefined();
    first.unmount();
    render(<PlayerApp now={() => now} storage={window.localStorage} loadStory={async () => ({ definition, initialState: initial })} />);
    expect(await screen.findByText('世界接手了這一輪。')).toBeDefined();
    expect(readSave(window.localStorage, now).currentLoopId).toBe(1);
  });

  it('keeps narrative and secondary tools keyboard-usable with reduced motion', async () => {
    render(<PlayerApp now={() => 1000} storage={window.localStorage} loadStory={async () => ({ definition, initialState: initial })} />);
    const user = userEvent.setup();
    const envelope = await screen.findByRole('button', { name: /拆開信封/ });
    envelope.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByText('回來一趟。')).toBeDefined();

    const caseButton = screen.getByRole('button', { name: /案卷/ });
    caseButton.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('dialog', { name: '案卷' })).toBeDefined();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(caseButton);
  });
});
