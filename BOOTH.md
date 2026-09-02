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

62 tents, 60 assignable:

| Type | Numbers | Count |
|---|---|---|
| Regular | 128–141 | 14 |
| Basis | 142–170 | 29 |
| Plus | 171–189 | 19 |

177 and 178 are held for Naemi and Fredi. They show on the board as held and are
never offered for assignment. To hold another tent, put a name in
`reserved_for`; to release one, clear it.

## The booking list

```
email,tent_type,addons,order_id
anna.berger@example.com,Plus,Bettwäsche x2; Kühlbox x1,900001
tobias.klein@example.com,Basis,Bettwäsche x1,900002
lena.hofmann@example.com,Regular,,900003
```

`tent_type` is `Regular`, `Basis` or `Plus`. `addons` is a semicolon-separated
list, each `Name xN` — leave it empty for none. No tent number: the booth
assigns that on arrival. The file currently holds three demo rows; replace them
with the organiser's export.

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

## What is in the page

Tent numbers, types, add-on names and quantities, the two staff names on the
held tents, and `sha256(salt + address)` per booking. No addresses.
