import type { ActionDefinition, Effect } from '../simulator/types';

function actionTime(action: ActionDefinition): string {
  return typeof action.at === 'string' ? action.at : `D${action.at.day} ${action.at.time}`;
}

function actionMinute(action: ActionDefinition): number {
  const value = typeof action.at === 'string' ? { day: 0, time: action.at } : action.at;
  const [hour, minute] = value.time.split(':').map(Number);
  return value.day * 1440 + hour * 60 + minute;
}

function effectSummary(effect: Effect): string {
  if ('set' in effect) return `${effect.set.path} → ${String(effect.set.value)}`;
  if ('add_flag' in effect) return `flag + ${effect.add_flag}`;
  if ('emit_event' in effect) return `觸發 ${effect.emit_event.event_id}`;
  return '狀態變化';
}

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
            aria-label={action.label}
            checked={selectedActionIds.includes(action.id)}
            onChange={(event) => toggle(action.id, event.currentTarget.checked)}
          />
          <span className="action-option">
            <span className="action-time">{actionTime(action)}</span>
            <span className="action-copy">
              <strong>{action.label}</strong>
              {action.effects.map((effect, index) => (
                <small key={`${action.id}-effect-${index}`}>{effectSummary(effect)}</small>
              ))}
            </span>
          </span>
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
  const orderedActions = [...actions].sort((left, right) => actionMinute(left) - actionMinute(right));

  return (
    <section className="panel scenario-panel" aria-label="Worldline Scenario">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Scenario · 18:31 車站事件</p>
          <h2>改變條件，重算世界線</h2>
        </div>
        <p>先看介入時間與效果，再比較兩條世界線的結果</p>
      </div>

      <div className="scenario-actions">
        <ActionGroup
          label="世界線 A"
          actions={orderedActions}
          selectedActionIds={leftActionIds}
          onChange={onLeftChange}
        />
        <ActionGroup
          label="世界線 B"
          actions={orderedActions}
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
