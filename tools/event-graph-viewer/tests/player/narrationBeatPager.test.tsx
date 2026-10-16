import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NarrationBeatPager, paginateNarration } from '../../src/player/ui/NarrationBeatPager';

describe('NarrationBeatPager', () => {
  it('retains each character of lengthy Chinese paragraphs across pages', () => {
    const original = ['不要回來。', '長風從月台吹過，' + '她記得這個晚上。'.repeat(36), '姊'];
    const pages = paginateNarration(original, 56);
    expect(pages.length).toBeGreaterThan(4);
    const restored = original.map((_, i) =>
      pages.flat().filter(beat => beat.lineIndex === i).map(beat => beat.text).join(''));
    expect(restored).toEqual(original);
    expect(pages.every(page => page.map(beat => Array.from(beat.text).length).reduce((a,b)=>a+b,0) <= 56)).toBe(true);
  });

  it('presents one page without scrolling the document or writing world state',async()=>{
    const changeWorld = vi.fn();
    const long = '列車在夜裡行駛。'.repeat(26);
    render(<div onClick={changeWorld}><NarrationBeatPager recordId="loop1:letter" lines={[long]}/></div>);
    const stage=screen.getByTestId('narration-beat-pager');
    expect(stage.querySelector('.document-lines')).toBeNull();
    expect(screen.getByRole('button',{name:'下一段故事'})).not.toHaveProperty('disabled',true);
    const before=screen.getByLabelText(/第 1 段，共/).getAttribute('aria-label');
    expect(before).toMatch(/^第 1 段，共/);
    fireEvent.click(screen.getByRole('button',{name:'下一段故事'}));
    await waitFor(()=>expect(screen.getByLabelText(/第 2 段，共/)).toBeDefined());
    expect(changeWorld).toHaveBeenCalledTimes(1); // DOM-only navigation; parent wasn't given a world command
    expect(screen.getByRole('button',{name:'上一段故事'})).not.toHaveProperty('disabled',true);
    fireEvent.click(screen.getByRole('button',{name:'上一段故事'}));
    await waitFor(()=>expect(screen.getByLabelText(/第 1 段，共/)).toBeDefined());
  });

  it('restarts on a different record and respects keyboard next/previous',async()=>{
    const ui=render(<NarrationBeatPager recordId="1:a" lines={['列車聲。'.repeat(40)]}/>);
    fireEvent.keyDown(screen.getByTestId('narration-beat-pager'),{key:'ArrowRight'});
    expect(screen.getByLabelText(/第 2 段，共/)).toBeDefined();
    fireEvent.keyDown(screen.getByTestId('narration-beat-pager'),{key:'ArrowLeft'});
    expect(screen.getByLabelText(/第 1 段，共/)).toBeDefined();
    ui.rerender(<NarrationBeatPager recordId="1:b" lines={['新一輪的話。']} />);
    expect(screen.getByLabelText('第 1 段，共 1 段')).toBeDefined();
    expect(screen.getByRole('button',{name:'下一段故事'}).hasAttribute('disabled')).toBe(true);
  });
});
