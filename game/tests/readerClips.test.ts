import { readerClipsFor } from '../src/audio/reader';
import { READER_LINES, READER_NUMBERS, READER_TEMPLATES, READER_VOICE } from '../src/audio/readerClips';
import { buildScript } from '../src/script/validate';

const manifest = {
  lines: { '鬧鐘。十月三日；六點十二分。': 'reader/alarm.m4a' },
  templates: [
    { before: '心率', after: '。', clips: ['reader/rate.m4a', ''] as [string, string] },
    { before: '心率', after: '，過高，已記錄。十八點三十一分。', clips: ['reader/rate.m4a', 'reader/1831.m4a'] as [string, string] },
  ],
  numbers: { 153: 'reader/153.m4a' } as Record<number, string>,
};

describe('her phone reads a line from its pre-rendered clips', () => {
  it('a whole line is one clip, marks for the eye do not matter', () => {
    expect(readerClipsFor('鬧鐘。十月三日；六點十二分。', manifest)).toEqual(['reader/alarm.m4a']);
    expect(readerClipsFor('鬧鐘。|十月三日；六點十二分。', manifest)).toEqual(['reader/alarm.m4a']);
  });

  it('a heart rate is the words before, the number, the words after', () => {
    expect(readerClipsFor('心率 153，過高，已記錄。十八點三十一分。', manifest)).toEqual(['reader/rate.m4a', 'reader/153.m4a', 'reader/1831.m4a']);
    expect(readerClipsFor('心率 153。', manifest)).toEqual(['reader/rate.m4a', 'reader/153.m4a']);
  });

  it('without a clip (or a number out of range) the device reads it instead', () => {
    expect(readerClipsFor('撥號中。', manifest)).toBeNull();
    expect(readerClipsFor('心率 999。', manifest)).toBeNull();
  });

  it('the clips that ship were made with a voice that may be published', () => {
    // `render-reader.py --tts say` is a local preview: macOS voices are licensed for personal use only.
    expect(READER_VOICE ?? '').not.toMatch(/PREVIEW/);
  });

  // Once the clips are rendered, every phone line must have one: the game plays files, it does not synthesize.
  it.runIf(READER_VOICE !== null)('every phone line in the story has its clip on disk', () => {
    const story = Object.values(import.meta.glob('../../story/*.yaml', { query: '?raw', import: 'default', eager: true }) as Record<string, string>);
    const { script } = buildScript(story.map((source, i) => ({ name: `${i}.yaml`, source })));
    const onDisk = new Set(Object.keys(import.meta.glob('../public/audio/reader/*.m4a')).map((path) => path.replace('../public/audio/', '')));
    const missing: string[] = [];
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== 'object') return;
      const beat = node as { k?: string; kind?: string; text?: string };
      if (beat.k === 'line' && beat.kind === 'phone' && beat.text) {
        const text = beat.text.replace('<心率>', '120');
        const clips = readerClipsFor(text, { lines: READER_LINES, templates: READER_TEMPLATES, numbers: READER_NUMBERS });
        if (!clips || clips.some((clip) => !onDisk.has(clip))) missing.push(beat.text);
      }
      Object.values(node).forEach(visit);
    };
    for (const scene of script.scenes.values()) visit(scene);
    // New or changed phone lines: run `python tools/render-reader.py --tts melo --python ~/.venvs/melo/bin/python`.
    expect([...new Set(missing)]).toEqual([]);
  });
});
