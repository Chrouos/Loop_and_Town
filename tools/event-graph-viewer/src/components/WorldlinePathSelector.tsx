import type { StoryWorldlinePath } from '../types/story';

type Props = {
  paths: StoryWorldlinePath[];
  selectedId: string;
  onChange: (id: string) => void;
  mode: 'public' | 'player-known' | 'author';
};

export function WorldlinePathSelector({ paths, selectedId, onChange, mode }: Props) {
  const visiblePaths = paths.filter((path) => mode === 'author' || path.visibility !== 'author');

  return (
    <label className="worldline-path-selector">
      <span>Worldline Path</span>
      <select
        aria-label="Worldline Path"
        value={selectedId}
        onChange={(event) => onChange(event.target.value)}
      >
        {mode === 'author' && <option value="all">All possibilities</option>}
        {visiblePaths.map((path) => (
          <option key={path.id} value={path.id}>{path.label}</option>
        ))}
      </select>
    </label>
  );
}
