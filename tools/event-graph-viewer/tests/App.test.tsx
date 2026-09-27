import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { StoryOrder } from '../src/components/StoryOrder';

const initial = `clock:\n  day: 1\n  time: "18:20"\ncharacters:\n  wakaharu: { location: old_station, status: alive }\n  doctor: { location: old_station, status: alive }\n  reporter: { location: hotel, status: alive }\nworld:\n  anomaly_1831_observed: false\nflags:\n  player_protected_wakaharu: false\n  player_stopped_doctor: false\n`;

const actions = `actions:\n  - id: make_coffee\n    at: "18:20"\n    duration_minutes: 5\n    label: 泡咖啡\n    effects: []\n  - id: protect_wakaharu\n    at: "18:20"\n    label: 阻止若晴前往舊車站\n    effects:\n      - set: { path: characters.wakaharu.location, value: home }\n      - add_flag: flags.player_protected_wakaharu\n  - id: stop_doctor\n    at: "18:20"\n    label: 阻止醫生前往舊車站\n    effects:\n      - set: { path: characters.doctor.location, value: clinic }\n      - add_flag: flags.player_stopped_doctor\n  - id: late_walk\n    at: "18:26"\n    label: 前往旅館\n    effects: []\n`;

const actionsWithInvalidCausalProbe = `actions:\n  - id: missed_train\n    at: "18:10"\n    label: 搭上早班車\n    effects: []\n`;

const actionsWithMalformedEffects = `actions:\n  - id: malformed_action\n    at: "18:20"\n    label: 設定損壞\n`;

const actionsWithInvalidTiming = `actions:\n  - id: invalid_timing\n    at: "23:58"\n    duration_minutes: 2\n    label: 超出當日\n    effects: []\n`;

const actionsWithMissingTiming = `actions:\n  - id: missing_timing\n    at: null\n    label: 缺少時間\n    effects: []\n`;

const actionAfterExistingEvents = `actions:\n  - id: late_walk\n    at: "21:30"\n    label: 深夜散步\n    effects: []\n`;

const event1831 = `id: evt_1831_station\ntitle: "18:31 車站事件"\nat: "18:31"\nvariants:\n  - id: wakaharu_dies\n    priority: 100\n    when: { path: characters.wakaharu.location, op: eq, value: old_station }\n    effects:\n      - set: { path: characters.wakaharu.status, value: dead }\n    delayed_effects:\n      - id: reporter_missing_after_wakaharu_death\n        delay_minutes: 163\n        effects:\n          - emit_event: { event_id: evt_2114_reporter_missing }\n  - id: doctor_dies\n    priority: 90\n    when: { path: characters.doctor.location, op: eq, value: old_station }\n    effects:\n      - set: { path: characters.doctor.status, value: dead }\n  - id: no_death\n    priority: 0\n    fallback: true\n    effects:\n      - add_flag: world.anomaly_1831_observed\n`;

const event1831WithNinetyMinuteDelay = event1831.replace('delay_minutes: 163', 'delay_minutes: 90');

const event2114 = `id: evt_2114_reporter_missing\ntitle: "21:14 記者失蹤"\nvariants:\n  - id: reporter_missing\n    priority: 0\n    fallback: true\n    effects:\n      - set: { path: characters.reporter.status, value: missing }\n`;

function responseFor(path: string, actionsYaml = actions, stationEventYaml = event1831) {
  const text = path.includes('/world/') ? initial
    : path.includes('/actions/') ? actionsYaml
    : path.includes('2114') ? event2114
    : stationEventYaml;
  return { ok: true, text: async () => text };
}

afterEach(() => vi.restoreAllMocks());

describe('App', () => {
  it('orders same-time player milestones by canonical action definition order', () => {
    const { container } = render(<StoryOrder entries={[
      {
        time: '18:20',
        durationMinutes: 0,
        endTime: '18:20',
        eventId: 'stop_doctor',
        title: '阻止醫生前往舊車站',
        source: 'player',
        hasImmediateStateChange: true,
      },
      {
        time: '18:20',
        durationMinutes: 0,
        endTime: '18:20',
        eventId: 'protect_wakaharu',
        title: '阻止若晴前往舊車站',
        source: 'player',
        hasImmediateStateChange: true,
      },
      {
        time: '18:20',
        durationMinutes: 5,
        endTime: '18:25',
        eventId: 'make_coffee',
        title: '泡咖啡',
        source: 'player',
        hasImmediateStateChange: false,
      },
      { time: '18:20', eventId: 'make_coffee', title: '泡咖啡', source: 'player' },
      { time: '18:20', eventId: 'protect_wakaharu', title: '阻止若晴前往舊車站', source: 'player' },
      { time: '18:20', eventId: 'stop_doctor', title: '阻止醫生前往舊車站', source: 'player' },
    ]} />);

    const labels = [...container.querySelectorAll('.story-milestone strong')]
      .map((element) => element.textContent);
    expect(labels).toEqual(['泡咖啡', '阻止若晴前往舊車站', '阻止醫生前往舊車站']);
  });

  it('opens on a readable story editor instead of the technical graph', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());

    expect(screen.getByRole('heading', { name: '改變條件' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '套用並比較世界線' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Event Graph' })).toBeNull();
  });

  it('keeps distinct same-time event milestones', () => {
    const { container } = render(<StoryOrder entries={[
      { time: '18:22', eventId: 'event_a', title: '18:22 事件甲', source: 'event' },
      { time: '18:22', eventId: 'event_b', title: '18:22 事件乙', source: 'event' },
    ]} />);

    expect(container.querySelectorAll('.story-milestone strong')).toHaveLength(2);
    expect(container.textContent).toContain('事件甲');
    expect(container.textContent).toContain('事件乙');
  });

  it('keeps same-time player actions and a selected duration interval in story order', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());

    const left = screen.getByRole('group', { name: '世界線 A' });
    fireEvent.click(within(left).getByRole('checkbox', { name: '泡咖啡' }));
    fireEvent.click(screen.getByRole('button', { name: '套用並比較世界線' }));

    const storyOrder = screen.getByRole('heading', { name: '故事順序' }).closest('section');
    if (!storyOrder) throw new Error('Expected story order section');
    for (const label of ['泡咖啡', '阻止若晴前往舊車站', '阻止醫生前往舊車站', '前往旅館']) {
      expect(within(storyOrder).getByText(label)).toBeTruthy();
    }
    expect(within(storyOrder).getByText('18:20–18:25')).toBeTruthy();
  });

  it('applies draft worldline changes only after explicit simulation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());

    const right = screen.getByRole('group', { name: '世界線 B' });
    fireEvent.click(within(right).getByRole('checkbox', { name: '阻止若晴前往舊車站' }));

    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getAllByText('若晴死亡').length).toBeGreaterThan(0);
    expect(screen.queryByText('醫生死亡')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '套用並比較世界線' }));
    expect(screen.getByText('醫生死亡')).toBeTruthy();
  });

  it('compares two independently configured worldlines including delayed consequences', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());

    const left = screen.getByRole('group', { name: '世界線 A' });
    const right = screen.getByRole('group', { name: '世界線 B' });
    fireEvent.click(within(left).getByRole('checkbox', { name: '阻止醫生前往舊車站' }));
    fireEvent.click(within(right).getByRole('checkbox', { name: '阻止若晴前往舊車站' }));
    fireEvent.click(within(right).getByRole('checkbox', { name: '阻止醫生前往舊車站' }));
    fireEvent.click(screen.getByRole('button', { name: '套用並比較世界線' }));

    fireEvent.click(screen.getByRole('button', { name: 'Worldline Diff' }));
    expect(screen.getByRole('heading', { name: 'Worldline Diff' })).toBeTruthy();
    expect(screen.getByText(/21:14 記者失蹤/)).toBeTruthy();
    expect(screen.getByText('18:31 若晴死亡')).toBeTruthy();
    expect(screen.queryByText('21:14 若晴死亡')).toBeNull();
    expect(screen.getAllByText('未發生').length).toBeGreaterThan(0);
  });

  it('keeps a selected empty-effect action visible as an interval after simulation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());

    const left = screen.getByRole('group', { name: '世界線 A' });
    fireEvent.click(within(left).getByRole('checkbox', { name: '泡咖啡' }));
    fireEvent.click(screen.getByRole('button', { name: '套用並比較世界線' }));

    const timeline = screen.getByRole('table', { name: '世界線時間線' });
    expect(within(timeline).getByText('泡咖啡')).toBeTruthy();
    expect(within(timeline).getByText('18:20–18:25')).toBeTruthy();
    expect(within(timeline).getByText('沒有立即狀態變化')).toBeTruthy();
  });

  it('does not overwrite multiple zero-duration actions at the same time', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());

    const left = screen.getByRole('group', { name: '世界線 A' });
    fireEvent.click(within(left).getByRole('checkbox', { name: '阻止若晴前往舊車站' }));
    fireEvent.click(within(left).getByRole('checkbox', { name: '阻止醫生前往舊車站' }));
    fireEvent.click(screen.getByRole('button', { name: '套用並比較世界線' }));

    const timeline = screen.getByRole('table', { name: '世界線時間線' });
    expect(within(timeline).getByText('阻止若晴前往舊車站')).toBeTruthy();
    expect(within(timeline).getByText('阻止醫生前往舊車站')).toBeTruthy();
    expect(within(timeline).getAllByText('立即')).toHaveLength(2);
  });

  it('includes player action intervals in Worldline Diff', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());

    const left = screen.getByRole('group', { name: '世界線 A' });
    fireEvent.click(within(left).getByRole('checkbox', { name: '泡咖啡' }));
    fireEvent.click(screen.getByRole('button', { name: '套用並比較世界線' }));
    fireEvent.click(screen.getByRole('button', { name: 'Worldline Diff' }));

    const comparison = screen.getByRole('table', { name: 'Worldline comparison' });
    const coffeeRow = within(comparison).getByRole('row', { name: /18:20–18:25 泡咖啡/ });
    expect(within(coffeeRow).getByText('18:20–18:25 泡咖啡')).toBeTruthy();
    expect(within(coffeeRow).getByText('未發生')).toBeTruthy();
  });

  it('shows every player action in the causal view with interval and time-flow semantics', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Event Graph' }));

    const graph = screen.getByRole('heading', { name: 'Event Graph' }).closest('section');
    if (!graph) throw new Error('Expected Event Graph section');

    for (const label of ['泡咖啡', '阻止若晴前往舊車站', '阻止醫生前往舊車站', '前往旅館']) {
      expect(within(graph).getByText(label)).toBeTruthy();
    }

    const coffeeBranch = within(graph).getByText('泡咖啡').closest('article');
    if (!coffeeBranch) throw new Error('Expected coffee causal branch');
    expect(within(coffeeBranch).getByText('18:20–18:25')).toBeTruthy();
    expect(within(coffeeBranch).getByText('無立即狀態變化')).toBeTruthy();
    expect(within(coffeeBranch).getByText('時間流逝')).toBeTruthy();
    expect(within(coffeeBranch).getByText('+11 分鐘')).toBeTruthy();
    expect(within(coffeeBranch).queryByText('↓')).toBeNull();
    expect(within(coffeeBranch).getByText('車站事件')).toBeTruthy();
    expect(within(coffeeBranch).getByText(/若晴死亡/)).toBeTruthy();
    expect(within(coffeeBranch).getByText('延遲效果')).toBeTruthy();

    const noOpPointBranch = within(graph).getByText('前往旅館').closest('article');
    if (!noOpPointBranch) throw new Error('Expected zero-duration no-op causal branch');
    expect(within(noOpPointBranch).getByText('時間流逝')).toBeTruthy();
    expect(within(noOpPointBranch).queryByText('↓')).toBeNull();
  });

  it('places a later player action after earlier graph events with a neutral connector', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (
      responseFor(String(input), actionAfterExistingEvents)
    )));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Event Graph' }));

    const graph = screen.getByRole('heading', { name: 'Event Graph' }).closest('section');
    if (!graph) throw new Error('Expected Event Graph section');
    const branch = within(graph).getByText('深夜散步').closest('article');
    if (!branch) throw new Error('Expected late-action causal branch');
    const earlierEvent = within(branch).getByText('18:31');
    const actionNode = within(branch).getByText('深夜散步').closest('div');
    if (!actionNode) throw new Error('Expected late-action node');
    const laterAction = within(actionNode).getByText('21:30');
    expect(earlierEvent.compareDocumentPosition(laterAction) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(branch).getByText('時間推進至玩家行動')).toBeTruthy();
    expect(within(branch).queryByText('造成狀態變化')).toBeNull();
    expect(within(branch).queryByText('↓')).toBeNull();
    expect(within(graph).getByText('玩家行動依時間進入故事，節點順序依實際時間排列。')).toBeTruthy();
    expect(within(graph).queryByText('每個選擇都會送進同一個 18:31 車站事件。')).toBeNull();
  });

  it('renders malformed action effects as an editor error instead of crashing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (
      responseFor(String(input), actionsWithMalformedEffects)
    )));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '改變條件' })).toBeTruthy());
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('checkbox', { name: '設定損壞' })).toHaveLength(2);
  });

  it('renders invalid action timing as an editor error instead of crashing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (
      responseFor(String(input), actionsWithInvalidTiming)
    )));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '改變條件' })).toBeTruthy());
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('checkbox', { name: '超出當日' })).toHaveLength(2);
  });

  it('renders missing action timing as an editor error instead of crashing', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (
      responseFor(String(input), actionsWithMissingTiming)
    )));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '改變條件' })).toBeTruthy());
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('checkbox', { name: '缺少時間' })).toHaveLength(2);
  });

  it('derives consequence delay labels from timestamps and omits zero-length labels', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (
      responseFor(String(input), actions, event1831WithNinetyMinuteDelay)
    )));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Event Graph' }));

    const graph = screen.getByRole('heading', { name: 'Event Graph' }).closest('section');
    if (!graph) throw new Error('Expected Event Graph section');
    const coffeeBranch = within(graph).getByText('泡咖啡').closest('article');
    if (!coffeeBranch) throw new Error('Expected coffee causal branch');
    expect(within(coffeeBranch).getByText('+90 分鐘')).toBeTruthy();
    expect(within(coffeeBranch).queryByText('+163 分鐘')).toBeNull();
    expect(within(coffeeBranch).queryByText('+ 分鐘')).toBeNull();
  });

  it('sorts selected actions by time even when they are selected in reverse', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());

    const left = screen.getByRole('group', { name: '世界線 A' });
    fireEvent.click(within(left).getByRole('checkbox', { name: '前往旅館' }));
    fireEvent.click(within(left).getByRole('checkbox', { name: '泡咖啡' }));
    fireEvent.click(screen.getByRole('button', { name: '套用並比較世界線' }));

    expect(within(left).queryByRole('alert')).toBeNull();
    const timeline = screen.getByRole('table', { name: '世界線時間線' });
    expect(within(timeline).getByText('泡咖啡')).toBeTruthy();
    expect(within(timeline).getByText('前往旅館')).toBeTruthy();
  });

  it('shows a source-order timing conflict, preserves drafts, and clears it after a valid retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '故事順序' })).toBeTruthy());

    const left = screen.getByRole('group', { name: '世界線 A' });
    const right = screen.getByRole('group', { name: '世界線 B' });
    const coffee = within(left).getByRole('checkbox', { name: '泡咖啡' });
    const protect = within(left).getByRole('checkbox', { name: '阻止若晴前往舊車站' });

    fireEvent.click(protect);
    fireEvent.click(coffee);
    fireEvent.click(within(right).getByRole('checkbox', { name: '阻止醫生前往舊車站' }));
    fireEvent.click(screen.getByRole('button', { name: '套用並比較世界線' }));

    const conflict = within(left).getByRole('alert');
    expect(conflict.textContent).toContain('阻止若晴前往舊車站');
    expect(conflict.textContent).toContain('18:20');
    expect(conflict.textContent).toContain('18:25');
    expect((protect as HTMLInputElement).checked).toBe(true);
    expect((coffee as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('button', { name: '套用並比較世界線' })).toBeTruthy();
    expect(within(screen.getByRole('table', { name: '世界線時間線' })).getByText('阻止醫生前往舊車站')).toBeTruthy();

    fireEvent.click(coffee);
    fireEvent.click(screen.getByRole('button', { name: '套用並比較世界線' }));

    expect(within(left).queryByRole('alert')).toBeNull();
    expect((protect as HTMLInputElement).checked).toBe(true);
  });

  it('keeps the editor available when an individual causal probe fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input), actionsWithInvalidCausalProbe)));
    render(<App />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '改變條件' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Event Graph' }));

    expect(screen.getByRole('button', { name: '套用並比較世界線' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('搭上早班車');
  });

  it('shows a readable load error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })));
    render(<App />);
    await waitFor(() => expect(screen.getByText('無法載入故事資料')).toBeTruthy());
  });
});
