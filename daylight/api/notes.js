// The notes wall, shared by every visitor on every browser and device.
// GET  /api/notes  → the latest notes (never emails)
// POST /api/notes  → pin a note; the email is kept privately, apart from the wall
//
// Storage: Upstash Redis over its REST API (no packages needed).
// In Vercel: Storage → Upstash for Redis → connect it to this project. That adds
// KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN) for you.

const { randomUUID } = require('node:crypto');
const dns = require('node:dns').promises;

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

// keep the wall readable: no keyboard mashing, no one-word or number-only notes
// a word is junk when its letter case flips back and forth (mHgTtDhrm…) or it is nearly all consonants (Cqgyhjcza)
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'poiuytrewq', 'lkjhgfdsa', 'mnbvcxz'];
function junkWord(w) {
  const L = w.replace(/[^A-Za-z]/g, '');
  if (L.length >= 4 && ROWS.some(r => r.includes(L.toLowerCase()))) return true;  // asdf, qwer
  if (L.length < 6) return false;
  let flips = 0;
  for (let i = 1; i < L.length; i++) if ((L[i] === L[i].toUpperCase()) !== (L[i - 1] === L[i - 1].toUpperCase())) flips++;
  const vowels = (L.match(/[aeiouy]/gi) || []).length / L.length;
  const run = Math.max(0, ...(L.match(/[^aeiou]+/gi) || []).map(r => r.length));
  return (flips >= 4 && L.length >= 8) || (vowels < 0.25 && run >= 7 && L.length >= 8);
}
const junkText = t => String(t || '').split(/\s+/).some(junkWord);
// notes taken down by hand: any note whose name, text, role or company contains one of these is hidden
const BLOCK = ['lihwak', 'testing the functionality and and validation', 'ai slop', 'uh uh'];

// an email has to look like a real person's: proper shape, a real-looking name and domain, no throwaway or placeholder services, no common typos
const FAKE_DOMAINS = ['example.com', 'example.org', 'example.net', 'test.com', 'test.test', 'test.in', 'fake.com', 'fakemail.com', 'noemail.com', 'none.com', 'abc.com', 'asdf.com', 'xyz.com', 'domain.com', 'email.test', 'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'sharklasers.com', '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'tempmail.net', 'yopmail.com', 'trashmail.com', 'throwawaymail.com', 'getnada.com', 'maildrop.cc', 'dispostable.com', 'fakeinbox.com', 'mailnesia.com', 'mintemail.com', 'moakt.com', 'emailondeck.com', 'spamgourmet.com', 'mohmal.com', 'burnermail.io'];
const TYPO_DOMAINS = ['gmial.com', 'gamil.com', 'gmai.com', 'gmail.co', 'gmail.cm', 'gmaill.com', 'gmal.com', 'gnail.com', 'gmail.con', 'hotmial.com', 'hotmal.com', 'yaho.com', 'yahooo.com', 'yahoo.co', 'outlok.com', 'outlook.co'];
const FAKE_LOCALS = ['test', 'testing', 'fake', 'asdf', 'qwerty', 'abc', 'abcd', 'xyz', 'noreply', 'no-reply', 'nobody', 'none', 'null', 'email', 'example', 'user', 'admin', 'name', 'sample', 'demo', 'spam', 'trash'];
function emailOk(e) {
  e = String(e || '').trim().toLowerCase();
  const m = /^([a-z0-9][a-z0-9._%+-]{0,63})@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})$/.exec(e);
  if (!m || e.length > 120) return false;
  const [, local, domain] = m;
  if (/\.\.|\.$|^\./.test(local) || /[._%+-]{2,}/.test(local)) return false;
  if (FAKE_DOMAINS.includes(domain) || TYPO_DOMAINS.includes(domain)) return false;
  if (FAKE_LOCALS.includes(local.replace(/[0-9._-]+$/, ''))) return false;
  if ((local.match(/[a-z]/g) || []).length < 2) return false;                    // 12345@…, a@…
  if (/^(.)\1{3,}/.test(local) || /(.)\1{4,}/.test(local)) return false;
  if (/lihwak/.test(e) || /(.)\1{3,}/.test(domain)) return false;
  if (domain.split('.').slice(0, -1).some(p => p.length >= 6 && ((p.match(/[aeiou]/g) || []).length / p.length) < .2)) return false;        // aaaaa@, hellooooo@
  if (junkText(local.replace(/[0-9._%+-]+/g, ' ')) || domain.split('.').slice(0, -1).some(p => junkWord(p))) return false;  // keyboard mashing
  return true;
}

// the domain has to exist and be able to receive mail; a lookup that merely times out lets the note through, a definite "no such domain" does not
async function domainReal(email) {
  const d = email.split('@')[1].toLowerCase();
  const dead = e => e && (e.code === 'ENOTFOUND' || e.code === 'ENODATA' || e.code === 'NXDOMAIN');
  const t = new Promise(r => setTimeout(() => r('slow'), 2500));
  try {
    const r = await Promise.race([dns.resolveMx(d).then(x => x.length > 0), t]);
    if (r === 'slow') return true;
    if (r) return true;
  } catch (e) { if (!dead(e)) return true; }
  try { const r = await Promise.race([dns.resolve4(d).then(x => x.length > 0), t]); return r === 'slow' ? true : r; } catch (e) { return !dead(e); }
}

// a note has to read like something a person meant: not interjections ("uh uh ah ah"), not the same words over and over, and with a couple of real words in it
const FILLER = new Set(['uh', 'uhh', 'uhm', 'um', 'umm', 'ah', 'aah', 'ahh', 'oh', 'ohh', 'eh', 'hm', 'hmm', 'hmmm', 'mm', 'mmm', 'huh', 'ha', 'haha', 'hahaha', 'hehe', 'heh', 'lol', 'lmao', 'blah', 'bla', 'la', 'na', 'nah', 'ya', 'yay', 'woo', 'yeah', 'yep', 'nope', 'test', 'testing', 'asdf', 'abc', 'xyz', 'zzz', 'ok', 'okay', 'hi', 'hey', 'hello', 'wow', 'yo']);
function nonsense(t) {
  const w = String(t || '').toLowerCase().match(/[\p{L}\p{M}']+/gu) || [], n = w.length;
  if (n < 2 || new Set(w).size < 2) return true;
  const uniq = new Set(w).size, fill = w.filter(x => FILLER.has(x) || /^(.)\1+$/.test(x)).length;
  const cnt = {}; w.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
  if (fill / n >= .5) return true;                                             // uh uh ah ah
  if (n >= 4 && uniq / n < .6) return true;                                    // the same few words again and again
  if (Math.max(...Object.values(cnt)) >= 3 && Math.max(...Object.values(cnt)) / n >= .3) return true;
  if (n >= 4) { const bg = {}; for (let i = 0; i < n - 1; i++) { const k = w[i] + ' ' + w[i + 1]; bg[k] = (bg[k] || 0) + 1; } if (Math.max(...Object.values(bg)) >= 2 && uniq / n < .75) return true; }
  return w.filter(x => x.length >= 3 && !FILLER.has(x) && (/[aeiouy]/.test(x) || !/[a-z]/.test(x))).length < 2;  // at least two real words
}
const blocked = n => { const t = [n.note, n.name, n.company, n.role].join(' ').toLowerCase(); return BLOCK.some(w => t.includes(w)); };
function noteOk(n) {
  if (blocked(n)) return false;
  const note = String(n.note || '').trim();
  const words = note.split(/\s+/).filter(w => /\p{L}/u.test(w));
  if (note.length < 8 || words.length < 2 || nonsense(note)) return false;
  if (!/\p{L}/u.test(String(n.name || ''))) return false;
  return ![n.note, n.name, n.company, n.role].some(junkText);
}

function clean(b) {
  const name = str(b.name, 40), note = str(b.note, 200), email = str(b.email, 120);
  if (!name || !note) return null;
  if (!EMAIL.test(email) || !emailOk(email)) return { bad: 'email' };
  if (!noteOk({ name, note, company: b.company, role: b.role })) return null;
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
      const notes = (raw || []).map(x => { try { return JSON.parse(x); } catch (_) { return null; } }).filter(Boolean).filter(noteOk);
      return res.status(200).json({ notes });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (body.website) return res.status(200).json({ ok: true }); // honeypot: bots fill every field
      const c = clean(body);
      if (!c) return res.status(400).json({ error: 'invalid' });
      if (c.bad || !(await domainReal(c.email))) return res.status(400).json({ error: 'email' });

      const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x').split(',')[0].trim();
      const rl = `notes:rl:${ip}`;
      const [, count] = await redis([['SET', rl, 0, 'EX', 3600, 'NX'], ['INCR', rl]]);  // works on every Redis version
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
