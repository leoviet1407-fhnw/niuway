# C5Z booth check-in

`booth.html` — the screen staff use at the booth. Served at
`https://niuway.vercel.app/booth.html`.

Staff type the address the guest booked with. The screen shows the tent type
they booked and the add-ons on the order, then offers the free numbers of that
type. Tapping one assigns it, and every device at the booth sees it immediately.

```
python3 gen_booth.py
```

| File | Role |
|---|---|
| `c5z-tents.csv` | **Input.** The inventory: `tent_no,type,reserved_for` |
| `c5z-bookings.csv` | **Input.** `email,tent_type,addons,order_id`. Never publish it. |
| `_booth.html`, `_booth.css`, `_booth.js` | Sources, inlined into the page |
| `api/assign.js` | The assignment endpoint |
| `booth.html` | **Output.** |

## The inventory

66 tents, 64 assignable:

| Type | Numbers | Count | Booked |
|---|---|---|---|
| Regular | 124–141 | 18 | 18 — exactly full |
| Basic | 142–170 | 29 | 27 |
| Plus | 171–189 | 19 (17 for guests) | 16 |

177 and 178 are held for Naemi and Fredi. They show on the board as held and are
never offered for assignment. To hold another tent, put a name in
`reserved_for`; to release one, clear it.

## The booking list

Generated from the organiser's spreadsheet — never hand-edited:

```
python3 import_c5z.py        # reads ../niuway_c5_checkin.xlsx
python3 gen_booth.py
```

`import_c5z.py` writes `c5z-bookings.csv` (one line per tent, so a guest with
three tents has three lines) and `c5z-addons.csv` (one line per add-on with its
quantity). Both are git-ignored: they carry real addresses. Re-run both scripts
whenever the sheet changes.

A guest can hold several tents of mixed types. The screen groups them by type
and assigns one number per tent, tracking "2 von 4 Zelten vergeben".

## Type names

The sheet sells `Comfort Zelt Regular / Large / Extra Large C5Z`. The numbering
uses niuway's names. `PRODUCT_TO_POOL` in `gen_booth.py` maps between them:

| Product | Pool | Numbers |
|---|---|---|
| Comfort Zelt Regular | Regular | 124–141 |
| Comfort Zelt Large | Basic | 142–170 |
| Comfort Zelt Extra Large | Plus | 171–189 |

The build prints the booked count against each pool, so a wrong mapping shows up
immediately as a shortfall. Regular came out at exactly 18 of 18 once the range
was corrected to 124–141, which is what confirms the mapping.

## The PIN

Assigning and releasing need `BOOTH_PIN`, a Vercel environment variable
(**Settings → Environment Variables**, then redeploy).

On a device with no PIN yet the page shows a **Booth-PIN** field at the top.
Staff type it once, it is kept on that device, and the field disappears. Tapping
a tent number before the PIN is set opens that field with the reason and then
carries on with the assignment; a wrong PIN reopens it and retries. "PIN ändern"
in the footer brings it back.

**This one is a real gate, not a decorative one.** The pin is never in the page —
it is compared on the server — so someone who opens `booth.html` can look at the
board but cannot assign anything. Reading is deliberately open, because every
phone at the booth needs the same picture and the page holds no addresses.

Without `BOOTH_PIN` set, assignment answers 503 with a message saying so.

## Pick-up items

`c5z-pickup.csv` (`email,first,last,item,qty`) is what a guest collects at the
booth rather than finds in their tent. The screen shows it first, in a yellow
block headed **Abholen — jetzt mitgeben**, above the add-ons that are already
set up in the tent.

**A collected tent is never given a pitch number.** Seven of the pick-up rows are
tents — 5 Zelt Large, 2 Zelt Regular — and those guests carry them away and pitch
them themselves. They are handed stock, not a place on the field. The booth shows
them under Abholen and offers no numbers at all, and the guest page tells them
there is no pitch number rather than promising one at the booth.

Most pick-up guests have no pitched tent at all. Their card says **Nur Abholung —
kein Stellplatz**. Two of the fifteen also have a pitch, and get both.

This file also carries the guests' names, which is why the booth now shows one.

> **The current file is transcribed from a screenshot, not exported.** Two of the
> fifteen addresses are confirmed against `c5z-bookings.csv`; the other thirteen
> appear nowhere else, so a single mistyped character would hide that guest with
> no error. Replace it with the real export.

## Searching for a guest

Two letters into the address field and matching addresses drop down; tap one and
the booking opens. Prefix matches come first, so typing a surname finds it
before the domains do.

The matching happens on the server, in `api/directory.js`, because `booth.html`
holds no addresses to match against. The list lives in Redis behind the PIN and
is seeded from the booking file:

```
python3 seed_directory.py <pin>
```

Re-run that whenever the booking list changes. Without it the field still works
— staff type the full address as before.

**The PIN is the only thing protecting that list.** A four-digit PIN is ten
thousand guesses against an endpoint that returns real addresses; a longer
`BOOTH_PIN` is worth the one time each phone types it.

## The list of who is where

**Belegung** shows every assigned tent with the guest's address, above the grid
of free and taken numbers.

That list is the one thing the endpoint will not hand out without the PIN. The
page itself carries no addresses — staff type one to look a guest up, and it is
stored only at the moment a tent is actually assigned. An open
`GET /api/assign` returns tent numbers and hashes; `GET /api/assign?pin=…`
returns the addresses too. So the addresses live in your Redis store and reach
nobody without the PIN.

## Confirming an assignment

Tapping a number does not assign it. It opens a confirmation showing the number,
the type and the guest's address, with **Bestätigen** and **Abbrechen** — so a
mis-tap at a busy counter costs a tap, not a wrong tent.

## What is in the page

Tent numbers, types, add-on names and quantities, the two staff names on the
held tents, and `sha256(salt + address)` per booking. No addresses.

Assigned addresses live in Redis, not in the page, and are served only with the
PIN.
