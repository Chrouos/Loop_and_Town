import { expect, it } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceBoard } from '../../src/player/EvidenceBoard';
import { normalizeSave } from '../../src/player/model';

it('keeps player-created links separate from automatic causal inference', async () => {
  const save = normalizeSave(null, 0);
  save.loops[1].revealedIds = ['1:letter', '1:old-death'];
  save.knowledge.pins = ['letter:postmark', 'old-death:death'];
  const user = userEvent.setup();
  render(<EvidenceBoard save={save} onChange={() => {}} onNotice={() => {}} />);
  const buttons = screen.getAllByRole('button', { name: '連線' });
  await user.click(buttons[0]);
  await user.click(buttons[1]);
  expect(screen.getByRole('status').textContent).toContain('不代表系統替你判定因果');
  expect(save.knowledge.connections).toEqual([]);
});

it('places persistent memories on the wall and saves player notes', async () => {
  const save = normalizeSave(null, 0);
  save.knowledge.memories = [{
    id: 'memory:1:station-blackout',
    sourceLoop: 1,
    sourceRecordId: 'station-blackout',
    sourceSceneId: 'station-blackout',
    capturedAtMinute: 1111,
    capturedAtMs: 1_000,
    kind: 'composite',
    title: '車站的燈',
    content: ['停電只有幾秒。遠處傳來一聲鐘響。'],
  }];
  function Harness() {
    const [current, setCurrent] = useState(save);
    return <EvidenceBoard save={current} onChange={setCurrent} onNotice={() => {}} />;
  }
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: '放到推理牆' }));
  expect(screen.getAllByText('車站的燈')).toHaveLength(2);
  await user.type(screen.getByRole('textbox', { name: '推理牆註記' }), '這是我自己的問題');
  await user.click(screen.getByRole('button', { name: '新增註記' }));
  expect(screen.getByText('這是我自己的問題')).toBeDefined();
  expect(save.knowledge.connections).toEqual([]);
});
