import { describe,expect,it } from 'vitest';
import { normalizeSave } from '../src/player/model';
import { connectWallRefs, submitBridgeHypothesis, BRIDGE_HYPOTHESIS } from '../src/player/logic';
import { confirmAction } from '../src/player/runtime';

function captured() {
  const s=normalizeSave(null,0);
  const fact=(loop:number,src:string)=>({id:`memory:${loop}:${src}`,sourceLoop:loop,sourceRecordId:src,sourceSceneId:src,
    capturedAtMinute:1054,capturedAtMs:0,kind:'text' as const,title:src,content:[src]});
  s.knowledge.memories=[fact(1,'signal-ledger'),fact(2,'backup-relay')];
  s.knowledge.wallRefs=s.knowledge.memories.map(x=>x.id);
  return s;
}
describe('P2: authored hypothesis is player-verified, not automatic',()=>{
  it('refuses a link when either memory was not captured',()=>{
    const s=captured();s.knowledge.memories.pop();
    expect(()=>submitBridgeHypothesis(s)).toThrow(/記下/);
    expect(s.knowledge.discoveredEvidence).toEqual([]);
  });
  it('does not grant a hypothesis just because two memories coexist',()=>{
    const s=captured();
    expect(()=>submitBridgeHypothesis(s)).toThrow(/連線/);
    expect(()=>confirmAction(s,'request_backup_inspection',0)).toThrow(/推論/);
  });
  it('a manual wall connection unlocks a new time-limited real world action',()=>{
    const s=captured();
    connectWallRefs(s,s.knowledge.memories[0].id,s.knowledge.memories[1].id);
    submitBridgeHypothesis(s);
    expect(s.knowledge.discoveredEvidence).toContain(BRIDGE_HYPOTHESIS);
    const updated=confirmAction(s,'request_backup_inspection',0);
    expect(updated.loops[1].actionIds).toContain('request_backup_inspection');
  });
});
