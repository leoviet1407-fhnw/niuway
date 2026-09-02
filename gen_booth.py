# -*- coding: utf-8 -*-
"""Build booth.html — the C5Z check-in screen for staff at the booth.

Staff type the address the guest booked with. The screen shows what they
booked and what add-ons are on the order, then offers the free tent numbers of
that type. Picking one assigns it, through api/assign.js, so every device at
the booth sees the same board.

Inputs:
  c5z-tents.csv      the inventory: tent_no, type, reserved_for
  c5z-bookings.csv   email, tent_type, addons, order_id
  salt.txt           the same salt as the guest page

No address is written into the page — only sha256(salt + address), same as the
guest page. Assignments live in Redis, keyed by tent number.

    python3 gen_booth.py
"""
import csv, hashlib, html, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
REV, DATE = "Rev 1", "2026-09-02"
TYPES = ["Regular", "Basis", "Plus"]


def rows(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        for r in csv.reader(f):
            r = [c.strip() for c in r]
            while r and r[-1] == "":
                r.pop()
            if r and r[0] and not r[0].startswith("#") and r[0].lower() not in ("email", "tent_no"):
                yield r


def tents():
    out = []
    for r in rows("c5z-tents.csv"):
        no, kind, res = r[0], r[1], (r[2] if len(r) > 2 else "")
        if kind not in TYPES:
            raise SystemExit("c5z-tents.csv: %r is not one of %s" % (kind, TYPES))
        out.append({"no": no, "t": kind, "r": res})
    return out


def bookings(salt, inventory):
    have = {t["t"] for t in inventory}
    book, n, bad = {}, 0, []
    for r in rows("c5z-bookings.csv"):
        mail, kind = r[0].lower(), (r[1] if len(r) > 1 else "")
        addons = r[2] if len(r) > 2 else ""
        order = r[3] if len(r) > 3 else ""
        if kind not in have:
            bad.append((mail, kind or "(no type)")); continue
        items = []
        for part in addons.split(";"):
            part = part.strip()
            if not part:
                continue
            name, qty = part, 1
            if " x" in part.lower():
                head, _, tail = part.rpartition(" x")
                if tail.strip().isdigit():
                    name, qty = head.strip(), int(tail)
            items.append([name, qty])
        book[hashlib.sha256((salt + mail).encode()).hexdigest()] = {
            "t": kind, "a": items, "o": order}
        n += 1
    return book, n, bad


def build():
    salt = open(os.path.join(HERE, "salt.txt")).read().strip()
    inv = tents()
    book, n, bad = bookings(salt, inv)
    data = {"salt": salt, "tents": inv, "book": book, "types": TYPES,
            "rev": REV, "date": DATE}

    page = (open(os.path.join(HERE, "_booth.html"), encoding="utf-8").read()
            .replace("__CSS__", open(os.path.join(HERE, "_booth.css"), encoding="utf-8").read())
            .replace("__LOGO__", open(os.path.join(HERE, "_logo.txt"), encoding="utf-8").read().strip())
            .replace("__SHA__", open(os.path.join(HERE, "_sha256.js"), encoding="utf-8").read())
            .replace("__DATA__", json.dumps(data, ensure_ascii=False, separators=(",", ":")))
            .replace("__JS__", open(os.path.join(HERE, "_booth.js"), encoding="utf-8").read()))

    path = os.path.join(HERE, "booth.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(page)
    return path, inv, n, bad


if __name__ == "__main__":
    path, inv, n, bad = build()
    free = [t for t in inv if not t["r"]]
    print("booth.html — %d tents, %d assignable, %d bookings loaded"
          % (len(inv), len(free), n))
    for t in TYPES:
        ns = [int(x["no"]) for x in inv if x["t"] == t]
        held = [x for x in inv if x["t"] == t and x["r"]]
        print("  %-8s %2d  %d-%d%s" % (t, len(ns), min(ns), max(ns),
              "  (held: " + ", ".join("%s %s" % (x["no"], x["r"]) for x in held) + ")" if held else ""))
    for mail, kind in bad:
        print("  ! unknown tent type %-12s (%s) — line skipped" % (kind, mail))
    if not n:
        print("  no bookings yet — fill c5z-bookings.csv")
    print("  %.0f kB" % (os.path.getsize(path) / 1024))
