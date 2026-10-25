import { describe, expect, it } from 'vitest';
import { CHAPTER_ORDER, type Beat, type Scene } from '../src/script/types';
import { driftClock, heardClock, parseClock, planClock, spokenClock } from '../src/engine/clock';
import { autoplay } from './harness';

const line = (text: string, kind: 'narr' | 'phone' = 'narr'): Beat => ({ k: 'line', kind, speaker: kind === 'phone' ? 'phone' as never : 'me', text });
const scene = (id: string, beats: Beat[], extra: Partial<Scene> = {}): Scene => ({ id, chapter: 'ch01', cast: {}, beats, threads: {}, ...extra });

describe('corner clock', () => {
  it('reads the time her phone says out loud', () => {
    expect(spokenClock('十八點三十分。')).toBe('18:30');
    expect(spokenClock('二十三點五十九分。')).toBe('23:59');
    expect(spokenClock('十月三日。六點十二分。', '06:12')).toBe('06:12');
    expect(spokenClock('八點。', '07:55')).toBe('08:00');
    expect(spokenClock('六點三十一分。', '18:20')).toBe('18:31');
    expect(spokenClock('十八點零三分。')).toBe('18:03');
    expect(spokenClock('如果你第二次看見十八點三十一分，')).toBeNull();
  });

  it('still reads the time when the phone first says why it spoke', () => {
    expect(spokenClock('心率過高，已記錄。十八點三十一分。')).toBe('18:31');
    expect(spokenClock('鬧鐘。十月三日；六點十二分。', '06:12')).toBe('06:12');
    expect(spokenClock('許若晴：六點。', '18:00')).toBeNull();
  });

  it('does not take a time she hears read off a page for the time now', () => {
    expect(heardClock('十八點三十一分。', '09:20')).toBeNull();
    expect(heardClock('十八點三十分。', '18:27')).toBe('18:30');
    expect(heardClock('十八點三十分。', '五年前')).toBeNull();
  });

  it('never walks back when a nearer target was in a branch not taken', () => {
    const here = scene('s', [line('a'), { k: 'if', cond: { op: 'false' }, then: [{ k: 'clock', time: '18:10' }], else: [line('x')] }, line('b')], { time: '18:00' });
    const plan = planClock(here, new Map());
    expect(driftClock(plan, 0, '18:00', 0)).toBe('18:05');
    expect(driftClock(plan, 1, '18:00', 0, '18:05')).toBeUndefined();
    expect(driftClock(plan, 2, '18:00', 0, '18:05')).toBeUndefined();
  });

  it('creeps toward the next named time without reaching it', () => {
    const beats = [line('a'), line('b'), line('c'), { k: 'clock', time: '18:30' } as Beat, line('d')];
    const here = scene('s', beats, { time: '18:20' });
    const plan = planClock(here, new Map([['s', here]]));
    const shown = [0, 1, 2].map((i) => driftClock(plan, i, '18:20', 0));
    expect(shown).toEqual(['18:22', '18:25', '18:27']);
  });

  it('walks slowly toward the next scene and stops a minute short', () => {
    const next = scene('n', [line('x')], { time: '16:10' });
    const here = scene('s', Array.from({ length: 200 }, (_, i) => line(`l${i}`)), { time: '15:30', next: 'n' });
    const plan = planClock(here, new Map([['s', here], ['n', next]]));
    expect(driftClock(plan, 199, '15:30', 0)).toBe('16:09');
    const short = scene('s', [line('a'), line('b'), line('c'), line('d')], { time: '15:30', next: 'n' });
    expect(driftClock(planClock(short, new Map([['n', next]])), 3, '15:30', 0)).toBe('15:32');
  });

  it('does not drift across midnight or out of a memory', () => {
    const next = scene('n', [line('x')], { time: '06:12' });
    const here = scene('s', [line('a'), line('b')], { time: '22:40', next: 'n' });
    expect(driftClock(planClock(here, new Map([['n', next]])), 1, '22:40', 0)).toBeUndefined();
    expect(driftClock(planClock(here, new Map([['n', next]])), 1, '五年前', 0)).toBeUndefined();
  });

  for (const key of CHAPTER_ORDER) {
    it(`never runs backward inside a scene (${key})`, () => {
      const problems: string[] = [];
      let last: { scene?: string; mark: number; minutes: number | null; clock?: string } = { mark: -1, minutes: null };
      autoplay({
        seed: 7, maxLoops: 1, startChapter: key, stopAtChapter: CHAPTER_ORDER[CHAPTER_ORDER.indexOf(key) + 1], attendRate: 0.5,
        observe: (director) => {
          const view = director.view;
          if (view.phase !== 'scene') return;
          const minutes = parseClock(view.clock);
          // Only the script may move the clock backward (a pinned time); creeping never does.
          if (view.sceneId === last.scene && view.clockMark === last.mark && minutes !== null && last.minutes !== null && minutes < last.minutes) {
            problems.push(`${view.sceneId}: ${last.clock} → ${view.clock}`);
          }
          if (view.center?.kind === 'phone') {
            const spoken = heardClock(view.center.text, view.clock);
            if (spoken && spoken !== view.clock) problems.push(`${view.sceneId}: phone says ${spoken}, corner shows ${view.clock}`);
          }
          last = { scene: view.sceneId, mark: view.clockMark, minutes, clock: view.clock };
        },
      });
      expect(problems).toEqual([]);
    });
  }
});
