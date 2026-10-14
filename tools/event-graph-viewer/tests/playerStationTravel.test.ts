import { describe,expect,it } from 'vitest';
import { normalizeSave } from '../src/player/model';
import { availablePresenceRecords } from '../src/player/knowledge';
import { travelToOldStation,leaveOldStation,isAtOldStation } from '../src/player/stationTravel';

describe('Physical Perception Boundary: station visit',()=>{
 it('cannot observe old-station evidence remotely or while traveling',()=>{
  const save=normalizeSave(null,0);
  save.loops[1].revealedIds=['1:signal-ledger','1:backup-relay'];
  expect(availablePresenceRecords(save,1,1053).map(x=>x.id)).not.toContain('signal-ledger');
  travelToOldStation(save,1045);
  expect(isAtOldStation(save,1054)).toBe(false);
  expect(availablePresenceRecords(save,1,1054).map(x=>x.id)).not.toContain('signal-ledger');
  expect(isAtOldStation(save,1068)).toBe(true);
  expect(availablePresenceRecords(save,1,1068).map(x=>x.id)).toContain('backup-relay');
 });
 it('a delayed visit cannot retroactively catch an expired clue',()=>{
  const save=normalizeSave(null,0);
  save.loops[1].revealedIds=['1:signal-ledger'];
  travelToOldStation(save,1050);
  expect(isAtOldStation(save,1070)).toBe(true);
  expect(availablePresenceRecords(save,1,1070).map(x=>x.id)).not.toContain('signal-ledger');
 });
 it('returns from the station without teleporting or freezing world events',()=>{
  const save=normalizeSave(null,0);travelToOldStation(save,1000);
  leaveOldStation(save,1100);
  expect(isAtOldStation(save,1099)).toBe(true);
  expect(isAtOldStation(save,1100)).toBe(false);
  expect(save.loops[1].stationVisit?.returnArriveMinute).toBe(1120);
  const reload=normalizeSave(JSON.stringify(save),1101);
  expect(reload.loops[1].stationVisit).toEqual(save.loops[1].stationVisit);
 });
 it('cannot depart before arriving in town or teleport back for a second visit',()=>{
  const save=normalizeSave(null,0);
  expect(()=>travelToOldStation(save,372)).toThrow(/尚未抵達/);
  travelToOldStation(save,1000);
  expect(()=>travelToOldStation(save,1001)).toThrow(/已安排/);
 });
});
