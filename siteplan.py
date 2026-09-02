# -*- coding: utf-8 -*-
"""What tents exist per campsite, and the picture the guest sees of the place.

The Aufbauten PDFs give the tent count and each tent's model and size. That is
all they are used for — the page does not point at an individual tent.

The picture comes from maps/:

    maps/C3.jpg     a drone photo of the campsite (jpg or png)

Nothing to calibrate and nothing to line up: the photo is shown as it is, with
nothing drawn on top. No photo for a campsite means no picture on the card —
the drawing is never shown to guests.

C5Z is not covered here. The niuway booth stands on C5Z, but that is one line of
copy in the page (T.booth in _app.js), not a map.
"""
import base64, glob, math, mimetypes, os, statistics as st

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))

KIND = {"Comfort Regular": "r", "Comfort Large": "L", "Comfort EXTRA Large": "X",
        "EXTRA Large": "X"}
MODEL = {"r": "Comfort Regular", "L": "Comfort Large", "X": "Comfort EXTRA Large"}
SIZE = {"r": (1.4, 2.7), "L": (2.4, 2.7), "X": (3.0, 3.0)}     # width x depth, metres
AREAS = [("C3", "C3"), ("C9", "C9"), ("DJK", "Green Camping (DJK)")]

# Where each campsite actually is, for the "open in maps" link on the card.
# From Leo, 2026-09-02. A campsite with no entry here simply gets no link.
COORDS = {
    "C3":  (49.323559, 8.561514),
    "C9":  (49.323692, 8.530419),
    "DJK": (49.330391, 8.558487),
}


def _tent_labels(page):
    pts = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            t = "".join(s["text"] for s in l["spans"]).strip()
            if t in KIND:
                x0, y0, x1, y1 = l["bbox"]
                pts.append({"x": (x0 + x1) / 2, "y": (y0 + y1) / 2,
                            "m": KIND[t], "dir": l["dir"]})
    return pts


def _order(pts):
    """Drawing order: rows across the block first, then left to right along each.

    Same clustering as extract_aufbauten.py — the labels are rotated with the
    drawing, so rotate into the block's own frame before grouping.
    """
    th = math.atan2(st.mean(p["dir"][1] for p in pts), st.mean(p["dir"][0] for p in pts))
    c, s = math.cos(th), math.sin(th)
    for p in pts:
        p["u"] = p["x"] * c + p["y"] * s
        p["v"] = -p["x"] * s + p["y"] * c
    pts.sort(key=lambda p: p["u"])
    rows, cur = [], [pts[0]]
    for p in pts[1:]:
        if p["u"] - cur[-1]["u"] > 7: rows.append(cur); cur = [p]
        else: cur.append(p)
    rows.append(cur)
    for r in rows: r.sort(key=lambda p: -p["v"])
    return rows, th


def _drawn(key):
    """What the Aufbauten drawing shows, or None if it is not in this checkout.

    The drawings are the organiser's and are kept out of the repository, so the
    build has to work without them. tents.csv is the authority either way; this
    only feeds the cross-check.
    """
    pdf = os.path.join(ROOT, "Aufbauten", "GGF26 - Aufbauten %s.pdf" % key)
    if not os.path.exists(pdf):
        return None
    try:
        import pymupdf
    except ImportError:
        return None
    page = pymupdf.open(pdf)[0]
    rows, _ = _order(_tent_labels(page))
    out, n = [], 0
    for r in rows:
        for p in r:
            n += 1
            out.append({"i": n, "m": p["m"]})
    return out


def _photo(key):
    """maps/<key>.<ext> if it is there, as (w, h, data uri, filename)."""
    for f in sorted(glob.glob(os.path.join(HERE, "maps", key + ".*"))):
        if os.path.splitext(f)[1].lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            continue
        from PIL import Image
        with Image.open(f) as im:
            w, h = im.size
        uri = "data:%s;base64,%s" % (mimetypes.guess_type(f)[0] or "image/jpeg",
                                     base64.b64encode(open(f, "rb").read()).decode())
        return w, h, uri, os.path.basename(f)
    return None




def area(key, name):
    tents = _drawn(key)                    # None when the drawing is not here

    shot = _photo(key)
    a = {"key": key, "name": name, "tents": tents or [], "drawn": tents is not None,
         "geo": list(COORDS.get(key)) if COORDS.get(key) else None,
         "source": "GGF26 - Aufbauten %s.pdf" % key}
    if shot:
        a["w"], a["h"], a["plan"], a["map"] = shot
    else:
        a["map"] = None
    return a


def all_areas():
    return {k: area(k, n) for k, n in AREAS}


if __name__ == "__main__":
    for k, n in AREAS:
        a = area(k, n)
        if a["map"]:
            print("%-4s %2d tents · photo %-12s %dx%d px · %.0f kB"
                  % (k, len(a["tents"]), a["map"], a["w"], a["h"],
                     len(a["plan"]) * 3 / 4 / 1024))
        else:
            print("%-4s %2d tents · no photo — put one in maps/%s.jpg" % (k, len(a["tents"]), k))
        if not a["drawn"]:
            print("     drawing not in this checkout — cross-check skipped")
        if not a["geo"]:
            print("     no coordinates — add %s to COORDS for the maps link" % k)
