import { describe,expect,it } from 'vitest';
import { createLoopClock } from '../src/player/clock';
import { emptyLoop, normalizeSave } from '../src/player/model';
import { applyFinalStep, finalCorrection, finalInvestigationReady, finalStepReason, offeredFinalSteps, type FinalStep } from '../src/player/finalGameplay';
import type { WorldState } from '../src/simulator/types';

function fixture(){
 const save=normalizeSave(null,0);
 save.currentLoopId=2;
 save.loops[2]=emptyLoop(createLoopClock('ACCELERATED',0));
 save.loops[2].actionIds.push('request_backup_inspection');
 save.loops[2].stationVisit={departMinute:1000,arriveMinute:1020};
 save.knowledge.discoveredEvidence.push('primary_recovery_both_active');
 const physical=['signal-ledger','backup-relay','track-damage','external-ack'];
 for(const [i,id] of physical.entries()) save.knowledge.memories.push({
   id:`memory:${i+1}:${id}`,sourceLoop:i+1,sourceRecordId:id,sourceSceneId:id,
   capturedAtMinute:1053+i*16,capturedAtMs:100,kind:'text',title:id,content:[id],
 });
 save.knowledge.opened.push('2:yuan-inspection-report');
 const world={
   world:{backup_inspection_completed:true},
   characters:{yuan:{assignment:'inspect_backup',status:'available'},doctor:{route:'stay_hospital',status:'alive'}},
 } as unknown as WorldState;
 return {save,world};
}
function step(save:ReturnType<typeof fixture>['save'],world:WorldState,values:Array<[FinalStep,number]>){
 for(const [id,minute] of values) applyFinalStep(save,world,minute,id);
}
describe('P4: real PlayerSave-backed Final transitions',()=>{
 it('requires a genuine player hypothesis and contemporaneous Yuan inspection',()=>{
   const {save,world}=fixture();
   expect(finalInvestigationReady(save,world,1132)).toBe(true);
   save.knowledge.discoveredEvidence=[];
   expect(finalInvestigationReady(save,world,1132)).toBe(false);
   expect(()=>applyFinalStep(save,world,1132,'trace_mismatch')).toThrow();
   save.knowledge.discoveredEvidence=['primary_recovery_both_active'];
   delete (world.world as Record<string,unknown>).backup_inspection_completed;
   expect(finalInvestigationReady(save,world,1132)).toBe(false);
 });
 it('missing time and missing independent recorder cannot be bypassed',()=>{
   const {save,world}=fixture();
   expect(finalStepReason(save,world,1100,'trace_mismatch')).not.toBeNull();
   step(save,world,[['trace_mismatch',1131],['invite_yuan',1132]]);
   expect(()=>applyFinalStep(save,world,1132,'invite_detective')).toThrow(/一分鐘/);
   save.knowledge.memories=save.knowledge.memories.filter(x=>x.sourceRecordId!=='external-ack');
   expect(finalStepReason(save,world,1133,'invite_detective')).not.toBeNull();
 });
 it('the NPC route matters: doctor cannot be forced to take a risky role',()=>{
   const {save,world}=fixture();
   step(save,world,[['trace_mismatch',1131]]);
   (world.characters as Record<string,Record<string,unknown>>).doctor.route='old_station';
   expect(finalStepReason(save,world,1132,'invite_doctor')).toContain('醫院');
 });
 it('a named NPC may decline and the protagonist cannot override the decision',()=>{
   const {save,world}=fixture();
   step(save,world,[['trace_mismatch',1131]]);
   (world.characters as Record<string,Record<string,unknown>).yuan.cooperation='decline';
   expect(finalStepReason(save,world,1132,'invite_yuan')).toContain('拒絕');
   expect(()=>applyFinalStep(save,world,1132,'invite_yuan')).toThrow(/拒絕/);
 });
 it('two willing people without technical capacity cannot operate either writer',()=>{
   const {save,world}=fixture();
   step(save,world,[['trace_mismatch',1131],['invite_doctor',1132],['invite_detective',1133]]);
   expect(finalStepReason(save,world,1134,'close_primary')).toContain('予安');
 });
 it('B retries when the player never secures an effective Forward Seal',()=>{
   const {save}=fixture();
   expect(finalCorrection(save,1440)).toMatchObject({outcome:'RETRY',nextCheckpoint:'10/3 06:12'});
 });
 it('A accepts the current day only; backup writer authority remains in force',()=>{
   const {save,world}=fixture();
   step(save,world,[['trace_mismatch',1131],['invite_yuan',1132],['invite_detective',1133],['seal_once',1134]]);
   expect(finalCorrection(save,1440)).toMatchObject({outcome:'FORWARD',sealMode:'ONE_TIME',
     primaryWriteAuthority:true,recoveryWriteAuthority:true,nextCheckpoint:'10/4 00:01'});
 });
 it('C executes primary, backup, fencing, verification and permanent seal',()=>{
   const {save,world}=fixture();
   step(save,world,[['trace_mismatch',1131],['invite_yuan',1132],['invite_detective',1133],
     ['close_primary',1134],['close_recovery',1135],['fence_epoch',1136],
     ['verify_isolation',1137],['seal_permanent',1138]]);
   expect(finalCorrection(save,1440)).toMatchObject({phase:'FORWARD_SEALED',outcome:'FORWARD',
     sealMode:'PERMANENT',primaryWriteAuthority:false,recoveryWriteAuthority:false,
     epochFenced:true,isolationVerified:true,nextCheckpoint:'10/4 00:01'});
   expect(offeredFinalSteps(save,world,1139)).toEqual([]);
 });
 it('primary shutdown alone is not a win, and an unsealed dual cutoff is a hold',()=>{
   const {save,world}=fixture();
   step(save,world,[['trace_mismatch',1131],['invite_yuan',1132],['invite_detective',1133],
     ['close_primary',1134]]);
   expect(finalCorrection(save,1440)).toMatchObject({outcome:'RETRY',recoveryWriteAuthority:true});
   const both=fixture();
   step(both.save,both.world,[['trace_mismatch',1131],['invite_yuan',1132],['invite_detective',1133],
      ['close_primary',1134],['close_recovery',1135]]);
   expect(finalCorrection(both.save,1440)).toMatchObject({outcome:'SAFETY_HOLD',nextCheckpoint:null});
 });
});
