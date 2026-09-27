import { sortTimeline } from '../lib/timeline';
import type { WorldlineEntry } from '../types/story';

function storyLabel(entry: WorldlineEntry) {
  if (entry.source === 'player') return entry.title;
  if (entry.source === 'delayed' || entry.eventId === 'evt_2114_reporter_missing' || entry.title.includes('記者失蹤')) return '延遲後果';
  return entry.title.replace(/^\d{2}:\d{2}\s*/, '');
}

function storyTime(entry: WorldlineEntry) {
  return entry.source === 'player' && entry.durationMinutes && entry.endTime
    ? `${entry.time}–${entry.endTime}`
    : entry.time;
}

function actionKey(entry: WorldlineEntry) {
  return `${entry.time}:${entry.eventId}`;
}

function isActionDefinitionEntry(entry: WorldlineEntry) {
  return entry.source === 'player'
    && entry.hasImmediateStateChange === undefined;
}

function orderSameTimeActions(entries: WorldlineEntry[], actionOrder: Map<string, number>) {
  const groups = new Map<string, WorldlineEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.time) ?? [];
    group.push(entry);
    groups.set(entry.time, group);
  }

  return [...groups.values()].flatMap((group) => {
    const players = group
      .filter((entry) => entry.source === 'player')
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => (
        (actionOrder.get(actionKey(left.entry)) ?? actionOrder.size + left.index)
        - (actionOrder.get(actionKey(right.entry)) ?? actionOrder.size + right.index)
      ))
      .map(({ entry }) => entry);
    let playerIndex = 0;
    return group.map((entry) => entry.source === 'player' ? players[playerIndex++] : entry);
  });
}

export function StoryOrder({ entries }: { entries: WorldlineEntry[] }) {
  const actionOrder = new Map<string, number>();
  for (const entry of entries) {
    if (isActionDefinitionEntry(entry) && !actionOrder.has(actionKey(entry))) {
      actionOrder.set(actionKey(entry), actionOrder.size);
    }
  }
  const seenActions = new Set<string>();
  const seenEventEntries = new Set<string>();
  const deduplicated = sortTimeline(entries).filter((entry) => {
    if (entry.source === 'player') {
      const key = actionKey(entry);
      if (seenActions.has(key)) return false;
      seenActions.add(key);
      return true;
    }
    const key = `${entry.source}:${entry.time}:${entry.eventId}`;
    if (seenEventEntries.has(key)) return false;
    seenEventEntries.add(key);
    return true;
  });
  const milestones = orderSameTimeActions(deduplicated, actionOrder);

  return (
    <section className="panel story-order" aria-labelledby="story-order-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">第 1 天 · 18:20 — 23:59</p>
          <h2 id="story-order-heading">故事順序</h2>
        </div>
        <p>先看事件怎麼發生，再看哪個介入改變了結果。</p>
      </div>
      <div className="story-order-track">
        {milestones.map((entry, index) => (
          <div className="story-milestone" key={`${entry.source}:${entry.time}:${entry.eventId}:${entry.variantId ?? ''}`}>
            <div className="story-milestone-dot" aria-hidden="true" />
            <time>{storyTime(entry)}</time>
            {entry.source === 'player' && <span className="story-milestone-kind">玩家介入</span>}
            <strong>{storyLabel(entry)}</strong>
            {index < milestones.length - 1 && <span className="story-milestone-arrow" aria-hidden="true">→</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
