"""Cut LXGW WenKai TC down to the characters the game can show, as one self-hosted woff2.

Google Fonts splits a CJK font into ~100 unicode-range slices and fetches each one the first time a
character from it appears. Until that slice lands the line shows in a fallback font, then swaps, so
text visibly changes face mid-scene (worst on a phone). One file holding every character we use,
loaded before the game starts, never swaps.

    pip install fonttools brotli
    python tools/subset-font.py [path/to/LXGWWenKaiTC-Regular.ttf]

Run it again whenever the story or UI text gains a new character; tests/fontCoverage.test.ts fails
until you do. The font: https://github.com/lxgw/LxgwWenkaiTC (SIL OFL 1.1).
"""
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

GAME = pathlib.Path(__file__).resolve().parent.parent
REPO = GAME.parent
OUT = GAME / 'src' / 'assets' / 'fonts'
SOURCES = [
    *sorted((REPO / 'story').glob('*.yaml')),
    *sorted((GAME / 'src').rglob('*.ts')),
    *sorted((GAME / 'src').rglob('*.tsx')),
    *sorted((GAME / 'src').rglob('*.css')),
    GAME / 'index.html',
    GAME / 'public' / 'audio' / 'CREDITS.md',
]
# Everything printable in ASCII and the full-width forms, so typed or numbered text never falls back.
EXTRA = ''.join(chr(c) for c in range(0x20, 0x7F)) + ''.join(chr(c) for c in range(0xFF01, 0xFF5F)) + '　、。〈〉《》「」『』【】〔〕—…‧·・～'


def wanted() -> set[str]:
    chars = set(EXTRA)
    for path in SOURCES:
        if path.exists():
            chars.update(ch for ch in path.read_text(encoding='utf-8') if ord(ch) >= 0x20)
    return chars


def main() -> None:
    source = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path.home() / 'Library/Fonts/LXGWWenKaiTC-Regular.ttf'
    cmap = TTFont(source).getBestCmap()
    chars = wanted()
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
    subset.save_font(font, str(OUT / 'wenkai-tc-subset.woff2'), options)
    (OUT / 'wenkai-tc-chars.txt').write_text(''.join(kept), encoding='utf-8')

    size = (OUT / 'wenkai-tc-subset.woff2').stat().st_size
    print(f'{len(kept)} characters, {size / 1024:.0f} KB')
    if missing:
        print(f'not in LXGW WenKai TC (will use the fallback font): {"".join(missing)}')


if __name__ == '__main__':
    main()
