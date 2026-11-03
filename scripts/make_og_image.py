"""Generate the default 1200x630 social share image (frontend/public/images/brand/og-default.png).

Uses the clinic's own logo and photo and the real Google rating from content/clinic.json.
Run: python scripts/make_og_image.py .   (Windows fonts: Segoe UI)
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
brand = root / "frontend/public/images/brand"
clinic = json.loads((root / "content/clinic.json").read_text(encoding="utf-8"))
rating = clinic["clinic"]["googleRating"]

W, H = 1200, 630
FONTS = Path("C:/Windows/Fonts")
bold = lambda size: ImageFont.truetype(str(FONTS / "segoeuib.ttf"), size)  # noqa: E731
semi = lambda size: ImageFont.truetype(str(FONTS / "seguisb.ttf"), size)  # noqa: E731

# Soft brand background: white with pink and teal glows.
canvas = Image.new("RGB", (W, H), "#ffffff")
glow = Image.new("RGB", (W, H), "#ffffff")
draw_glow = ImageDraw.Draw(glow)
for radius, colour, centre in [(520, (255, 229, 238), (1150, -60)), (420, (211, 243, 255), (-80, 660))]:
    for step in range(radius, 0, -6):
        t = step / radius
        mix = tuple(int(255 * t + c * (1 - t)) for c in colour)
        draw_glow.ellipse(
            [centre[0] - step, centre[1] - step, centre[0] + step, centre[1] + step], fill=mix
        )
canvas = Image.blend(canvas, glow, 1.0)
draw = ImageDraw.Draw(canvas)

# Photo on the right, rounded.
photo = Image.open(root / "frontend/public/images/original/about-img.jpg").convert("RGB")
photo = ImageOps.fit(photo, (430, 530), centering=(0.5, 0.2))
mask = Image.new("L", photo.size, 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, *photo.size], radius=36, fill=255)
canvas.paste(photo, (W - 430 - 50, 50), mask)

# Logo and text on the left.
logo = Image.open(brand / "logo.png").convert("RGBA")
logo.thumbnail((300, 100))
canvas.paste(logo, (60, 60), logo)

ink, muted, magenta = (31, 36, 43), (87, 97, 112), (210, 2, 127)
draw.text((60, 205), "Gentle, modern", font=bold(64), fill=ink)
draw.text((60, 280), "dentistry for", font=bold(64), fill=ink)
draw.text((60, 355), "the whole family", font=bold(64), fill=magenta)
draw.text((60, 450), "Duler (Mapusa)  ·  Candolim, Goa", font=semi(30), fill=muted)

font = semi(26)
score = f"{rating['rating']}"
rest = f"Google rating · {rating['reviewCount']} reviews"
score_w = draw.textlength(score, font=font)
rest_w = draw.textlength(rest, font=font)
pill_w = 22 + score_w + 10 + 26 + 12 + rest_w + 22
draw.rounded_rectangle([60, 515, 60 + pill_w, 567], radius=26, fill=(255, 243, 247))
x = 82
draw.text((x, 525), score, font=font, fill=(173, 0, 104))
x += score_w + 10
# Five-pointed star drawn as a polygon (Segoe UI has no star glyph).
cx, cy, outer, inner = x + 13, 541, 13, 5.5
points = []
for i in range(10):
    r = outer if i % 2 == 0 else inner
    angle = math.radians(-90 + i * 36)
    points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
draw.polygon(points, fill=(245, 158, 11))
x += 26 + 12
draw.text((x, 525), rest, font=font, fill=(173, 0, 104))

out = brand / "og-default.jpg"
canvas.save(out, quality=86, optimize=True, progressive=True)
print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
