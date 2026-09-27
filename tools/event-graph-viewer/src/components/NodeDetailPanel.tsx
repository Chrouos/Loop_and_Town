import type { StoryDagNode } from '../types/story';

type NarrativeBlock = {
  type?: string;
  speaker?: string;
  text?: string;
};

type NarrativeScene = {
  id: string;
  blocks?: NarrativeBlock[];
};

type Props = {
  node: StoryDagNode;
  narrativeScenes: NarrativeScene[];
  downstreamTitles: string[];
};

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="node-detail-section">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

export function NodeDetailPanel({ node, narrativeScenes, downstreamTitles }: Props) {
  const sceneById = new Map(narrativeScenes.map((scene) => [scene.id, scene]));
  const linkedScenes = node.detail.narrativeRefs
    .map((id) => sceneById.get(id))
    .filter((scene): scene is NarrativeScene => Boolean(scene));

  return (
    <aside className="panel node-detail-panel" aria-label="Node detail">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Node Inspector</p>
          <h2>[{node.id} {node.title}]</h2>
        </div>
      </div>

      <div className="node-detail-meta">
        {node.time && <span>{node.time}</span>}
        <span>{node.actorIds.length > 0 ? node.actorIds.join(' / ') : 'system'}</span>
      </div>

      <DetailList title="Before" items={node.detail.before} />
      <DetailList title="After" items={node.detail.after} />
      {node.detail.reason && (
        <section className="node-detail-section">
          <h4>Reason</h4>
          <p>{node.detail.reason}</p>
        </section>
      )}
      <DetailList title="Affected Characters" items={node.detail.affectedCharacters} />
      <DetailList title="Delayed Effects" items={node.detail.delayedEffects} />
      <DetailList title="Knowledge Changes" items={node.detail.knowledgeChanges} />
      <DetailList title="Relationship Changes" items={node.detail.relationshipChanges} />
      <DetailList title="Direct downstream" items={downstreamTitles} />

      <section className="node-detail-section novel-scene-section">
        <h4>小說場景</h4>
        {linkedScenes.length === 0 ? (
          <p>沒有連結小說場景</p>
        ) : linkedScenes.map((scene) => (
          <article key={scene.id} className="linked-narrative-scene">
            <strong>{scene.id}</strong>
            {(scene.blocks ?? []).filter((block) => block.text).map((block, index) => (
              <p key={`${scene.id}-${index}`}>
                {block.speaker && <span className="narrative-speaker">{block.speaker}：</span>}
                <span>{block.text}</span>
              </p>
            ))}
          </article>
        ))}
      </section>
    </aside>
  );
}
