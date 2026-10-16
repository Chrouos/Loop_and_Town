import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AutoFlowNarrative } from '../../src/player/ui/AutoFlowNarrative';
import { inlineAnchors } from '../../src/player/ui/inlineMemory';

describe('inline memory capture', () => {
  it('highlights only words that actually exist in the narration', () => {
    const line = '她說今晚要去舊車站，卻沒有提到原因。';
    const anchors = inlineAnchors(line, [{ id: 'station', text: '今晚要去舊車站。' }]);
    expect(anchors).toHaveLength(1);
    expect(line.slice(anchors[0].start, anchors[0].end)).toBe('今晚要去舊車站');
  });

  it('captures a revealed phrase using its authored excerpt id', async () => {
    const onRemember = vi.fn();
    render(<AutoFlowNarrative reducedMotion lines={['她說今晚要去舊車站。', '沉默。']} excerpts={[{ id: 'plan', text: '今晚要去舊車站。' }]} onRemember={onRemember} />);
    const button = await screen.findByRole('button', { name: '記住：今晚要去舊車站。' });
    fireEvent.click(button);
    expect(onRemember).toHaveBeenCalledWith('plan');
  });

  it('retains unmatched authored clues without putting cards below the text', () => {
    const onRemember = vi.fn();
    render(<AutoFlowNarrative lines={['不要回來。']} excerpts={[{ id: 'postmark', text: '郵戳是昨天的；署名是林知夏。' }]} onRemember={onRemember} />);
    fireEvent.click(screen.getByRole('button', { name: '其他線索' }));
    fireEvent.click(screen.getByRole('button', { name: '郵戳是昨天的；署名是林知夏。' }));
    expect(onRemember).toHaveBeenCalledWith('postmark');
  });
});
