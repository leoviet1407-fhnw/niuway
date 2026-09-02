// Check-in store. GET returns who has checked in, POST records or undoes one.
//
// Storage is Upstash Redis over its REST API — no npm packages, no build step,
// just fetch. Add it in the Vercel dashboard under Storage and the two
// environment variables below appear on their own.
//
// With no store configured this answers 503 and the page hides check-in
// entirely, so the site keeps working as a plain static file.
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "ggf26:checkin";
const TENT = /^[A-Z0-9]{1,6}:[A-Za-z0-9-]{1,8}$/;   // "C3:95"

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
      const flat = (await redis(["HGETALL", KEY])) || [];
      const tents = {};
      for (let i = 0; i < flat.length; i += 2) tents[flat[i]] = Number(flat[i + 1]) || 0;
      return res.status(200).json({ tents });
    }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const tent = String(body.tent || "");
      if (!TENT.test(tent)) return res.status(400).json({ error: "bad tent" });
      if (body.undo) await redis(["HDEL", KEY, tent]);
      else await redis(["HSET", KEY, tent, String(Date.now())]);
      return res.status(200).json({ tent, checked: !body.undo });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
