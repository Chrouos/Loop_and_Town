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

describe('which phone lines are read aloud', () => {
  it('reads the moments that matter at full level and the rest quietly', async () => {
    const { phoneMatters } = await import('../src/audio/reader');
    for (const line of ['鬧鐘。十八點三十一分。', '十八點零三分。', '心率153，過高，已記錄。十八點三十一分。', '死亡。', '撥號中。一一九。', '一，一，九。撥號中。', '鬧鐘。二十三點五十九分。', '十月四日，零點零分。']) {
      expect(phoneMatters(line), line).toBe(true);
    }
    for (const line of ['鬧鐘。六點十二分。', '周予安傳送了一張圖片。', '許若晴：我在家。', '撥號中。周予安。', '十二點二十分。']) {
      expect(phoneMatters(line), line).toBe(false);
    }
  });

  it('lets a script line say so itself, on a phone line only', async () => {
    const { buildScript } = await import('../src/script/validate');
    const build = (beats: string) => buildScript([{ name: 'a.yaml', source: `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    beats:
${beats}
      - end: reset
` }]);
    const ok = build("      - { phone: 不要再找最好的一天。, loud: true }\n      - { phone: 十八點零三分。, loud: false }");
    expect(ok.errors).toEqual([]);
    const beats = ok.script.scenes.get('s1')!.beats as { loud?: boolean }[];
    expect(beats.slice(0, 2).map((beat) => beat.loud)).toEqual([true, false]);
    expect(build('      - { narr: 雨停了。, loud: true }').errors.join()).toContain('loud 只能用在 phone');
  });
});

describe('the director tells the phone how to read', () => {
  it('passes whether a line matters, and a script line\'s own loud: wins', async () => {
    const { buildScript } = await import('../src/script/validate');
    const { Director } = await import('../src/engine/director');
    const { freshSave } = await import('../src/engine/save');
    const { silentAudio } = await import('./harness');
    const { script, errors } = buildScript([{ name: 'a.yaml', source: `
chapter: 1
title: 測試
start: s1
scenes:
  - id: s1
    beats:
      - phone: 周予安傳送了一張圖片。
      - phone: 鬧鐘。十八點三十一分。
      - { phone: 不要再找最好的一天。, loud: true }
      - { phone: 十八點零三分。, loud: false }
      - end: reset
` }]);
    expect(errors).toEqual([]);
    const said: [string, boolean | undefined][] = [];
    const audio = { ...silentAudio(), speak: (text: string, aloud?: boolean) => { said.push([text, aloud]); } };
    let save = { ...freshSave(), calibrated: true };
    const director = new Director(script, save, { audio, vibrate: () => undefined, persist: (next) => { save = next; }, wallNow: () => 0 }, { speed: 1 });
    director.start();
    for (let i = 0; i < 2000 && said.length < 4; i++) { director.hurry(); director.tick(200); }
    expect(said).toEqual([
      ['周予安傳送了一張圖片。', false],
      ['鬧鐘。十八點三十一分。', true],
      ['不要再找最好的一天。', true],
      ['十八點零三分。', false],
    ]);
  });
});
