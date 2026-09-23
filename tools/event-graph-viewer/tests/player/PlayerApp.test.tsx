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
  await user.click(screen.getByRole('button', { name: /保護若晴/ }));
  expect(readSave(storage, 1000).loops[1].actionIds).toContain('protect_wakaharu');
});
