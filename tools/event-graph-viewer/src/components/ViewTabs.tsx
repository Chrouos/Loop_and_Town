export type ViewName = 'graph' | 'timeline' | 'diff';

const items: Array<{ id: ViewName; label: string }> = [
  { id: 'graph', label: 'Event Graph' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'diff', label: 'Worldline Diff' },
];

export function ViewTabs({ value, onChange }: { value: ViewName; onChange: (value: ViewName) => void }) {
  return (
    <nav className="view-tabs" aria-label="Viewer mode">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
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
