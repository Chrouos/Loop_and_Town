import type { StoryWorldlinePath } from '../types/story';

type Props = {
  paths: StoryWorldlinePath[];
  selectedPathId: string;
  actorIds: string[];
  actorId: string;
  query: string;
  compareEnabled: boolean;
  onPathChange: (id: string) => void;
  onActorChange: (id: string) => void;
  onQueryChange: (query: string) => void;
  onCompareToggle: (enabled: boolean) => void;
};

export function CausalTimelineToolbar({
  paths,
  selectedPathId,
  actorIds,
  actorId,
  query,
  compareEnabled,
  onPathChange,
  onActorChange,
  onQueryChange,
  onCompareToggle,
}: Props) {
  return (
    <div className="causal-toolbar" role="toolbar" aria-label="Causal Timeline controls">
      <label>
        <span>Loop / Worldline</span>
        <select
          aria-label="Loop / Worldline"
          value={selectedPathId}
          onChange={(event) => onPathChange(event.target.value)}
        >
          {paths.map((path) => (
            <option key={path.id} value={path.id}>{path.label}</option>
          ))}
        </select>
      </label>

      <label>
        <span>Character Filter</span>
        <select
          aria-label="Character Filter"
          value={actorId}
          onChange={(event) => onActorChange(event.target.value)}
        >
          <option value="">全部角色</option>
          {actorIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>

      <label className="causal-toolbar-search">
        <span>Search</span>
        <input
          aria-label="Search"
          type="search"
          value={query}
          placeholder="搜尋事件、角色或時間"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <button
        type="button"
        className={compareEnabled ? 'is-active' : undefined}
        aria-pressed={compareEnabled}
        onClick={() => onCompareToggle(!compareEnabled)}
      >
        {compareEnabled ? 'Close Compare' : 'Compare'}
      </button>
    </div>
  );
}
