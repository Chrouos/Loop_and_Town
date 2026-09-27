import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceBoard } from '../../src/player/EvidenceBoard';
import { normalizeSave } from '../../src/player/model';

it('keeps the reason for an unsupported inference visible at the table', async () => {
  const save = normalizeSave(null, 0);
  save.loops[1].revealedIds = ['1:letter', '1:old-death'];
  save.knowledge.pins = ['letter:postmark', 'old-death:death'];
  const user = userEvent.setup();
  render(<EvidenceBoard save={save} onChange={() => {}} onNotice={() => {}} />);
  const buttons = screen.getAllByRole('button', { name: '連線' });
  await user.click(buttons[0]);
  await user.click(buttons[1]);
  await user.click(screen.getByRole('button', { name: '姊姊一定還活著' }));
  expect(screen.getByRole('status').textContent).toContain('還不能證明');
});
