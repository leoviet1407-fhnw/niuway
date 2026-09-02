# -*- coding: utf-8 -*-
"""Build tent-finder.html — one self-contained page, no server, no build step.

A guest types the e-mail they booked with and gets their tent number, their
campsite and a photo of it. German / English, switchable in the header.
C3, C9 and Green Camping (DJK) only — C5Z is not part of this page.

Guest-facing German copy lives only in the T object in _app.js, mirrored by T.en.

Where the numbers and the map come from:
  tents.csv   the authority for what exists: campsite, tent_no, model. Written
              with placeholder numbers on first run, never overwritten after
              that. The Aufbauten drawings are only cross-checked against it.
  maps/       one drone photo per campsite — maps/C3.jpg and so on. Shown as
              it is, nothing drawn on it. No photo, no picture on the card.

Security, such as it is on a static page:
  * no e-mail address is written into the page — only sha256(salt + address)
  * the salt lives in salt.txt and is NOT the guest list; keep the CSV off the web
  * nothing but tent number, campsite and model is published — no names
  * the page makes no network calls beyond the Google Fonts stylesheet
A static page can only ever confirm or deny an address someone already has.
If the guest list must stay secret, this needs a server-side lookup instead.

    python3 gen_tent_finder.py
"""
import csv, hashlib, html, json, os, secrets
import siteplan as SP

HERE = SP.HERE
REV, DATE = "Rev 2", "2026-09-02"
# Who a guest reaches, and how. WA is the wa.me number: digits only, no plus.
CONTACT = {"name": "Alex", "phone": "+41 76 541 13 25", "wa": "41765411325",
           "hours": "08:00\u201322:00"}

# Addresses that additionally get the whole-site overview after looking themselves
# up. Only the hash goes into the page, same as everyone else. The overview holds
# tent numbers, models and sales channels — never anyone's address, because
# anything the page can show, anyone holding the file can read out of it.
ADMINS = ["flo@niuway.ch"]
SW = {"r": "r", "L": "l", "X": "x"}              # css token suffix per model
TENTS_CSV = os.path.join(HERE, "tents.csv")


def salt():
    f = os.path.join(HERE, "salt.txt")
    if not os.path.exists(f):
        with open(f, "w") as h:
            h.write(secrets.token_hex(16))
        print("salt.txt created — do not delete it, or every hash changes.")
    return open(f).read().strip()


def tents(areas):
    """What exists per campsite, from tents.csv — created on first run.

    tents.csv wins. The drawings are cross-checked against it and any difference
    is reported, because on site the drawing is the thing that is out of date.
    """
    if not os.path.exists(TENTS_CSV):
        with open(TENTS_CSV, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["campsite", "tent_no", "model"])
            for a in areas.values():
                for t in a["tents"]:
                    w.writerow([a["key"], t["i"], SP.MODEL[t["m"]]])
        print("tents.csv created with placeholder numbers — put the real ones in.")

    by_model = {v: k for k, v in SP.MODEL.items()}
    out, dup, notes = {}, [], []
    with open(TENTS_CSV, encoding="utf-8") as f:
        for row in csv.reader(f):
            row = [c.strip() for c in row]
            if not row or not row[0] or row[0].startswith("#") or row[0].lower() == "campsite":
                continue
            site, no, model = row[0].upper(), row[1], (row[2] if len(row) > 2 else "")
            if model and model not in by_model:
                raise SystemExit("tents.csv: %r is not one of %s" % (model, list(by_model)))
            if (site, no) in out:
                dup.append("%s tent %s listed twice in tents.csv" % (site, no))
            out[(site, no)] = by_model[model] if model else "?"

    for a in areas.values():
        mine = {k: v for k, v in out.items() if k[0] == a["key"]}
        drawn = {}
        for t in a["tents"]:               # still the drawing's tents at this point
            drawn[t["m"]] = drawn.get(t["m"], 0) + 1
        listed = {}
        for m in mine.values():
            listed[m] = listed.get(m, 0) + 1

        a["tents"] = [{"no": no, "m": m} for (site, no), m in sorted(mine.items(),
                      key=lambda kv: (len(kv[0][1]), kv[0][1]))]

        if a["drawn"] and drawn != listed:  # no drawing in this checkout: nothing to compare
            more = {k: listed.get(k, 0) - drawn.get(k, 0) for k in ("r", "L", "X", "?")}
            notes.append("%s: %s than the drawing (%s vs %s)"
                         % (a["key"], _diff(more), _mix(listed), _mix(drawn)))
        gap = _gaps([no for (site, no) in mine])
        if gap:
            notes.append("%s: numbers run %s but %s missing — is that tent unsold, or "
                         "filtered out of the export?" % (a["key"], gap[0], gap[1]))
    return dup, notes


def _gaps(nos):
    """Holes in an otherwise unbroken run of numbers — usually a filtered export."""
    try:
        ns = sorted(int(n) for n in nos)
    except ValueError:
        return None                       # not plain numbers, nothing to check
    if len(ns) < 3:
        return None
    missing = [n for n in range(ns[0], ns[-1] + 1) if n not in set(ns)]
    if not missing or len(missing) > len(ns) / 2:
        return None
    return ("%d-%d" % (ns[0], ns[-1]), ", ".join(map(str, missing)))


NAMES = dict(SP.MODEL, **{"?": "model not known yet"})


def _diff(d):
    up = " + ".join("%d %s" % (v, NAMES[k]) for k, v in d.items() if v > 0)
    dn = " + ".join("%d %s" % (-v, NAMES[k]) for k, v in d.items() if v < 0)
    return " and ".join(x for x in ((up + " more") if up else "", (dn + " fewer") if dn else "") if x)


def _mix(c):
    return " + ".join("%d %s" % (c[k], NAMES[k]) for k in ("r", "L", "X", "?") if c.get(k)) or "nothing"


def bookings(s, areas):
    """email,campsite,tent_no[,pos] -> {sha256(salt+email): [["C9:301", pos], ...]}.

    A two-column line (email,tent_no) is accepted when that number is unique
    across all campsites. pos is the Point of Sale column from the organiser's
    export; "Pickup Tent" marks the tent the materials are stored in, which the
    page labels differently. Comments start with #.

    Also returns which tent carries which pos, for the admin overview.
    """
    known, everywhere = set(), {}
    for a in areas.values():
        for t in a["tents"]:
            known.add((a["key"], str(t["no"])))
            everywhere.setdefault(str(t["no"]), []).append(a["key"])

    book, demo, bad, taken, posn, n = {}, True, [], {}, {}, 0
    with open(os.path.join(HERE, "bookings.csv"), encoding="utf-8") as f:
        for row in csv.reader(f):
            row = [c.strip() for c in row]
            while row and row[-1] == "":
                row.pop()
            if not row or row[0].startswith("#") or row[0].lower() == "email":
                continue
            mail, pos = row[0].lower(), row[3] if len(row) >= 4 else ""
            if len(row) >= 3 and row[2]:
                site, no = row[1].upper(), row[2]
            elif len(row) == 2:
                no = row[1]
                where = everywhere.get(no, [])
                if len(where) != 1:
                    bad.append((mail, no, "ambiguous" if where else "unknown")); continue
                site = where[0]
            else:
                bad.append((mail, "", "no tent number")); continue
            if (site, no) not in known:
                bad.append((mail, site + " " + no, "not in tents.csv")); continue
            taken.setdefault((site, no), []).append(mail)
            posn[(site, no)] = pos or "-"
            book.setdefault(hashlib.sha256((s + mail).encode()).hexdigest(), []).append(
                [site + ":" + no, "pickup" if pos.lower().startswith("pickup") else ""])
            if not mail.endswith(("example.com", "example.org", "example.net")):
                demo = False
            n += 1
    clash = ["%s tent %s is booked to %d addresses: %s" % (k[0], k[1], len(v), ", ".join(v))
             for k, v in sorted(taken.items()) if len(v) > 1]
    sample = ""
    if demo:
        with open(os.path.join(HERE, "bookings.csv"), encoding="utf-8") as f:
            for row in csv.reader(f):
                if row and row[0].strip() and not row[0].lstrip().startswith("#") \
                   and row[0].strip().lower() != "email":
                    sample = row[0].strip().lower(); break
    return book, demo, bad, clash, n, sample, posn


# The wrapper a browser needs and the Artifact runtime supplies on its own.
STANDALONE = """<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="niuway Zeltfinder — Zeltnummer und Camping f\u00fcr Gl\u00fccksgef\u00fchle 2026. / Tent number and campsite lookup.">
<meta name="theme-color" content="#174a5b">
<meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>%E2%9B%BA</text></svg>">
<style>html{background:#174a5b}</style>
__HEAD__
</head>
<body>
__BODY__
</body>
</html>
"""


def read(name):
    return open(os.path.join(HERE, name), encoding="utf-8").read()


def page():
    s = salt()
    areas = SP.all_areas()
    dup, notes = tents(areas)
    book, demo, bad, clash, n, sample, posn = bookings(s, areas)
    total = sum(len(a["tents"]) for a in areas.values())
    overview = {a["key"]: {"name": a["name"],
                           "tents": [{"no": t["no"], "m": t["m"],
                                      "pos": posn.get((a["key"], str(t["no"])), "")}
                                     for t in a["tents"]]}
                for a in areas.values() if a["tents"]}
    data = {"salt": s, "book": book, "areas": areas,
            "admins": [hashlib.sha256((s + m.strip().lower()).encode()).hexdigest()
                       for m in ADMINS],
            "overview": overview,
            "labels": {k: SP.MODEL[k] for k in ("r", "L", "X")},
            "contact": CONTACT, "sample": sample}

    demo_note = '<p class="callout" id="demo"></p>' if demo else ""
    # Static title/heading are English so the file reads as English at rest;
    # the language switch replaces both at runtime.
    out = """<!-- niuway tent finder · __REV__ · __DATE__ · __TOT__ tents -->
<title>Tent Finder</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap">
<style>__CSS__</style>
<div class="wrap">
  <header class="header">
    <img class="brand-logo" src="__LOGO__" alt="niuway">
    <div class="lang" role="group" aria-label="Sprache / Language">
      <button type="button" data-lang="de" aria-pressed="true">DE</button>
      <button type="button" data-lang="en" aria-pressed="false">EN</button>
    </div>
  </header>

  <h1 id="h1">Tent finder</h1>
  <p class="intro" id="intro"></p>

  <form class="card finder" id="finder" novalidate>
    <label for="email" id="lab"></label>
    <input id="email" name="email" type="email" inputmode="email" autocomplete="email"
           spellcheck="false" aria-describedby="msg">
    <button type="submit" class="submit" id="go"></button>
    <p class="msg" id="msg" role="status" aria-live="polite"></p>
  </form>

  <p class="booth" id="booth"></p>

  <p class="addon addon-top" id="addonTop"></p>

  <div id="out"></div>

  __DEMO__

  <section class="help">
    <h2 id="helpH"></h2>
    <ul id="helpL"></ul>
  </section>

  <footer class="foot"><p id="foot"></p></footer>
</div>

<div class="nudge" id="nudge" hidden>
  <button type="button" class="nudge-x" id="nudgeX" aria-label="OK">&times;</button>
  <div class="nudge-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.8 14.13c-.24.68-1.42 1.31-1.96 1.36-.5.05-.98.23-3.3-.69-2.78-1.1-4.55-3.95-4.69-4.13-.14-.18-1.12-1.49-1.12-2.85 0-1.35.71-2.02.96-2.29.25-.28.55-.35.73-.35.18 0 .37 0 .53.01.17.01.4-.06.62.48.24.55.8 1.9.87 2.04.07.14.12.3.02.48-.09.18-.14.29-.28.45-.14.16-.29.35-.42.47-.14.14-.28.29-.12.57.16.28.72 1.19 1.55 1.93 1.07.95 1.97 1.25 2.25 1.39.28.14.44.12.6-.07.16-.19.69-.81.88-1.09.18-.28.37-.23.62-.14.25.09 1.6.75 1.87.89.28.14.46.21.53.32.07.12.07.66-.17 1.32z"/></svg>
  </div>
  <p class="nudge-h" id="nudgeH"></p>
  <p class="nudge-b" id="nudgeB"></p>
  <a class="nudge-cta" id="nudgeCta" target="_blank" rel="noopener noreferrer"></a>
  <p class="nudge-hours" id="nudgeHours"></p>
  <p class="nudge-fun" id="nudgeFun"></p>
</div>

<div class="lightbox" id="lb" role="dialog" aria-modal="true">
  <button type="button" class="lb-close" id="lbClose">&times;</button>
  <div id="lbBody"></div>
</div>
<script>__SHA__
const DATA=__DATA__;
__JS__</script>
"""
    out = (out.replace("__CSS__", read("_app_style.css"))
              .replace("__LOGO__", read("_logo.txt").strip())
              .replace("__REV__", REV).replace("__DATE__", DATE).replace("__TOT__", str(total))
              .replace("__DEMO__", demo_note)
              .replace("__SHA__", read("_sha256.js"))
              .replace("__DATA__", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
              .replace("__JS__", read("_app.js")))

    path = os.path.join(HERE, "tent-finder.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(out)

    # index.html — the same page as a complete document, at the repository root
    # so Vercel serves it with no configuration. tent-finder.html is a fragment
    # for the Claude artifact; a web server will not wrap it for you.
    cut = out.index('<div class="wrap">')          # title/link/style above, page below
    with open(os.path.join(HERE, "index.html"), "w", encoding="utf-8") as f:
        f.write(STANDALONE.replace("__HEAD__", out[:cut].strip())
                          .replace("__BODY__", out[cut:].strip()))
    return path, n, len(book), bad, dup, notes, clash, demo, total, areas


if __name__ == "__main__":
    path, n, guests, bad, dup, notes, clash, demo, total, areas = page()
    print("%s — %d tents · %d bookings / %d addresses%s"
          % (os.path.basename(path), total, n, guests, "  [demo data]" if demo else ""))
    for a in areas.values():
        print("  %-4s %2d tents · %s" % (a["key"], len(a["tents"]),
              "photo maps/" + a["map"] if a["map"] else "NO PHOTO — put one in maps/%s.jpg" % a["key"]))
    for d in set(dup):
        print("  ! %s" % d)
    for d in notes:
        print("  ! %s" % d)
    for c in clash:
        print("  !! %s" % c)
    for mail, what, why in bad:
        print("  ! %s tent %-10s (%s) — line skipped" % (why, what, mail))
    print("  %.0f kB" % (os.path.getsize(path) / 1024))
