import type { PlayerSave } from './model';

export const STATION_TRAVEL_MINUTES = 20;
export type StationVisit = {
  departMinute: number;
  arriveMinute: number;
  returnDepartMinute?: number;
  returnArriveMinute?: number;
};

export function isAtOldStation(save: PlayerSave, minute: number): boolean {
  const visit = save.loops[save.currentLoopId]?.stationVisit;
  return !!visit && minute >= visit.arriveMinute
    && (visit.returnDepartMinute === undefined || minute < visit.returnDepartMinute);
}

export const TOWN_ARRIVAL_MINUTE = 7 * 60 + 40;

/** The player only travels between the old house and the old station; every other stay is the old house. */
export function protagonistLocationAt(save: PlayerSave, loop: number, minute: number): string {
  if (minute < TOWN_ARRIVAL_MINUTE) return 'train';
  const visit = save.loops[loop]?.stationVisit;
  if (visit && minute >= visit.departMinute) {
    if (minute < visit.arriveMinute) return 'en_route';
    if (visit.returnDepartMinute === undefined || minute < visit.returnDepartMinute) return 'old_station';
    if (minute < (visit.returnArriveMinute ?? visit.returnDepartMinute)) return 'en_route';
  }
  return 'old_house';
}

export function travelToOldStation(save: PlayerSave, minute: number): PlayerSave {
  if(minute < TOWN_ARRIVAL_MINUTE) throw new Error('主角尚未抵達灰潮鎮。');
  if(minute >= 18 * 60 + 31) throw new Error('現在出發已來不及抵達關鍵現場。');
  const loop = save.loops[save.currentLoopId];
  if(loop.stationVisit) throw new Error('今天已安排過舊站行程，不能瞬間換位置。');
  if(loop.actionIds.includes('protect_wakaharu')) throw new Error('你答應過今晚陪著若晴，不能丟下她去舊車站。');
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
