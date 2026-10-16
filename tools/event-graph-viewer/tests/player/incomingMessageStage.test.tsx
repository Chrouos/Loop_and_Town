import { expect, it, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncomingMessageStage } from '../../src/player/ui/IncomingMessageStage';
import type { PlayerNarrativeRecord } from '../../src/player/story';

function pendingMessages(count: number): PlayerNarrativeRecord[] {
 return Array.from({length:count},(_,i)=>({
   id:'message-'+i, sceneId:'message-'+i, loopId:1,
   title:'訊息 '+String(i+1).padStart(2,'0'), source:'鎮上／手機', formedAt:'18:00',
   obtainedAt:'18:00',body:['內容只能透過閱讀操作取得'],excerpts:[],
   revealMinute:1080,acquisition:'message' as const,matches:()=>true,
 }));
}

it('renders 20 pending messages in one viewport without a vertical button list',async()=>{
 const onRead=vi.fn();
 render(<IncomingMessageStage messages={pendingMessages(20)} onRead={onRead}/>);
 const region=screen.getByRole('region',{name:'鎮上新消息'});
 expect(within(region).getByText('20 則訊息')).toBeDefined();
 expect(within(region).getByLabelText('第 1 則，共 20 則')).toBeDefined();
 expect(within(region).getByRole('button',{name:'閱讀新消息：訊息 01'})).toBeDefined();
 expect(within(region).queryByRole('button',{name:'閱讀新消息：訊息 20'})).toBeNull();
 expect(onRead).not.toHaveBeenCalled();
 const user=userEvent.setup();
 await user.click(within(region).getByRole('button',{name:'下一則消息'}));
 expect(within(region).getByLabelText('第 2 則，共 20 則')).toBeDefined();
 expect(onRead).not.toHaveBeenCalled();
 await user.click(within(region).getByRole('button',{name:'閱讀新消息：訊息 02'}));
 expect(onRead).toHaveBeenCalledWith('message-1');
});

it('supports keyboard navigation without marking messages read',async()=>{
 const onRead=vi.fn();
 render(<IncomingMessageStage messages={pendingMessages(3)} onRead={onRead}/>);
 const region=screen.getByRole('region',{name:'鎮上新消息'});
 fireEvent.keyDown(region,{key:'ArrowRight'});
 expect(within(region).getByLabelText('第 2 則，共 3 則')).toBeDefined();
 fireEvent.keyDown(region,{key:'ArrowLeft'});
 expect(within(region).getByLabelText('第 1 則，共 3 則')).toBeDefined();
 expect(onRead).not.toHaveBeenCalled();
});

it('does not render an empty message stage',()=>{
 const onRead=vi.fn();
 render(<IncomingMessageStage messages={[]} onRead={onRead}/>);
 expect(screen.queryByRole('region',{name:'鎮上新消息'})).toBeNull();
});
