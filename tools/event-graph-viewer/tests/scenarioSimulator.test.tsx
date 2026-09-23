import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScenarioSimulator } from '../src/components/ScenarioSimulator';
import type { ActionDefinition } from '../src/simulator/types';

const actions: ActionDefinition[] = [
  { id: 'protect_wakaharu', at: '18:20', label: '阻止若晴前往舊車站', effects: [] },
  { id: 'stop_doctor', at: '18:20', label: '阻止醫生前往舊車站', effects: [] },
];

describe('ScenarioSimulator', () => {
  it('edits worldline A and B independently', () => {
    const onLeftChange = vi.fn();
    const onRightChange = vi.fn();
    render(
      <ScenarioSimulator
        actions={actions}
        leftActionIds={[]}
        rightActionIds={[]}
        onLeftChange={onLeftChange}
        onRightChange={onRightChange}
        onSimulate={() => undefined}
      />,
    );

    const left = screen.getByRole('group', { name: '世界線 A' });
    const right = screen.getByRole('group', { name: '世界線 B' });

    fireEvent.click(within(left).getByRole('checkbox', { name: '阻止若晴前往舊車站' }));
    fireEvent.click(within(right).getByRole('checkbox', { name: '阻止醫生前往舊車站' }));

    expect(onLeftChange).toHaveBeenCalledWith(['protect_wakaharu']);
    expect(onRightChange).toHaveBeenCalledWith(['stop_doctor']);
  });

  it('only requests a recalculation when the simulate button is pressed', () => {
    const onSimulate = vi.fn();
    render(
      <ScenarioSimulator
        actions={actions}
        leftActionIds={[]}
        rightActionIds={[]}
        onLeftChange={() => undefined}
        onRightChange={() => undefined}
        onSimulate={onSimulate}
      />,
    );

    expect(onSimulate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '重算世界線' }));
    expect(onSimulate).toHaveBeenCalledTimes(1);
  });
});
