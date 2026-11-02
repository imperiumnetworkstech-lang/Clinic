"""Generate 50-950 colour scales in OKLCH from brand anchors and report WCAG contrast."""
import json
import math
import sys


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def lin_to_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_to_oklch(h):
    r, g, b = (srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (x ** (1 / 3) for x in (l, m, s))
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360


def oklch_to_rgb(L, C, H):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return r, g, bl


def in_gamut(rgb):
    return all(-1e-4 <= c <= 1 + 1e-4 for c in rgb)


def to_hex(L, C, H):
    while C > 0 and not in_gamut(oklch_to_rgb(L, C, H)):
        C -= 0.002
    return "#" + "".join(f"{round(max(0, min(1, lin_to_srgb(max(0, c)))) * 255):02X}" for c in oklch_to_rgb(L, C, H))


def luminance(h):
    r, g, b = (srgb_to_lin(int(h[i:i + 2], 16) / 255) for i in (1, 3, 5))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


STEPS = {50: .975, 100: .945, 200: .89, 300: .81, 400: .72, 500: .645, 600: .565, 700: .49, 800: .415, 900: .35, 950: .26}
CHROMA = {50: .18, 100: .3, 200: .5, 300: .75, 400: .95, 500: 1, 600: 1, 700: .92, 800: .8, 900: .65, 950: .5}


def scale(anchor, max_c=None):
    _, C, H = hex_to_oklch(anchor)
    C = max_c or C
    return {k: to_hex(L, C * CHROMA[k], H) for k, L in STEPS.items()}


anchors = {"primary": "#F51B97", "secondary": "#00A3C8"}
out = {name: scale(h) for name, h in anchors.items()}
out["neutral"] = scale("#64748B", 0.03)
out["success"] = scale("#16A34A")
out["warning"] = scale("#F59E0B")
out["danger"] = scale("#DC2626")
report = {}
for name, sc in out.items():
    report[name] = {k: {"hex": v, "onWhite": round(contrast(v, "#FFFFFF"), 2), "onNeutral950": round(contrast(v, out["neutral"][950] if "neutral" in out else "#000000"), 2)} for k, v in sc.items()}
report["anchors"] = {k: {"hex": v, "oklch": [round(x, 3) for x in hex_to_oklch(v)], "onWhite": round(contrast(v, "#FFFFFF"), 2)} for k, v in anchors.items()}
json.dump(report, sys.stdout, indent=1)
