import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

const initial = `clock:\n  day: 1\n  time: "18:20"\ncharacters:\n  wakaharu: { location: old_station, status: alive }\n  doctor: { location: old_station, status: alive }\n  reporter: { location: hotel, status: alive }\nworld:\n  anomaly_1831_observed: false\nflags:\n  player_protected_wakaharu: false\n  player_stopped_doctor: false\n`;

const actions = `actions:\n  - id: protect_wakaharu\n    at: "18:20"\n    label: 阻止若晴前往舊車站\n    effects:\n      - set: { path: characters.wakaharu.location, value: home }\n      - add_flag: flags.player_protected_wakaharu\n  - id: stop_doctor\n    at: "18:20"\n    label: 阻止醫生前往舊車站\n    effects:\n      - set: { path: characters.doctor.location, value: clinic }\n      - add_flag: flags.player_stopped_doctor\n`;

const event1831 = `id: evt_1831_station\ntitle: "18:31 車站事件"\nat: "18:31"\nvariants:\n  - id: wakaharu_dies\n    priority: 100\n    when: { path: characters.wakaharu.location, op: eq, value: old_station }\n    effects:\n      - set: { path: characters.wakaharu.status, value: dead }\n    delayed_effects:\n      - id: reporter_missing_after_wakaharu_death\n        delay_minutes: 163\n        effects:\n          - emit_event: { event_id: evt_2114_reporter_missing }\n  - id: doctor_dies\n    priority: 90\n    when: { path: characters.doctor.location, op: eq, value: old_station }\n    effects:\n      - set: { path: characters.doctor.status, value: dead }\n  - id: no_death\n    priority: 0\n    fallback: true\n    effects:\n      - add_flag: world.anomaly_1831_observed\n`;

const event2114 = `id: evt_2114_reporter_missing\ntitle: "21:14 記者失蹤"\nvariants:\n  - id: reporter_missing\n    priority: 0\n    fallback: true\n    effects:\n      - set: { path: characters.reporter.status, value: missing }\n`;

function responseFor(path: string) {
  const text = path.includes('/world/') ? initial
    : path.includes('/actions/') ? actions
    : path.includes('2114') ? event2114
    : event1831;
  return { ok: true, text: async () => text };
}

afterEach(() => vi.restoreAllMocks());

describe('App', () => {
  it('applies draft worldline changes only after explicit simulation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByText(/Loaded: evt_1831_station/)).toBeTruthy());

    const right = screen.getByRole('group', { name: '世界線 B' });
    fireEvent.click(within(right).getByRole('checkbox', { name: '阻止若晴前往舊車站' }));

    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    expect(screen.getByText('wakaharu_dies')).toBeTruthy();
    expect(screen.queryByText('doctor_dies')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '重算世界線' }));
    expect(screen.getByText('doctor_dies')).toBeTruthy();
  });

  it('compares two independently configured worldlines including delayed consequences', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => responseFor(String(input))));
    render(<App />);

    await waitFor(() => expect(screen.getByText(/Loaded: evt_1831_station/)).toBeTruthy());

    const left = screen.getByRole('group', { name: '世界線 A' });
    const right = screen.getByRole('group', { name: '世界線 B' });
    fireEvent.click(within(left).getByRole('checkbox', { name: '阻止醫生前往舊車站' }));
    fireEvent.click(within(right).getByRole('checkbox', { name: '阻止若晴前往舊車站' }));
    fireEvent.click(within(right).getByRole('checkbox', { name: '阻止醫生前往舊車站' }));
    fireEvent.click(screen.getByRole('button', { name: '重算世界線' }));

    fireEvent.click(screen.getByRole('button', { name: 'Worldline Diff' }));
    expect(screen.getByRole('heading', { name: 'Worldline Diff' })).toBeTruthy();
    expect(screen.getByText(/21:14 記者失蹤/)).toBeTruthy();
    expect(screen.getByText('未發生')).toBeTruthy();
  });

  it('shows a readable load error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })));
    render(<App />);
    await waitFor(() => expect(screen.getByText('無法載入 Event Graph')).toBeTruthy());
  });
});
