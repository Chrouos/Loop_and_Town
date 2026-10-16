import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceBoard } from '../../src/player/EvidenceBoard';
import { normalizeSave } from '../../src/player/model';
import { unpinExcerpt } from '../../src/player/logic';

function previousSave() {
 const save = normalizeSave(null, 1000);
 save.knowledge.pins = ['letter:postmark','old-death:death'];
 save.knowledge.connections = ['letter:postmark|old-death:death#letter-after-death'];
 save.knowledge.positions['letter:postmark'] = {x:125,y:250};
 save.knowledge.positions['old-death:death'] = {x:345,y:250};
 return save;
}

describe('old pin saves remain readable without creating new pin choices',()=>{
 it('keeps historical excerpt pins, position and authored user link through save normalization',()=>{
  const prior = previousSave();
  const restored = normalizeSave(JSON.stringify(prior), 2000);
  expect(restored.knowledge.pins).toEqual(prior.knowledge.pins);
  expect(restored.knowledge.positions).toEqual(prior.knowledge.positions);
  expect(restored.knowledge.connections).toEqual(prior.knowledge.connections);
 });
 it('shows legacy excerpt only in the wall; old links still render and can be removed',async()=>{
  const save=previousSave();
  const onChange=vi.fn(),onNotice=vi.fn();
  render(<EvidenceBoard save={save} onChange={onChange} onNotice={onNotice}/>);
  expect(screen.getByText(/舊版保存的句子仍留在推理牆/)).toBeDefined();
  expect(screen.getByText(/郵戳是昨天的；署名是林知夏/)).toBeDefined();
  expect(screen.getByText(/玩家連線/)).toBeDefined();
  const remove=screen.getAllByRole('button',{name:'移出'});
  await userEvent.setup().click(remove[0]);
  expect(onChange).toHaveBeenCalledOnce();
  const updated=onChange.mock.calls[0][0];
  expect(updated.knowledge.pins).toEqual(['old-death:death']);
  expect(updated.knowledge.connections).toEqual([]);
  expect(updated.knowledge.positions['letter:postmark']).toBeUndefined();
 });
 it('removing a legacy pin does not remove captured memories or unrelated wall connections',()=>{
  const save=previousSave();
  save.knowledge.memories.push({
   id:'memory:1:paper-word',sourceLoop:1,sourceRecordId:'paper-word',sourceSceneId:'paper-word',
   capturedAtMinute:372,capturedAtMs:1000,kind:'text',title:'紙張',content:['有一道摺痕']
  });
  save.knowledge.wallRefs.push('memory:1:paper-word');
  unpinExcerpt(save,'letter:postmark');
  expect(save.knowledge.memories).toHaveLength(1);
  expect(save.knowledge.wallRefs).toContain('memory:1:paper-word');
 });
});
