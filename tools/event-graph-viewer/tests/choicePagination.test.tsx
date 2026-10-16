import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceSurface, choicesPerPage } from '../src/playerNarrative/components/ChoiceSurface';

describe('choice pagination', () => {
  it('uses fewer options on short screens', () => {
    expect(choicesPerPage(600)).toBe(2);
    expect(choicesPerPage(768)).toBe(3);
  });

  it('reveals the remaining options without scrolling and keeps clicks functional', () => {
    const onChoose = vi.fn();
    const choices = Array.from({ length: 7 }, (_, i) => ({ id: `choice-${i}`, label: `選項 ${i}` }));
    render(<ChoiceSurface choices={choices} onChoose={onChoose} />);
    expect(screen.queryByText('選項 6')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '下頁 ›' }));
    fireEvent.click(screen.getByRole('button', { name: '下頁 ›' }));
    expect(screen.getByText('選項 6')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '選項 6' }));
    expect(onChoose).toHaveBeenCalledWith('choice-6');
  });
});
