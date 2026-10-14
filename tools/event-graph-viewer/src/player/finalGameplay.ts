import { initialCorrectionSession, reduceCorrection, type CorrectionCommand, type CorrectionSession } from '../simulator/correctionSession';
import type { WorldState } from '../simulator/types';
import type { PlayerSave } from './model';
import { isAtOldStation } from './stationTravel';

export const FINAL_STEPS = [
  'trace_mismatch','invite_yuan','invite_doctor','invite_detective',
  'close_primary','close_recovery','fence_epoch','verify_isolation','seal_once','seal_permanent',
] as const;
export type FinalStep = typeof FINAL_STEPS[number];
export type TimedFinalStep = { id: FinalStep; minute: number };

const memory = (save: PlayerSave, recordId: string) =>
  save.knowledge.memories.some(item => item.sourceRecordId === recordId);
const opened = (save: PlayerSave, recordId: string) =>
  save.knowledge.opened.includes(`${save.currentLoopId}:${recordId}`);
const stateOf = (world: WorldState, id: string): Record<string, unknown> =>
  ((world.characters as Record<string,Record<string, unknown>> | undefined)?.[id] ?? {});
const currentSteps = (save: PlayerSave): TimedFinalStep[] =>
  save.loops[save.currentLoopId]?.finalSteps ?? [];

export function finalInvestigationReady(save: PlayerSave, world: WorldState, minute: number): boolean {
  return save.currentLoopId >= 2 && isAtOldStation(save,minute)
    && save.knowledge.discoveredEvidence.includes('primary_recovery_both_active')
    && memory(save, 'signal-ledger') && memory(save, 'backup-relay')
    && memory(save, 'track-damage')
    && save.loops[save.currentLoopId]?.actionIds.includes('request_backup_inspection') === true
    && opened(save,'yuan-inspection-report')
    && (world.world as Record<string, unknown> | undefined)?.backup_inspection_completed === true;
}

function commandsFor(step: FinalStep): CorrectionCommand[] {
  switch (step) {
    case 'trace_mismatch': return [
      {op:'record_evidence',id:'ledger_conflict',source:'protagonist'},
      {op:'record_evidence',id:'route_exposure',source:'protagonist'},
      {op:'record_evidence',id:'bridge_map',source:'yuan'},
      {op:'disclose_risk'},
      {op:'identify_bridges'},
    ];
    case 'invite_yuan': return [{op:'record_choice',actor:'yuan',choice:'participate'}];
    case 'invite_doctor': return [{op:'record_choice',actor:'doctor',choice:'participate'}];
    case 'invite_detective': return [{op:'record_choice',actor:'detective',choice:'participate'}];
    case 'close_primary': return [{op:'revoke_primary'}];
    case 'close_recovery': return [{op:'revoke_recovery'}];
    case 'fence_epoch': return [{op:'fence_epoch'}];
    case 'verify_isolation': return [
      {op:'record_evidence',id:'independent_check',source:'detective'},
      {op:'verify_isolation'},
    ];
    case 'seal_once': return [{op:'seal_one_time'}];
    case 'seal_permanent': return [{op:'seal_permanent'}];
  }
}

export function finalCorrection(save: PlayerSave, minute: number): CorrectionSession {
  let session=initialCorrectionSession();
  if(minute<1111) return session;
  session=reduceCorrection(session,{op:'converge'});
  for(const item of currentSteps(save)) for(const cmd of commandsFor(item.id)) session=reduceCorrection(session,cmd);
  if(minute>=1439) session=reduceCorrection(session,{op:'final_check'});
  if(minute>=1440) session=reduceCorrection(session,{op:'adjudicate'});
  return session;
}

export function finalStepReason(save: PlayerSave, world: WorldState, minute: number, step: FinalStep): string | null {
  if(minute<1111 || minute>=1439) return '本輪可介入的時間已經過去。';
  if(!finalInvestigationReady(save,world,minute)) return '你還沒有在舊站取得本輪可核實的線索與予安的回覆。';
  const entries=currentSteps(save);
  if(entries.some(item=>item.id===step)) return '同一個決定不會重做一次。';
  if(entries.length && minute<=entries[entries.length-1].minute) return '世界還在變化。下一項行動至少需要再過一分鐘。';
  const session=finalCorrection(save,minute);
  if(session.phase!=='UNRESOLVED') return '這一輪的結案選擇已經作出。';
  if(step==='trace_mismatch') return null;
  if(!session.bridgesIdentified) return '還需要先向在場的人解釋證據。';
  if(step==='invite_yuan' && (stateOf(world,'yuan').assignment!=='inspect_backup' ||
      (world.world as Record<string,unknown>).backup_inspection_completed!==true))
    return '予安有自己的行程，無法從別處被強制叫回來。';
  if(step==='invite_doctor' && (stateOf(world,'doctor').status!=='alive' || stateOf(world,'doctor').route!=='stay_hospital'))
    return '柏勳此時無法安全地離開醫院協助操作。';
  if(step==='invite_detective' && !memory(save,'external-ack')) return '尚未親自保存志遠的獨立紀錄。';
  if(step==='verify_isolation' && !memory(save,'external-ack')) return '缺少另一個獨立來源，不能只相信操作介面。';
  if(['close_primary','close_recovery','fence_epoch','verify_isolation','seal_once','seal_permanent'].includes(step)
    && Object.values(session.choices).filter(choice=>choice==='participate').length<2)
    return '至少需要有相應能力的人願意安全協作，不能替他們決定。';
  if(step==='seal_permanent' && !session.isolationVerified) return '兩條寫入路徑尚未完成獨立驗證。';
  if(step==='seal_once' && !session.riskDisclosed) return '還沒有把風險說明清楚。';
  try { let proposed=session; for(const c of commandsFor(step)) proposed=reduceCorrection(proposed,c); }
  catch(e) {return e instanceof Error ? e.message : String(e);}
  return null;
}

export function applyFinalStep(save: PlayerSave, world: WorldState, minute: number, step: FinalStep): PlayerSave {
  const reason=finalStepReason(save,world,minute,step);
  if(reason) throw new Error(reason);
  save.loops[save.currentLoopId].finalSteps.push({id:step,minute});
  return save;
}

export function offeredFinalSteps(save: PlayerSave, world: WorldState, minute: number): FinalStep[] {
  if(!finalInvestigationReady(save,world,minute)||minute<1111||minute>=1439) return [];
  const existing=new Set(currentSteps(save).map(item=>item.id));
  const candidates:FinalStep[]=[
    'trace_mismatch','invite_yuan','invite_doctor','invite_detective',
    'close_primary','close_recovery','fence_epoch','verify_isolation','seal_once','seal_permanent',
  ];
  return candidates.filter(step=>!existing.has(step)&&finalStepReason(save,world,minute,step)===null);
}
