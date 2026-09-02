# -*- coding: utf-8 -*-
"""Build booth.html — the C5Z check-in screen for staff at the booth.

Staff type the address the guest booked with. The screen shows what they
booked and what add-ons are on the order, then offers the free tent numbers of
that type. Picking one assigns it, through api/assign.js, so every device at
the booth sees the same board.

Inputs:
  c5z-tents.csv      the inventory: tent_no, type, reserved_for
  c5z-bookings.csv   email, tent_type, order_id, checkin — one line per tent
  c5z-addons.csv     email, addon, qty, order_id
  salt.txt           the same salt as the guest page

Both booking files come from import_c5z.py. A guest can hold several tents, of
mixed types; the screen groups them by type and assigns one number per tent.

No address is written into the page — only sha256(salt + address), same as the
guest page. Assignments live in Redis, keyed by tent number.

    python3 gen_booth.py
"""
import csv, hashlib, html, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
REV, DATE = "Rev 1", "2026-09-02"
# The inventory is numbered by niuway's names; the booking export uses the
# product names. Leo's ranges: 128-141 Regular, 142-170 Basis, 171-189 Plus.
# ASSUMED mapping — confirm before the booth opens.
TYPES = ["Regular", "Basis", "Plus"]
_BOOK = {}
PRODUCT_TO_POOL = {
    "Regular":     "Regular",
    "Large":       "Basis",
    "Extra Large": "Plus",
}


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
    """One entry per guest: how many tents of each pool, plus their add-ons."""
    pools = {t["t"] for t in inventory}
    by_mail, bad = {}, []
    for r in rows("c5z-bookings.csv"):
        mail, product = r[0].lower(), (r[1] if len(r) > 1 else "")
        order = r[2] if len(r) > 2 else ""
        pool = PRODUCT_TO_POOL.get(product, product)
        if pool not in pools:
            bad.append((mail, product or "(no type)")); continue
        g = by_mail.setdefault(mail, {"t": {}, "a": [], "o": order})
        g["t"][pool] = g["t"].get(pool, 0) + 1

    if os.path.exists(os.path.join(HERE, "c5z-addons.csv")):
        for r in rows("c5z-addons.csv"):
            mail, name = r[0].lower(), (r[1] if len(r) > 1 else "")
            try:
                qty = int(r[2]) if len(r) > 2 and r[2] else 1
            except ValueError:
                qty = 1
            g = by_mail.get(mail)
            if not g:                        # an add-on with no tent on C5Z
                bad.append((mail, "add-on %s without a C5Z tent" % name)); continue
            for row in g["a"]:
                if row[0] == name:
                    row[1] += qty; break
            else:
                g["a"].append([name, qty])

    book = {hashlib.sha256((salt + m).encode()).hexdigest(): g for m, g in by_mail.items()}
    global _BOOK
    _BOOK = book
    return book, len(by_mail), sum(sum(g["t"].values()) for g in by_mail.values()), bad


def build():
    salt = open(os.path.join(HERE, "salt.txt")).read().strip()
    inv = tents()
    book, n, ntents, bad = bookings(salt, inv)
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
    return path, inv, n, ntents, bad


if __name__ == "__main__":
    path, inv, n, ntents, bad = build()
    book = _BOOK
    free = [t for t in inv if not t["r"]]
    print("booth.html — %d tents, %d assignable, %d guests / %d booked tents"
          % (len(inv), len(free), n, ntents))
    import json as _j
    booked = {}
    for g in _j.loads(_j.dumps(list(book.values()))) if False else []:
        pass
    for t in TYPES:
        ns = [int(x["no"]) for x in inv if x["t"] == t]
        held = [x for x in inv if x["t"] == t and x["r"]]
        want = sum(g["t"].get(t, 0) for g in book.values())
        have = len(ns) - len(held)
        flag = "" if want <= have else "   <-- %d MORE BOOKED THAN EXIST" % (want - have)
        print("  %-8s %2d-%-3d  %2d free for guests, %2d booked%s"
              % (t, min(ns), max(ns), have, want, flag))
        if held:
            print("           held: " + ", ".join("%s %s" % (x["no"], x["r"]) for x in held))
    for mail, kind in bad:
        print("  ! unknown tent type %-12s (%s) — line skipped" % (kind, mail))
    if not n:
        print("  no bookings yet — fill c5z-bookings.csv")
    print("  %.0f kB" % (os.path.getsize(path) / 1024))
