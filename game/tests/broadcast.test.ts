import { describe, expect, it } from 'vitest';
import type { AudioEngine } from '../src/audio/engine';
import { BROADCAST_LINES, BROADCAST_TIMES } from '../src/audio/broadcastClips';
import { readable } from '../src/audio/reader';
import { Director } from '../src/engine/director';
import { freshSave, type GameSave } from '../src/engine/save';
import { buildScript } from '../src/script/validate';
import { silentAudio } from './harness';

describe('what the town plays over a loudspeaker', () => {
  // New or changed `via: speaker` lines: run `python tools/render-reader.py --tts melo --python ~/.venvs/melo/bin/python`.
  it('every loudspeaker line in the story has its recording and its speech times', () => {
    const story = Object.values(import.meta.glob('../../story/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>);
    const { script } = buildScript(story.map((source, i) => ({ name: `${i}.yaml`, source })));
    const onDisk = new Set(Object.keys(import.meta.glob('../public/audio/broadcast/*.m4a')).map((path) => path.replace('../public/audio/', '')));
    const lines = new Set<string>();
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== 'object') return;
      const beat = node as { k?: string; via?: string; text?: string };
      if (beat.k === 'line' && beat.via === 'speaker' && beat.text) lines.add(readable(beat.text));
      Object.values(node).forEach(visit);
    };
    for (const scene of script.scenes.values()) visit(scene);
    expect(lines.size).toBeGreaterThan(0);
    expect([...lines].filter((line) => !onDisk.has(BROADCAST_LINES[line] ?? ''))).toEqual([]);
    expect(Object.keys(BROADCAST_TIMES).sort()).toEqual(Object.keys(BROADCAST_LINES).sort());
    for (const [start, end, gaps] of Object.values(BROADCAST_TIMES)) {
      expect(start).toBeLessThan(end);
      expect(gaps.every((gap) => gap > start && gap < end)).toBe(true);
    }
  });

  it('plays the recording from the loudspeaker, moving with it, and the line comes in as it is said', () => {
    const { script, errors } = buildScript([{ name: 'a.yaml', source: `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    beats:
      - { announcer: 下一站，灰潮鎮。, as: 廣播, via: speaker }
      - { man: 烤地瓜喔……燒燒的烤地瓜……, as: 賣烤地瓜的車, at: left, dist: far, to: back-left:far, via: speaker }
      - end: reset
` }]);
    expect(errors).toEqual([]);
    const casts: { text: string; pos: unknown; to: unknown }[] = [];
    const audio: AudioEngine = { ...silentAudio(), broadcast: (text, pos, to) => { casts.push({ text, pos, to }); } };
    let save: GameSave = freshSave();
    save.settings.autoAdvance = true;
    let wall = 0;
    const director = new Director(script, save, { audio, vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => wall });
    director.start();
    const seen = new Map<string, number>();
    for (let i = 0; i < 1200 && seen.size < 2; i++) {
      wall += 50;
      director.tick(50);
      const line = director.view.center;
      if (line && !seen.has(line.text)) seen.set(line.text, line.revealMs);
    }
    expect(casts.map((cast) => cast.text)).toEqual(['下一站，灰潮鎮。', '烤地瓜喔……燒燒的烤地瓜……']);
    expect(casts[1].pos).toMatchObject({ dir: 'left', dist: 'far' });
    expect(casts[1].to).toMatchObject({ dir: 'back-left', dist: 'far' });
    expect(seen.get('下一站，灰潮鎮。')).toBe(Math.round(BROADCAST_TIMES['下一站，灰潮鎮。'][1] * 1000));
  });
});
