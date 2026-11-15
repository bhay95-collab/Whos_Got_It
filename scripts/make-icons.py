"""Builds every home-screen icon from public/icons/source.webp (the master artwork).
Dev tool only. Needs: pip install pillow numpy.   Run: python3 scripts/make-icons.py
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'icons'
src = Image.open(OUT / 'source.webp').convert('RGB')

# The master image is a rounded tile on white. Tile edges, measured from the file:
TILE = (58, 53, 1196, 1191)   # tile edges (42,37)-(1212,1207) pulled in ~15px to drop the bevel highlight
tile = src.crop(TILE)                       # 1170 x 1170, rounded corners still white
T = tile.size[0]

def squircle_mask(size, n=5.0, inset=2):
    """Anti-aliased superellipse alpha (iOS-style corners)."""
    ss = 4
    s = size * ss
    y, x = np.mgrid[0:s, 0:s]
    u = (x + 0.5 - s / 2) / (s / 2 - inset * ss)
    v = (y + 0.5 - s / 2) / (s / 2 - inset * ss)
    m = (np.abs(u) ** n + np.abs(v) ** n <= 1).astype(np.float32)
    m = m.reshape(size, ss, size, ss).mean(axis=(1, 3))
    return Image.fromarray((m * 255).astype(np.uint8), 'L')

def rounded(size):
    img = tile.resize((size, size), Image.LANCZOS).convert('RGBA')
    img.putalpha(squircle_mask(size))
    return img

# Full-bleed square: crop well inside the tile (clear of the rounded corners), then grow the
# cream background outward with a smooth gradient so the artwork can sit inside a safe zone.
inner = tile.crop((100, 100, T - 100, T - 100))      # ~938 px square, clear of the rounded corners
def full_bleed(size, artwork_fraction):
    from PIL import ImageFilter
    canvas_px = int(round(inner.size[0] / artwork_fraction))
    pad = (canvas_px - inner.size[0]) // 2
    a = np.asarray(inner).astype(np.float32)
    # 1) find the artwork (coral) and its soft shadow, and paint it out to leave only the cream lighting
    art = ((a[..., 0] - a[..., 2]) > 26).astype(np.uint8) * 255
    art = Image.fromarray(art, 'L').filter(ImageFilter.MaxFilter(61))
    keep = 1.0 - np.asarray(art, np.float32) / 255.0
    def blur(ch, r):
        x = np.arange(-3 * r, 3 * r + 1); k = np.exp(-x * x / (2 * r * r)); k /= k.sum()
        for axis in (0, 1):
            ch = np.apply_along_axis(lambda v: np.convolve(np.pad(v, 3 * r, mode='edge'), k, mode='valid'), axis, ch)
        return ch
    mean = (a * keep[..., None]).sum((0, 1)) / keep.sum()
    def fill(r):
        d = blur(keep, r)
        return np.stack([blur(a[..., i] * keep, r) for i in range(3)], -1) / np.maximum(d, 1e-6)[..., None], d
    near, d1 = fill(40)
    far, d2 = fill(160)
    clean = np.where((d1 > 0.08)[..., None], near, np.where((d2 > 0.02)[..., None], far, mean))
    clean = np.where(keep[..., None] > 0.5, a, clean)
    # 2) grow that cream outward by repeating its edge, then soften
    grown = np.pad(clean, ((pad, canvas_px - inner.size[0] - pad),) * 2 + ((0, 0),), mode='edge')
    canvas = Image.fromarray(np.clip(grown, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(40))
    # 3) lay the real artwork back on top with a short feather
    feather = 28
    ramp = np.ones(inner.size, np.float32)
    for i in range(feather):
        t = (i + 1) / feather
        ramp[i, :] = np.minimum(ramp[i, :], t); ramp[-1 - i, :] = np.minimum(ramp[-1 - i, :], t)
        ramp[:, i] = np.minimum(ramp[:, i], t); ramp[:, -1 - i] = np.minimum(ramp[:, -1 - i], t)
    canvas.paste(inner, (pad, pad), Image.fromarray((ramp * 255).astype(np.uint8), 'L'))
    return canvas.resize((size, size), Image.LANCZOS)

full_bleed(180, 0.86).save(OUT / 'apple-touch-icon.png')     # iOS rounds the corners itself
full_bleed(512, 0.62).save(OUT / 'icon-maskable-512.png')    # artwork inside the 80% safe circle
rounded(192).save(OUT / 'icon-192.png')
rounded(512).save(OUT / 'icon-512.png')
rounded(32).save(OUT / 'favicon-32.png')
print('icons written to', OUT)
