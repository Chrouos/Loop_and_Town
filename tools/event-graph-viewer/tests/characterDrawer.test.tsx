import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlayerCharacterMemory } from '../src/narrative/characterMemory';
import { CharacterDrawer } from '../src/playerNarrative/components/CharacterDrawer';

const memory: PlayerCharacterMemory[] = [
  {
    characterId: 'protagonist',
    name: '我',
    facts: [],
    insights: [],
    questions: [],
  },
  {
    characterId: 'yuan',
    name: '林遠',
    occupation: '鐘錶師',
    hometown: '灰潮鎮',
    facts: [{ id: 'yuan_shop', summary: '他在車站旁修鐘。' }],
    insights: [{ id: 'yuan_nervous', title: '不安的習慣', presentation: '他緊張時會反覆確認門鎖。' }],
    questions: [{ id: 'yuan_question', text: '他為什麼不肯談起那座塔？' }],
  },
  {
    characterId: 'qing',
    name: '若晴',
    facts: [],
    insights: [],
    questions: [],
  },
];

describe('CharacterDrawer', () => {
  it('renders player-safe identity, facts, insights, and unresolved questions while excluding protagonist', () => {
    render(<CharacterDrawer memory={memory} open onClose={() => undefined} />);

    expect(screen.queryByRole('heading', { name: '我' })).toBeNull();
    expect(screen.getByRole('heading', { name: '林遠' })).not.toBeNull();
    expect(screen.getByText('鐘錶師')).not.toBeNull();
    expect(screen.getByText('我記得的事')).not.toBeNull();
    expect(screen.getByText('他在車站旁修鐘。')).not.toBeNull();
    expect(screen.getByText('跨輪迴線索')).not.toBeNull();
    expect(screen.getByText('他緊張時會反覆確認門鎖。')).not.toBeNull();
    expect(screen.getByText('還沒想通的事')).not.toBeNull();
    expect(screen.getByText('他為什麼不肯談起那座塔？')).not.toBeNull();
  });

  it('hides empty sections and uses a monogram fallback', () => {
    render(<CharacterDrawer memory={memory} open onClose={() => undefined} />);

    const qingCard = screen.getByRole('heading', { name: '若晴' }).closest('article');
    expect(qingCard).not.toBeNull();
    expect(qingCard?.querySelector('.character-monogram')?.textContent).toBe('若');
    expect(qingCard?.textContent).not.toContain('我記得的事');
    expect(qingCard?.textContent).not.toContain('跨輪迴線索');
    expect(qingCard?.textContent).not.toContain('還沒想通的事');
    expect(qingCard?.textContent).not.toContain('author');
  });

  it('closes on button click and keeps focus on the close control', () => {
    const onClose = vi.fn();
    render(<CharacterDrawer memory={memory} open onClose={onClose} />);

    const close = screen.getByRole('button', { name: '關閉人物' });
    close.focus();
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders nothing while closed', () => {
    render(<CharacterDrawer memory={memory} open={false} onClose={() => undefined} />);
    expect(screen.queryByRole('complementary', { name: '人物' })).toBeNull();
  });
});
