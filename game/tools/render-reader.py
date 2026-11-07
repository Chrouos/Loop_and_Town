"""Render her phone's screen reader: every phone line in the story as a clip, flat and through a small speaker.

The game plays these instead of the device's own voice, so every player hears the same reader. A line without a
clip still falls back to the device's voice. Lines with `<心率>` are rendered as the words before and after the
number, plus one clip per number.

    python tools/render-reader.py --tts melo --python ~/.venvs/melo/bin/python
    python tools/render-reader.py --tts say          # local preview only: macOS voices may not be published

Writes public/audio/reader/*.m4a and src/audio/readerClips.ts, and removes clips no line uses any more. A clip
is named after its words, the voice and the effect, so a clip already there is kept and only new lines are rendered.
The clips are committed with the game: render them here, once, whenever a phone line changes; the game only plays
files and never synthesizes at play time. tests/readerClips.test.ts fails while a phone line has no clip.
Needs ffmpeg. The `melo` backend needs an environment with MeloTTS (MIT, https://github.com/myshell-ai/MeloTTS);
`opencc` in that environment is used when present (Traditional → Simplified for the Mandarin front end).
Re-run it whenever a phone line changes; a line without a clip is read by the device's voice until then.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile

GAME = pathlib.Path(__file__).resolve().parent.parent
OUT = GAME / 'public' / 'audio' / 'reader'
MANIFEST = GAME / 'src' / 'audio' / 'readerClips.ts'
CREDITS = GAME / 'public' / 'audio' / 'CREDITS.md'

# The phone's small speaker: narrow band, a little grain (the "B" the user picked).
EFFECT = 'highpass=f=350,lowpass=f=3400,acrusher=bits=10:mix=0.4,volume=1.4'
NUMBERS = range(40, 231)
DIGITS = '零一二三四五六七八九'

VOICES = {
    'melo': 'MeloTTS Chinese（MIT，myshell-ai/MeloTTS）',
    'say': 'PREVIEW-ONLY macOS say（不可公開發佈）',
}


def spoken_number(n: int) -> str:
    """How the reader says a heart rate: 一百五十三, 一百零五, 兩百一十."""
    hundreds, rest = divmod(n, 100)
    tens, ones = divmod(rest, 10)
    out = ''
    if hundreds:
        out += ('兩' if hundreds == 2 else DIGITS[hundreds]) + '百'
        if rest and tens == 0:
            out += '零'
    if tens:
        out += ('' if tens == 1 and not hundreds else DIGITS[tens]) + '十'
    if ones:
        out += DIGITS[ones]
    return out or '零'


def clip_name(text: str, tts: str) -> str:
    key = f'{tts}|{EFFECT}|{text}'
    return 'reader/' + hashlib.sha1(key.encode('utf-8')).hexdigest()[:12] + '.m4a'


def story_lines() -> dict:
    res = subprocess.run(['npx', 'vite-node', 'tools/reader-lines.ts'], cwd=GAME, capture_output=True, text=True, check=True)
    return json.loads(res.stdout.strip().splitlines()[-1])


MELO_WORKER = r'''
import json, sys
import torch
# On a Mac, MeloTTS's BERT picks the GPU (MPS) on its own while the rest runs on the CPU, and the two clash.
torch.backends.mps.is_available = lambda: False
from melo.api import TTS
try:
    from opencc import OpenCC
    to_simple = OpenCC('t2s').convert
except Exception:
    to_simple = lambda s: s
jobs = json.load(sys.stdin)
model = TTS(language='ZH', device='cpu')
speaker = model.hps.data.spk2id['ZH']
for text, path in jobs:
    model.tts_to_file(to_simple(text), speaker, path, speed=1.2, quiet=True)
'''


def synthesize(jobs: list[tuple[str, pathlib.Path]], tts: str, python: str | None) -> None:
    if tts == 'say':
        for text, path in jobs:
            subprocess.run(['say', '-v', 'Meijia', '-r', '230', '--file-format=WAVE', '--data-format=LEI16@22050', '-o', str(path), text], check=True)
        return
    if not python:
        sys.exit('--tts melo needs --python pointing at an environment with MeloTTS installed')
    payload = json.dumps([[text, str(path)] for text, path in jobs], ensure_ascii=False)
    subprocess.run([python, '-c', MELO_WORKER], input=payload, text=True, check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--tts', choices=sorted(VOICES), default='melo')
    ap.add_argument('--python', help='python of the environment that has MeloTTS (for --tts melo)')
    args = ap.parse_args()
    if args.tts == 'say':
        print('!! macOS voices are for personal, non-commercial use: these clips are a local preview and must not be published.', file=sys.stderr)

    data = story_lines()
    texts: dict[str, str] = {}  # spoken text -> clip path
    for line in data['lines']:
        texts[line] = clip_name(line, args.tts)
    templates = []
    for t in data['templates']:
        clips = []
        for part in (t['before'], t['after']):
            # Punctuation alone has nothing to say.
            if part.strip('，。、；：！？…'):
                texts[part] = clip_name(part, args.tts)
                clips.append(texts[part])
            else:
                clips.append('')
        templates.append({'before': t['before'], 'after': t['after'], 'clips': clips})
    numbers = {}
    for n in NUMBERS:
        words = spoken_number(n)
        texts[words] = clip_name(words, args.tts)
        numbers[n] = texts[words]

    OUT.mkdir(parents=True, exist_ok=True)
    missing = [text for text, path in texts.items() if not (GAME / 'public' / 'audio' / path).exists()]
    with tempfile.TemporaryDirectory() as tmp:
        jobs = [(text, pathlib.Path(tmp) / f'{i}.wav') for i, text in enumerate(missing)]
        if jobs:
            synthesize(jobs, args.tts, args.python)
        for text, wav in jobs:
            dest = GAME / 'public' / 'audio' / texts[text]
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-af', EFFECT, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', str(dest)], check=True)

    used = {GAME / 'public' / 'audio' / path for path in texts.values()}
    for old in OUT.glob('*.m4a'):
        if old not in used:
            old.unlink()

    lines = {line: texts[line] for line in data['lines']}
    MANIFEST.write_text('\n'.join([
        '// <generated by tools/render-reader.py — do not edit by hand>',
        "// Her phone's screen reader, pre-rendered: every phone line in the story as a clip under public/audio/reader/.",
        "// A line without a clip is read by the device's own voice instead.",
        '// `voice` names the TTS the clips were made with (credited in public/audio/CREDITS.md).',
        '',
        f'export const READER_VOICE: string | null = {json.dumps(VOICES[args.tts], ensure_ascii=False)};',
        '',
        '/** A whole line (as `readable()` gives it) → its clip. */',
        f'export const READER_LINES: Record<string, string> = {json.dumps(lines, ensure_ascii=False, indent=2)};',
        '',
        '/** Lines with a number filled in at play time (`<心率>`): the words around the number, each its own clip. */',
        f'export const READER_TEMPLATES: {{ before: string; after: string; clips: [string, string] }}[] = {json.dumps(templates, ensure_ascii=False, indent=2)};',
        '',
        '/** The numbers a template can be filled with, read out in Mandarin. */',
        f'export const READER_NUMBERS: Record<number, string> = {json.dumps(numbers, indent=2)};',
        '',
    ]), encoding='utf-8')

    if args.tts == 'melo':
        credit = '- 手機讀屏語音：MeloTTS Chinese（MIT License，https://github.com/myshell-ai/MeloTTS），以 tools/render-reader.py 產生並加上手機喇叭效果。'
        if CREDITS.exists() and credit not in CREDITS.read_text(encoding='utf-8'):
            with CREDITS.open('a', encoding='utf-8') as f:
                f.write('\n' + credit + '\n')
    print(f'{len(texts)} clips ({len(lines)} lines, {len(templates)} templates, {len(numbers)} numbers) with {args.tts}; {len(missing)} rendered now')


if __name__ == '__main__':
    main()
