// Recordings whose license (Creative Commons Attribution) requires credit inside the game.
// Everything else in public/audio is CC0; the full list is public/audio/CREDITS.md.
// A test checks that every CC BY line in CREDITS.md has an entry here.

export interface AttributionCredit {
  /** What the player hears it as. */
  readonly use: string;
  readonly title: string;
  readonly author: string;
  readonly url: string;
  readonly license: string;
  readonly licenseUrl: string;
}

export const ATTRIBUTION_CREDITS: readonly AttributionCredit[] = [
  {
    use: '戶外雨聲',
    title: 'Raining City Soundscape at Yuanlin City, recorded during Mandatory Quarantine on June 8th, 2020',
    author: 'SonnySoundOfTaiwan',
    url: 'https://freesound.org/people/SonnySoundOfTaiwan/sounds/522113/',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
  {
    use: '機車發動',
    title: 'CPI Scooter Fast Start and acceleration.wav',
    author: 'loljames',
    url: 'https://freesound.org/people/loljames/sounds/97159/',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
];
