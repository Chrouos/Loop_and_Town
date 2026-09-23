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
