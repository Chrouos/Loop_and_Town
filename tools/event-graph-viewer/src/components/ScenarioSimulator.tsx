import type { ActionDefinition } from '../simulator/types';

function characterName(path: string) {
  const character = path.split('.')[1];
  return character === 'wakaharu' ? '若晴' : character === 'doctor' ? '醫生' : character === 'reporter' ? '記者' : character;
}

function fieldName(path: string) {
  const field = path.split('.')[2];
  return field === 'location' ? '位置' : field === 'status' ? '狀態' : field ?? '狀態';
}

function locationName(value: unknown) {
  const locations: Record<string, string> = {
    old_station: '舊車站',
    home: '家',
    clinic: '診所',
    hotel: '旅館',
  };
  return locations[String(value)] ?? String(value);
}

function describeEffects(effects: unknown) {
  if (!Array.isArray(effects)) return '效果設定無效';
  if (effects.length === 0) return '沒有立即世界狀態變化';
  return effects.map((effect) => {
    if (effect && typeof effect === 'object' && 'set' in effect && effect.set && typeof effect.set === 'object') {
      const set = effect.set as { path?: unknown; value?: unknown };
      if (typeof set.path !== 'string') return '設定效果格式無效';
      const value = fieldName(set.path) === '位置' ? locationName(set.value) : String(set.value);
      return `${characterName(set.path)}：${fieldName(set.path)}改為「${value}」`;
    }
    if (effect && typeof effect === 'object' && 'add_flag' in effect) return `記錄世界狀態：${String(effect.add_flag)}`;
    if (effect && typeof effect === 'object' && 'emit_event' in effect && effect.emit_event && typeof effect.emit_event === 'object') {
      return `觸發事件：${String((effect.emit_event as { event_id?: unknown }).event_id)}`;
    }
    return '效果設定格式無效';
  }).join('；');
}

function describeDuration(durationMinutes = 0) {
  return durationMinutes === 0 ? '立即完成' : `花費 ${durationMinutes} 分鐘`;
}

function ActionChoice({
  action,
  selected,
  onToggle,
}: {
  action: ActionDefinition;
  selected: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label className={selected ? 'action-choice selected' : 'action-choice'}>
      <input
        type="checkbox"
        aria-label={action.label}
        checked={selected}
        onChange={(event) => onToggle(event.currentTarget.checked)}
      />
      <span className="action-choice-copy">
        <span className="action-choice-title"><time>{action.at}</time>{action.label}</span>
        <span className="action-choice-detail">{describeEffects(action.effects)}</span>
        <span className="action-choice-duration">{describeDuration(action.duration_minutes)}</span>
      </span>
    </label>
  );
}

function ActionGroup({
  label,
  actions,
  selectedActionIds,
  error,
  onChange,
}: {
  label: string;
  actions: ActionDefinition[];
  selectedActionIds: string[];
  error?: string;
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
      <div className="worldline-heading">
        <div>
          <strong>基準世界線</strong>
          <span>{selectedActionIds.length === 0 ? '尚未加入玩家介入' : `${selectedActionIds.length} 個玩家介入`}</span>
        </div>
        <span className="worldline-badge">草稿</span>
      </div>
      <div className="action-list">
        {actions.map((action) => (
          <ActionChoice
            key={action.id}
            action={action}
            selected={selectedActionIds.includes(action.id)}
            onToggle={(checked) => toggle(action.id, checked)}
          />
        ))}
      </div>
      {error && <p className="scenario-error" role="alert">{error}</p>}
    </fieldset>
  );
}

export function ScenarioSimulator({
  actions,
  leftActionIds,
  rightActionIds,
  leftError,
  rightError,
  onLeftChange,
  onRightChange,
  onSimulate,
}: {
  actions: ActionDefinition[];
  leftActionIds: string[];
  rightActionIds: string[];
  leftError?: string;
  rightError?: string;
  onLeftChange: (ids: string[]) => void;
  onRightChange: (ids: string[]) => void;
  onSimulate: () => void;
}) {
  return (
    <section className="panel scenario-panel" aria-label="Worldline Scenario">
      <div className="panel-heading scenario-heading">
        <div>
          <p className="eyebrow">編輯介入條件 · 18:20</p>
          <h2>改變條件</h2>
        </div>
        <p>先選擇兩條世界線各自要發生的事，再比較後果。</p>
      </div>

      <div className="scenario-actions">
        <ActionGroup
          label="世界線 A"
          actions={actions}
          selectedActionIds={leftActionIds}
          error={leftError}
          onChange={onLeftChange}
        />
        <ActionGroup
          label="世界線 B"
          actions={actions}
          selectedActionIds={rightActionIds}
          error={rightError}
          onChange={onRightChange}
        />
      </div>

      <div className="scenario-footer">
        <span className="draft-note">變更只會先保留在草稿，套用後才會重算故事。</span>
        <button className="simulate-button" type="button" onClick={onSimulate}>
          套用並比較世界線
        </button>
      </div>
    </section>
  );
}
