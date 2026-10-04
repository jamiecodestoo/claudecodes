// The notes wall, shared by every visitor on every browser and device.
// GET  /api/notes  → the latest notes (never emails)
// POST /api/notes  → pin a note; the email is kept privately, apart from the wall
//
// Storage: Upstash Redis over its REST API (no packages needed).
// In Vercel: Storage → Upstash for Redis → connect it to this project. That adds
// KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN) for you.

const { randomUUID } = require('node:crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const WALL = 'notes:wall';          // public notes, newest first
const CONTACTS = 'notes:contacts';  // name + email + note id, private
const KEEP = 300, SHOW = 60, PER_HOUR = 5;

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

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function clean(b) {
  const name = str(b.name, 40), note = str(b.note, 200), email = str(b.email, 120);
  if (!name || !note || !EMAIL.test(email)) return null;
  const photo = typeof b.photo === 'string' && b.photo.length < 60000 && PHOTO.test(b.photo) ? b.photo : '';
  const avatar = str(b.avatar, 16).replace(/[^a-z0-9]/gi, '');
  const company = str(b.company, 40), role = str(b.role, 40);
  const brand = b.brand && /^[a-z0-9]{1,60}$/.test(b.brand.s) && /^[0-9A-Fa-f]{6}$/.test(b.brand.h) ? { s: b.brand.s, h: b.brand.h } : null;
  const n = { id: randomUUID(), name, note, photo, avatar, at: Date.now() };
  if (company) n.company = company;
  if (role) n.role = role;
  if (company && brand) n.brand = brand;
  return { n, email };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'storage_not_connected' });

  try {
    if (req.method === 'GET') {
      const [raw] = await redis([['LRANGE', WALL, 0, SHOW - 1]]);
      const notes = (raw || []).map(x => { try { return JSON.parse(x); } catch (_) { return null; } }).filter(Boolean);
      return res.status(200).json({ notes });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (body.website) return res.status(200).json({ ok: true }); // honeypot: bots fill every field
      const c = clean(body);
      if (!c) return res.status(400).json({ error: 'invalid' });

      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();
      const rl = `notes:rl:${ip}`;
      const [count] = await redis([['INCR', rl], ['EXPIRE', rl, 3600, 'NX']]);
      if (count > PER_HOUR) return res.status(429).json({ error: 'slow_down' });

      await redis([
        ['LPUSH', WALL, JSON.stringify(c.n)], ['LTRIM', WALL, 0, KEEP - 1],
        ['LPUSH', CONTACTS, JSON.stringify({ id: c.n.id, name: c.n.name, email: c.email, at: c.n.at })], ['LTRIM', CONTACTS, 0, 1999],
      ]);
      return res.status(201).json({ note: c.n });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'storage_error' });
  }
};
