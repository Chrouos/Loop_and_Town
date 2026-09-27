export type ViewName = 'graph' | 'timeline' | 'diff';

const items: Array<{ id: ViewName; label: string; accessibleLabel: string }> = [
  { id: 'graph', label: '事件圖', accessibleLabel: 'Event Graph' },
  { id: 'timeline', label: '時間線', accessibleLabel: 'Timeline' },
  { id: 'diff', label: '比較', accessibleLabel: 'Worldline Diff' },
];

export function ViewTabs({ value, onChange }: { value: ViewName; onChange: (value: ViewName) => void }) {
  return (
    <nav className="view-tabs" aria-label="Viewer mode">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-label={item.accessibleLabel}
          className={value === item.id ? 'tab active' : 'tab'}
          aria-pressed={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
