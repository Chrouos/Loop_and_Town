import { describe, expect, it } from 'vitest';
import { loadRealStory } from './helpers/loadRealStory';

describe('Loop 02 survivor narrative', () => {
  it('shows the causal chain from saving Wakaharu to the doctor dying', () => {
    const scenes = loadRealStory().narrative.scenes;
    const byId = new Map(scenes.map((scene) => [scene.id, scene]));
    const required = [
      'loop02_1420_reset_awareness',
      'loop02_1718_wakaharu_persuaded',
      'loop02_1805_doctor_no_recipient',
      'loop02_1824_maintenance_passage',
      'loop02_1831_doctor_death',
      'loop02_2030_wakaharu_resignation',
      'loop02_2359_bell_again',
      'loop02_0000_reset_again',
    ];

    for (const id of required) {
      const scene = byId.get(id);
      expect(scene, `missing ${id}`).toBeDefined();
      expect(scene?.blocks.length ?? 0, `${id} should be a real scene`).toBeGreaterThanOrEqual(2);
    }

    expect(JSON.stringify(byId.get('loop02_1718_wakaharu_persuaded'))).toContain('攝影');
    expect(JSON.stringify(byId.get('loop02_1805_doctor_no_recipient'))).toContain('沒來');
    expect(JSON.stringify(byId.get('loop02_1824_maintenance_passage'))).toContain('維修');
    expect(JSON.stringify(byId.get('loop02_1831_doctor_death'))).toContain('18:31');
    expect(JSON.stringify(byId.get('loop02_2030_wakaharu_resignation'))).toContain('辭職');
  });

  it('keeps Wakaharu alive as a person with her own next action', () => {
    const scenes = loadRealStory().narrative.scenes;
    const resignation = scenes.find((scene) => scene.id === 'loop02_2030_wakaharu_resignation');
    expect(JSON.stringify(resignation)).toContain('我本來以為今天做完那件事，就可以走了');
    expect(JSON.stringify(resignation)).toContain('結果好像還是得走');
  });
});
