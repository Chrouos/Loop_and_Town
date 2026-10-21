import type { PlayerSave } from './model';

export const STATION_TRAVEL_MINUTES = 20;
export type StationVisit = {
  departMinute: number;
  arriveMinute: number;
  returnDepartMinute?: number;
  returnArriveMinute?: number;
};

export type TownPlace = 'cafe' | 'hospital' | 'clock_shop';
export const TOWN_PLACES: TownPlace[] = ['clock_shop', 'cafe', 'hospital'];
// Walking times from the old house, matching story/travel/loop_01.yaml.
export const TOWN_TRAVEL_MINUTES: Record<TownPlace, number> = { clock_shop: 8, cafe: 12, hospital: 18 };
/** A round trip from the old house to a place in town; leaving for the old station ends it without a walk home. */
export type TownVisit = StationVisit & { place: TownPlace };

export function isAtOldStation(save: PlayerSave, minute: number): boolean {
  return protagonistLocationAt(save, save.currentLoopId, minute) === 'old_station';
}

export const TOWN_ARRIVAL_MINUTE = 7 * 60 + 40;
const LAST_DEPARTURE_MINUTE = 23 * 60 + 59;

type Segment = { from: number; to: number; location: string };

function visitSegments(location: string, visit: StationVisit): Segment[] {
  const segments: Segment[] = [
    { from: visit.departMinute, to: visit.arriveMinute, location: 'en_route' },
    { from: visit.arriveMinute, to: visit.returnDepartMinute ?? Infinity, location },
  ];
  if (visit.returnDepartMinute !== undefined && visit.returnArriveMinute !== undefined) {
    segments.push({ from: visit.returnDepartMinute, to: visit.returnArriveMinute, location: 'en_route' });
  }
  return segments;
}

/** Where the protagonist is: on the train before arriving, on the road between places, otherwise the old house. */
export function protagonistLocationAt(save: PlayerSave, loop: number, minute: number): string {
  if (minute < TOWN_ARRIVAL_MINUTE) return 'train';
  const entry = save.loops[loop];
  const segments = [
    ...(entry?.townVisits ?? []).flatMap(visit => visitSegments(visit.place, visit)),
    ...(entry?.stationVisit ? visitSegments('old_station', entry.stationVisit) : []),
  ];
  const current = segments
    .filter(segment => segment.from <= minute && minute < segment.to)
    .sort((left, right) => right.from - left.from)[0];
  return current?.location ?? 'old_house';
}

// Leaving on foot ends whatever the protagonist was doing at home (activities are interruptible).
function stopActivities(save: PlayerSave, minute: number): void {
  for (const run of save.loops[save.currentLoopId].activityRuns ?? []) {
    if (run.stopMinute === undefined && run.startMinute <= minute) run.stopMinute = minute;
  }
}

export function travelToOldStation(save: PlayerSave, minute: number): PlayerSave {
  if(minute < TOWN_ARRIVAL_MINUTE) throw new Error('主角尚未抵達灰潮鎮。');
  if(minute >= 18 * 60 + 31) throw new Error('現在出發已來不及抵達關鍵現場。');
  const loop = save.loops[save.currentLoopId];
  if(loop.stationVisit) throw new Error('今天已安排過舊站行程，不能瞬間換位置。');
  if(loop.actionIds.includes('protect_wakaharu')) throw new Error('你答應過今晚陪著若晴，不能丟下她去舊車站。');
  const here = protagonistLocationAt(save, save.currentLoopId, minute);
  if(here === 'en_route') throw new Error('你還在路上。');
  const townVisit = loop.townVisits?.find(visit => visit.place === here && visit.returnDepartMinute === undefined);
  if(townVisit) townVisit.returnDepartMinute = minute;
  stopActivities(save, minute);
  loop.stationVisit = { departMinute: minute, arriveMinute: minute + STATION_TRAVEL_MINUTES };
  return save;
}
export function leaveOldStation(save: PlayerSave, minute: number): PlayerSave {
  if(!isAtOldStation(save,minute)) throw new Error('不在舊車站，無法從此處離開。');
  const visit = save.loops[save.currentLoopId].stationVisit!;
  if(visit.returnDepartMinute !== undefined) throw new Error('已經離開舊車站。');
  visit.returnDepartMinute=minute;
  visit.returnArriveMinute=minute+STATION_TRAVEL_MINUTES;
  return save;
}

/** A scene narrates her going home: wherever she was, she set off in time to arrive as it begins. */
export function returnHomeByStory(save: PlayerSave, loop: number, minute: number): void {
  const entry = save.loops[loop];
  if (!entry) return;
  const station = entry.stationVisit;
  if (station && station.returnDepartMinute === undefined && station.departMinute <= minute) {
    station.returnDepartMinute = Math.max(station.arriveMinute, minute - STATION_TRAVEL_MINUTES);
    station.returnArriveMinute = station.returnDepartMinute + STATION_TRAVEL_MINUTES;
  }
  for (const visit of entry.townVisits ?? []) {
    if (visit.returnDepartMinute !== undefined || visit.departMinute > minute) continue;
    const walk = TOWN_TRAVEL_MINUTES[visit.place];
    visit.returnDepartMinute = Math.max(visit.arriveMinute, minute - walk);
    visit.returnArriveMinute = visit.returnDepartMinute + walk;
  }
}

export function travelToTown(save: PlayerSave, place: TownPlace, minute: number): PlayerSave {
  if (minute < TOWN_ARRIVAL_MINUTE) throw new Error('主角尚未抵達灰潮鎮。');
  if (minute >= LAST_DEPARTURE_MINUTE) throw new Error('已經太晚，鎮上的店都關了。');
  if (protagonistLocationAt(save, save.currentLoopId, minute) !== 'old_house') throw new Error('先回到老家再出發。');
  const loop = save.loops[save.currentLoopId];
  stopActivities(save, minute);
  loop.townVisits = [...(loop.townVisits ?? []), { place, departMinute: minute, arriveMinute: minute + TOWN_TRAVEL_MINUTES[place] }];
  return save;
}

export function leaveTown(save: PlayerSave, minute: number): PlayerSave {
  const here = protagonistLocationAt(save, save.currentLoopId, minute);
  const visit = save.loops[save.currentLoopId].townVisits?.find(item => item.place === here && item.returnDepartMinute === undefined);
  if (!visit) throw new Error('你現在不在鎮上的店裡。');
  visit.returnDepartMinute = minute;
  visit.returnArriveMinute = minute + TOWN_TRAVEL_MINUTES[visit.place];
  return save;
}
