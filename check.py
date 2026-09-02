# -*- coding: utf-8 -*-
"""Occupancy per campsite: what exists, what is booked, what is still empty.

    python3 check.py            all campsites
    python3 check.py C3         one of them

"Empty" means a tent that is listed in tents.csv and has no line in
bookings.csv. That only tells the truth if tents.csv is the real inventory —
if it was built from the booking list, everything in it is booked by
construction and the answer is meaningless. The header of each block says which
case you are in.
"""
import collections, csv, os, sys
import siteplan as SP

HERE = SP.HERE


def rows(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as f:
        for r in csv.reader(f):
            r = [c.strip() for c in r]
            while r and r[-1] == "":
                r.pop()
            if r and r[0] and not r[0].startswith("#") and r[0].lower() not in ("campsite", "email"):
                yield r


def main(only=None):
    stock = collections.OrderedDict()
    for r in rows("tents.csv"):
        site, no = r[0].upper(), r[1]
        stock.setdefault(site, {})[no] = (r[2] if len(r) > 2 and r[2] else "model not known yet")

    booked = collections.defaultdict(dict)
    for r in rows("bookings.csv"):
        if len(r) >= 3 and r[2]:
            booked[r[1].upper()][r[2]] = r[3] if len(r) >= 4 else ""

    drawn = {k: len(SP.area(k, n)["tents"]) for k, n in SP.AREAS}

    for site, tents in stock.items():
        if only and site != only.upper():
            continue
        free = sorted((n for n in tents if n not in booked[site]), key=_key)
        pick = [n for n, p in booked[site].items() if p.lower().startswith("pickup")]
        print("\n%s — %d tents listed, %d booked, %d empty"
              % (site, len(tents), len(booked[site]), len(free)))
        print("   drawing shows %d tents; %d listed here (%s the pickup store%s)"
              % (drawn.get(site, 0), len(tents),
                 "+%d for" % len(pick) if pick else "no line for",
                 "" if pick else ", so it may be missing"))
        if not free:
            print("   nothing empty — but every number in tents.csv came from the booking")
            print("   list, so an unsold tent would not be in it. Add it to tents.csv first.")
        else:
            print("   empty: " + ", ".join(free))
        gaps = _gaps(tents)
        if gaps:
            print("   numbering runs %s with %s missing — unlisted tent, or just a skipped"
                  " number?" % gaps)


def _key(n):
    try: return (0, int(n))
    except ValueError: return (1, n)


def _gaps(tents):
    try: ns = sorted(int(n) for n in tents)
    except ValueError: return None
    missing = [n for n in range(ns[0], ns[-1] + 1) if n not in set(ns)]
    if not missing or len(missing) > len(ns) / 2:
        return None
    return ("%d-%d" % (ns[0], ns[-1]), ", ".join(map(str, missing)))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
