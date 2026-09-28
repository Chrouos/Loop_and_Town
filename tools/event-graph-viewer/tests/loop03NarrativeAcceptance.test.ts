import { describe, expect, it } from 'vitest';
import { toAbsoluteMinute } from '../src/simulator/time';
import { loadRealStory } from './helpers/loadRealStory';

describe('Loop 03 no-death narrative', () => {
  it('shows the protagonist clearing known people away from 18:31 without treating that as clean success', () => {
    const scenes = loadRealStory().narrative.scenes;
    const byId = new Map(scenes.map((scene) => [scene.id, scene]));
    const required = [
      'loop03_1420_third_awake',
      'loop03_1540_wakaharu_foreknowledge',
      'loop03_1630_yuan_notices',
      'loop03_1720_doctor_intercept',
      'loop03_1800_clear_station',
      'loop03_1831_no_death',
      'loop03_2240_not_success',
      'loop03_2310_doctor_old_record',
      'loop03_2359_bell',
      'loop03_0000_reset',
    ];

    for (const id of required) {
      const scene = byId.get(id);
      expect(scene, `missing ${id}`).toBeDefined();
      expect(scene?.blocks.length ?? 0, `${id} should be a real scene`).toBeGreaterThanOrEqual(2);
    }

    expect(JSON.stringify(byId.get('loop03_1540_wakaharu_foreknowledge'))).toContain('妳怎麼知道我要去');
    expect(JSON.stringify(byId.get('loop03_1720_doctor_intercept'))).toContain('這是第幾次');
    expect(JSON.stringify(byId.get('loop03_1831_no_death'))).toContain('所以我現在可以出門了嗎');
    expect(JSON.stringify(byId.get('loop03_2240_not_success'))).toContain('沒有人死');
    expect(JSON.stringify(byId.get('loop03_2310_doctor_old_record'))).toContain('十二天');
    expect(JSON.stringify(byId.get('loop03_2310_doctor_old_record'))).toContain('那不一定是一回事');
  });

  it('lets ordinary lives resume before the same midnight reset', () => {
    const scenes = loadRealStory().narrative.scenes;
    const byId = new Map(scenes.map((scene) => [scene.id, scene]));
    const resignation = byId.get('loop03_1910_wakaharu_resignation');
    const realtor = byId.get('loop03_2000_yuan_realtor');
    const bell = byId.get('loop03_2359_bell');
    const reset = byId.get('loop03_0000_reset');

    expect(JSON.stringify(resignation)).toContain('如果等到想好');
    expect(JSON.stringify(realtor)).toContain('替所有人保存一個他們比較喜歡的過去');
    expect(JSON.stringify(bell)).toContain('只有');
    if (!reset) throw new Error('missing loop03_0000_reset');
    expect(toAbsoluteMinute(reset.at)).toBe(24 * 60);
    expect(JSON.stringify(reset)).toContain('10 月 3 日');
  });
});
