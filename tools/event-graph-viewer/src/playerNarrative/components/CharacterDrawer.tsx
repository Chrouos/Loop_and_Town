import { projectCharacterGraph } from '../../narrative/characterGraph';
import type { NarrativeFoundation } from '../../narrative/types';

export type CharacterDrawerProps = {
  story: NarrativeFoundation;
  knownFactIds: Iterable<string>;
  open: boolean;
  onClose: () => void;
};

export function CharacterDrawer({ story, knownFactIds, open, onClose }: CharacterDrawerProps) {
  if (!open) return null;
  const graph = projectCharacterGraph(story, 'player-known', knownFactIds);

  return (
    <aside className="character-drawer" aria-label="人物">
      <header>
        <h2>人物</h2>
        <button type="button" onClick={onClose}>關閉</button>
      </header>
      <div className="character-list">
        {graph.nodes.filter((node) => node.id !== 'protagonist').map((node) => {
          const detail = graph.details[node.id];
          return (
            <article className="character-card" key={node.id}>
              <h3>{node.name}</h3>
              {node.occupation && <p className="character-role">{node.occupation}</p>}
              <p>{detail.backgroundSummary}</p>
              {detail.knowledgeIds.length > 0 && (
                <div className="character-known">
                  <span>我記得的事</span>
                  <ul>{detail.knowledgeIds.map((id) => <li key={id}>{story.knowledgeFacts.find((fact) => fact.id === id)?.summary ?? id}</li>)}</ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </aside>
  );
}
