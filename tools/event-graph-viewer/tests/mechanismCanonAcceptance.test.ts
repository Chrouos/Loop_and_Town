import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import mechanism from '../../../docs/story-canon-mechanism.md?raw';
import canonTime from '../../../docs/story-canon-time.md?raw';
import finalDagText from '../../../story/events/final_story_dag.yaml?raw';
import finalNarrativeText from '../../../story/narrative/final_player.yaml?raw';

type FinalNode = { id: string; detail?: { delayed_effects?: string[]; after?: string[] } };
type FinalEdge = { id: string; label: string };

const graph = yaml.load(finalDagText) as { nodes: FinalNode[]; edges: FinalEdge[] };
const node = (id: string) => graph.nodes.find(item => item.id === id);

describe('Mechanism Canon v0.1 authoring contract', () => {
  it('keeps loss of life separate from the midnight retry predicate', () => {
    expect(mechanism).toContain('Death / Anchor death ≠ Reset / Loop stop trigger');
    expect(mechanism).toContain('feedbackMismatch');
    expect(mechanism).toContain('pendingCorrection');
    expect(mechanism).toContain('Forward Seal');
    expect(mechanism).toContain('06:12');
    expect(mechanism).toContain('23:59');
    expect(mechanism).toContain('18:31');
  });

  it('differentiates one-time Ending A, repeat Ending B, and permanent local Ending C', () => {
    expect(mechanism).toContain('**A 接受單一世界**');
    expect(mechanism).toContain('**B 再一次**');
    expect(mechanism).toContain('**C 停止改寫**');
    expect(mechanism).toContain('G1｜');
    expect(mechanism).toContain('G5｜');
    const a = JSON.stringify(node('F_N09_ending_a'));
    const b = JSON.stringify(node('F_N10_ending_b'));
    const c = JSON.stringify(node('F_N11_ending_c'));
    expect(a).toContain('一次性 Forward Seal');
    expect(b).toContain('Rollback');
    expect(c).toContain('Primary／Recovery Bridge');
    expect(c).toContain('Epoch Fencing');
    expect(graph.edges.find(edge => edge.id === 'F_E05c')?.label).toBe('revoke autonomous write-back');
    expect(finalNarrativeText).toContain('Prediction / Simulation');
    expect(finalNarrativeText).not.toContain('必須刪除我的記憶');
    expect(canonTime).toContain('Rollback 或 Forward');
  });
});
