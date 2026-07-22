#!/usr/bin/env python3
"""Bake the site's provenance watermark into a photo.

Matches the diagonal, semi-transparent "Z&Z STROTEC · zzstrotec.com" mark that
commit fac94ba applied to the original 15 site images, so newly added photos
stay visually consistent with them.

Usage:  python3 scripts/watermark.py photo/some-image.jpg [more.jpg ...]

Keep a clean copy in photo/_original/ (gitignored) before running — the mark is
baked into the JPEG and cannot be removed afterwards.
"""
import sys
import os
from PIL import Image, ImageDraw, ImageFont

TEXT = "Z&Z STROTEC · zzstrotec.com"
ANGLE = 30          # degrees counter-clockwise, matching the existing images
OPACITY = 14        # 0-255 white; deliberately near the noise floor, like the
                    # existing images where the mark only reads once you look
FONT_RATIO = 0.010  # cap height relative to image width (~14px on a 1400px image)
GAP_X = 3.6         # horizontal tile spacing, in multiples of the text width
GAP_Y = 7.0         # vertical tile spacing, in multiples of the text height
QUALITY = 88

# Environment overrides, so the mark can be tuned per image without editing
# this file:  WM_OPACITY=18 python3 scripts/watermark.py photo/x.jpg
OPACITY = int(os.environ.get("WM_OPACITY", OPACITY))
GAP_X = float(os.environ.get("WM_GAP_X", GAP_X))
GAP_Y = float(os.environ.get("WM_GAP_Y", GAP_Y))

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica.ttf",
    "/Library/Fonts/Arial.ttf",
]


def _font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def watermark(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size

    font = _font(max(11, round(w * FONT_RATIO)))
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    x0, y0, x1, y1 = probe.textbbox((0, 0), TEXT, font=font)
    tw, th = x1 - x0, y1 - y0

    # Draw the tiled text on a layer big enough that rotating it still covers
    # the whole frame, then rotate and centre-crop back to the image size.
    diag = int((w ** 2 + h ** 2) ** 0.5) + max(tw, th) * 2
    layer = Image.new("RGBA", (diag, diag), (255, 255, 255, 0))
    draw = ImageDraw.Draw(layer)

    step_x, step_y = int(tw * GAP_X), int(th * GAP_Y)
    row = 0
    for y in range(0, diag, step_y):
        # Offset alternate rows so the marks do not line up in columns.
        offset = (step_x // 2) if row % 2 else 0
        for x in range(-step_x, diag, step_x):
            draw.text((x + offset, y), TEXT, font=font,
                      fill=(255, 255, 255, OPACITY))
        row += 1

    layer = layer.rotate(ANGLE, resample=Image.BICUBIC)
    left, top = (diag - w) // 2, (diag - h) // 2
    layer = layer.crop((left, top, left + w, top + h))

    out = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
    out.save(path, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return w, h, font.size


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for p in sys.argv[1:]:
        w, h, fs = watermark(p)
        print(f"watermarked {p}  ({w}x{h}, font {fs}px)")
