import { Fragment } from 'react';
import type { ActionDefinition } from '../simulator/types';
import { formatTime, parseTime } from '../simulator/time';
import type { EventGraphDocument, WorldlineEntry } from '../types/story';

export type CausalBranch = {
  action: ActionDefinition;
  entries: WorldlineEntry[];
};

function variantLabel(variantId?: string) {
  const labels: Record<string, string> = {
    wakaharu_dies: '若晴死亡',
    doctor_dies: '醫生死亡',
    no_death: '沒有人死亡',
    reporter_missing: '記者失蹤',
  };
  return variantId ? labels[variantId] ?? variantId : undefined;
}

function effectLabel(entry: WorldlineEntry) {
  if (entry.source === 'delayed') return '延遲效果';
  return variantLabel(entry.variantId) ?? entry.title.replace(/^\d{2}:\d{2}\s*/, '');
}

function entryLabel(entry: WorldlineEntry) {
  if (entry.source === 'event') return entry.title.replace(/^\d{2}:\d{2}\s*/, '');
  return effectLabel(entry);
}

function actionTiming(action: ActionDefinition) {
  const duration = action.duration_minutes ?? 0;
  return duration > 0
    ? `${action.at}–${formatTime(parseTime(action.at) + duration)}`
    : action.at;
}

function ActionNode({ action }: { action: ActionDefinition }) {
  const hasImmediateStateChange = action.effects.length > 0;
  return (
    <div className="causal-branch-action">
      <time>{actionTiming(action)}</time>
      <strong>{action.label}</strong>
      <span>{hasImmediateStateChange ? '立即改變世界狀態' : '無立即狀態變化'}</span>
    </div>
  );
}

function ActionRelation({
  action,
  actionIsEarlier,
  nextTime,
}: {
  action: ActionDefinition;
  actionIsEarlier: boolean;
  nextTime?: string;
}) {
  if (!actionIsEarlier) {
    return (
      <div className="causal-time-flow">
        <span>時間推進至玩家行動</span>
        <span>{action.at}</span>
      </div>
    );
  }

  return action.effects.length > 0 ? (
    <div className="causal-arrow" aria-label="造成狀態變化">
      <span aria-hidden="true">↓</span>
      <span>造成狀態變化</span>
    </div>
  ) : (
    <div className="causal-time-flow">
      <span>時間流逝</span>
      <span>{nextTime
        ? `+${Math.max(0, parseTime(nextTime) - parseTime(action.at))} 分鐘`
        : '沿原世界線前進'}</span>
    </div>
  );
}

function EntryNode({
  entry,
  entryIndex,
  delayMinutes,
}: {
  entry: WorldlineEntry;
  entryIndex: number;
  delayMinutes?: number;
}) {
  if (entryIndex === 0) {
    return (
      <div className="causal-event">
        <time>{entry.time}</time>
        <strong>{entry.title.replace(/^\d{2}:\d{2}\s*/, '')}</strong>
        <span>命中：{effectLabel(entry)}</span>
      </div>
    );
  }

  return (
    <div className="causal-consequence">
      {delayMinutes !== undefined && delayMinutes > 0 && (
        <span className="causal-delay">+{delayMinutes} 分鐘</span>
      )}
      <time>{entry.time}</time>
      <strong>{entryLabel(entry)}</strong>
    </div>
  );
}

type BranchNode =
  | { kind: 'action'; time: string }
  | { kind: 'entry'; time: string; entry: WorldlineEntry; entryIndex: number };

function Branch({ branch }: { branch: CausalBranch }) {
  const nodes: BranchNode[] = [
    { kind: 'action', time: branch.action.at },
    ...branch.entries.map((entry, entryIndex) => ({ kind: 'entry' as const, time: entry.time, entry, entryIndex })),
  ];
  nodes.sort((left, right) => (
    parseTime(left.time) - parseTime(right.time)
    || (left.kind === right.kind ? 0 : left.kind === 'action' ? -1 : 1)
  ));

  return (
    <article className="causal-branch">
      {nodes.map((node, index) => {
        const previous = nodes[index - 1];
        const relation = index === 0 || (previous.kind === 'entry' && node.kind === 'entry')
          ? null
          : <ActionRelation
            action={branch.action}
            actionIsEarlier={previous.kind === 'action'}
            nextTime={node.time}
          />;
        return (
          <Fragment key={node.kind === 'action' ? `action:${branch.action.id}` : `entry:${node.entryIndex}:${node.entry.eventId}`}>
            {relation}
            {node.kind === 'action'
              ? <ActionNode action={branch.action} />
              : (
                <EntryNode
                  entry={node.entry}
                  entryIndex={node.entryIndex}
                  delayMinutes={node.entryIndex > 0
                    ? parseTime(node.entry.time) - parseTime(branch.entries[node.entryIndex - 1].time)
                    : undefined}
                />
              )}
          </Fragment>
        );
      })}
    </article>
  );
}

export function EventGraphView({ document, branches = [] }: { document: EventGraphDocument; branches?: CausalBranch[] }) {
  return (
    <section className="panel graph-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">事件因果圖 · 技術檢視</p>
          <h2 aria-label="Event Graph">事件圖</h2>
        </div>
        <p>以因果順序閱讀，不用節點位置猜時間。</p>
      </div>
      <div className="causal-root">
        <time>18:20</time>
        <strong>玩家介入</strong>
        <span>玩家行動依時間進入故事，節點順序依實際時間排列。</span>
      </div>
      <div className="causal-branches" aria-label="Event Graph causal branches">
        {branches.map((branch) => <Branch key={branch.action.id} branch={branch} />)}
      </div>
      {document.notes.length > 0 && (
        <aside className="causal-notes">
          <strong>故事備註</strong>
          {document.notes.map((note) => <span key={note}>{note}</span>)}
        </aside>
      )}
    </section>
  );
}
