import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlayerSceneStage } from '../../src/player/ui/PlayerSceneStage';
import type { PlayerPresentationModel } from '../../src/player/presentation/types';

function model(overrides: Partial<PlayerPresentationModel> = {}): PlayerPresentationModel {
  return {
    loopId: 2,
    timeLabel: '18:31',
    location: '舊車站',
    mode: 'attention',
    scene: {
      id: 'loop02_1831_doctor_death',
      sceneId: 'loop02_1831_doctor_death',
      loopId: 2,
      title: '18:31 的另一個死者',
      source: '時間線紀錄',
      formedAt: '18:31',
      obtainedAt: '18:31',
      body: ['停電後，鐘聲從月台傳來。'],
      excerpts: [],
      revealMinute: 1111,
      acquisition: 'presence',
    },
    sceneCandidates: [],
    ambientCues: [{
      id: 'ambient-1',
      sceneId: 'ambient-1',
      loopId: 2,
      title: '遠處的腳步聲',
      source: '周遭動靜',
      formedAt: '18:30',
      obtainedAt: '18:30',
      body: ['有人在雨裡走過。'],
      excerpts: [],
      revealMinute: 1110,
      acquisition: 'presence',
    }],
    attention: { phase: 'observing', targetId: 'ambient-1' },
    capture: { active: false },
    reset: { pending: false, npcState: 'reset' },
    persistentMemoryIds: ['memory:1:letter'],
    wallRefs: ['memory:1:letter'],
    memoryCandidates: [],
    inference: 'player-led',
    ...overrides,
  };
}

describe('PlayerSceneStage', () => {
  it('renders a stable scene surface with quiet context and ambient cues', () => {
    render(<PlayerSceneStage presentation={model()}><p>場景內容</p></PlayerSceneStage>);

    const stage = screen.getByRole('region', { name: '玩家場景：舊車站' });
    expect(stage.getAttribute('data-presentation-mode')).toBe('attention');
    expect(screen.getByText('舊車站')).toBeDefined();
    expect(screen.getByText('18:31')).toBeDefined();
    expect(screen.getByText('場景內容')).toBeDefined();
    expect(screen.getByText('周遭有動靜')).toBeDefined();
    expect(screen.getAllByText('正在留意')).toHaveLength(2);
  });

  it('exposes capture and reset state without exposing author data', () => {
    render(<PlayerSceneStage presentation={model({
      mode: 'reset',
      reset: { pending: true, npcState: 'reset' },
      capture: { active: true, recordId: 'loop02_1831_doctor_death', memoryId: 'memory:2:x' },
      scene: undefined,
    })}><p>重置前的安靜</p></PlayerSceneStage>);

    const stage = screen.getByRole('region', { name: '玩家場景：舊車站' });
    expect(stage.getAttribute('data-presentation-mode')).toBe('reset');
    expect(screen.getByText('正在留下這一刻')).toBeDefined();
    expect(screen.getByText('世界正在接手這一輪')).toBeDefined();
    expect(screen.queryByText(/storyDags|relationship|hidden/i)).toBeNull();
  });
});
