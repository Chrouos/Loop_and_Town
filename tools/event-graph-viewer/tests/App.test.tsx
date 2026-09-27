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
  const suffix = pathname.replace(/^\/?story\//, '');
  const key = Object.keys(rawStoryFiles).find((candidate) => candidate.endsWith(`/story/${suffix}`));
  if (!key) return { ok: false, status: 404, text: async () => '' };
  return { ok: true, status: 200, text: async () => rawStoryFiles[key] };
}

function stubRealStoryFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(input)));
}

afterEach(() => vi.restoreAllMocks());

describe('App', () => {
  it('loads the Day 01 causal DAG reader and node inspector', async () => {
    stubRealStoryFetch();
    render(<App />);

    expect(await screen.findByText('[N01_wakaharu_photography 與若晴聊攝影]')).toBeTruthy();
    expect(screen.getByLabelText('Worldline Path')).toBeTruthy();
    fireEvent.click(screen.getByText('[N03_station_plan_known 玩家知道若晴要去舊車站]'));
    expect(await screen.findByText('若晴信任足夠，主動透露行程。')).toBeTruthy();
    expect(screen.getByText('我晚點還要去一趟舊車站。很快就回來。')).toBeTruthy();
  });

  it('loads Loop 03 as a merged DAG path with readable novel scenes', async () => {
    stubRealStoryFetch();
    render(<App />);

    const selector = await screen.findByLabelText('Worldline Path');
    fireEvent.change(selector, { target: { value: 'loop_03_no_death' } });
    expect(await screen.findByText('[L3_N05_no_death_1831 18:31 沒有人死亡]')).toBeTruthy();
    fireEvent.click(screen.getByText('[L3_N03_doctor_asks_iteration 柏勳問「這是第幾次？」]'));
    expect(await screen.findByText('……這是第幾次？')).toBeTruthy();
  });

  it('opens Character Graph and exposes visibility modes without leaking author relationships by default', async () => {
    stubRealStoryFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Character Graph' }));
    expect(await screen.findByRole('heading', { name: 'Character Graph' })).toBeTruthy();
    expect(screen.getAllByText('周予安').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/高中同學/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/研究所/)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Author Truth' }));
    expect(screen.getAllByText(/研究所/).length).toBeGreaterThan(0);
  });

  it('shows the cross-day loop end with an explicit Day 1 label', async () => {
    stubRealStoryFetch();
    render(<App />);

    await screen.findByRole('group', { name: '世界線 B' });
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));

    expect(screen.getByText('D1 00:00')).toBeTruthy();
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
    expect(screen.getAllByText(/reporter_missing/).length).toBeGreaterThan(0);
  });

  it('shows a readable load error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })));
    render(<App />);
    await waitFor(() => expect(screen.getByText('無法載入 Event Graph')).toBeTruthy());
  });
});
