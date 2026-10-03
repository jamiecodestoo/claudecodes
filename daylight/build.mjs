// Builds dist/: the site, plus a real page for every case study and section, so each link
// has its own tab title and its own preview card when shared. Run: node build.mjs
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';

const SITE = 'https://www.jameschugh.com';
const NAME = 'James Chugh';
const HEAD = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n';
const src = readFileSync('index.html', 'utf8');

const HOME = { path: '/', title: NAME, og: 'home',
  desc: 'James Chugh, product designer. A painted valley of the places I’ve worked, and the numbers my work moved.' };
const PAGES = [
  HOME,
  { path: '/work/eazydiner', title: `The Coupon Hunter · EazyDiner | ${NAME}`, og: 'eazydiner',
    desc: 'Finding the best coupon shouldn’t feel like a treasure hunt. How I redesigned the moment you pay for dinner at EazyDiner: +41% payment success.' },
  { path: '/work/makemytrip', title: `Special Requests · MakeMyTrip | ${NAME}`, og: 'makemytrip',
    desc: 'Skip the calls. How I helped guests ask hotels for what they need on MakeMyTrip: 4,500+ bookings a day, hotel replies up from 16% to 35%.' },
  { path: '/work/swipr', title: `Swipr.AI · MakeMyTrip | ${NAME}`, og: 'swipr',
    desc: 'Swipe right on your next stay. A GenAI hotel search concept, runner-up at the MakeMyTrip AI Deathon.' },
  { path: '/work/lastlook', title: `LastLook | ${NAME}`, og: 'lastlook',
    desc: 'LastLook, my own iOS app that reminds you to check your essentials before you leave. Case study coming soon.' },
  { path: '/work/campusx', title: `CampusX | ${NAME}`, og: 'campusx',
    desc: 'CampusX, the failed app that got me into design. Case study coming soon.' },
  { path: '/journey', title: `The journey | ${NAME}`, og: 'home', desc: 'Engineer by degree, designer by obsession. Nine stops between 2021 and now.' },
  { path: '/work', title: `Work | ${NAME}`, og: 'home', desc: 'Case studies from EazyDiner, MakeMyTrip and my own apps.' },
  { path: '/about', title: `About me | ${NAME}`, og: 'home', desc: HOME.desc },
  { path: '/contact', title: `Say hi | ${NAME}`, og: 'home', desc: 'Book a free call about your website, brand or product, or just say hi.' },
];

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const page = p => {
  const url = SITE + (p.path === '/' ? '/' : p.path);
  const meta = `<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${NAME}">
<meta property="og:url" content="${url}"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.desc)}">
<meta property="og:image" content="${SITE}/v2/og/${p.og}.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(p.title)}"><meta name="twitter:description" content="${esc(p.desc)}"><meta name="twitter:image" content="${SITE}/v2/og/${p.og}.jpg">
`;
  return HEAD + src
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>\n${meta}`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(p.desc)}">`);
};

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/work', { recursive: true });
for (const p of PAGES) writeFileSync(p.path === '/' ? 'dist/index.html' : `dist${p.path}.html`, page(p));
cpSync('v2', 'dist/v2', { recursive: true });
cpSync('404.html', 'dist/404.html');
const today = new Date().toISOString().slice(0, 10);
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map(p => `  <url><loc>${SITE}${p.path === '/' ? '/' : p.path}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`built ${PAGES.length} pages`);
