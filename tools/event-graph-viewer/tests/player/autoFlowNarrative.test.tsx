import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutoFlowNarrative, playbackDelay } from '../../src/player/ui/AutoFlowNarrative';

describe('auto-flow narration', () => {
  it('uses a bounded natural pause between lines', () => {
    expect(playbackDelay('好。')).toBeGreaterThanOrEqual(1100);
    expect(playbackDelay('很長的敘述'.repeat(200))).toBeLessThanOrEqual(2800);
  });

  it('renders each line without previous/next page buttons', () => {
    render(<AutoFlowNarrative title="鎮上的對話" lines={['她說了一句話。', '然後沉默。']} />);
    expect(screen.getByText('鎮上的對話')).not.toBeNull();
    expect(screen.queryByText('上一頁')).toBeNull();
    expect(screen.queryByText('下一頁')).toBeNull();
    expect(screen.getByRole('button', { name: '顯示完整句子或接續對話' })).not.toBeNull();
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
