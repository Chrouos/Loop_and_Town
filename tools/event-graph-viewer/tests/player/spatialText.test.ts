import { describe, expect, it } from 'vitest';
import type { NarrativeBlock } from '../../src/narrative/types';
import { compileSpatialScript, frameSpatialScript, nextSpatialDeadline } from '../../src/player/spatialText';

const blocks: NarrativeBlock[] = [
  { type: 'dialogue', speaker: 'protagonist', text: '今天不要去舊車站。' },
  { type: 'dialogue', speaker: 'wakaharu', text: '……為什麼？' },
  { type: 'narration', text: '她把作品集闔起來。' },
];

describe('spatial rhythmic text', () => {
  it('projects speaker position into spatial anchors instead of a stacked chat line', () => {
    const script = compileSpatialScript(blocks);
    expect(script.phrases.map((phrase) => phrase.anchor)).toEqual(['lower-left', 'right', 'center']);
    expect(script.phrases.map((phrase) => phrase.kind)).toEqual(['dialogue', 'dialogue', 'narration']);
  });

  it('reveals complete beats rather than individual characters', () => {
    const script = compileSpatialScript([
      {
        type: 'dialogue',
        speaker: 'wakaharu',
        text: '妳今天真的很奇怪。可是先別問。',
        presentation: { beats: ['妳今天真的很奇怪。', '可是先別問。'], beatMs: 400, pauseAfterMs: 200 },
      },
    ]);

    expect(frameSpatialScript(script, 0).active?.visibleText).toBe('妳今天真的很奇怪。');
    expect(frameSpatialScript(script, 399).active?.visibleText).toBe('妳今天真的很奇怪。');
    expect(frameSpatialScript(script, 400).active?.visibleText).toBe('妳今天真的很奇怪。可是先別問。');
  });

  it('turns the previous phrase into a temporary echo while the next phrase becomes active', () => {
    const script = compileSpatialScript([
      { type: 'dialogue', speaker: 'protagonist', text: '你……', presentation: { beats: ['你……'], beatMs: 300, pauseAfterMs: 100, echoMs: 1000 } },
      { type: 'dialogue', speaker: 'wakaharu', text: '你怎麼會知道？', presentation: { beats: ['你怎麼會知道？'], beatMs: 500, echoMs: 800 } },
    ]);

    const frame = frameSpatialScript(script, 450);
    expect(frame.active?.text).toBe('你怎麼會知道？');
    expect(frame.echoes.map((echo) => echo.text)).toContain('你……');
    expect(frame.echoes[0]?.opacity).toBeLessThan(1);
  });

  it('removes an echo after its echo window instead of retaining chat history', () => {
    const script = compileSpatialScript([
      { type: 'dialogue', speaker: 'protagonist', text: '第一句。', presentation: { beats: ['第一句。'], beatMs: 200, pauseAfterMs: 0, echoMs: 300 } },
      { type: 'dialogue', speaker: 'wakaharu', text: '第二句。', presentation: { beats: ['第二句。'], beatMs: 200, pauseAfterMs: 0, echoMs: 300 } },
    ]);
    expect(frameSpatialScript(script, 250).echoes.map((x) => x.text)).toContain('第一句。');
    expect(frameSpatialScript(script, 600).echoes.map((x) => x.text)).not.toContain('第一句。');
  });

  it('returns the next real-time presentation deadline without altering world time', () => {
    const script = compileSpatialScript([
      { type: 'dialogue', speaker: 'wakaharu', text: 'A。B。', presentation: { beats: ['A。', 'B。'], beatMs: 400, pauseAfterMs: 200, echoMs: 500 } },
    ]);
    expect(nextSpatialDeadline(script, 0)).toBe(400);
    expect(nextSpatialDeadline(script, 400)).toBe(800);
    expect(nextSpatialDeadline(script, 800)).toBe(1000);
  });
});
