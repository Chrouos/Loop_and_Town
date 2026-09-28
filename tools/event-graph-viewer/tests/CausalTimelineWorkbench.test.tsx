import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CausalTimelineWorkbench } from '../src/components/CausalTimelineWorkbench';
import type { StoryDagDocument, StoryWorldlinePath } from '../src/types/story';

const detail = {
  before: [], after: [], affectedCharacters: [], delayedEffects: [],
  knowledgeChanges: [], relationshipChanges: [], narrativeRefs: [],
};

const document: StoryDagDocument = {
  id: 'workbench-test',
  title: 'Workbench Test',
  nodes: [
    { id: 'N1', title: '與若晴聊攝影', time: '16:10', actorIds: ['wakaharu'], visibility: 'public', detail },
    {
      id: 'N2', title: '玩家知道若晴要去舊車站', time: '17:20', actorIds: ['protagonist', 'wakaharu'], visibility: 'public',
      detail: { ...detail, reason: '若晴信任足夠，主動透露行程。', narrativeRefs: ['scene_station'] },
    },
    { id: 'N3', title: '柏勳進入維修通道', time: '18:24', actorIds: ['doctor'], visibility: 'public', detail },
    { id: 'N4', title: '18:31 Convergence', time: '18:31', actorIds: [], visibility: 'public', detail },
    { id: 'N5', title: '另一輪才發生', time: '17:30', actorIds: ['reporter'], visibility: 'public', detail },
  ],
  edges: [
    { id: 'E1', source: 'N1', target: 'N2', label: 'trust +1', visibility: 'public' },
    { id: 'E2', source: 'N2', target: 'N3', label: 'no recipient', visibility: 'public' },
    { id: 'E3', source: 'N3', target: 'N4', label: 'still nearby', visibility: 'public' },
  ],
};

const paths: StoryWorldlinePath[] = [
  { id: 'loop1', label: 'Loop 01｜第一個今天', nodeIds: ['N1', 'N2', 'N3', 'N4'], edgeIds: ['E1', 'E2', 'E3'], visibility: 'public' },
  { id: 'loop2', label: 'Loop 02｜另一條', nodeIds: ['N1', 'N5', 'N4'], edgeIds: [], visibility: 'public' },
];

const narrativeScenes = [{
  id: 'scene_station',
  blocks: [{ type: 'dialogue', speaker: 'wakaharu', text: '我晚點還要去一趟舊車站。' }],
}];

describe('CausalTimelineWorkbench', () => {
  it('starts with one named worldline and only the four primary controls', () => {
    render(<CausalTimelineWorkbench document={document} paths={paths} narrativeScenes={narrativeScenes} />);
    expect(screen.getByLabelText('Loop / Worldline')).toBeTruthy();
    expect(screen.getByLabelText('Character Filter')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compare' })).toBeTruthy();
    expect(screen.getByText('與若晴聊攝影')).toBeTruthy();
    expect(screen.queryByText('另一輪才發生')).toBeNull();
    expect(screen.queryByText('[N1 與若晴聊攝影]')).toBeNull();
  });

  it('opens narrative-first inspector and exposes focus actions only after selecting a node', () => {
    render(<CausalTimelineWorkbench document={document} paths={paths} narrativeScenes={narrativeScenes} />);
    expect(screen.queryByRole('group', { name: 'Causal Focus' })).toBeNull();
    fireEvent.click(screen.getByText('玩家知道若晴要去舊車站'));
    expect(screen.getByText('為什麼發生？')).toBeTruthy();
    expect(screen.getByText('我晚點還要去一趟舊車站。')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Causal Focus' })).toBeTruthy();
    expect(screen.getByText('Debug Data')).toBeTruthy();
  });

  it('combines path, character and search filtering without restoring unrelated nodes', () => {
    render(<CausalTimelineWorkbench document={document} paths={paths} narrativeScenes={narrativeScenes} />);
    fireEvent.change(screen.getByLabelText('Character Filter'), { target: { value: 'doctor' } });
    expect(screen.getByText('柏勳進入維修通道')).toBeTruthy();
    expect(screen.queryByText('與若晴聊攝影')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '不存在' } });
    expect(screen.queryByText('柏勳進入維修通道')).toBeNull();
  });

  it('switches named paths and opens multi-worldline compare', () => {
    render(<CausalTimelineWorkbench document={document} paths={paths} narrativeScenes={narrativeScenes} />);
    fireEvent.change(screen.getByLabelText('Loop / Worldline'), { target: { value: 'loop2' } });
    expect(screen.getByText('另一輪才發生')).toBeTruthy();
    expect(screen.queryByText('柏勳進入維修通道')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByRole('heading', { name: 'Worldline Compare' })).toBeTruthy();
  });
});
