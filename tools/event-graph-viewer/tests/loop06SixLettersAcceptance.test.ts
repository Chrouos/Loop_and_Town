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

describe('Loop 06 six letters', () => {
  it('turns the carrier experiments into playable narrative scenes without NPC memory residue', () => {
    const document = yaml.load(raw('/narrative/loop_06_player.yaml')) as {
      scenes?: Array<{ id: string; blocks?: Array<{ text?: string }> }>;
    };
    const scenes = document.scenes ?? [];
    const ids = new Set(scenes.map((scene) => scene.id));

    for (const id of [
      'loop06_0612_sort_carriers',
      'loop06_0830_first_note',
      'loop06_0940_library_card',
      'loop06_1100_sound_carrier',
      'loop06_1230_medical_record',
      'loop06_1410_fifth_letter',
      'loop06_1510_insight_to_evidence',
      'loop06_1600_sixth_carrier',
      'loop06_1740_why_seventh',
      'loop06_1803_handoff_point',
      'loop06_1831_seventh_message',
    ]) expect(ids.has(id), `missing ${id}`).toBe(true);

    const text = scenes.flatMap((scene) => scene.blocks ?? []).map((block) => block.text ?? '').join('\n');
    expect(text).toContain('不是讓我記得');
    expect(text).toContain('是讓妳收到');
    expect(text).toContain('只有我記得');
    expect(text).not.toContain('予安想起上一輪');
    expect(text).not.toContain('Memory Residue');
  });

  it('uses a remembered character moment only as a hypothesis, then requires the repair record', () => {
    const dag = parseStoryDagText(raw('/events/loop_06_story_dag.yaml'));
    const hypothesisNode = dag.nodes.find((node) => node.id === 'L6_N06_character_insight');
    const recordNode = dag.nodes.find((node) => node.id === 'L6_N07_repair_ledger');
    const narrative = yaml.load(raw('/narrative/loop_06_player.yaml')) as {
      scenes?: Array<{ id: string; blocks?: Array<{ text?: string }> }>;
    };
    const scene = narrative.scenes?.find((item) => item.id === 'loop06_1510_insight_to_evidence');
    const text = (scene?.blocks ?? []).map((block) => block.text ?? '').join('\n');

    expect(hypothesisNode?.title).toContain('假設');
    expect(hypothesisNode?.detail.reason).toContain('不能自動判定');
    expect(recordNode?.detail.knowledgeChanges).toContain('fact_zhixia_borrowed_audio_adapter');
    expect(text).toContain('這只是我看過的另一個 Moment');
    expect(text).toContain('不是「予安絕對不會丟」的答案');
    expect(text).toContain('真正留下記錄的');

    expect(dag.edges.some((edge) =>
      edge.source === 'L6_N06_character_insight' &&
      edge.target === 'L6_N07_repair_ledger' &&
      edge.label.includes('alternate investigation'),
    )).toBe(true);
  });

  it('provides a complete Loop 06 path from carrier inventory to seventh-letter handoff', () => {
    const paths = parseStoryWorldlinePathsText(raw('/worldlines/loop_06_paths.yaml'));
    const path = paths.find((item) => item.id === 'loop_06_six_letters');
    expect(path).toBeDefined();
    expect(path?.nodeIds[0]).toBe('L6_N00_sort_carriers');
    expect(path?.nodeIds).toContain('L6_N07_repair_ledger');
    expect(path?.nodeIds).toContain('L6_N10_handoff_1803');
    expect(path?.nodeIds.at(-1)).toBe('L6_N11_seventh_message');
  });
});
