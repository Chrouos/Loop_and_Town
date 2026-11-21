"""Render her phone's screen reader: every phone line in the story as a clip, flat and through a small speaker.

The device's own voice reads first (flat and robotic, as a phone's reader is); these clips are what plays on a
device that has no Mandarin voice, so the line is never silent. Lines with `<心率>` are rendered as the words before and after the
number, plus one clip per number.

    python tools/render-reader.py --tts melo --python ~/.venvs/melo/bin/python
    python tools/render-reader.py --tts say          # local preview only: macOS voices may not be published

It also renders the recordings the town plays over a loudspeaker (`via: speaker`: the station's announcements, a
number called at the hospital, a van's horn) into public/audio/broadcast/ and src/audio/broadcastClips.ts. A
loudspeaker really does play a recording, so a synthesized voice there is the real thing, unlike a person's voice.

Writes public/audio/reader/*.m4a and src/audio/readerClips.ts, and removes clips no line uses any more. A clip
is named after its words, the voice and the effect, so a clip already there is kept and only new lines are rendered.
The clips are committed with the game: render them here, once, whenever a phone line changes.
tests/readerClips.test.ts fails while a phone line has no clip.
Needs ffmpeg. The `melo` backend needs an environment with MeloTTS (MIT, https://github.com/myshell-ai/MeloTTS);
`opencc` in that environment is used when present (Traditional → Simplified for the Mandarin front end).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import subprocess
import sys
import tempfile

import numpy as np

GAME = pathlib.Path(__file__).resolve().parent.parent
OUT = GAME / 'public' / 'audio' / 'reader'
MANIFEST = GAME / 'src' / 'audio' / 'readerClips.ts'
CREDITS = GAME / 'public' / 'audio' / 'CREDITS.md'

# The phone's small speaker: narrow band, a little grain (the "B" the user picked).
EFFECT = 'highpass=f=350,lowpass=f=3400,acrusher=bits=10:mix=0.4,volume=1.4'
NUMBERS = range(40, 231)

BROADCAST_OUT = GAME / 'public' / 'audio' / 'broadcast'
BROADCAST_MANIFEST = GAME / 'src' / 'audio' / 'broadcastClips.ts'
# The announcer: a ceiling PA in a hall, wide and a little hollow, with the room answering. Calm and even.
STATION = 'highpass=f=220,lowpass=f=5200,aecho=0.85:0.5:90|210:0.25|0.15,volume=1.3'
# A van's horn: a man's voice (pitched down) through a cheap megaphone, narrow, pushed until it breaks up.
HORN = 'asetrate=44100*0.8,aresample=44100,atempo=1.25,highpass=f=450,lowpass=f=3000,acompressor=threshold=0.1:ratio=6,volume=3,alimiter=limit=0.9'
BROADCAST_LEVEL = 'loudnorm=I=-20:TP=-3:LRA=7,aresample=44100'
BROADCAST_SPEED = {'announcer': 1.0}
HORN_SPEED = 1.1
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


def clip_name(text: str, tts: str, effect: str = EFFECT, folder: str = 'reader', speed: float = 1.2) -> str:
    key = f'{tts}|{effect}|{text}' if folder == 'reader' else f'{tts}|{effect}|{BROADCAST_LEVEL}|{speed}|{text}'
    return f'{folder}/' + hashlib.sha1(key.encode('utf-8')).hexdigest()[:12] + '.m4a'


def broadcast_effect(speaker: str) -> str:
    return STATION if speaker == 'announcer' else HORN


def spoken(text: str) -> str:
    """What the TTS is handed: marks drawn for the eye (a trailing-off ……, a cut-off ——) become a breath or nothing."""
    return text.replace('……', '，').replace('…', '，').replace('——', '').replace('—', '').strip('，') or text


def speech_times(path: pathlib.Path) -> list:
    """When the reader is talking in a clip: [first word, last word ends, [the quiet spots between words]], in seconds.
    The game shows a phone line's phrases as the voice reaches them; the quiet spots are where a phrase can start."""
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', str(path), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    hop = 160  # 10 ms
    n = len(x) // hop
    e = 10 * np.log10(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    e = np.convolve(e, np.ones(3) / 3, mode='same')
    voiced = np.nonzero(e > e.max() - 30)[0]
    start, end = int(voiced[0]), int(voiced[-1]) + 1
    gaps = []
    for i in range(start + 5, end - 5):
        before, after = e[max(start, i - 15):i], e[i + 1:min(end, i + 16)]
        # the lowest point within 150 ms either way, at least 12 dB under the words on both sides
        if e[i] <= min(before.min(), after.min()) and min(before.max(), after.max()) - e[i] >= 12:
            gaps.append(round(i / 100, 2))
    return [round(start / 100, 2), round(end / 100, 2), gaps]


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
for text, path, speed in jobs:
    model.tts_to_file(to_simple(text), speaker, path, speed=speed, quiet=True)
'''


def synthesize(jobs: list[tuple[str, pathlib.Path, float]], tts: str, python: str | None) -> None:
    if tts == 'say':
        for text, path, speed in jobs:
            subprocess.run(['say', '-v', 'Meijia', '-r', str(round(190 * speed)), '--file-format=WAVE', '--data-format=LEI16@22050', '-o', str(path), text], check=True)
        return
    if not python:
        sys.exit('--tts melo needs --python pointing at an environment with MeloTTS installed')
    payload = json.dumps([[text, str(path), speed] for text, path, speed in jobs], ensure_ascii=False)
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
    BROADCAST_OUT.mkdir(parents=True, exist_ok=True)
    casts = {}  # spoken text -> (clip path, effect, speed)
    for cast in data['broadcasts']:
        effect = broadcast_effect(cast['speaker'])
        speed = BROADCAST_SPEED.get(cast['speaker'], HORN_SPEED)
        casts[cast['text']] = (clip_name(cast['text'], args.tts, effect, 'broadcast', speed), effect, speed)
    missing_casts = [text for text, (path, _, _) in casts.items() if not (GAME / 'public' / 'audio' / path).exists()]
    with tempfile.TemporaryDirectory() as tmp:
        jobs = [(text, pathlib.Path(tmp) / f'{i}.wav', 1.2) for i, text in enumerate(missing)]
        cast_jobs = [(text, pathlib.Path(tmp) / f'b{i}.wav') for i, text in enumerate(missing_casts)]
        if jobs or cast_jobs:
            synthesize(jobs + [(spoken(text), wav, casts[text][2]) for text, wav in cast_jobs], args.tts, args.python)
        for text, wav, _ in jobs:
            dest = GAME / 'public' / 'audio' / texts[text]
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-af', EFFECT, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', str(dest)], check=True)
        for text, wav in cast_jobs:
            path, effect, _ = casts[text]
            # every broadcast at one level (the game places it by distance), with a short tail so the echo is not cut off
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(wav), '-af', effect + f',{BROADCAST_LEVEL},apad=pad_dur=0.4', '-ac', '1', '-c:a', 'aac', '-b:a', '64k', str(GAME / 'public' / 'audio' / path)], check=True)
    used_casts = {GAME / 'public' / 'audio' / path for path, _, _ in casts.values()}
    for old in BROADCAST_OUT.glob('*.m4a'):
        if old not in used_casts:
            old.unlink()
    cast_times = {text: speech_times(GAME / 'public' / 'audio' / path) for text, (path, _, _) in casts.items()}
    BROADCAST_MANIFEST.write_text('\n'.join([
        '// <generated by tools/render-reader.py — do not edit by hand>',
        '// What the town plays over a loudspeaker (`via: speaker`), pre-rendered under public/audio/broadcast/: the station,',
        '// the hospital calling a number, a van going by. The line comes in on screen as the recording says it.',
        '',
        '/** A line (as `readable()` gives it) → its clip. */',
        f'export const BROADCAST_LINES: Record<string, string> = {json.dumps({t: p for t, (p, _, _) in casts.items()}, ensure_ascii=False, indent=2)};',
        '',
        "/** When each clip is talking: [first word, end of the last, [quiet spots between words]] in seconds. */",
        'export const BROADCAST_TIMES: Record<string, [number, number, number[]]> = {',
        *[f'  {json.dumps(text, ensure_ascii=False)}: {json.dumps(t)},' for text, t in cast_times.items()],
        '};',
        '',
    ]), encoding='utf-8')

    used = {GAME / 'public' / 'audio' / path for path in texts.values()}
    for old in OUT.glob('*.m4a'):
        if old not in used:
            old.unlink()

    lines = {line: texts[line] for line in data['lines']}
    times = {line: speech_times(GAME / 'public' / 'audio' / texts[line]) for line in data['lines']}
    MANIFEST.write_text('\n'.join([
        '// <generated by tools/render-reader.py — do not edit by hand>',
        "// Her phone's screen reader, pre-rendered: every phone line in the story as a clip under public/audio/reader/.",
        "// The device's own voice reads first; a clip plays only where the device has no Mandarin voice.",
        '// `voice` names the TTS the clips were made with (credited in public/audio/CREDITS.md).',
        '',
        f'export const READER_VOICE: string | null = {json.dumps(VOICES[args.tts], ensure_ascii=False)};',
        '',
        '/** A whole line (as `readable()` gives it) → its clip. */',
        f'export const READER_LINES: Record<string, string> = {json.dumps(lines, ensure_ascii=False, indent=2)};',
        '',
        '/** When each line\'s clip is talking: [first word, end of the last, [quiet spots between words]] in seconds. */',
        'export const READER_TIMES: Record<string, [number, number, number[]]> = {',
        *[f'  {json.dumps(line, ensure_ascii=False)}: {json.dumps(t)},' for line, t in times.items()],
        '};',
        '',
        '/** Lines with a number filled in at play time (`<心率>`): the words around the number, each its own clip. */',
        f'export const READER_TEMPLATES: {{ before: string; after: string; clips: [string, string] }}[] = {json.dumps(templates, ensure_ascii=False, indent=2)};',
        '',
        '/** The numbers a template can be filled with, read out in Mandarin. */',
        f'export const READER_NUMBERS: Record<number, string> = {json.dumps(numbers, indent=2)};',
        '',
    ]), encoding='utf-8')

    if args.tts == 'melo':
        for credit in [
            '- 手機讀屏語音：MeloTTS Chinese（MIT License，https://github.com/myshell-ai/MeloTTS），以 tools/render-reader.py 產生並加上手機喇叭效果。',
            '- 車站與醫院廣播、宣傳車喇叭：MeloTTS Chinese（MIT License，https://github.com/myshell-ai/MeloTTS），以 tools/render-reader.py 產生並加上擴音效果。',
        ]:
            if CREDITS.exists() and credit not in CREDITS.read_text(encoding='utf-8'):
                with CREDITS.open('a', encoding='utf-8') as f:
                    f.write('\n' + credit + '\n')
    print(f'{len(texts)} clips ({len(lines)} lines, {len(templates)} templates, {len(numbers)} numbers) with {args.tts}; {len(missing)} rendered now')
    print(f'{len(casts)} broadcasts; {len(missing_casts)} rendered now')


if __name__ == '__main__':
    main()
