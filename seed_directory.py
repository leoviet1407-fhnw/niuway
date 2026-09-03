# -*- coding: utf-8 -*-
"""Push the C5Z guest list to the search endpoint.

booth.html holds no addresses, so type-ahead has to match server-side. This
sends address, name and a one-line summary of what each guest has, so staff can
tell two Vanessas apart in the dropdown. It covers everyone who might walk up:
pitched tents and pick-up-only guests alike.

Re-run it whenever either booking file changes.

    python3 seed_directory.py <pin> [https://niuway.vercel.app]
"""
import csv, json, os, ssl, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


def rows(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for r in csv.reader(f):
            r = [c.strip() for c in r]
            while r and r[-1] == "":
                r.pop()
            if r and r[0] and not r[0].startswith("#") and r[0].lower() != "email":
                yield r


def entries():
    """One row per guest: address, name if known, and what they have."""
    tents, pick, names = {}, {}, {}
    for r in rows("c5z-bookings.csv"):
        tents[r[0].lower()] = tents.get(r[0].lower(), 0) + 1
    for r in rows("c5z-pickup.csv"):
        m = r[0].lower()
        pick[m] = pick.get(m, 0) + 1
        if len(r) > 2:
            names[m] = (r[1] + " " + r[2]).strip()

    out = []
    for m in sorted(set(tents) | set(pick)):
        t, p = tents.get(m, 0), pick.get(m, 0)
        if t and p:
            what = "%d Zelt%s + Abholung" % (t, "e" if t > 1 else "")
        elif t:
            what = "%d Zelt%s" % (t, "e" if t > 1 else "")
        else:
            what = "Nur Abholung"
        out.append({"m": m, "n": names.get(m, ""), "k": what})
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    pin, base = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "https://niuway.vercel.app")
    rowsout = entries()
    body = json.dumps({"pin": pin, "entries": rowsout}).encode()
    req = urllib.request.Request(base + "/api/directory", data=body,
                                 headers={"Content-Type": "application/json"})
    # This python.org build ships without a CA bundle, so fall back to certifi
    # rather than failing the handshake. See mail/SETUP.md, step 0.
    ctx = ssl.create_default_context()
    try:
        ctx.load_verify_locations(__import__("certifi").where())
    except Exception:
        pass
    with urllib.request.urlopen(req, context=ctx) as r:
        print(base, "->", r.read().decode())
    named = sum(1 for e in rowsout if e["n"])
    print("%d guests, %d with a name" % (len(rowsout), named))


if __name__ == "__main__":
    main()
