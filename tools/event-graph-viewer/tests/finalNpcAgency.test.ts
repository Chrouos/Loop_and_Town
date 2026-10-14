import { describe,expect,it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';
import { simulateStory } from '../src/simulator/storySimulation';
import { fromAbsoluteMinute } from '../src/simulator/time';
import { STORY_RECORDS } from '../src/player/story';

function run(actions:string[]) {
 const story=loadRealStory();
 return simulateStory({story,actionIds:actions,until:fromAbsoluteMinute(19*60)});
}
describe('P3: autonomous NPC timetable affects investigative result',()=>{
  it('Yuan investigates when free and asked; does not automatically grant shutdown consent',()=>{
    const r=run(['request_backup_inspection']);
    expect((r.state.world as Record<string,unknown>).backup_inspection_completed).toBe(true);
    expect((r.state.characters as Record<string,any>).yuan.assignment).toBe('inspect_backup');
    const row=STORY_RECORDS.find(x=>x.id==='yuan-inspection-report')!;
    expect(row.matches(r.fullHistory)).toBe(true);
    expect((r.state.correction as Record<string,unknown>).riskDisclosed).toBe(false);
  });
  it('a prior independent post-office assignment prevents the inspection without changing NPC memory',()=>{
    const r=run(['send_yuan_to_post_office','request_backup_inspection']);
    expect((r.state.world as Record<string,unknown>).backup_inspection_completed).toBe(false);
    expect(STORY_RECORDS.find(x=>x.id==='yuan-inspection-report')!.matches(r.fullHistory)).toBe(false);
    expect(STORY_RECORDS.find(x=>x.id==='yuan-no-inspection')!.matches(r.fullHistory)).toBe(true);
  });
});
