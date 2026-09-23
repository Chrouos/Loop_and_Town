import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScenarioSimulator } from '../src/components/ScenarioSimulator';
import type { ActionDefinition } from '../src/simulator/types';

const actions: ActionDefinition[] = [
  { id: 'protect_wakaharu', at: '18:20', label: '阻止若晴前往舊車站', effects: [] },
  { id: 'stop_doctor', at: '18:20', label: '阻止醫生前往舊車站', effects: [] },
];

describe('ScenarioSimulator', () => {
  it('reports the selected authored action ids', () => {
    const onChange = vi.fn();
    render(<ScenarioSimulator actions={actions} selectedActionIds={[]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: '阻止若晴前往舊車站' }));
    expect(onChange).toHaveBeenCalledWith(['protect_wakaharu']);
  });

  it('removes an action when its checkbox is cleared', () => {
    const onChange = vi.fn();
    render(<ScenarioSimulator actions={actions} selectedActionIds={['protect_wakaharu']} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: '阻止若晴前往舊車站' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
