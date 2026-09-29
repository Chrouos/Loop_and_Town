import { expect, it } from 'vitest';
import yaml from 'js-yaml';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerApp } from '../../src/player/PlayerApp';
import { emptyLoop, normalizeSave } from '../../src/player/model';
import { readSave, SAVE_KEY } from '../../src/player/storage';
import { createNextLoop } from '../../src/player/runtime';
import { MINUTE } from '../../src/player/clock';
import type { SimulationDefinition, WorldState } from '../../src/simulator/types';
import initialYaml from '../../../../story/world/day_01_initial.yaml?raw';
import actionsYaml from '../../../../story/actions/day_01_actions.yaml?raw';
import stationYaml from '../../../../story/events/day_01_1831.yaml?raw';
import reporterYaml from '../../../../story/events/day_01_2114.yaml?raw';
import { loadRealStory } from '../helpers/loadRealStory';
import type { PlayerStoryBundle } from '../../src/types/playerStory';

const initial: WorldState = { clock: { day: 0, time: '06:12' }, characters: { wakaharu: { location: 'old_station', status: 'alive' }, doctor: { location: 'old_station', status: 'alive' }, reporter: { location: 'hotel', status: 'alive' } }, world: { anomaly_1831_observed: false }, flags: { player_protected_wakaharu: false, player_stopped_doctor: false } };
const definition: SimulationDefinition = { actions: [], events: [] };
const canonical: { initialState: WorldState; definition: SimulationDefinition } = {
  initialState: initial,
  definition: { actions: (yaml.load(actionsYaml) as SimulationDefinition).actions, events: [yaml.load(stationYaml), yaml.load(reporterYaml)] as SimulationDefinition['events'] },
};

function realPlayerStory(): PlayerStoryBundle {
  const story = loadRealStory();
  return {
    simulation: {
      loop: story.loop,
      initialState: story.initialState,
      schedules: story.schedules,
      definition: story.definition,
      worldlines: story.worldlines,
      playerChoices: story.playerChoices,
      travelEdges: story.travelEdges,
    },
    narrativeDocuments: [
      {
        sourcePath: 'story/narrative/loop_01_player.yaml',
        loopId: 1,
        scenes: story.narrative.scenes.filter((scene) => !scene.id.startsWith('loop02_')),
      },
      {
        sourcePath: 'story/narrative/loop_02_player.yaml',
        loopId: 2,
        scenes: story.narrative.scenes.filter((scene) => scene.id.startsWith('loop02_')),
      },
    ],
    artifacts: story.narrative.artifacts,
  };
}

it('opens the envelope and records a deliberate action before the deadline', async () => {
  const storage = window.localStorage;
  storage.clear();
  storage.setItem(SAVE_KEY, JSON.stringify(normalizeSave(null, 1000)));
  let current = 1000;
  render(<PlayerApp now={() => current} storage={storage} loadStory={async () => ({ definition, initialState: initial })} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /拆開信封/ }));
  expect(screen.getByText('回來一趟。')).toBeDefined();
  expect(screen.queryByRole('button', { name: /保護若晴/ })).toBeNull();
  current += Math.ceil((1080 - 372) / 12) * MINUTE;
  fireEvent(document, new Event('visibilitychange'));
  await user.click(screen.getByRole('button', { name: /讀予安的留言/ }));
  expect(screen.getByText(/她看起來不想自己去/)).toBeDefined();
  await user.click(await screen.findByRole('button', { name: /保護若晴/ }));
  expect(readSave(storage, 1000).loops[1].actionIds).toContain('protect_wakaharu');
});

it('marks a fresh loop bulletin unread even when the same document was read last loop', async () => {
  const storage = window.localStorage;
  storage.clear();
  const save = normalizeSave(null, 0);
  save.loops[1].sealed = true;
  createNextLoop(save, 'ACCELERATED', 1000);
  save.knowledge.opened = ['letter', 'station-bulletin-wakaharu'];
  save.loops[1].revealedIds = ['1:letter', '1:station-bulletin-wakaharu'];
  save.loops[2].revealedIds = ['2:letter', '2:station-bulletin-wakaharu'];
  storage.setItem(SAVE_KEY, JSON.stringify(save));
  render(<PlayerApp now={() => 1000} storage={storage} loadStory={async () => ({ definition, initialState: initial })} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '開啟工具' }));
  await user.click(screen.getByRole('button', { name: /案卷/ }));
  expect(screen.getByRole('button', { name: /車站通報.*新/ })).toBeDefined();
});

it('shows a character response in the scene immediately after confirming a choice', async () => {
  const storage = window.localStorage;
  storage.clear();
  let current = 1000;
  render(<PlayerApp now={() => current} storage={storage} loadStory={async () => ({ definition, initialState: initial })} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /拆開信封/ }));
  current += Math.ceil((1080 - 372) / 12) * MINUTE;
  fireEvent(document, new Event('visibilitychange'));
  await user.click(screen.getByRole('button', { name: /讀予安的留言/ }));
  await user.click(await screen.findByRole('button', { name: /保護若晴/ }));
  expect(screen.getByText(/若晴回了訊息/)).toBeDefined();
  expect(screen.getByText(/今晚先不去車站/)).toBeDefined();
  await user.click(await screen.findByRole('button', { name: /請予安/ }));
  expect(screen.getByText(/予安回覆/)).toBeDefined();
  expect(readSave(storage, 1000).loops[1].actionIds).toEqual(['protect_wakaharu', 'stop_doctor']);
});

it('requires Attend before a presence opportunity becomes readable knowledge', async () => {
  const storage = window.localStorage;
  storage.clear();
  let current = 1000;
  const now = () => current;
  render(<PlayerApp now={now} storage={storage} loadStory={async () => canonical} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /拆開信封/ }));
  current += Math.ceil((1111 - 372) / 12) * MINUTE;
  fireEvent(document, new Event('visibilitychange'));

  expect(screen.queryByText(/停電只有幾秒/)).toBeNull();
  expect(screen.queryByRole('button', { name: /閱讀新消息：車站的燈/ })).toBeNull();
  const cue = await screen.findByRole('button', { name: '……鐘聲？' });
  await user.click(cue);

  expect(screen.getByText(/停電只有幾秒/)).toBeDefined();
  expect(readSave(storage, current).loops[1].perceivedSceneIds).toContain('station-blackout');
});

it('frames Loop 1 at the return train and does not ask for a mode', async () => {
  const storage = window.localStorage;
  storage.clear();
  render(<PlayerApp now={() => 1000} storage={storage} loadStory={async () => ({ definition, initialState: initial })} />);
  expect(await screen.findByText(/返程列車在灰潮鎮的月台/)).toBeDefined();
  expect(screen.queryByRole('button', { name: /跟著現在走/ })).toBeNull();
});

it('offers a locked mode choice only after a foreground reset', async () => {
  const storage = window.localStorage;
  storage.clear();
  const now = 1_000;
  const save = normalizeSave(null, now);
  save.loops[1].clock.anchor.realStartedAtMs = now - ((1440 - 372) / 12) * MINUTE;
  save.loops[1].clock.lastProcessedMinute = 1440;
  save.loops[1].clock.pendingCriticalBoundary = 'reset';
  storage.setItem(SAVE_KEY, JSON.stringify(save));
  render(<PlayerApp now={() => now} storage={storage} loadStory={async () => ({ definition, initialState: initial })} />);
  expect(await screen.findByText('世界接手了這一輪。', {}, { timeout: 2000 })).toBeDefined();
  expect(screen.queryByRole('button', { name: /回到記憶開始的地方/ })).toBeNull();
  await userEvent.setup().click(await screen.findByRole('button', { name: '將記憶交還給世界' }));
  expect(await screen.findByRole('button', { name: /回到記憶開始的地方/ }, { timeout: 2000 })).toBeDefined();
  expect((screen.getByRole('button', { name: /跟著現在走/ }) as HTMLButtonElement).disabled).toBe(false);
  await userEvent.setup().click(screen.getByRole('button', { name: /回到記憶開始的地方/ }));
  expect(screen.queryByRole('button', { name: /跟著現在走/ })).toBeNull();
  expect(readSave(storage, now).currentLoopId).toBe(2);
});

it('replays the reset presentation after reload without creating a loop', async () => {
  const storage = window.localStorage;
  storage.clear();
  const now = 1_000;
  const save = normalizeSave(null, now);
  save.loops[1].clock.anchor.realStartedAtMs = now - ((1440 - 372) / 12) * MINUTE;
  save.loops[1].clock.lastProcessedMinute = 1440;
  save.loops[1].clock.pendingCriticalBoundary = 'reset';
  storage.setItem(SAVE_KEY, JSON.stringify(save));

  const first = render(<PlayerApp now={() => now} storage={storage} loadStory={async () => ({ definition, initialState: initial })} />);
  expect(await screen.findByText('世界接手了這一輪。', {}, { timeout: 2000 })).toBeDefined();
  first.unmount();
  render(<PlayerApp now={() => now} storage={storage} loadStory={async () => ({ definition, initialState: initial })} />);
  expect(await screen.findByText('世界接手了這一輪。', {}, { timeout: 2000 })).toBeDefined();
  expect(readSave(storage, now).currentLoopId).toBe(1);
  expect(readSave(storage, now).loops[1].clock.pendingCriticalBoundary).toBe('reset');
});

it('bootstraps a late Live Sync loop without exposing presence-only history', async () => {
  const storage = window.localStorage;
  storage.clear();
  const entryAt = new Date('2026-09-28T21:40:00+08:00').getTime();
  const save = normalizeSave(null, entryAt);
  save.loops[1].sealed = true;
  createNextLoop(save, 'LIVE_SYNC', entryAt);
  storage.setItem(SAVE_KEY, JSON.stringify(save));
  render(<PlayerApp now={() => entryAt} storage={storage} loadStory={async () => ({ definition: canonical.definition, initialState: canonical.initialState })} />);
  expect(await screen.findByText(/21:40/)).toBeDefined();
  const current = readSave(storage, entryAt);
  expect(current.loops[2].history.some(item => item.eventId === 'evt_1831_station')).toBe(true);
  expect(current.loops[2].revealedIds).not.toContain('2:station-blackout');
});

it('disables Live Sync in the inactive early-morning gap but keeps accelerated mode', async () => {
  const storage = window.localStorage;
  storage.clear();
  const now = new Date('2026-09-28T02:00:00+08:00').getTime();
  const save = normalizeSave(null, now);
  save.loops[1].clock.anchor.realStartedAtMs = now - ((1440 - 372) / 12) * MINUTE;
  save.loops[1].clock.lastProcessedMinute = 1440;
  save.loops[1].clock.pendingCriticalBoundary = 'reset';
  storage.setItem(SAVE_KEY, JSON.stringify(save));
  render(<PlayerApp now={() => now} storage={storage} loadStory={async () => ({ definition, initialState: initial })} />);
  expect(await screen.findByText('世界接手了這一輪。')).toBeDefined();
  await userEvent.setup().click(await screen.findByRole('button', { name: '將記憶交還給世界' }));
  expect((await screen.findByRole('button', { name: /跟著現在走/ }, { timeout: 2000 }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: /回到記憶開始的地方/ }) as HTMLButtonElement).disabled).toBe(false);
});

it('renders Loop 2 survivor scenes without exposing author or relationship metadata', async () => {
  const storage = window.localStorage;
  storage.clear();
  const save = normalizeSave(null, 0);
  save.currentLoopId = 2;
  save.loops[2] = emptyLoop(save.loops[1].clock);
  save.loops[2].actionIds = ['protect_wakaharu'];
  save.loops[2].clock.anchor.realStartedAtMs = 0;
  save.loops[2].clock.lastProcessedMinute = 372;
  storage.setItem(SAVE_KEY, JSON.stringify(save));
  const now = () => Math.ceil((1111 - 372) / 12) * MINUTE;
  render(<PlayerApp now={now} storage={storage} loadStory={async () => realPlayerStory() as never} />);
  const user = userEvent.setup();

  expect(await screen.findByText(/不是夢/)).toBeDefined();
  await user.click(screen.getByRole('button', { name: /閱讀新消息：若晴還活著/ }));
  expect(screen.getAllByText(/她活著/).length).toBeGreaterThan(0);
  expect(readSave(storage, now()).loops[2].seenSceneIds).toContain('loop02_1610_wakaharu_alive');
  expect(screen.queryByText(/remember|trust|closeness|respect|pressure|DAG|storyDag/i)).toBeNull();
  await user.click(screen.getByRole('button', { name: /閱讀新消息：18:31 的另一個死者/ }));
  expect(screen.getByText(/找到陳柏勳/)).toBeDefined();
});