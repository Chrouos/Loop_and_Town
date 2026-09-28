import type { StoryDagNode } from '../types/story';

type NarrativeBlockPreview = {
  speaker?: string;
  text?: string;
  artifactId?: string;
};

type NarrativeScenePreview = {
  id: string;
  blocks?: NarrativeBlockPreview[];
};

type Props = {
  node: StoryDagNode;
  narrativeScenes: NarrativeScenePreview[];
  upstreamTitles?: string[];
  downstreamTitles?: string[];
  incomingLabels?: string[];
  outgoingLabels?: string[];
};

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="node-detail-section">
      <h4>{title}</h4>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

export function NodeDetailPanel({
  node,
  narrativeScenes,
  upstreamTitles = [],
  downstreamTitles = [],
  incomingLabels = [],
  outgoingLabels = [],
}: Props) {
  const sceneById = new Map(narrativeScenes.map((scene) => [scene.id, scene]));
  const linkedScenes = node.detail.narrativeRefs
    .map((id) => sceneById.get(id))
    .filter((scene): scene is NarrativeScenePreview => Boolean(scene));

  return (
    <aside className="panel node-detail-panel" aria-label="Node detail">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Node Inspector</p>
          <h2>{node.title}</h2>
        </div>
      </div>

      <div className="node-detail-meta">
        {node.time && <span>{node.time}</span>}
        <span>{node.actorIds.length > 0 ? node.actorIds.join(' / ') : 'system'}</span>
      </div>

      <section className="node-detail-section narrative-meaning-section">
        <h4>為什麼發生？</h4>
        {node.detail.reason && <p>{node.detail.reason}</p>}
        {upstreamTitles.length > 0 ? (
          <ul>
            {upstreamTitles.map((title) => <li key={title}>{title}</li>)}
          </ul>
        ) : !node.detail.reason ? <p>沒有更早的直接因果節點</p> : null}
      </section>

      <section className="node-detail-section narrative-meaning-section">
        <h4>接下來影響</h4>
        {downstreamTitles.length === 0 && node.detail.delayedEffects.length === 0 ? (
          <p>目前沒有直接後續事件</p>
        ) : (
          <ul>
            {downstreamTitles.map((title) => <li key={`downstream-${title}`}>{title}</li>)}
            {node.detail.delayedEffects.map((effect) => <li key={`delayed-${effect}`}>{effect}</li>)}
          </ul>
        )}
      </section>

      <section className="node-detail-section novel-scene-section">
        <h4>小說場景</h4>
        {linkedScenes.length === 0 ? <p>沒有連結小說場景</p> : linkedScenes.map((scene) => (
          <article key={scene.id} className="linked-narrative-scene">
            {(scene.blocks ?? []).filter((block) => block.text).map((block, index) => (
              <p key={`${scene.id}-${index}`}>
                {'speaker' in block && <span className="narrative-speaker">{block.speaker}：</span>}
                <span>{block.text}</span>
              </p>
            ))}
          </article>
        ))}
      </section>

      <details className="node-debug-data">
        <summary>Debug Data</summary>
        <div className="node-debug-content">
          <p><strong>Node ID:</strong> {node.id}</p>
          <p><strong>Visibility:</strong> {node.visibility}</p>
          <DetailList title="Before" items={node.detail.before} />
          <DetailList title="After" items={node.detail.after} />
          <DetailList title="Affected Characters" items={node.detail.affectedCharacters} />
          <DetailList title="Knowledge Changes" items={node.detail.knowledgeChanges} />
          <DetailList title="Relationship Changes" items={node.detail.relationshipChanges} />
          <DetailList title="Narrative Refs" items={node.detail.narrativeRefs} />
          <DetailList title="Incoming Causal Labels" items={incomingLabels} />
          <DetailList title="Outgoing Causal Labels" items={outgoingLabels} />
        </div>
      </details>
    </aside>
  );
}
