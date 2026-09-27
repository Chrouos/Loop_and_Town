import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

function sceneText(scene: ReturnType<typeof loadRealStory>['narrative']['scenes'][number] | undefined) {
  return JSON.stringify(scene ?? {});
}

describe('Loop 04 five-years-ago narrative', () => {
  it('reconstructs the hidden five-year-old evidence chain', () => {
    const story = loadRealStory();
    const byId = new Map(story.narrative.scenes.map((scene) => [scene.id, scene]));

    const required = [
      'loop04_0910_detective_confrontation',
      'loop04_0930_hidden_recorder',
      'loop04_1020_future_voice',
      'loop04_1140_seven_records',
      'loop04_1310_reporter_confession',
      'loop04_1400_first_correction',
      'loop04_1530_ethical_break',
      'loop04_1803_unknown_call',
    ];

    for (const id of required) {
      const scene = byId.get(id);
      expect(scene, `missing ${id}`).toBeDefined();
      expect(scene?.blocks.length ?? 0, `${id} should contain readable prose`).toBeGreaterThan(1);
    }

    expect(sceneText(byId.get('loop04_0930_hidden_recorder'))).toContain('庭安，這次不是若晴');
    expect(sceneText(byId.get('loop04_1020_future_voice'))).toContain('18:42');
    expect(sceneText(byId.get('loop04_1140_seven_records'))).toContain('同一天曾經發生不同結果');
    expect(sceneText(byId.get('loop04_1400_first_correction'))).toContain('修正');
    expect(sceneText(byId.get('loop04_1530_ethical_break'))).toContain('至少不要替所有人決定');
    expect(sceneText(byId.get('loop04_1803_unknown_call'))).toContain('18:03');
  });

  it('establishes 06:12 as the canonical hard-reset checkpoint', () => {
    const story = loadRealStory();
    const byId = new Map(story.narrative.scenes.map((scene) => [scene.id, scene]));
    const opening = byId.get('loop04_0612_hard_reset');

    expect(opening).toBeDefined();
    expect(opening?.time).toBe('06:12');
    expect(sceneText(opening)).toContain('10 月 3 日');
    expect(sceneText(opening)).toContain('06:12');
  });
});
