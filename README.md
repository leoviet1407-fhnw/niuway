# Tent Finder — guest lookup page

One HTML file. A guest types the e-mail address they booked with and gets their
tent number, their campsite, a photo of it and a Google Maps link to it. German /
English, switchable top right. Lost or lonely, they get Alex on WhatsApp. No
server, no database, no build step — upload the file and you're done.

**Scope: C3, C9 and Green Camping (DJK) — 51 tents. C5Z is not included.**

Styling follows niuway.vercel.app: Barlow, `#174a5b`, white cards, 12 px radius,
the original logo.

> Everything in this folder is English except the guest-facing German strings in
> `_app.js` (object `T.de`), which are mirrored one-to-one by `T.en`.

## Two pages

| Page | Who | Built by |
|---|---|---|
| `index.html` | guests — C3, C9, Green Camping | `gen_tent_finder.py` |
| `booth.html` | staff at the C5Z booth | `gen_booth.py` — see `BOOTH.md` |

They share the salt, the logo and the SHA-256 helper, nothing else.

## The repository

**Push this `app` folder — it is the repository root.** It is self-contained:
nothing outside it is needed to build or deploy. The Aufbauten drawings and the
festival planning docs stay in the parent folder, out of git.

```
app/                  <- the repository root, and Vercel's too
  index.html          <- served at /
  api/checkin.js      <- served at /api/checkin
  bookings.csv        <- git-ignored, never pushed
  tents.csv  salt.txt  siteplan.py  gen_tent_finder.py  check.py
  _app.js  _app_style.css  _sha256.js  _logo.txt
```

`index.html` and `api/` sit at the root on purpose: Vercel then needs no Root
Directory setting, no framework preset and no build command. `.vercelignore`
keeps the sources out of the deployment.

If the drawings happen to be next to the folder, the build cross-checks against
them; if they are not, it skips that check and everything else is identical.

## Build

```
cd app
python3 gen_tent_finder.py
```

Writes `tent-finder.html` and `site/index.html`. `pymupdf` is needed only if the Aufbauten
drawings sit next to the folder, and it is optional — the build says when it
skips the cross-check.

| File | Role |
|---|---|
| `bookings.csv` | **Input.** `email,campsite,tent_no` — one line per tent. Never publish it. |
| `tents.csv` | **Input.** One line per tent; column `tent_no` is what guests see. |
| `salt.txt` | **Input.** Random value for the hashes. Don't delete it, or every hash changes. |
| `siteplan.py` | Tent count and model per campsite from the PDFs; photo and coordinates |
| `gen_tent_finder.py` | Builds the page |
| `_app_style.css`, `_app.js`, `_sha256.js`, `_logo.txt` | Inlined into the page |
| `tent-finder.html` | **Output.** The page as a fragment, for the Claude artifact |
| `index.html` | **Output.** The same page as a complete document — this is what Vercel serves |
| `api/checkin.js` | The check-in endpoint (Vercel serverless function) |

## tents.csv — what exists

`tents.csv` is the authority for what stands on each campsite. Three columns:

```
campsite,tent_no,model
C9,301,Comfort EXTRA Large
C9,302,Comfort EXTRA Large
C9,303,Comfort Regular
```

`model` must be one of `Comfort Regular`, `Comfort Large`, `Comfort EXTRA Large`.
The Aufbauten drawings are only cross-checked against this file, and every
difference is printed at build time — on site it is the drawing that is out of
date, so the file wins and the warning is there to be read, not silenced.

C9 currently holds the real numbers (301–312). C3 and Green Camping are still
empty, so those campsites have no tents on the page yet.

## The location link

Each result card carries a "Directions in Google Maps" link built from `COORDS`
in `siteplan.py`:

```python
COORDS = {
    "C3":  (49.323559, 8.561514),
    "C9":  (49.323692, 8.530419),
    "DJK": (49.330391, 8.558487),
}
```

The three campsites are 800 m to 2.2 km apart, so the link is doing real work —
it is the difference between a guest walking to the right field and the wrong
one. A campsite with no coordinates simply gets no link.

There is no picture on the card. The CAD drawings are never shown to guests, and
the drone-photo path was removed on 2026-09-02 — it is in git history if it is
ever wanted back.

## bookings.csv — who has what

```
email,campsite,tent_no,pos
flo@niuway.ch,C9,301,Pickup Tent
j.pointi@yahoo.de,C9,307,GG Accounts
j.pointi@yahoo.de,C9,308,GG Accounts
```

One line per tent — a booking of three tents becomes three lines. `pos` is the
Point of Sale column from the organiser's export, kept as exported.

**`pos` = `Pickup Tent`** marks the tent the materials and the tents are stored
in. That card is outlined and reads "Pickup tent — this is the tent the materials
and the tents are stored in" instead of the normal wording. Every other value is
treated as an ordinary booking.

`email,tent_no` also works when the number is unique across all campsites.
Addresses are case-insensitive.

The build reports, and does not resolve:

- **a tent booked to more than one address** (`!!`) — someone is going to turn up
  to an occupied tent, so this needs fixing in the source list, not in the app
- a tent number that is not in `tents.csv` — the line is skipped
- an ambiguous two-column line

## Language

DE / EN switch top right. The default comes from the browser language (German →
DE, otherwise EN) and is remembered in the browser. It covers the map flag
(`DU` / `YOU`), the landmark hint and the decimal separator — 2,4 m vs 2.4 m.

**All guest-facing text lives in one place:** the object `T` at the top of
`_app.js`, with `T.de` and `T.en` line by line in the same order, so the German
can be checked against the English without reading the rest of the code.

## Security — what the page does and doesn't do

**It does:**

- Carry **no e-mail address at all** in the HTML, only `sha256(salt + address)`.
  Downloading the file gets you no address list.
- Publish nothing but tent number, campsite and model — **no names**, no phone
  numbers, no booking references.
- Load nothing except the Google Fonts stylesheet, call no API, and store nothing
  but the language choice. No tracking, no backend.
- Pause for 30 seconds after five failed attempts, which slows down typing by hand.

**It doesn't:** a static page can only ever confirm or deny an address someone
already has. Anyone who knows an address and has the file can test it offline and
learn the tent number with it. That is as much as a guest learns at the info point
— no more, but no harder either.

If that isn't enough, it needs a server-side lookup (lookup on the server, rate
limit per IP) or a one-time token link per guest in the booking confirmation.
Neither is a big job — say the word.

**Before uploading:** only `tent-finder.html` goes on the web server.
`bookings.csv`, `tents.csv`, `salt.txt` and `maps/` stay local.

## Hosting it

Import the repository in Vercel and deploy it as it is — no Root Directory, no
framework, no build command. Then **Storage → Upstash for Redis → Connect** and
redeploy, which switches check-in on.

Check it:

```bash
curl https://<your-project>.vercel.app/api/checkin
```

`{"tents":{}}` means the store is connected. 503 means the Redis step is missing
or the project has not been redeployed since.

The same `index.html` also works with no backend at all — opened from disk, on
GitHub Pages, or as a Claude artifact. It probes `api/checkin` once on load and
hides check-in when there is nothing there.

**Before the first push, run `git status` and check `bookings.csv` is not in
it.** The `.gitignore` excludes it, along with `mail/` and `Aufbauten/`, because
it holds the booking list in plain text and GitHub history keeps deleted files.
`tents.csv` and `salt.txt` are deliberately tracked — no personal data in the
first, and losing the second changes every hash and breaks every lookup.

A public site is readable by anyone with the URL. The page carries no addresses,
only hashes, but someone who already knows an address can confirm it and learn
the tent number — the same as asking at the booth. `noindex` keeps it out of
search results; it does not make it private.

## Check-in and check-out

A guest who looks themselves up gets **Jetzt einchecken / Check in now**. Once
checked in, the card reminds them to check out when they leave and offers
**Auschecken / Check out** — behind a confirmation,
because it says the tent gets taken down afterwards and a mis-tap at the wrong
moment is expensive.

In the overview a tent is neutral before arrival, **green** once checked in and
**red** once checked out, so a red chip means "ready to dismantle". The header
counts both.

Rows are `{"i": arrived, "o": left}` in Redis. Rows written before check-out
existed are a bare timestamp and read as arrived-only, so nothing had to be
migrated. Checking in again after a check-out clears the check-out.

## The overview for flo@niuway.ch

Addresses listed in `ADMINS` (in `gen_tent_finder.py`) get one extra card after
looking themselves up: every tent on every campsite, with its model and sales
channel, and a booked/free count. Read-only — a glance, not an editor.

Checked-in tents are green, checked-out tents red, with counts in the header. It deliberately holds
**no addresses**. Anything the page can display, anyone
holding the file can read out of it, so the overview is limited to what is
harmless in public: numbers, models, channels. The gate is Flo's own address,
which is a speed bump rather than a login — proportionate, because there is
nothing personal behind it.

## Still to fill in

- The model for C3 tent 92 — the row in `tents.csv` has an empty model column.
  Nothing on the card shows it, so this is bookkeeping, not a visible gap.
- Nothing else — `CONTACT` is Alex on WhatsApp, +41 76 541 13 25.
