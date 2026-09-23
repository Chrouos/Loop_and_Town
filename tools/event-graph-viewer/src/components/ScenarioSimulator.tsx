import type { ActionDefinition } from '../simulator/types';

export function ScenarioSimulator({
  actions,
  selectedActionIds,
  onChange,
}: {
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
    <section className="panel scenario-panel" aria-label="Worldline Scenario">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Scenario · 18:31 車站事件</p>
          <h2>改變條件，重算世界線</h2>
        </div>
        <p>左側基準世界線固定為不介入，右側套用下列行動</p>
      </div>
      <div className="scenario-actions">
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
      </div>
    </section>
  );
}
