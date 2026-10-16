import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerApp } from '../../src/player/PlayerApp';
import { PlayerSceneStage } from '../../src/player/ui/PlayerSceneStage';
import { InlineTextTarget } from '../../src/player/ui/InlineTextTarget';
import { readSave } from '../../src/player/storage';
import { normalizeSave } from '../../src/player/model';
import { attendPresenceRecord, settlePresenceAttention } from '../../src/player/knowledge';
import { ATTENTION_OBSERVATION_MS, ATTENTION_SHIFT_MS } from '../../src/player/attention';
import type { PlayerPresentationModel } from '../../src/player/presentation/types';
import type { SimulationDefinition, WorldState } from '../../src/simulator/types';

const initialState:WorldState={clock:{day:0,time:'06:12'},world:{},characters:{},flags:{}};
const definition:SimulationDefinition={actions:[],events:[]};
const loadStory=async ()=>({initialState,definition});

it('narration words are accessible click targets, not automatic hidden awards',async()=>{
 const attend=vi.fn(),preview=vi.fn();
 const ui=render(<InlineTextTarget available focused={false} onAttend={attend} onPreview={preview}>紙張</InlineTextTarget>);
 const button=screen.getByRole('button',{name:'留意：紙張'});
 fireEvent.focus(button);expect(preview).toHaveBeenCalledWith(true);
 await userEvent.setup().click(button);expect(attend).toHaveBeenCalledTimes(1);
 ui.rerender(<InlineTextTarget available={false} onAttend={attend}>紙張</InlineTextTarget>);
 expect(screen.queryByRole('button',{name:'留意：紙張'})).toBeNull();
 expect(screen.getByText('紙張')).toBeDefined();
});

it('the black stage exposes peripheral cues as real buttons sharing the same focus',async()=>{
 const cue={id:'train-rustle',sceneId:'train-rustle',loopId:1,title:'沙沙',source:'車廂',
   formedAt:'06:12',obtainedAt:'06:12',body:['信封的紙聲'],excerpts:[],revealMinute:372,acquisition:'presence' as const};
 const model:PlayerPresentationModel={loopId:1,timeLabel:'06:12',location:'返鄉列車',mode:'reading',
   scene:undefined,sceneCandidates:[],ambientCues:[cue],
   attention:{phase:'idle'},capture:{active:false},reset:{pending:false,npcState:'current'},
   persistentMemoryIds:[],wallRefs:[],memoryCandidates:[],inference:'player-led'};
 const attend=vi.fn(),preview=vi.fn();
 render(<PlayerSceneStage presentation={model} onAmbientAttend={attend}
   onAmbientPreview={preview} focusedId="train-rustle"><p>其他文字仍在發生</p></PlayerSceneStage>);
 const button=screen.getByRole('button',{name:'沙沙、沙沙——'});
 expect(button.getAttribute('data-focus')).toBe('true');
 fireEvent.mouseEnter(button);expect(preview).toHaveBeenCalledWith('train-rustle');
 await userEvent.setup().click(button);expect(attend).toHaveBeenCalledWith('train-rustle');
 expect(screen.getByRole('region',{name:'玩家場景：返鄉列車'}).getAttribute('data-active-attention')).toBe('true');
});

it('opening inline paper and separate rustle use actual Attention; neither auto-captures',async()=>{
 const storage=window.localStorage;storage.clear();
 let ms=1_000;
 render(<PlayerApp now={()=>ms} storage={storage} loadStory={loadStory}/>);
 const user=userEvent.setup();
 const paper=await screen.findByRole('button',{name:'留意：紙張'});
 expect(screen.getByRole('button',{name:'沙沙、沙沙——'})).toBeDefined();
 await user.click(paper);
 expect(readSave(storage,ms).loops[1].attention.targetId).toBe('paper-word');
 expect(readSave(storage,ms).knowledge.memories).toHaveLength(0);
 await user.click(screen.getByRole('button',{name:'沙沙、沙沙——'}));
 expect(readSave(storage,ms).loops[1].attention.targetId).toBe('train-rustle');
 ms+=ATTENTION_SHIFT_MS+ATTENTION_OBSERVATION_MS+10;
 fireEvent(document,new Event('visibilitychange'));
 expect((await screen.findByText(/紙頁擦過掌心/))).toBeDefined();
 expect(readSave(storage,ms).loops[1].perceivedSceneIds).toContain('train-rustle');
 expect(readSave(storage,ms).knowledge.memories).toHaveLength(0);
 await user.click(screen.getByRole('button',{name:'捕捉記憶'}));
 ms+=ATTENTION_SHIFT_MS+1_200+10;
 fireEvent(document,new Event('visibilitychange'));
 expect(readSave(storage,ms).knowledge.memories.map(x=>x.sourceRecordId)).toContain('train-rustle');
});

it('clicking the opening letter remains an actual story transaction',async()=>{
 const storage=window.localStorage;storage.clear();
 render(<PlayerApp now={()=>1_000} storage={storage} loadStory={loadStory}/>);
 const user=userEvent.setup();
 await user.click(await screen.findByRole('button',{name:/拆開信封/}));
 expect(readSave(storage,1_000).knowledge.opened).toContain('1:letter');
 expect((await screen.findAllByText('不要回來。')).length).toBeGreaterThan(0);
});

it('a visible paper excerpt button updates the Investigation pin instead of silently ignoring clicks',async()=>{
 const storage=window.localStorage;storage.clear();
 render(<PlayerApp now={()=>1_000} storage={storage} loadStory={loadStory}/>);
 const user=userEvent.setup();
 await user.click(await screen.findByRole('button',{name:/拆開信封/}));
 const excerpt=screen.getByRole('button',{name:/郵戳是昨天的；署名是林知夏/});
 await user.click(excerpt);
 expect(readSave(storage,1_000).knowledge.pins).toContain('letter:postmark');
 expect(screen.getByRole('status').textContent).toContain('已放在推理桌上');
});

it('an observation missed during attention shift cannot retroactively produce player knowledge',()=>{
 const save=normalizeSave(null,1_000);
 save.loops[1].revealedIds.push('1:paper-word');
 expect(attendPresenceRecord(save,1,'paper-word',389,undefined,'letter',1_000)).toBe(true);
 const missed=settlePresenceAttention(save,1,1_000+ATTENTION_SHIFT_MS+ATTENTION_OBSERVATION_MS+1,391);
 expect(missed).toBeUndefined();
 expect(save.loops[1].perceivedSceneIds).not.toContain('paper-word');
 expect(save.knowledge.memories).toHaveLength(0);
});
