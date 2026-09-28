export type CausalFocusMode = 'why' | 'effects' | 'convergence' | 'character' | null;

type Props = {
  selectedNodeId: string | null;
  activeMode: CausalFocusMode;
  onModeChange: (mode: CausalFocusMode) => void;
};

const modes: Array<{ mode: Exclude<CausalFocusMode, null>; label: string }> = [
  { mode: 'why', label: 'Why did this happen' },
  { mode: 'effects', label: 'What does this affect' },
  { mode: 'convergence', label: 'Show full chain to 18:31' },
  { mode: 'character', label: 'Show this character only' },
];

export function CausalFocusControls({ selectedNodeId, activeMode, onModeChange }: Props) {
  if (!selectedNodeId) return null;

  return (
    <div className="causal-focus-controls" role="group" aria-label="Causal Focus">
      {modes.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={activeMode === mode}
          onClick={() => onModeChange(mode)}
        >
          {label}
        </button>
      ))}
      <button type="button" onClick={() => onModeChange(null)}>Clear focus</button>
    </div>
  );
}
