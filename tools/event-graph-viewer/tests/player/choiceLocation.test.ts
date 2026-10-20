import { expect, it } from 'vitest';
import { normalizeSave } from '../../src/player/model';
import { confirmAction, PROTECT_AWAY_MESSAGE } from '../../src/player/runtime';
import { MINUTE } from '../../src/player/clock';
import { leaveOldStation, travelToOldStation } from '../../src/player/stationTravel';

const T0 = 1_000_000;
const realTimeAt = (minute: number) => T0 + ((minute - 372) / 12) * MINUTE;

it('rejects promising to stay with Wakaharu while the player is at the old station', () => {
  const save = normalizeSave(null, T0);
  travelToOldStation(save, 17 * 60 + 10);
  expect(() => confirmAction(save, 'protect_wakaharu', realTimeAt(18 * 60 + 1))).toThrow(PROTECT_AWAY_MESSAGE);
  expect(save.loops[1].actionIds).toEqual([]);
});

it('still lets the player ask Yuan for help from the old station by phone', () => {
  const save = normalizeSave(null, T0);
  travelToOldStation(save, 17 * 60 + 10);
  confirmAction(save, 'stop_doctor', realTimeAt(18 * 60 + 1));
  expect(save.loops[1].actionIds).toEqual(['stop_doctor']);
});

it('allows the promise again once the player is back in town', () => {
  const save = normalizeSave(null, T0);
  travelToOldStation(save, 8 * 60);
  leaveOldStation(save, 9 * 60);
  confirmAction(save, 'protect_wakaharu', realTimeAt(18 * 60 + 1));
  expect(save.loops[1].actionIds).toEqual(['protect_wakaharu']);
});

it('does not let the player abandon the promise to travel to the old station', () => {
  const save = normalizeSave(null, T0);
  confirmAction(save, 'protect_wakaharu', realTimeAt(18 * 60 + 1));
  expect(() => travelToOldStation(save, 18 * 60 + 2)).toThrow(/陪著若晴/);
});
