import { expect, it } from 'vitest';
import { fromAbsoluteMinute, toAbsoluteMinute } from '../src/simulator/time';

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
