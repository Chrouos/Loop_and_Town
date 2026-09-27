import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { parseStoryDagText, parseStoryWorldlinePathsText } from '../src/lib/loadStory';

const rawFiles = import.meta.glob('../../../story/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function raw(suffix: string): string {
  const key = Object.keys(rawFiles).find((candidate) => candidate.endsWith(suffix));
  if (!key) throw new Error(`Missing story file: ${suffix}`);
  return rawFiles[key];
}

describe('relationship-driven Final', () => {
  it('defines four hidden relationship dimensions that reset each loop while Character Insight persists', () => {
    const doc = yaml.load(raw('/relationships/relationship_state.yaml')) as {
      dimensions?: string[];
      reset_on_loop?: boolean;
      persistent_across_loops?: string[];
      forbidden_metrics?: string[];
    };

    expect(doc.dimensions).toEqual(['trust', 'closeness', 'respect', 'pressure']);
    expect(doc.reset_on_loop).toBe(true);
    expect(doc.persistent_across_loops).toContain('character_insight');
    expect(doc.forbidden_metrics).toContain('affection');
  });

  it('lets all five NPCs resolve their own final contribution from knowledge plus relationship state', () => {
    const doc = yaml.load(raw('/relationships/final_decisions.yaml')) as {
      decisions?: Array<{ character_id: string; outcomes?: Array<{ id: string; when?: unknown; fallback?: boolean }> }>;
    };
    const decisions = doc.decisions ?? [];
    expect(new Set(decisions.map((item) => item.character_id)))
      .toEqual(new Set(['wakaharu', 'doctor', 'reporter', 'detective', 'yuan']));

    for (const decision of decisions) {
      expect(decision.outcomes?.some((outcome) => Boolean(outcome.when))).toBe(true);
      expect(decision.outcomes?.some((outcome) => outcome.fallback === true)).toBe(true);
    }

    const text = raw('/relationships/final_decisions.yaml');
    expect(text).toContain('relationships.');
    expect(text).toContain('knowledge.');
    expect(text).not.toContain('affection');
  });

  it('keeps NPC decisions before the protagonist chooses among three definitions of rescue', () => {
    const narrative = yaml.load(raw('/narrative/final_player.yaml')) as {
      scenes?: Array<{ id: string; blocks?: Array<{ text?: string }> }>;
    };
    const scenes = narrative.scenes ?? [];
    const ids = new Set(scenes.map((scene) => scene.id));
    for (const id of [
      'final_1742_full_truth',
      'final_1750_everyone_chooses',
      'final_1803_handoff_open',
      'final_1831_convergence',
      'final_a_tomorrow',
      'final_b_once_more',
      'final_c_forget_me',
    ]) expect(ids.has(id), `missing ${id}`).toBe(true);

    const text = scenes.flatMap((scene) => scene.blocks ?? []).map((block) => block.text ?? '').join('\n');
    expect(text).toContain('我不能再替他們選');
    expect(text).toContain('我只能決定，我自己願意承擔什麼');
    expect(text).not.toContain('True Ending');
    expect(text).not.toContain('Good Ending');
    expect(text).not.toContain('Bad Ending');
  });

  it('provides three ending paths that branch only after the shared NPC-decision convergence', () => {
    const dag = parseStoryDagText(raw('/events/final_story_dag.yaml'));
    const choice = dag.nodes.find((node) => node.id === 'F_N08_protagonist_choice');
    expect(choice).toBeDefined();
    expect(dag.nodes.find((node) => node.id === 'F_N07_collective_1831')?.time).toBe('18:31');

    const paths = parseStoryWorldlinePathsText(raw('/worldlines/final_paths.yaml'));
    const ids = new Set(paths.map((path) => path.id));
    expect(ids).toEqual(new Set(['ending_a_tomorrow', 'ending_b_once_more', 'ending_c_forget_me']));
    for (const path of paths) {
      const convergenceIndex = path.nodeIds.indexOf('F_N07_collective_1831');
      const choiceIndex = path.nodeIds.indexOf('F_N08_protagonist_choice');
      expect(convergenceIndex).toBeGreaterThanOrEqual(0);
      expect(choiceIndex).toBeGreaterThan(convergenceIndex);
    }
  });
});
