import type { StoryTime, StoryTimeInput } from './types';

const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function parseTime(time: string): number {
  if (!TIME_RE.test(time)) throw new Error(`Invalid time: ${time}`);
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function formatTime(minuteOfDay: number): string {
  if (!Number.isInteger(minuteOfDay) || minuteOfDay < 0 || minuteOfDay >= 24 * 60) {
    throw new Error(`Invalid minute-of-day: ${minuteOfDay}`);
  }
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function toAbsoluteMinute(input: StoryTimeInput): number {
  const value = typeof input === 'string' ? { day: 0, time: input } : input;
  if (!Number.isInteger(value.day) || value.day < 0) {
    throw new Error(`Invalid story day: ${value.day}`);
  }
  return value.day * 24 * 60 + parseTime(value.time);
}

export function fromAbsoluteMinute(value: number): StoryTime {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid absolute minute: ${value}`);
  }
  const day = Math.floor(value / (24 * 60));
  return { day, time: formatTime(value % (24 * 60)) };
}

export function formatStoryTime(input: StoryTimeInput): string {
  const value = fromAbsoluteMinute(toAbsoluteMinute(input));
  return `D${value.day} ${value.time}`;
}
