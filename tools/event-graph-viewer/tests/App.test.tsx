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
  it('loads the Day 01 causal timeline workbench without the simulator information wall', async () => {
    stubRealStoryFetch();
    render(<App />);

    expect(await screen.findByText('與若晴聊攝影')).toBeTruthy();
    expect(screen.getByLabelText('Loop / Worldline')).toBeTruthy();
    expect(screen.getByLabelText('Character Filter')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compare' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: '世界線 B' })).toBeNull();
    expect(screen.queryByText(/\[N01_wakaharu_photography/)).toBeNull();

    fireEvent.click(screen.getByText('玩家知道若晴要去舊車站'));
    expect(await screen.findByText('若晴信任足夠，主動透露行程。')).toBeTruthy();
    expect(screen.getByText('我晚點還要去一趟舊車站。很快就回來。')).toBeTruthy();
  });

  it('loads Loop 03 as a timeline trace with readable novel scenes', async () => {
    stubRealStoryFetch();
    render(<App />);

    const selector = await screen.findByLabelText('Loop / Worldline');
    fireEvent.change(selector, { target: { value: 'loop_03_no_death' } });
    expect(await screen.findByText('18:31 沒有人死亡')).toBeTruthy();
    fireEvent.click(screen.getByText('柏勳問「這是第幾次？」'));
    expect(await screen.findByText('……這是第幾次？')).toBeTruthy();
  });

  it('loads Loop 04 investigation trace with five-year-old evidence', async () => {
    stubRealStoryFetch();
    render(<App />);

    const selector = await screen.findByLabelText('Loop / Worldline');
    fireEvent.change(selector, { target: { value: 'loop_04_five_years_ago' } });
    expect(await screen.findByText('志遠交出未登錄錄音器')).toBeTruthy();
    fireEvent.click(screen.getByText('志遠交出未登錄錄音器'));
    expect(await screen.findByText('庭安，這次不是若晴。')).toBeTruthy();
    expect(screen.getByText('Loop 04｜五年前・重建知夏的世界線')).toBeTruthy();
  });

  it('loads Loop 05 without giving Yuan cross-loop memory', async () => {
    stubRealStoryFetch();
    render(<App />);

    const selector = await screen.findByLabelText('Loop / Worldline');
    fireEvent.change(selector, { target: { value: 'loop_05_only_i_remember' } });
    expect(await screen.findByText('予安再次只是五年沒見的舊友')).toBeTruthy();
    fireEvent.click(screen.getByText('主角使用不存在昨日的備用鑰匙情報'));
    expect(await screen.findByText('……妳怎麼知道備用鑰匙在那？')).toBeTruthy();
    expect(screen.getByText('Loop 05｜只有我記得')).toBeTruthy();
  });

  it('loads Loop 06 without confirming seventh-letter transmission', async () => {
    stubRealStoryFetch();
    render(<App />);

    const selector = await screen.findByLabelText('Loop / Worldline');
    fireEvent.change(selector, { target: { value: 'loop_06_six_letters' } });
    expect(await screen.findByText('18:31 警告信仍未變字')).toBeTruthy();
    fireEvent.click(screen.getByText('18:31 警告信仍未變字'));
    expect(await screen.findByText('18:31，我再次拿起那封署名知夏的信，紙上仍然只有「不要回來」。')).toBeTruthy();
    expect(screen.getByText('沒有新增字，也沒有知夏的即時回覆。鎮上卻傳來短暫的供電異常聲。')).toBeTruthy();
    expect(screen.getByText('Loop 06｜前六份紀錄・來源調查')).toBeTruthy();
  });

  it('loads both Loop 07 Yuan-agency branches and reconverges on collective burden', async () => {
    stubRealStoryFetch();
    render(<App />);

    const selector = await screen.findByLabelText('Loop / Worldline');
    fireEvent.change(selector, { target: { value: 'loop_07_yuan_answers' } });
    expect(await screen.findByText('Worldline 31：留下來的主角在 18:31 死亡')).toBeTruthy();
    fireEvent.click(screen.getByText('Worldline 31：留下來的主角在 18:31 死亡'));
    expect(await screen.findByText(/五年前的那一輪，姊第一次真正把我留在灰潮鎮/)).toBeTruthy();
    expect(screen.getByText('Loop 07｜林知夏・予安接電話')).toBeTruthy();

    fireEvent.change(selector, { target: { value: 'loop_07_yuan_declines' } });
    fireEvent.click(await screen.findByText('予安選擇延後仲介來電'));
    expect(await screen.findByText(/予安讓電話停止震動，傳訊息給仲介約明天再談/)).toBeTruthy();
    expect(screen.getByText('Loop 07｜林知夏・予安不接電話')).toBeTruthy();

    fireEvent.click(screen.getByText('主角不再替大家選擇'));
    expect(await screen.findByText('18:31 的電力異常仍然到來，但大家都知道自己正在承擔什麼。')).toBeTruthy();
    expect(screen.getByText('這次不要由我選誰活。我想把風險交還給真正要承擔的人。')).toBeTruthy();
  });

  it('loads all three Final paths after NPC-owned decisions reconverge', async () => {
    stubRealStoryFetch();
    render(<App />);

    const selector = await screen.findByLabelText('Loop / Worldline') as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: 'ending_a_tomorrow' } });
    expect(selector.value).toBe('ending_a_tomorrow');
    expect(await screen.findByText('18:31 各自選擇在同一個 Convergence 合流')).toBeTruthy();
    fireEvent.click(screen.getByText('18:03 查核 Write-back 同步資料'));
    expect(await screen.findByText('18:03，我們比對當年通聯紀錄與同步資料。紀錄方向仍有矛盾，但沒有信紙即時回覆，也沒有已證明的跨線交接。')).toBeTruthy();

    fireEvent.change(selector, { target: { value: 'ending_b_once_more' } });
    expect(selector.value).toBe('ending_b_once_more');
    expect(await screen.findByText('Ending B｜再一次', { selector: 'strong' })).toBeTruthy();

    fireEvent.change(selector, { target: { value: 'ending_c_forget_me' } });
    expect(selector.value).toBe('ending_c_forget_me');
    fireEvent.click(await screen.findByText('Ending C｜停止改寫', { selector: 'strong' }));
    expect(await screen.findByText('真正要切斷的是自主 Reality Write-back 的執行權，保留 Prediction / Simulation，不是刪除我的記憶。')).toBeTruthy();
    expect(screen.getByText('我依然記得那些不再存在的昨天，但我不再用它們替眼前的人做選擇。')).toBeTruthy();
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

  it('keeps Scenario Simulator on the simulator Timeline tool', async () => {
    stubRealStoryFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Timeline' }));
    await screen.findByRole('group', { name: '世界線 B' });
    expect(screen.getByText('D1 00:00')).toBeTruthy();
  });

  it('applies draft worldline changes only after explicit simulation', async () => {
    stubRealStoryFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Timeline' }));
    const right = await screen.findByRole('group', { name: '世界線 B' });
    fireEvent.click(within(right).getByRole('checkbox', { name: '阻止若晴前往舊車站' }));
    expect(screen.getAllByText('wakaharu_dies').length).toBeGreaterThan(0);
    expect(screen.queryByText('doctor_dies')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '重算世界線' }));
    expect(screen.getByText('doctor_dies')).toBeTruthy();
  });

  it('recomputes a reporter worldline from the legacy Worldline Diff tool', async () => {
    stubRealStoryFetch();
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Worldline Diff' }));
    const right = await screen.findByRole('group', { name: '世界線 B' });
    fireEvent.click(within(right).getByRole('checkbox', { name: '拆穿葉庭安' }));
    fireEvent.click(screen.getByRole('button', { name: '重算世界線' }));

    expect(await screen.findByRole('heading', { name: 'Worldline Diff' })).toBeTruthy();
    expect(screen.getAllByText(/reporter_missing/).length).toBeGreaterThan(0);
  });

  it('shows a readable load error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })));
    render(<App />);
    await waitFor(() => expect(screen.getByText('無法載入 Event Graph')).toBeTruthy());
  });
});
