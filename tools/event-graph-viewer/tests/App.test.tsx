import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const yaml = `id: evt_1831_station\ntitle: "18:31 車站事件"\ntime: "18:31"\nvariants:\n  - id: no_death\n    when: {}\n    effects: []\n`;

afterEach(() => vi.restoreAllMocks());

describe('App', () => {
  it('switches between Graph, Timeline and Worldline Diff', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => yaml })));
    render(<App />);

    await waitFor(() => expect(screen.getByText(/Loaded: evt_1831_station/)).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Event Graph' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Timeline' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Worldline Diff' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getByRole('heading', { name: 'Timeline' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Worldline Diff' }));
    expect(screen.getByRole('heading', { name: 'Worldline Diff' })).toBeTruthy();
  });

  it('shows a readable load error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })));
    render(<App />);
    await waitFor(() => expect(screen.getByText('無法載入 Event Graph')).toBeTruthy());
  });
});
