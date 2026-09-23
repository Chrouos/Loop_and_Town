import type { ActionDefinition } from '../simulator/types';

function ActionGroup({
  label,
  actions,
  selectedActionIds,
  onChange,
}: {
  label: string;
  actions: ActionDefinition[];
  selectedActionIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string, checked: boolean) {
    onChange(checked
      ? [...selectedActionIds, id]
      : selectedActionIds.filter((value) => value !== id));
  }

  return (
    <fieldset className="scenario-worldline" aria-label={label}>
      <legend>{label}</legend>
      {actions.map((action) => (
        <label key={action.id}>
          <input
            type="checkbox"
            checked={selectedActionIds.includes(action.id)}
            onChange={(event) => toggle(action.id, event.currentTarget.checked)}
          />
          <span>{action.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function ScenarioSimulator({
  actions,
  leftActionIds,
  rightActionIds,
  onLeftChange,
  onRightChange,
  onSimulate,
}: {
  actions: ActionDefinition[];
  leftActionIds: string[];
  rightActionIds: string[];
  onLeftChange: (ids: string[]) => void;
  onRightChange: (ids: string[]) => void;
  onSimulate: () => void;
}) {
  return (
    <section className="panel scenario-panel" aria-label="Worldline Scenario">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Scenario · 18:31 車站事件</p>
          <h2>改變條件，重算世界線</h2>
        </div>
        <p>分別設定兩條世界線，再執行一次 deterministic simulation</p>
      </div>

      <div className="scenario-actions">
        <ActionGroup
          label="世界線 A"
          actions={actions}
          selectedActionIds={leftActionIds}
          onChange={onLeftChange}
        />
        <ActionGroup
          label="世界線 B"
          actions={actions}
          selectedActionIds={rightActionIds}
          onChange={onRightChange}
        />
      </div>

      <button className="simulate-button" type="button" onClick={onSimulate}>
        重算世界線
      </button>
    </section>
  );
}
