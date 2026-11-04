// The echo of each place. She cannot see the room, so its size and walls come to her as the tail every sound
// leaves: a cane tap in the old station hall rings on; in the cafe it is gone at once, soaked up by people and
// cushions. A scene's beds name the place; the engine crossfades to that room's impulse response.

import type { AmbienceId } from './catalog';
import type { ImpulseOpts } from './core';

export type RoomId = 'open' | 'train' | 'home' | 'shop' | 'office' | 'library' | 'tunnel' | 'hall';

/** `wet`: how much of the room comes back (the convolver is normalized, so this is its level). */
export type Room = ImpulseOpts & { wet: number };

export const ROOMS: Record<RoomId, Room> = {
  // Streets, platforms, the square: almost no tail, a far wall answering late.
  open: { seconds: 0.9, brightness: 0.35, damping: 2.2, early: 2, earlySpread: 0.12, preDelay: 0.03, wet: 0.22 },
  // A carriage: seats and windows close on every side.
  train: { seconds: 0.45, brightness: 0.4, damping: 2.6, early: 6, earlySpread: 0.012, preDelay: 0.004, wet: 0.26 },
  // The old house: small rooms, wooden floors, a hallway.
  home: { seconds: 0.75, brightness: 0.45, damping: 2, early: 8, earlySpread: 0.02, preDelay: 0.006, wet: 0.34 },
  // Cafe, clock shop, the noodle place: small and full of soft things.
  shop: { seconds: 0.6, brightness: 0.38, damping: 2.3, early: 8, earlySpread: 0.018, preDelay: 0.005, wet: 0.3 },
  // Hospital corridor, police station, the institute: hard walls, tiled floors.
  office: { seconds: 1.15, brightness: 0.6, damping: 1.4, early: 10, earlySpread: 0.03, preDelay: 0.01, wet: 0.42 },
  // Shelves of paper drink the highs.
  library: { seconds: 1.4, brightness: 0.32, damping: 1.7, early: 6, earlySpread: 0.04, preDelay: 0.014, wet: 0.36 },
  // The maintenance passage: narrow, concrete, bright flutter close by.
  tunnel: { seconds: 2.6, brightness: 0.7, damping: 1, early: 14, earlySpread: 0.025, preDelay: 0.008, wet: 0.72 },
  // The empty station hall: every sound comes back from far away, for a long time.
  hall: { seconds: 3.6, brightness: 0.55, damping: 0.9, early: 10, earlySpread: 0.09, preDelay: 0.035, wet: 0.85 },
};

const AMBIENCE_ROOM: Partial<Record<AmbienceId, RoomId>> = {
  train_interior: 'train',
  platform: 'open',
  street_morning: 'open',
  street_afternoon: 'open',
  street_evening: 'open',
  town_square: 'open',
  construction_far: 'open',
  rain: 'open',
  sea_far: 'open',
  wind_open: 'open',
  tower_square_night: 'open',
  old_house: 'home',
  house_night: 'home',
  room_tone: 'home',
  rain_on_window: 'home',
  clock_shop: 'shop',
  cafe: 'shop',
  restaurant: 'shop',
  hospital: 'office',
  police_office: 'office',
  research_facility: 'office',
  library: 'library',
  maintenance_tunnel: 'tunnel',
  old_station_hall: 'hall',
};

/** Walls beat weather: an indoor bed decides the room over the wind outside it. */
const ENCLOSED: Record<RoomId, number> = { open: 0, train: 1, home: 1, shop: 1, office: 1, library: 1, tunnel: 2, hall: 2 };

/** The room these beds put her in, or null when none of them names a place (keep the last one). */
export function roomFor(beds: readonly AmbienceId[]): RoomId | null {
  let best: RoomId | null = null;
  for (const bed of beds) {
    const room = AMBIENCE_ROOM[bed];
    if (room && (best === null || ENCLOSED[room] > ENCLOSED[best])) best = room;
  }
  return best;
}
