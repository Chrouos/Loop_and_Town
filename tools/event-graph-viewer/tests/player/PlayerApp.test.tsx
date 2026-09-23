import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerApp } from '../../src/player/PlayerApp';
import { normalizeSave } from '../../src/player/model';
import { readSave, SAVE_KEY } from '../../src/player/storage';
import type { SimulationDefinition, WorldState } from '../../src/simulator/types';

const initial: WorldState = { clock: { day: 1, time: '18:20' }, characters: { wakaharu: { location: 'old_station', status: 'alive' }, doctor: { location: 'old_station', status: 'alive' }, reporter: { location: 'hotel', status: 'alive' } }, world: { anomaly_1831_observed: false }, flags: { player_protected_wakaharu: false, player_stopped_doctor: false } };
const definition: SimulationDefinition = { actions: [], events: [] };

it('opens the envelope and records a deliberate action before the deadline', async () => {
  const storage = window.localStorage;
  storage.clear();
  storage.setItem(SAVE_KEY, JSON.stringify(normalizeSave(null, 1000)));
  render(<PlayerApp now={() => 1000} storage={storage} loadStory={async () => ({ definition, initialState: initial })} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /拆開信封/ }));
  expect(screen.getByText('回來一趟。')).toBeDefined();
  expect(screen.queryByRole('button', { name: /保護若晴/ })).toBeNull();
  await user.click(screen.getByRole('button', { name: /讀予安的留言/ }));
  expect(screen.getByText(/她看起來不想自己去/)).toBeDefined();
  await user.click(screen.getByRole('button', { name: /保護若晴/ }));
  expect(readSave(storage, 1000).loops[1].actionIds).toContain('protect_wakaharu');
});

it('marks a fresh loop bulletin unread even when the same document was read last loop', async () => {
  const storage = window.localStorage;
  storage.clear();
  const save = normalizeSave(null, 0);
  save.lastConfirmedMs = 24 * 3_600_000 + 40 * 60_000;
  save.knowledge.opened = ['letter', 'station-bulletin-wakaharu'];
  save.loops[1].revealedIds = ['1:letter', '1:station-bulletin-wakaharu'];
  save.loops[1].sealed = true;
  save.loops[2] = { actionIds: [], revealedIds: ['2:letter', '2:station-bulletin-wakaharu'], sealed: false };
  storage.setItem(SAVE_KEY, JSON.stringify(save));
  render(<PlayerApp now={() => save.lastConfirmedMs} storage={storage} loadStory={async () => ({ definition, initialState: initial })} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /案卷/ }));
  expect(screen.getByRole('button', { name: /車站通報.*新/ })).toBeDefined();
});
