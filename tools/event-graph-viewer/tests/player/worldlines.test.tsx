import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorldlineNotebook } from '../../src/player/WorldlineNotebook';
import { knownDiff } from '../../src/player/logic';
import { normalizeSave } from '../../src/player/model';

it('shows the actual interventions next to the known outcomes', () => {
  const save = normalizeSave(null, 0);
  save.loops[1] = { actionIds: ['protect_wakaharu'], revealedIds: ['1:station-bulletin-doctor'], sealed: true };
  save.loops[2] = { actionIds: ['stop_doctor'], revealedIds: ['2:station-bulletin-wakaharu'], sealed: true };
  render(<WorldlineNotebook save={save} currentLoop={2} knownDiff={knownDiff} />);
  expect(screen.getByText(/陪若晴留在家/)).toBeDefined();
  expect(screen.getByText(/請予安留住醫生/)).toBeDefined();
  expect(screen.getByText('陳柏勳死亡')).toBeDefined();
  expect(screen.getByText('許若晴死亡')).toBeDefined();
});
