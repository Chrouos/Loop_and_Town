import { describe, expect, it } from 'vitest';
import { STORY_RECORDS, staticPlayerRecords } from '../src/player/story';
import { normalizeSave } from '../src/player/model';
import { availablePresenceRecords, attendPresenceRecord, visibleRecords } from '../src/player/knowledge';
import { createLoopClock } from '../src/player/clock';
import { advanceAttention } from '../src/player/attention';

const cues=['signal-ledger','backup-relay','track-damage','external-ack'];
describe('P1: finite, missable Final evidence',()=>{
  it('provides four distinct finite observation windows, never persistent autoplay records',()=>{
    const rows=STORY_RECORDS.filter(x=>cues.includes(x.id));
    expect(rows).toHaveLength(4);
    expect(rows.every(x=>x.acquisition==='presence' && x.availableUntilMinute!>x.revealMinute)).toBe(true);
    expect(staticPlayerRecords(3).filter(x=>cues.includes(x.id)).every(x=>x.loopId===3)).toBe(true);
  });
  it('does not expose a clue after its window if the player never focused on it',()=>{
    const save=normalizeSave(null,0);
    save.loops[1].revealedIds.push('1:signal-ledger');
    save.loops[1].stationVisit={departMinute:1000,arriveMinute:1020};
    expect(availablePresenceRecords(save,1,1070)).toEqual([]);
    expect(visibleRecords(save,1).some(x=>x.id==='signal-ledger')).toBe(false);
  });
  it('requires focused observation; a glance before shift completion grants nothing',()=>{
    const save=normalizeSave(null,0);
    save.loops[1].revealedIds.push('1:signal-ledger');
    save.loops[1].stationVisit={departMinute:1000,arriveMinute:1020};
    expect(attendPresenceRecord(save,1,'signal-ledger',1054,undefined,undefined,1_000)).toBe(true);
    expect(save.loops[1].perceivedSceneIds).toEqual([]);
    const shifted=advanceAttention(save.loops[1].attention,1_100);
    expect(shifted.completedTargetId).toBeUndefined();
    expect(availablePresenceRecords(save,1,1070)).toEqual([]);
  });
  it('old elapsed loops may observe the same physical source again without inheriting NPC memory',()=>{
    const save=normalizeSave(null,0);
    save.currentLoopId=2;
    save.loops[2]={...save.loops[1], clock:createLoopClock('ACCELERATED',0),stationVisit:{departMinute:1000,arriveMinute:1020},revealedIds:['2:backup-relay'],
      perceivedSceneIds:[],seenSceneIds:[],history:[], actionIds:[],attention:{phase:'idle'}};
    expect(availablePresenceRecords(save,2,1070,staticPlayerRecords(2)).map(x=>x.id)).toContain('backup-relay');
    expect(visibleRecords(save,2,staticPlayerRecords(2))).toEqual([]);
  });
});
