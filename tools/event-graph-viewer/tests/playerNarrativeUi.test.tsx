import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NarrativeSurface } from '../src/playerNarrative/components/NarrativeSurface';
import { ActivitySurface } from '../src/playerNarrative/components/ActivitySurface';
import { ArtifactSurface } from '../src/playerNarrative/components/ArtifactSurface';
import { ChoiceSurface } from '../src/playerNarrative/components/ChoiceSurface';
import type { ArtifactDefinition } from '../src/narrative/types';

const coffee = { id: 'coffee', label: '先去買杯咖啡' };
const protect = { id: 'protect', label: '現在去找若晴' };

const letter: ArtifactDefinition = {
  id: 'letter',
  kind: 'letter',
  author: 'zhixia',
  formedAt: { day: 0, time: '08:00' },
  content: ['回來一趟。', '如果午夜的鐘聲響起，就代表又失敗了。'],
};

describe('player narrative UI', () => {
  it('renders prose without author/debug labels', () => {
    render(<NarrativeSurface blocks={[{ type: 'narration', text: '火車進站時，我差點沒認出月台。' }]} />);
    expect(screen.getByText('火車進站時，我差點沒認出月台。')).toBeInTheDocument();
    expect(screen.queryByText(/WORLDLINE|impactType|Knowledge \+|BAD END/i)).toBeNull();
  });

  it('renders Ambient Prose without progress UI', () => {
    render(<ActivitySurface timeLabel="15:41" title="正在看書" prose="茶已經沒有剛才那麼燙了。" />);
    expect(screen.getByText('茶已經沒有剛才那麼燙了。')).toBeInTheDocument();
    expect(screen.queryByText(/%|剩餘|EXP/i)).toBeNull();
  });

  it('styles ordinary and causal choices identically', () => {
    render(<ChoiceSurface choices={[coffee, protect]} onChoose={() => undefined} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].className).toBe(buttons[1].className);
  });

  it('opens the physical letter without exposing author metadata', () => {
    render(<ArtifactSurface artifact={letter} />);
    fireEvent.click(screen.getByRole('button', { name: '翻到背面' }));
    expect(screen.getByText(/灰潮郵局/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '拆開信封' }));
    expect(screen.getByText('回來一趟。')).toBeInTheDocument();
    expect(screen.getByText('如果午夜的鐘聲響起，就代表又失敗了。')).toBeInTheDocument();
    expect(screen.queryByText(/Artifact ID/i)).toBeNull();
  });
});
