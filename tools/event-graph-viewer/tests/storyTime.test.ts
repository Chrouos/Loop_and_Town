import { expect, it } from 'vitest';
import { fromAbsoluteMinute, toAbsoluteMinute } from '../src/simulator/time';
import { validateDefinition } from '../src/simulator/validation';

it('orders midnight across days', () => {
  expect(toAbsoluteMinute({ day: 0, time: '23:59' })).toBe(1439);
  expect(toAbsoluteMinute({ day: 1, time: '00:00' })).toBe(1440);
});

it('keeps the legacy string syntax on day zero', () => {
  expect(toAbsoluteMinute('18:31')).toBe(1111);
});

it('converts absolute minutes back to StoryTime', () => {
  expect(fromAbsoluteMinute(1440)).toEqual({ day: 1, time: '00:00' });
});

it('rejects a negative story day', () => {
  expect(() => toAbsoluteMinute({ day: -1, time: '12:00' })).toThrow('Invalid story day');
});

it('rejects an inverted loop range', () => {
  const definition = {
    loop: {
      id: 'loop_test',
      range: {
        start: { day: 1, time: '00:00' },
        end: { day: 0, time: '23:59' },
      },
    },
    actions: [],
    events: [],
  };
  const initialState = { clock: { day: 0, time: '14:20' } };
  expect(() => validateDefinition(definition as never, initialState)).toThrow('Invalid loop range');
});

it('accepts the inclusive loop end and rejects a scheduled event after it', () => {
  const base = {
    loop: {
      id: 'loop_test',
      range: {
        start: { day: 0, time: '14:20' },
        end: { day: 1, time: '00:00' },
      },
    },
    actions: [],
  };
  const initialState = { clock: { day: 0, time: '14:20' } };
  const event = (at: { day: number; time: string }) => ({
    id: 'evt_boundary',
    title: 'boundary',
    at,
    variants: [{ id: 'always', priority: 0, fallback: true, effects: [] }],
  });

  expect(() => validateDefinition({ ...base, events: [event({ day: 1, time: '00:00' })] } as never, initialState)).not.toThrow();
  expect(() => validateDefinition({ ...base, events: [event({ day: 1, time: '00:01' })] } as never, initialState))
    .toThrow('Scheduled event outside loop range: evt_boundary');
});
