import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const rawStoryFiles = import.meta.glob('../../../story/**/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function responseFor(input: RequestInfo | URL) {
  const pathname = String(input).replace(/^https?:\/\/[^/]+/, '');
  const suffix = pathname.startsWith('/story/') ? pathname.slice('/story/'.length) : pathname;
  const key = Object.keys(rawStoryFiles).find((candidate) => candidate.endsWith(`/story/${suffix}`));
  if (!key) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => rawStoryFiles[key] };
}

function stubRealStoryFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(input)));
}

afterEach(() => vi.restoreAllMocks());

describe('App', () => {
  it('loads the complete Loop 01 author graph from the manifest', async () => {
    stubRealStoryFetch();
    render(<App />);

    expect(await screen.findByText('reporter_enter_old_lab')).toBeTruthy();
    expect(screen.getByText('21:14 葉庭安失蹤')).toBeTruthy();
  });

  it('applies draft worldline changes only after explicit simulation', async () => {
    stubRealStoryFetch();
    render(<App />);

    const right = await screen.findByRole('group', { name: '世界線 B' });
    fireEvent.click(within(right).getByRole('checkbox', { name: '阻止若晴前往舊車站' }));

    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getAllByText('wakaharu_dies').length).toBeGreaterThan(0);
    expect(screen.queryByText('doctor_dies')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '重算世界線' }));
    expect(screen.getByText('doctor_dies')).toBeTruthy();
  });

  it('recomputes a reporter worldline from the story simulator', async () => {
    stubRealStoryFetch();
    render(<App />);

    const right = await screen.findByRole('group', { name: '世界線 B' });
    fireEvent.click(within(right).getByRole('checkbox', { name: '拆穿葉庭安' }));
    fireEvent.click(screen.getByRole('button', { name: '重算世界線' }));
    fireEvent.click(screen.getByRole('button', { name: 'Worldline Diff' }));

    expect(await screen.findByRole('heading', { name: 'Worldline Diff' })).toBeTruthy();
    expect(screen.getByText(/reporter_missing/)).toBeTruthy();
  });

  it('shows a readable load error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })));
    render(<App />);
    await waitFor(() => expect(screen.getByText('無法載入 Event Graph')).toBeTruthy());
  });
});
