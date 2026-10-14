import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { parseStoryDagText, parseStoryWorldlinePathsText } from '../src/lib/loadStory';
import { loadRealStory } from './helpers/loadRealStory';
import { STORY_RECORDS } from '../src/player/story';

const files = import.meta.glob('../../../story/**/*.yaml', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

function raw(relative: string): string {
  const suffix = '/story/' + relative;
  const file = Object.entries(files).find(([name]) => name.endsWith(suffix));
  if (!file) throw new Error('Missing story file: ' + relative);
  return file[1];
}

describe('PR #24 Story Canon regression guards', () => {
  it('keeps the warning letter before 06:12, without a summon or midnight instructions', () => {
    const artifact = yaml.load(raw('artifacts/zhixia_letter.yaml')) as {
      content: string[];
      formed_at: { day: number; time: string };
    };
    expect(artifact.content).toContain('不要回來。');
    expect(artifact.content.join(' ')).not.toMatch(/回來一趟|如果午夜|失敗了|第幾次/);
    expect(artifact.formed_at).toEqual({ day: 0, time: '06:00' });

    const story = loadRealStory();
    const scenes = new Map(story.narrative.scenes.map((item) => [item.id, item]));
    expect(scenes.get('prologue_arrival')?.at).toEqual({ day: 0, time: '06:12' });
    expect(scenes.get('prologue_letter_discovery')?.at).toEqual({ day: 0, time: '06:14' });
    expect(scenes.get('prologue_letter_discovery')?.requiresLocation).toBeUndefined();
    expect(scenes.get('prologue_yuan_reunion')?.at).toEqual({ day: 0, time: '07:40' });
    expect(STORY_RECORDS.find((item) => item.id === 'letter')?.body).toEqual(['不要回來。', '姊']);
  });

  it('guards the finite causal preconditions that precede 18:31', () => {
    const handoff = yaml.load(raw('events/loop_01_1805.yaml')) as {
      variants: Array<{ id: string; effects?: Array<{ add_flag?: string }> }>;
    };
    const station = yaml.load(raw('events/loop_01_1831.yaml')) as {
      variants: Array<{ id: string; when?: { all?: Array<{ path: string }> } }>;
    };
    expect(handoff.variants.find((v) => v.id === 'envelope_handoff')?.effects)
      .toContainEqual({ add_flag: 'world.station_handoff_completed' });
    expect(handoff.variants.find((v) => v.id === 'doctor_no_recipient')?.effects).toEqual([]);
    const doctorSchedule = yaml.load(raw('schedules/doctor.yaml')) as { entries: Array<{ id: string; at: { day: number; time: string }; effects: unknown[] }> };
    const maintenance = doctorSchedule.entries.find((entry) => entry.id === 'doctor_enter_maintenance');
    expect(maintenance?.at).toEqual({ day: 0, time: '18:24' });
    expect(maintenance?.effects).toContainEqual({ add_flag: 'world.doctor_maintenance_exposed' });
    const wakaharu = station.variants.find((v) => v.id === 'wakaharu_dies');
    const doctor = station.variants.find((v) => v.id === 'doctor_dies');
    expect(wakaharu?.when?.all?.map((c) => c.path)).toContain('world.station_handoff_completed');
    expect(doctor?.when?.all?.map((c) => c.path)).toContain('world.doctor_maintenance_exposed');
    expect(doctor?.when?.all).toContainEqual({ path: 'characters.doctor.location', op: 'eq', value: 'maintenance_tunnel' });
    expect(station.variants.some((v) => v.id === 'no_death')).toBe(true);
  });

  it('resolves every manifest DAG and worldline path identifier', () => {
    const manifest = yaml.load(raw('manifests/loop_01.yaml')) as {
      story_dags: string[];
      worldline_paths: string[];
    };
    expect(manifest.story_dags.length).toBe(manifest.worldline_paths.length);
    const allSceneIds = new Set(['narrative/loop_01_player.yaml', ...['02','03','04','05','06','07'].map(n => 'narrative/loop_' + n + '_player.yaml'), 'narrative/final_player.yaml'].flatMap(file => {
      const parsed = yaml.load(raw(file)) as { scenes?: Array<{ id: string }> };
      return (parsed.scenes ?? []).map(scene => scene.id);
    }));
    for (let i = 0; i < manifest.story_dags.length; i++) {
      const graph = parseStoryDagText(raw(manifest.story_dags[i]));
      const paths = parseStoryWorldlinePathsText(raw(manifest.worldline_paths[i]));
      const nodeIds = new Set(graph.nodes.map((n) => n.id));
      const edgeIds = new Set(graph.edges.map((e) => e.id));
      expect(nodeIds.size).toBe(graph.nodes.length);
      expect(edgeIds.size).toBe(graph.edges.length);
      for (const node of graph.nodes) {
        for (const sceneId of node.detail.narrativeRefs ?? []) {
          expect(allSceneIds.has(sceneId), node.id + ': missing narrative ' + sceneId).toBe(true);
        }
      }
      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.source), edge.id + ': unknown source').toBe(true);
        expect(nodeIds.has(edge.target), edge.id + ': unknown target').toBe(true);
      }
      for (const path of paths) {
        const selected = path.nodeIds.map(id => {
          const node = graph.nodes.find(n => n.id === id);
          expect(node, path.id + ': missing ' + id).toBeDefined();
          return node!;
        });
        for (const id of path.edgeIds) expect(edgeIds.has(id), path.id + ': missing ' + id).toBe(true);
        const minute = (time: string | undefined) => {
          if (!time) throw new Error('Graph node lacks a time value');
          return time === '00:00' ? 24 * 60 : Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
        };
        for (let j = 1; j < selected.length; j++) {
          expect(minute(selected[j].time), path.id + ': reverse order ' + selected[j-1].id + ' → ' + selected[j].id).toBeGreaterThanOrEqual(minute(selected[j-1].time));
        }
      }
    }
  });

  it('does not turn a delivery mystery into dynamic paper transmission or memory erasure', () => {
    const sceneText = ['narrative/loop_06_player.yaml', 'narrative/loop_07_player.yaml',
      'narrative/final_player.yaml'].map((file) => raw(file)).join('\n');
    expect(sceneText).not.toMatch(/回來一趟。|如果午夜的鐘聲響起，就代表又失敗了。|昨晚新增的字還在|信件回覆/);
    const zhixia = raw('characters/zhixia.yaml');
    expect(zhixia).toContain('Fixed Anchor');
    expect(zhixia).not.toContain('第七種跨世界線訊息載體');

    const final = raw('narrative/final_player.yaml');
    expect(final).toContain('Reality Write-back');
    expect(final).toContain('Prediction / Simulation');
    expect(final).not.toContain('我切斷第六與第七載體的交接');
    expect(raw('narrative/loop_07_player.yaml')).not.toContain('一輛車偏離道路');
    expect(raw('events/loop_04_story_dag.yaml')).not.toContain('17:58 未來來電');
  });
});
