import { describe,expect,it,vi } from 'vitest';
import { render,screen,fireEvent } from '@testing-library/react';
import { normalizeSave } from '../src/player/model';
import { createLoopClock } from '../src/player/clock';
import { emptyLoop } from '../src/player/model';
import { FinalInvestigationScene } from '../src/player/ui/FinalInvestigationScene';
import type { WorldState } from '../src/simulator/types';

function setup(){
 const save=normalizeSave(null,0);
 save.currentLoopId=2;
 save.loops[2]=emptyLoop(createLoopClock('ACCELERATED',0));
 save.loops[2].chapterId='final';
 save.loops[2].actionIds=['request_backup_inspection'];
 save.loops[2].stationVisit={departMinute:1000,arriveMinute:1020};
 save.knowledge.discoveredEvidence=['primary_recovery_both_active'];
 save.knowledge.opened=['2:yuan-inspection-report'];
 for(const x of ['signal-ledger','backup-relay','track-damage','external-ack']) {
  save.knowledge.memories.push({id:'memory:1:'+x,sourceLoop:1,sourceRecordId:x,sourceSceneId:x,
   capturedAtMinute:1054,capturedAtMs:0,kind:'text',title:x,content:[x]});
 }
 const world={world:{backup_inspection_completed:true},characters:{
  yuan:{assignment:'inspect_backup'},doctor:{status:'alive',route:'stay_hospital'},
 }} as unknown as WorldState;
 return {save,world};
}
describe('Playable Final presentation',()=>{
 it('only exposes a concrete first-person intervention after observed evidence',()=>{
  const {save,world}=setup();const onStep=vi.fn();
  const {rerender}=render(<FinalInvestigationScene save={save} world={world} minute={1100} onStep={onStep}/>);
  expect(screen.queryByRole('region',{name:'舊站的選擇'})).toBeNull();
  rerender(<FinalInvestigationScene save={save} world={world} minute={1132} onStep={onStep}/>);
  const button=screen.getByRole('button',{name:/向在場的人說明/});
  fireEvent.click(button);
  expect(onStep).toHaveBeenCalledWith('trace_mismatch');
  expect(screen.queryByText(/G1｜|G2｜|Forward Seal/)).toBeNull();
 });
 it('does not create an access panel from Author Truth alone',()=>{
  const {save,world}=setup();save.knowledge.memories=[];
  render(<FinalInvestigationScene save={save} world={world} minute={1132} onStep={vi.fn()}/>);
  expect(screen.queryByRole('region',{name:'舊站的選擇'})).toBeNull();
 });
});
