"""Cut each of the game's typefaces down to the characters it has to show, as self-hosted woff2 files.

Google Fonts splits a CJK font into ~100 unicode-range slices and fetches each one the first time a
character from it appears. Until that slice lands the line shows in a fallback font, then swaps, so
text visibly changes face mid-scene (worst on a phone). One file per face, holding every character
that face is used for and loaded before the game starts (src/main.tsx), never swaps.

Every voice has its own hand (docs/design.md §3.1):

  LXGW WenKai TC   her narration and thoughts, people beside her, the whole UI: every character the game can show
  Sarasa Fixed TC  the machine: her phone's screen reader and the clock (phone lines, scene times, clock/until)
  Iansui           a voice from before: anything played off a tape, and Zhixia (recordings and memories)

The two narrower faces fall back to WenKai (never to a system font) for anything outside their cut, and
tests/fontCoverage.test.ts checks that each voice's lines are inside its own cut.

    pip install fonttools brotli pyyaml
    python tools/subset-font.py [fonts-dir]

The source fonts live in tools/fonts-src/ (git-ignored; only the cut woff2 files are committed):
  LXGWWenKaiTC-Regular.ttf   https://github.com/lxgw/LxgwWenkaiTC/releases (SIL OFL 1.1)
  SarasaFixedTC-Regular.ttf  https://github.com/be5invis/Sarasa-Gothic/releases, SarasaFixedTC-TTF-*.7z (SIL OFL 1.1)
  Iansui-Regular.ttf         https://github.com/ButTaiwan/iansui/releases (SIL OFL 1.1)

Run it again whenever the story or UI text gains a new character; the coverage test fails until you do.
"""
import pathlib
import sys

import yaml
from fontTools import subset
from fontTools.ttLib import TTFont

GAME = pathlib.Path(__file__).resolve().parent.parent
REPO = GAME.parent
OUT = GAME / 'src' / 'assets' / 'fonts'
STORY = sorted((REPO / 'story').glob('*.yaml'))
SOURCES = [
    *STORY,
    *sorted((GAME / 'src').rglob('*.ts')),
    *sorted((GAME / 'src').rglob('*.tsx')),
    *sorted((GAME / 'src').rglob('*.css')),
    GAME / 'index.html',
    GAME / 'public' / 'audio' / 'CREDITS.md',
]
ASCII = ''.join(chr(c) for c in range(0x20, 0x7F))
# Everything printable in ASCII and the full-width forms, so typed or numbered text never falls back.
EXTRA = ASCII + ''.join(chr(c) for c in range(0xFF01, 0xFF5F)) + '　、。〈〉《》「」『』【】〔〕—…‧·・～'
# What the screen does to a line (engine/text.ts turns a full stop into a full-width space) and the marks any voice uses.
PUNCT = '　、。，．：；？！…—「」『』（）《》〈〉／·・～'
# Keep these in step with tests/fontCoverage.test.ts.
TIME_KEYS = ('time', 'clock', 'until')


def walk(node, visit):
    if isinstance(node, dict):
        visit(node)
        for value in node.values():
            walk(value, visit)
    elif isinstance(node, list):
        for value in node:
            walk(value, visit)


def voices() -> tuple[set[str], set[str]]:
    """Characters the machine (phone reader, clock) and the past (tapes, Zhixia) speak in the story."""
    machine: set[str] = set()
    past: set[str] = set()

    def visit(node: dict) -> None:
        if isinstance(node.get('phone'), str):
            machine.update(node['phone'])
        for key in TIME_KEYS:
            if isinstance(node.get(key), (str, int)):
                machine.update(str(node[key]))
        if node.get('via') == 'tape' or isinstance(node.get('zhixia'), str):
            for key, value in node.items():
                if key != 'via' and isinstance(value, str):
                    past.update(value)

    for path in STORY:
        walk(yaml.safe_load(path.read_text(encoding='utf-8')), visit)
    return machine, past


def everything() -> set[str]:
    chars = set(EXTRA)
    for path in SOURCES:
        if path.exists():
            chars.update(ch for ch in path.read_text(encoding='utf-8') if ord(ch) >= 0x20)
    return chars


def cut(source: pathlib.Path, chars: set[str], name: str) -> None:
    cmap = TTFont(source, lazy=True).getBestCmap()
    chars = {ch for ch in chars if ord(ch) >= 0x20}
    kept = sorted(ch for ch in chars if ord(ch) in cmap)
    missing = sorted(ch for ch in chars if ord(ch) not in cmap and ord(ch) > 0x7F)

    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    font = subset.load_font(str(source), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[ord(ch) for ch in kept])
    subsetter.subset(font)
    OUT.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(OUT / f'{name}-subset.woff2'), options)
    (OUT / f'{name}-chars.txt').write_text(''.join(kept), encoding='utf-8')

    size = (OUT / f'{name}-subset.woff2').stat().st_size
    print(f'{name}: {len(kept)} characters, {size / 1024:.0f} KB')
    if missing:
        print(f'  not in {source.name} (falls back): {"".join(missing)}')


def main() -> None:
    fonts = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else GAME / 'tools' / 'fonts-src'
    machine, past = voices()
    cut(fonts / 'LXGWWenKaiTC-Regular.ttf', everything(), 'wenkai-tc')
    cut(fonts / 'SarasaFixedTC-Regular.ttf', machine | set(ASCII) | set(PUNCT), 'sarasa-fixed-tc')
    cut(fonts / 'Iansui-Regular.ttf', past | set(ASCII) | set(PUNCT), 'iansui')


if __name__ == '__main__':
    main()
