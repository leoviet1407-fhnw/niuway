// C5Z booth: which tent each guest was given.
//
// GET             -> {assign: {"128": {"h": <hash>, "at": <ms>}}}
// GET ?pin=<pin>   -> the same, plus "m": the guest's address on each row
// POST {tent, hash, mail, pin}       assign a tent to that guest
// POST {tent, pin, release: true}    free it again
//
// Writes need BOOTH_PIN (a Vercel environment variable). The pin is never in
// the page — staff type it once and it is checked here, so this is a real gate
// rather than a decorative one.
//
// Addresses are never in booth.html. Staff type one to look a guest up, and it
// is stored here only when a tent is actually assigned, so the "who is where"
// list can be read back. That list is the one thing this endpoint will not hand
// out without the pin: an open GET returns hashes only.
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PIN = process.env.BOOTH_PIN;
const KEY = "ggf26:c5z:assign";
const TENT = /^[0-9]{1,4}$/;
const HASH = /^[a-f0-9]{64}$/;

async function redis(command) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error("store answered " + r.status);
  return (await r.json()).result;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!URL || !TOKEN) {
    return res.status(503).json({ error: "no store configured",
      hint: "Add Upstash Redis in Vercel → Storage, then redeploy." });
  }
  try {
    if (req.method === "GET") {
      const url = new URL(req.url, "http://x");
      const named = PIN && url.searchParams.get("pin") === PIN;
      const flat = (await redis(["HGETALL", KEY])) || [];
      const assign = {};
      for (let i = 0; i < flat.length; i += 2) {
        let row;
        try { row = JSON.parse(flat[i + 1]); } catch { continue; }
        if (!named) delete row.m;          // no pin, no addresses
        assign[flat[i]] = row;
      }
      return res.status(200).json({ assign, locked: !PIN, named: !!named });
    }
    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      if (!PIN) return res.status(503).json({ error: "no pin set",
        hint: "Add BOOTH_PIN in Vercel → Settings → Environment Variables, then redeploy." });
      if (String(b.pin || "") !== PIN) return res.status(401).json({ error: "wrong pin" });

      const tent = String(b.tent || "");
      if (!TENT.test(tent)) return res.status(400).json({ error: "bad tent" });

      if (b.release) {
        await redis(["HDEL", KEY, tent]);
        return res.status(200).json({ tent, assigned: false });
      }
      const hash = String(b.hash || "");
      if (!HASH.test(hash)) return res.status(400).json({ error: "bad hash" });

      // one tent, one guest: refuse rather than overwrite someone silently
      const held = await redis(["HGET", KEY, tent]);
      if (held) {
        let who = null;
        try { who = JSON.parse(held); } catch { /* treat as taken */ }
        if (!who || who.h !== hash) {
          return res.status(409).json({ error: "already assigned", tent, held: who });
        }
      }
      const row = { h: hash, at: Date.now(), by: String(b.by || "").slice(0, 24) };
      const mail = String(b.mail || "").trim().toLowerCase();
      if (mail && mail.length < 160 && mail.includes("@")) row.m = mail;
      await redis(["HSET", KEY, tent, JSON.stringify(row)]);
      return res.status(200).json({ tent, assigned: true, row });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
