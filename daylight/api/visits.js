// Visitor counter for the "visitors so far" pill.
// POST /api/visits → counts this visitor (once per connection per day, bots skipped) and returns the total
// GET  /api/visits → the total
// Same Upstash Redis as the notes wall. Optional env VISITS_BASE adds visitors counted before this existed.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TOTAL = 'visits:total';
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|headless|lighthouse|pingdom|uptime/i;

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  const out = await r.json();
  const bad = out.find(x => x && x.error);
  if (bad) throw new Error(bad.error);
  return out.map(x => x.result);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'storage_not_connected' });
  const base = Math.max(0, parseInt(process.env.VISITS_BASE || '0', 10) || 0);

  try {
    if (req.method === 'POST' && !BOT.test(String(req.headers['user-agent'] || ''))) {
      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();
      const day = new Date().toISOString().slice(0, 10);
      const [fresh] = await redis([['SET', `visits:seen:${day}:${ip}`, 1, 'EX', 90000, 'NX']]);
      if (fresh === 'OK') { const [n] = await redis([['INCR', TOTAL]]); return res.status(200).json({ count: n + base }); }
    } else if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    const [v] = await redis([['GET', TOTAL]]);
    return res.status(200).json({ count: (parseInt(v, 10) || 0) + base });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'storage_error' });
  }
};
