#!/usr/bin/env python3
"""Compose HUGINN banner + social card from SINDRI art.

Type is set here, not by the image model: diffusion lettering is unreliable and a
repo banner with a mangled wordmark is worse than no banner.

  python3 scripts/make-banner.py art.png --out docs/banner.png
"""
import argparse
from PIL import Image, ImageDraw, ImageFont

MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
MONO_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"

# HUGINN palette (src/theme.js). The canvas is pure black because the SINDRI art
# is pure black: any tinted "void" shows up as a rectangular box inside it.
VOID = (0, 0, 0)
TEXT = (226, 232, 240)
DIM = (148, 163, 184)
RAVEN = (14, 165, 233)
FROST = (165, 243, 252)


def tracked(draw, xy, text, font, fill, tracking=0):
    """Draw text with letter-spacing; returns the x end position."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x


def tracked_width(draw, text, font, tracking=0):
    return sum(draw.textlength(c, font=font) for c in text) + tracking * max(len(text) - 1, 0)


def compose(art_path, out_path, size=(1536, 512)):
    art = Image.open(art_path).convert("RGB")
    canvas = Image.new("RGB", size, VOID)

    # Art sits right-of-centre; the left third stays black for the wordmark.
    target_h = size[1]
    scale = target_h / art.height
    art = art.resize((int(art.width * scale), target_h), Image.Resampling.LANCZOS)
    x_off = size[0] - art.width + int(art.width * 0.18)
    canvas.paste(art, (x_off, 0))

    # Fade the art's left edge into the background so there's no seam.
    fade_w = int(size[0] * 0.45)
    strip = Image.new("L", (fade_w, 1))
    strip.putdata([int(255 * (1 - x / fade_w) ** 1.6) for x in range(fade_w)])
    gradient = strip.resize((fade_w, size[1]))
    black = Image.new("RGB", (fade_w, size[1]), VOID)
    canvas.paste(black, (0, 0), gradient)

    draw = ImageDraw.Draw(canvas)
    word_font = ImageFont.truetype(MONO, int(size[1] * 0.20))
    tag_font = ImageFont.truetype(MONO_REG, int(size[1] * 0.042))
    meta_font = ImageFont.truetype(MONO, int(size[1] * 0.030))

    left = int(size[0] * 0.055)
    mid = size[1] * 0.44

    word = "HUGINN"
    w_width = tracked_width(draw, word, word_font, tracking=size[1] * 0.022)
    # glow pass
    for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)):
        tracked(draw, (left + dx, mid - size[1] * 0.16 + dy), word, word_font, (10, 40, 55), size[1] * 0.022)
    tracked(draw, (left, mid - size[1] * 0.16), word, word_font, FROST, size[1] * 0.022)

    rule_y = mid + size[1] * 0.10
    draw.line([(left, rule_y), (left + w_width * 0.98, rule_y)], fill=RAVEN, width=max(2, size[1] // 170))

    tracked(draw, (left, rule_y + size[1] * 0.055), "SAME STORY. EVERY TELLING.",
            tag_font, TEXT, tracking=size[1] * 0.012)

    tracked(draw, (left, rule_y + size[1] * 0.155), "67 OUTLETS · 8 DESKS · ONE STORY AT A TIME",
            meta_font, DIM, tracking=size[1] * 0.008)

    canvas.save(out_path, optimize=True)
    return out_path


def social(art_path, out_path, size=(1280, 640)):
    """GitHub social preview: art up top, wordmark centred underneath."""
    art = Image.open(art_path).convert("RGB")
    canvas = Image.new("RGB", size, VOID)
    band_h = int(size[1] * 0.62)
    art = art.resize((size[0], band_h), Image.Resampling.LANCZOS)
    canvas.paste(art, (0, 0))

    draw = ImageDraw.Draw(canvas)
    word_font = ImageFont.truetype(MONO, 84)
    tag_font = ImageFont.truetype(MONO_REG, 24)
    word = "HUGINN"
    w = tracked_width(draw, word, word_font, 10)
    tracked(draw, ((size[0] - w) / 2, band_h + 40), word, word_font, FROST, 10)
    tag = "SAME STORY. EVERY TELLING."
    t = tracked_width(draw, tag, tag_font, 4)
    tracked(draw, ((size[0] - t) / 2, band_h + 145), tag, tag_font, DIM, 4)
    canvas.save(out_path, optimize=True)
    return out_path


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("art")
    ap.add_argument("--out", default="docs/banner.png")
    ap.add_argument("--social", default="docs/social-preview.png")
    args = ap.parse_args()
    print(compose(args.art, args.out))
    print(social(args.art, args.social))
