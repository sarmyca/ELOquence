"""
One-shot icon generator for ELOquence PWA.

Produces:
  public/icon-192.png         - 192x192, rounded square, purpose: any
  public/icon-512.png         - 512x512, rounded square, purpose: any
  public/icon-maskable-512.png- 512x512, full bleed (safe zone), purpose: maskable
  public/apple-touch-icon.png - 180x180, iOS home screen
  public/favicon.ico          - 32+16 favicon

Run: python frontend/scripts/generate-icons.py
"""
from __future__ import annotations

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WORDLE_GREEN = (106, 170, 100, 255)   # --tile-correct
WORDLE_GREEN_DARK = (94, 152, 89, 255)
WHITE = (255, 255, 255, 255)
WHITE_BG = (255, 255, 255, 255)

PUBLIC = Path(__file__).resolve().parent.parent / "public"


def _find_serif_bold() -> str | None:
    candidates = [
        r"C:\Windows\Fonts\cambriab.ttf",
        r"C:\Windows\Fonts\georgiab.ttf",
        r"C:\Windows\Fonts\timesbd.ttf",
        r"C:\Windows\Fonts\Cambria.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def _draw_letter(img: Image.Image, letter: str, height_ratio: float, color=WHITE) -> None:
    """Center `letter` on the image, sized so its glyph height = height_ratio * img.height."""
    draw = ImageDraw.Draw(img)
    target_h = int(img.height * height_ratio)

    font_path = _find_serif_bold()
    size = target_h
    if font_path:
        # Binary-search font size so glyph height ~= target_h
        lo, hi = 8, img.height
        while lo < hi:
            mid = (lo + hi + 1) // 2
            f = ImageFont.truetype(font_path, mid)
            bbox = f.getbbox(letter)
            h = bbox[3] - bbox[1]
            if h <= target_h:
                lo = mid
            else:
                hi = mid - 1
        size = lo
        font = ImageFont.truetype(font_path, size)
    else:
        font = ImageFont.load_default()

    bbox = font.getbbox(letter)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (img.width - text_w) // 2 - bbox[0]
    y = (img.height - text_h) // 2 - bbox[1]
    draw.text((x, y), letter, fill=color, font=font)


def _rounded_square(size: int, radius_ratio: float, fill) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    r = int(size * radius_ratio)
    draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=r, fill=fill)
    return img


def make_any(size: int) -> Image.Image:
    """White card with a rounded green Wordle tile inside.

    The opaque white background means no Chrome chrome (e.g. the dark
    'Open in app' pill) shows through the rounded corners. On dark UI
    surfaces the white edges read as an intentional app-card.
    """
    img = Image.new("RGBA", (size, size), WHITE_BG)
    inset = int(size * 0.08)
    tile_size = size - 2 * inset
    tile = _rounded_square(tile_size, 0.18, WORDLE_GREEN)
    _draw_letter(tile, "E", 0.68)
    img.paste(tile, (inset, inset), tile)
    return img


def make_maskable(size: int) -> Image.Image:
    """Full bleed green so OS masks (circle/squircle) crop only green.

    The letter sits inside the inner ~80% safe zone so no Android
    launcher ever clips it.
    """
    img = Image.new("RGBA", (size, size), WORDLE_GREEN)
    _draw_letter(img, "E", 0.48)
    return img


def make_apple(size: int) -> Image.Image:
    """iOS auto-rounds corners; full bleed green looks best on dock/home."""
    img = Image.new("RGBA", (size, size), WORDLE_GREEN)
    _draw_letter(img, "E", 0.62)
    return img


def make_favicon_tile(size: int) -> Image.Image:
    """Rounded green tile on a transparent canvas — reads cleanly as a
    tab favicon across browser themes. Used only for favicon.ico."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inset = max(1, int(size * 0.04))
    tile_size = size - 2 * inset
    tile = _rounded_square(tile_size, 0.18, WORDLE_GREEN)
    _draw_letter(tile, "E", 0.66)
    img.paste(tile, (inset, inset), tile)
    return img


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)

    out = {
        "icon-192.png": make_any(192),
        "icon-512.png": make_any(512),
        "icon-maskable-512.png": make_maskable(512),
        "apple-touch-icon.png": make_apple(180),
    }
    for name, img in out.items():
        path = PUBLIC / name
        img.save(path, "PNG", optimize=True)
        print(f"wrote {path}  ({path.stat().st_size:,} bytes)")

    favicon_path = PUBLIC / "favicon.ico"
    make_favicon_tile(32).save(favicon_path, format="ICO", sizes=[(16, 16), (32, 32)])
    print(f"wrote {favicon_path}  ({favicon_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
