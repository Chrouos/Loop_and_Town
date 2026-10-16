import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NarrationBeatPager, splitNarrationPages } from '../src/playerNarrative/components/NarrationBeatPager';

describe('NarrationBeatPager', () => {
  it('keeps every character in order when breaking long text', () => {
    const text = '月台上的腳步聲。'.repeat(40);
    expect(splitNarrationPages(text, 30).join('')).toBe(text);
    expect(splitNarrationPages(text, 30).every(page => page.length <= 30)).toBe(true);
  });

  it('reveals current page before changing pages or advancing beats', () => {
    const text = '鐘聲響起。'.repeat(28);
    const pages = splitNarrationPages(text);
    const reveal = vi.fn();
    const advance = vi.fn();
    const props = {
      block: { type: 'narration' as const, text },
      phase: 'typing' as const,
      revealedCharacters: 0,
      onReveal: reveal,
      onAdvance: advance,
    };
    const { rerender } = render(<NarrationBeatPager {...props} />);
    const surface = screen.getByRole('region', { name: '故事敘事' });
    fireEvent.click(surface);
    expect(reveal).toHaveBeenCalledWith(pages[0].length);
    expect(advance).not.toHaveBeenCalled();
    rerender(<NarrationBeatPager {...props} revealedCharacters={pages[0].length} />);
    fireEvent.click(surface);
    expect(screen.getByText(`2 / ${pages.length}`)).not.toBeNull();
    expect(advance).not.toHaveBeenCalled();
  });

  it('supports Enter as the same progression action', () => {
    const advance = vi.fn();
    render(<NarrationBeatPager block={{ type: 'narration', text: '結束。' }} phase="waiting" revealedCharacters={3} onReveal={() => undefined} onAdvance={advance} />);
    fireEvent.keyDown(screen.getByRole('region', { name: '故事敘事' }), { key: 'Enter' });
    expect(advance).toHaveBeenCalledTimes(1);
  });
});
