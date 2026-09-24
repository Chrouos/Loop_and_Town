import type { TravelEdgeDefinition } from '../narrative/types';

export type PlannedTravel = {
  from: string;
  to: string;
  departMinute: number;
  arriveMinute: number;
  durationMinutes: number;
};

export function planTravel(
  edges: TravelEdgeDefinition[],
  from: string,
  to: string,
  departMinute: number,
): PlannedTravel {
  const edge = edges.find((item) => item.from === from && item.to === to);
  if (!edge) throw new Error(`No authored travel route: ${from} -> ${to}`);
  return {
    from,
    to,
    departMinute,
    arriveMinute: departMinute + edge.minutes,
    durationMinutes: edge.minutes,
  };
}
