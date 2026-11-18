"""Cut each of the game's typefaces down to the characters it has to show, as self-hosted woff2 files.

Google Fonts splits a CJK font into ~100 unicode-range slices and fetches each one the first time a
character from it appears. Until that slice lands the line shows in a fallback font, then swaps, so
text visibly changes face mid-scene (worst on a phone). One file per face, holding every character
that face is used for and loaded before the game starts (src/main.tsx), never swaps.

The faces (docs/design.md §3.1): every voice in the story is one hand, and only what is not a person has its own:

  LXGW WenKai TC       the story: her words, her senses, her thoughts, the people beside her, the past; every character the game can show
  FashionBitmap16      a screen: her phone's reader and the corner clock/place, at 16px steps (cut renamed "Grey Tide Pixel")
  Noto Sans CJK TC L   the world's stamps: the time/place/chapter cards, cold and even
  GenWanMin2 TW EL     the game's own furniture (menus, settings, buttons): a thin Ming, outside the story

The narrower faces fall back to WenKai (never to a system font) for anything outside their cut, and
tests/fontCoverage.test.ts checks that each voice's lines are inside its own cut.

    pip install fonttools brotli pyyaml
    python tools/subset-font.py [fonts-dir]

The source fonts live in tools/fonts-src/ (git-ignored; only the cut woff2 files are committed), all SIL OFL 1.1:
  LXGWWenKaiTC-Regular.ttf     https://github.com/lxgw/LxgwWenkaiTC/releases
  FashionBitmap16_0.092.ttf    https://github.com/scott0107000/FashionBitmap16 (Reserved Font Names)
  NotoSansCJKtc-Light.otf      https://github.com/notofonts/noto-cjk/tree/main/Sans/OTF/TraditionalChinese
  GenWanMin2TW-EL.otf          https://github.com/ButTaiwan/genwan-font/releases, GenWanMin2TW-otf.zip

Run it again whenever the story or UI text gains a new character; the coverage test fails until you do.
"""
from __future__ import annotations

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
# What the cards say besides places and titles: 第N章, 第N次的十月三日, 結局 B (engine/director.ts, script/types.ts).
CARDS = '第一二三四五六七八九十章終次的月日結局'
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


def voices() -> dict[str, set[str]]:
    """Characters the screen (phone reader, clock, the corner's place) and the stamps (card times, places, titles) show."""
    found: dict[str, set[str]] = {'screen': set(), 'stamps': set()}

    def visit(node: dict) -> None:
        if isinstance(node.get('phone'), str):
            found['screen'].update(node['phone'])
        for key in ('place', 'title'):
            if isinstance(node.get(key), str):
                found['stamps'].update(node[key])
        if isinstance(node.get('place'), str):
            found['screen'].update(node['place'])
        for key in TIME_KEYS:
            if isinstance(node.get(key), (str, int)):
                found['screen'].update(str(node[key]))
                found['stamps'].update(str(node[key]))

    for path in STORY:
        walk(yaml.safe_load(path.read_text(encoding='utf-8')), visit)
    return found


def everything() -> set[str]:
    chars = set(EXTRA)
    for path in SOURCES:
        if path.exists():
            chars.update(ch for ch in path.read_text(encoding='utf-8') if ord(ch) >= 0x20)
    return chars


def ui() -> set[str]:
    """Characters the game's own screens show: the code's strings, the credits, and each chapter's title (the chapter list)."""
    chars = set(EXTRA)
    for path in [*SOURCES[len(STORY):]]:
        if path.exists():
            chars.update(ch for ch in path.read_text(encoding='utf-8') if ord(ch) >= 0x20)
    for path in STORY:
        title = yaml.safe_load(path.read_text(encoding='utf-8')).get('title')
        if isinstance(title, str):
            chars.update(title)
    return chars


def rename(font: TTFont, family: str) -> None:
    """A font with Reserved Font Names may not keep them once cut (OFL §3): every name record but the copyright and license."""
    names = {1: family, 2: 'Regular', 3: f'{family};subset', 4: family, 6: family.replace(' ', ''), 16: family, 17: 'Regular'}
    table = font['name']
    for record in list(table.names):
        if record.nameID in names or record.nameID in (18, 21, 22):
            table.removeNames(nameID=record.nameID)
    for name_id, value in names.items():
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)


def cut(source: pathlib.Path, chars: set[str], name: str, family: str | None = None) -> None:
    """`family`: the cut's own name, for a source whose names are reserved."""
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
    if family:
        rename(font, family)
    OUT.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(OUT / f'{name}-subset.woff2'), options)
    (OUT / f'{name}-chars.txt').write_text(''.join(kept), encoding='utf-8')

    size = (OUT / f'{name}-subset.woff2').stat().st_size
    print(f'{name}: {len(kept)} characters, {size / 1024:.0f} KB')
    if missing:
        print(f'  not in {source.name} (falls back): {"".join(missing)}')


def main() -> None:
    fonts = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else GAME / 'tools' / 'fonts-src'
    found = voices()
    marks = set(ASCII) | set(PUNCT)
    cut(fonts / 'LXGWWenKaiTC-Regular.ttf', everything(), 'wenkai-tc')
    cut(fonts / 'FashionBitmap16_0.092.ttf', found['screen'] | marks, 'screen-pixel', family='Grey Tide Pixel')
    cut(fonts / 'NotoSansCJKtc-Light.otf', found['stamps'] | marks | set(CARDS), 'stamps')
    cut(fonts / 'GenWanMin2TW-EL.otf', ui(), 'genwan-min-tw')


if __name__ == '__main__':
    main()
