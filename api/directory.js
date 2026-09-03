// Type-ahead search for the booth, and nothing else.
//
//   GET  ?pin=<pin>&q=kram   -> {matches: ["kramberg.markus@gmail.com", ...]}
//   POST {pin, entries: [..]} -> replaces the list (seeded from the booking CSV)
//
// booth.html holds no addresses — only sha256(salt + address) — so it cannot
// match on the first few letters of one. The list lives here instead, in the
// same Redis store, and is only ever returned to a request carrying the pin.
//
// The pin is the whole protection for this list. Use a long one: a four-digit
// pin is ten thousand guesses, and this endpoint returns real addresses.
const STORE = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PIN = process.env.BOOTH_PIN;
const KEY = "ggf26:c5z:directory";
const LIMIT = 15;

async function redis(command) {
  const r = await fetch(STORE, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error("store answered " + r.status);
  return (await r.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!STORE || !TOKEN) return res.status(503).json({ error: "no store configured" });
  if (!PIN) return res.status(503).json({ error: "no pin set" });

  try {
    if (req.method === "GET") {
      const url = new URL(req.url, "http://x");
      if (url.searchParams.get("pin") !== PIN) return res.status(401).json({ error: "wrong pin" });
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      if (q.length < 2) return res.status(200).json({ matches: [] });
      const all = JSON.parse((await redis(["GET", KEY])) || "[]");
      // addresses that start with what was typed come first — that is how
      // someone searches when they are reading a name off a phone screen
      const starts = [], holds = [];
      for (const m of all) {
        if (m.startsWith(q)) starts.push(m);
        else if (m.includes(q)) holds.push(m);
        if (starts.length >= LIMIT) break;
      }
      return res.status(200).json({ matches: starts.concat(holds).slice(0, LIMIT) });
    }
    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      if (String(b.pin || "") !== PIN) return res.status(401).json({ error: "wrong pin" });
      const entries = Array.isArray(b.entries) ? b.entries : null;
      if (!entries) return res.status(400).json({ error: "entries must be an array" });
      const clean = [...new Set(entries
        .map((e) => String(e).trim().toLowerCase())
        .filter((e) => e.includes("@") && e.length < 160))].sort();
      await redis(["SET", KEY, JSON.stringify(clean)]);
      return res.status(200).json({ stored: clean.length });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
