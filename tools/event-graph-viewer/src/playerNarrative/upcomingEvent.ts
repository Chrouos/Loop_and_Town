import type { EventDefinition } from '../simulator/types';
import { toAbsoluteMinute } from '../simulator/time';

export type UpcomingWorldEvent = {
  title: string;
  minute: number;
  remainingMinutes: number;
};

export function projectUpcomingWorldEvent(
  events: EventDefinition[],
  currentStoryMinute: number,
): UpcomingWorldEvent | null {
  return events
    .filter((event) => event.visibility !== 'hidden' && event.at !== undefined)
    .map((event) => ({ title: event.title, minute: toAbsoluteMinute(event.at!) }))
    .filter((event) => event.minute > currentStoryMinute)
    .sort((a, b) => a.minute - b.minute)
    .map((event) => ({ ...event, remainingMinutes: event.minute - currentStoryMinute }))[0] ?? null;
}
