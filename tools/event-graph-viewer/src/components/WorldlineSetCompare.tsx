import { compareWorldlinePaths } from '../lib/causalTimeline';
import type { StoryDagDocument, StoryWorldlinePath } from '../types/story';

type Props = {
  document: StoryDagDocument;
  paths: StoryWorldlinePath[];
  selectedPathIds: string[];
  onSelectedPathIdsChange: (ids: string[]) => void;
  onClose: () => void;
};

function NodeList({ document, nodeIds }: { document: StoryDagDocument; nodeIds: string[] }) {
  const byId = new Map(document.nodes.map((node) => [node.id, node]));
  return (
    <ul className="worldline-compare-node-list">
      {nodeIds.map((id) => {
        const node = byId.get(id);
        if (!node) return null;
        return (
          <li key={id}>
            <strong>{node.title}</strong>
            <span>{[node.time, node.actorIds.join(' / ')].filter(Boolean).join(' · ')}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function WorldlineSetCompare({
  document,
  paths,
  selectedPathIds,
  onSelectedPathIdsChange,
  onClose,
}: Props) {
  const uniqueIds = [...new Set(selectedPathIds)];
  const pathById = new Map(paths.map((path) => [path.id, path]));
  const selectedPaths = uniqueIds
    .map((id) => pathById.get(id))
    .filter((path): path is StoryWorldlinePath => Boolean(path));
  const comparison = compareWorldlinePaths(document, selectedPaths);

  function togglePath(pathId: string) {
    const next = uniqueIds.includes(pathId)
      ? uniqueIds.filter((id) => id !== pathId)
      : [...uniqueIds, pathId];
    onSelectedPathIdsChange(next);
  }

  return (
    <aside className="panel worldline-set-compare" aria-label="Worldline Compare panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">多世界線比較</p>
          <h2>Worldline Compare</h2>
        </div>
        <button type="button" aria-label="Close worldline compare" onClick={onClose}>×</button>
      </div>

      <fieldset className="worldline-set-picker">
        <legend>Worldlines</legend>
        {paths.map((path) => (
          <label key={path.id}>
            <input
              type="checkbox"
              aria-label={path.label}
              checked={uniqueIds.includes(path.id)}
              onChange={() => togglePath(path.id)}
            />
            <span>{path.label}</span>
          </label>
        ))}
      </fieldset>

      <section className="worldline-compare-section">
        <h3>Invariant</h3>
        {comparison.invariantNodeIds.length > 0
          ? <NodeList document={document} nodeIds={comparison.invariantNodeIds} />
          : <p>沒有共同節點</p>}
      </section>

      {selectedPaths.map((path) => {
        const variableIds = comparison.variableNodeIdsByPath[path.id] ?? [];
        if (variableIds.length === 0) return null;
        return (
          <section key={path.id} className="worldline-compare-section">
            <h3>{`Variable · ${path.label}`}</h3>
            <NodeList document={document} nodeIds={variableIds} />
          </section>
        );
      })}
    </aside>
  );
}
