import type { EventGraphDocument, GraphProjection } from '../types/story';

export function buildEventGraph(doc: EventGraphDocument): GraphProjection {
  const nodes: GraphProjection['nodes'] = [
    {
      id: doc.id,
      role: 'event',
      title: doc.title,
      subtitle: [doc.time, doc.location].filter(Boolean).join(' · '),
      details: doc.conditions,
    },
  ];
  const edges: GraphProjection['edges'] = [];

  for (const variant of doc.variants) {
    const variantId = `${doc.id}::${variant.id}`;
    nodes.push({
      id: variantId,
      role: 'variant',
      parentEventId: doc.id,
      title: variant.id,
      subtitle: `priority ${variant.priority}`,
      details: [...variant.conditions, ...variant.effects.map((effect) => effect.description)],
    });
    edges.push({
      id: `${doc.id}->${variantId}`,
      source: doc.id,
      target: variantId,
    });

    for (const delayed of variant.delayedEffects) {
      const delayedId = `${variantId}::${delayed.id}`;
      nodes.push({
        id: delayedId,
        role: 'delayed',
        parentEventId: doc.id,
        title: delayed.id,
        subtitle:
          delayed.delayMinutes !== undefined
            ? `+${delayed.delayMinutes}m`
            : delayed.executeAt
              ? `@${delayed.executeAt}`
              : 'delayed',
        details: [...delayed.conditions, ...delayed.effects.map((effect) => effect.description)],
      });
      edges.push({
        id: `${variantId}->${delayedId}`,
        source: variantId,
        target: delayedId,
        label:
          delayed.delayMinutes !== undefined
            ? `+${delayed.delayMinutes}m`
            : delayed.executeAt
              ? `@${delayed.executeAt}`
              : undefined,
      });
    }
  }

  return { nodes, edges };
}
