import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutoFlowNarrative, playbackDelay } from '../../src/player/ui/AutoFlowNarrative';

describe('auto-flow narration', () => {
  it('uses a bounded natural pause between lines', () => {
    expect(playbackDelay('好。')).toBeGreaterThanOrEqual(1100);
    expect(playbackDelay('很長的敘述'.repeat(200))).toBeLessThanOrEqual(2800);
  });

  it('types every character and plays through to the end with normal motion', async () => {
    const onComplete = vi.fn();
    render(<AutoFlowNarrative lines={['不要回來。', '姊']} onComplete={onComplete} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 4000 });
    expect(screen.getByRole('status').textContent).toContain('姊');
  });

  it('renders each line without previous/next page buttons', () => {
    render(<AutoFlowNarrative title="鎮上的對話" lines={['她說了一句話。', '然後沉默。']} />);
    expect(screen.getByText('鎮上的對話')).not.toBeNull();
    expect(screen.queryByText('上一頁')).toBeNull();
    expect(screen.queryByText('下一頁')).toBeNull();
    expect(screen.getByRole('button', { name: '顯示完整句子或接續對話' })).not.toBeNull();
  });

  it('mouse movement never changes the explicit pause state', () => {
    render(<AutoFlowNarrative lines={['先聽我說。', '然後呢。']} />);
    const region = screen.getByRole('region', { name: '自動播放敘事' });
    fireEvent.mouseEnter(region);
    fireEvent.mouseLeave(region);
    expect(screen.getByRole('button', { name: '暫停' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '暫停' }));
    fireEvent.mouseEnter(region);
    fireEvent.mouseLeave(region);
    expect(screen.getByRole('button', { name: '播放' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('pauses and resumes on explicit user control', () => {
    render(<AutoFlowNarrative lines={['等一下。', '我還沒說完。']} />);
    const toggle = screen.getByRole('button', { name: '暫停' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: '播放' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '播放' }));
    expect(screen.getByRole('button', { name: '暫停' })).not.toBeNull();
  });
});
