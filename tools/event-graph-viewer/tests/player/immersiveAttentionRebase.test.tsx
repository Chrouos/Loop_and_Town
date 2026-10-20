import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InlineTextTarget } from '../../src/player/ui/InlineTextTarget';
import { PlayerAmbientLayer } from '../../src/player/ui/PlayerAmbientLayer';
import { OpeningScene } from '../../src/player/scenes/OpeningScene';
import type { PlayerPresentationModel } from '../../src/player/presentation/types';

describe('PR25 attention migration onto auto-flow', () => {
  it('only permits an actual inline observation when the cue is available', () => {
    const attend = vi.fn();
    const { rerender } = render(<InlineTextTarget available onAttend={attend}>紙張</InlineTextTarget>);
    fireEvent.click(screen.getByRole('button', { name: '留意：紙張' }));
    expect(attend).toHaveBeenCalledOnce();
    rerender(<InlineTextTarget available={false} onAttend={attend}>紙張</InlineTextTarget>);
    expect(screen.queryByRole('button', { name: '留意：紙張' })).toBeNull();
  });

  it('keeps the opening envelope usable alongside inline attention', () => {
    const attend = vi.fn(), open = vi.fn();
    render(<OpeningScene label="清晨" lines={[]} onOpenLetter={open} paperAvailable onAttendPaper={attend} />);
    fireEvent.click(screen.getByRole('button', { name: '留意：紙張' }));
    fireEvent.click(screen.getByRole('button', { name: '拆開信封，讀姊姊的信' }));
    expect(attend).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
  });

  it('renders a finite world cue that starts attention only when clicked', () => {
    const attend = vi.fn();
    const presentation = {
      mode: 'reading',
      attention: { phase: 'idle' },
      capture: { active: false },
      reset: { pending: false, npcState: 'current' },
      ambientCues: [{ id: 'train-rustle', title: '沙沙、沙沙——' }, { id: 'paper-word', title: '紙張' }],
    } as unknown as PlayerPresentationModel;
    render(<PlayerAmbientLayer presentation={presentation} onAttend={attend} />);
    expect(screen.getByRole('button', { name: '沙沙、沙沙——' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: '紙張' })).toBeNull();
    expect(attend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '沙沙、沙沙——' }));
    expect(attend).toHaveBeenCalledWith('train-rustle');
  });
});
