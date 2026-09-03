# -*- coding: utf-8 -*-
"""Push the C5Z address list to the search endpoint.

booth.html holds no addresses, so type-ahead has to match server-side. This
sends the list to /api/directory, where it lives in Redis behind the booth PIN.
Re-run it whenever the booking list changes.

    python3 seed_directory.py <pin> [https://niuway.vercel.app]
"""
import csv, json, os, ssl, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


def emails():
    out = set()
    with open(os.path.join(HERE, "c5z-bookings.csv"), encoding="utf-8") as f:
        for r in csv.reader(f):
            if r and r[0].strip() and not r[0].startswith("#") and r[0].strip().lower() != "email":
                out.add(r[0].strip().lower())
    return sorted(out)


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    pin, base = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "https://niuway.vercel.app")
    body = json.dumps({"pin": pin, "entries": emails()}).encode()
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


if __name__ == "__main__":
    main()
