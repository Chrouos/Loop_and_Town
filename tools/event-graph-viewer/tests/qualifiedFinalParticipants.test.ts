import {describe,expect,it} from 'vitest';
import {initialCorrectionSession,hasQualifiedParticipants,reduceCorrection} from '../src/simulator/correctionSession';

function prepared(){
 let s=initialCorrectionSession();
 s=reduceCorrection(s,{op:'converge'});
 for(const e of [
   {op:'record_evidence' as const,id:'ledger_conflict' as const,source:'protagonist' as const},
   {op:'record_evidence' as const,id:'route_exposure' as const,source:'doctor' as const},
   {op:'record_evidence' as const,id:'bridge_map' as const,source:'yuan' as const},
 ])s=reduceCorrection(s,e);
 s=reduceCorrection(s,{op:'disclose_risk'});
 s=reduceCorrection(s,{op:'identify_bridges'});
 return s;
}
describe('Ending C qualified character participation',()=>{
 it('rejects a merely numerical majority without technical expertise',()=>{
  let s=prepared();
  s=reduceCorrection(s,{op:'record_choice',actor:'doctor',choice:'participate'});
  s=reduceCorrection(s,{op:'record_choice',actor:'detective',choice:'participate'});
  expect(hasQualifiedParticipants(s)).toBe(false);
  expect(()=>reduceCorrection(s,{op:'revoke_primary'})).toThrow(/unauthorized/);
 });
 it('requires an independently qualified reviewer in addition to Yuan',()=>{
  let s=prepared();
  s=reduceCorrection(s,{op:'record_choice',actor:'yuan',choice:'participate'});
  s=reduceCorrection(s,{op:'record_choice',actor:'protagonist',choice:'participate'});
  expect(hasQualifiedParticipants(s)).toBe(false);
  expect(()=>reduceCorrection(s,{op:'seal_one_time'})).toThrow(/informed participation/);
 });
 it('accepts Yuan and either Doctor or Detective without forcing Wakaharu',()=>{
  for (const reviewer of ['doctor','detective'] as const) {
   let s=prepared();
   s=reduceCorrection(s,{op:'record_choice',actor:'wakaharu',choice:'decline'});
   s=reduceCorrection(s,{op:'record_choice',actor:'yuan',choice:'participate'});
   s=reduceCorrection(s,{op:'record_choice',actor:reviewer,choice:'participate'});
   expect(hasQualifiedParticipants(s)).toBe(true);
   expect(reduceCorrection(s,{op:'revoke_primary'}).primaryWriteAuthority).toBe(false);
  }
 });
});
