/*
 * Sketchbook portfolio: a playable landing page.
 * Tools: move, highlighter (4 colours), sticky, stamp, clear.
 * The hero is a board of draggable things; "Recruiter mode" tidies it into
 * a fact sheet; a "James" cursor demonstrates what's possible.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;
  const board = $('#board');

  // ------------------------------------------------------------ theme
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => { const t = root.getAttribute('data-theme'); return t ? t === 'dark' : mq.matches; };
  const themeBtn = $('#theme');
  const syncTheme = () => themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
  themeBtn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('jc-theme', next); } catch (e) {}
    syncTheme(); renderInk();
  });
  mq.addEventListener && mq.addEventListener('change', () => { syncTheme(); renderInk(); });
  syncTheme();

  // ------------------------------------------------------------ toast
  const toastEl = $('#toast');
  let toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 2400);
  }

  // ------------------------------------------------------------ hero layout (messy ⇄ tidy)
  const items = $$('.board .item');
  function applyLayout() {
    const tidy = board.classList.contains('tidy');
    items.forEach(el => {
      const [x, y, r] = (tidy ? el.dataset.t : el.dataset.m).split(',').map(Number);
      el.style.setProperty('--x', x); el.style.setProperty('--y', y); el.style.setProperty('--r', r + 'deg');
    });
  }
  applyLayout();
  const tidyInput = $('#tidy');
  function setTidy(on) {
    tidyInput.checked = on;
    board.classList.toggle('tidy', on);
    items.forEach(el => { el.style.setProperty('--dx', '0px'); el.style.setProperty('--dy', '0px'); });
    applyLayout();
    toast(on ? 'Tidied up. Everything a recruiter needs, in one glance.' : 'Back to the fun version.');
  }
  tidyInput.addEventListener('change', () => setTidy(tidyInput.checked));

  // ------------------------------------------------------------ tools
  let tool = 'move', color = '#FFE14D';
  const toolBtns = $$('.tool');
  function setTool(t) {
    if (t === 'clear') { strokes.length = 0; renderInk(); $('#layer').innerHTML = ''; toast('Cleared your marks.'); t = 'move'; }
    tool = t;
    toolBtns.forEach(b => b.classList.toggle('on', b.dataset.tool === t));
    document.body.className = document.body.className.replace(/\btool-\w+/g, '').trim() + ' tool-' + t;
  }
  toolBtns.forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $$('.sw').forEach(b => b.addEventListener('click', () => {
    color = b.dataset.c; $$('.sw').forEach(x => x.classList.toggle('on', x === b)); setTool('marker');
  }));
  setTool('move');

  addEventListener('keydown', e => {
    const a = document.activeElement;
    if (a && (a.isContentEditable || /INPUT|TEXTAREA/.test(a.tagName)) && e.key !== 'Escape') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'v' || k === 'escape') { setTool('move'); if (a && a.isContentEditable) a.blur(); }
    else if (k === 'h') setTool('marker');
    else if (k === 's') setTool('sticky');
    else if (k === 'e') setTool('stamp');
    else if (k === 't') setTidy(!tidyInput.checked);
    else if ('1234'.includes(k)) $$('.sw')[+k - 1].click();
  });

  // ------------------------------------------------------------ dragging
  let selected = null;
  function select(el) { if (selected && selected !== el) selected.classList.remove('selected'); selected = el; el && el.classList.add('selected'); }
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.item, .user-sticky, .stamp')) select(null); });

  function makeDraggable(el) {
    el.addEventListener('pointerdown', e => {
      if (tool !== 'move' || e.button !== 0) return;
      if (el.isContentEditable && document.activeElement === el) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY;
      const bx = parseFloat(el.style.getPropertyValue('--dx')) || 0, by = parseFloat(el.style.getPropertyValue('--dy')) || 0;
      let lastX = sx, vel = 0, moved = false;
      el.classList.add('dragging'); select(el);
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        vel = vel * 0.7 + (ev.clientX - lastX) * 0.3; lastX = ev.clientX;
        el.style.setProperty('--dx', (bx + dx) + 'px'); el.style.setProperty('--dy', (by + dy) + 'px');
        el.style.setProperty('--tilt', clamp(vel * 0.9, -14, 14) + 'deg');
      };
      const up = () => {
        el.classList.remove('dragging'); el.style.setProperty('--tilt', '0deg');
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        if (!moved && el.classList.contains('user-sticky')) el.focus();
        if (!moved && el.tagName === 'A') el.click();
      };
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }
  items.forEach(makeDraggable);

  // ------------------------------------------------------------ highlighter ink (viewport canvas, strokes in page space)
  const ink = $('#ink'), ictx = ink.getContext('2d');
  const strokes = [];
  let live = null, dpr = 1;
  function sizeInk() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    ink.width = Math.round(innerWidth * dpr); ink.height = Math.round(innerHeight * dpr);
    ink.style.width = innerWidth + 'px'; ink.style.height = innerHeight + 'px';
    renderInk();
  }
  function renderInk() {
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ictx.clearRect(0, 0, innerWidth, innerHeight);
    ictx.translate(-scrollX, -scrollY);
    ictx.lineCap = 'round'; ictx.lineJoin = 'round';
    for (const s of strokes) {
      if (s.pts.length < 1) continue;
      ictx.globalAlpha = isDark() ? 0.5 : 0.62;
      ictx.strokeStyle = s.c; ictx.lineWidth = 22;
      ictx.beginPath();
      const p = s.pts;
      ictx.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) ictx.lineTo(p[0][0] + 0.1, p[0][1]);
      for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ictx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
      if (p.length > 1) ictx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ictx.stroke();
    }
    ictx.globalAlpha = 1;
  }
  let raf = 0;
  const queueInk = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; renderInk(); }); };
  addEventListener('scroll', queueInk, { passive: true });
  addEventListener('resize', sizeInk);
  ink.addEventListener('pointerdown', e => {
    if (tool !== 'marker') return;
    e.preventDefault(); ink.setPointerCapture(e.pointerId);
    live = { c: color, pts: [[e.pageX, e.pageY]] }; strokes.push(live); queueInk();
  });
  ink.addEventListener('pointermove', e => {
    if (!live) return;
    const l = live.pts[live.pts.length - 1];
    if (Math.hypot(e.pageX - l[0], e.pageY - l[1]) > 2) { live.pts.push([e.pageX, e.pageY]); queueInk(); }
  });
  const endStroke = () => { if (live && strokes.length === 1 && !sessionFlag.inked) { sessionFlag.inked = true; toast('Nice. Press 1–4 to change colour, S for a sticky.'); } live = null; };
  ink.addEventListener('pointerup', endStroke); ink.addEventListener('pointercancel', endStroke);
  const sessionFlag = {};
  sizeInk();

  // ------------------------------------------------------------ stickies and stamps
  const layer = $('#layer');
  const STICKY = ['s-yellow', 's-pink', 's-mint', 's-blue', 's-lilac'];
  const STAMPS = [['hire him!', 0], ['wow', 0], ['★', 1], ['👀', 1], ['10/10', 0], ['ship it', 0], ['✦', 1]];
  let si = 0, st = 0;
  document.addEventListener('pointerdown', e => {
    if (tool !== 'sticky' && tool !== 'stamp') return;
    if (e.target.closest('.toolbar, .top, .user-sticky, .stamp, button, a, input, label')) return;
    e.preventDefault();
    const r = (Math.random() * 10 - 5).toFixed(1) + 'deg';
    if (tool === 'sticky') {
      const n = document.createElement('div');
      n.className = 'user-sticky ' + STICKY[si++ % STICKY.length];
      n.contentEditable = 'true'; n.setAttribute('role', 'textbox'); n.setAttribute('aria-label', 'Your sticky note');
      n.dataset.ph = 'write something…';
      n.style.left = (e.pageX - 20) + 'px'; n.style.top = (e.pageY - 20) + 'px'; n.style.setProperty('--r', r);
      layer.appendChild(n); makeDraggable(n); setTool('move');
      setTimeout(() => n.focus(), 0);
    } else {
      const [txt, big] = STAMPS[st++ % STAMPS.length];
      const n = document.createElement('div');
      n.className = 'stamp' + (big ? ' big' : ''); n.textContent = txt;
      n.style.left = (e.pageX - 30) + 'px'; n.style.top = (e.pageY - 24) + 'px'; n.style.setProperty('--r', r);
      layer.appendChild(n); makeDraggable(n);
    }
  });

  // ------------------------------------------------------------ "You" label
  const you = $('#you');
  if (fine) {
    addEventListener('pointermove', e => { you.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`; you.classList.add('on'); }, { passive: true });
    document.addEventListener('pointerleave', () => you.classList.remove('on'));
  }

  // ------------------------------------------------------------ scroll reveals
  setTimeout(() => $$('.board .hl').forEach(h => h.classList.add('on')), reduce ? 0 : 450);
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('on'); $$('.hl', en.target).forEach((h, i) => { h.style.setProperty('--d', (0.25 + i * 0.25) + 's'); h.classList.add('on'); }); io.unobserve(en.target); }
  }), { threshold: 0.6, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal, .page-title, .section-title, .big-sticky h2').forEach(el => io.observe(el));

  // the path draws itself as you scroll
  const pathSec = $('#path'), pathLine = $('#pathLine'), stops = $$('.stops li');
  pathLine.setAttribute('pathLength', '1');
  pathLine.style.strokeDasharray = '1';
  function drawPath() {
    const r = pathSec.getBoundingClientRect();
    const p = clamp((innerHeight * 0.85 - r.top) / (r.height * 0.9), 0, 1);
    pathLine.style.strokeDashoffset = String(1 - p);
    stops.forEach((li, i) => li.classList.toggle('on', p >= i / (stops.length - 1) * 0.94 + 0.02 || innerWidth <= 860 && p > 0.05));
  }
  addEventListener('scroll', drawPath, { passive: true }); drawPath();

  // ------------------------------------------------------------ small components
  const flip = $('#flip');
  flip.addEventListener('click', () => flip.setAttribute('aria-pressed', flip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
  $$('.frame').forEach(f => {
    const dim = $('.fdim', f), body = $('.fbody', f);
    const set = () => { const r = body.getBoundingClientRect(); dim.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`; };
    f.addEventListener('pointerenter', set); f.addEventListener('focus', set);
    f.addEventListener('click', () => toast(`${$('b', f).textContent} case study is being written. Coming soon.`));
  });
  $$('[data-todo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); toast('Link coming soon.'); }));
  const sizeLabel = () => { $('#boardSize').textContent = `${Math.round(board.clientWidth)} × ${Math.round(board.clientHeight)}`; };
  addEventListener('resize', sizeLabel); sizeLabel();

  // ------------------------------------------------------------ James's cursor
  const jc = $('#jc'), bubble = $('#jcBubble');
  let jx = -120, jy = -120;
  const place = () => { jc.style.transform = `translate(${jx}px, ${jy}px)`; };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function glide(x, y, ms, onStep) {
    const x0 = jx, y0 = jy, t0 = performance.now();
    const cx = (x0 + x) / 2 + (y - y0) * 0.18, cy = (y0 + y) / 2 - (x - x0) * 0.18;  // a gentle arc
    return new Promise(res => {
      const step = now => {
        const t = clamp((now - t0) / ms, 0, 1), e = ease(t);
        jx = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * x;
        jy = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * y;
        place(); onStep && onStep(e);
        t < 1 ? requestAnimationFrame(step) : res();
      };
      requestAnimationFrame(step);
    });
  }
  const rel = el => { const b = board.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; };
  const say = async (msg, ms = 2600) => { bubble.textContent = msg; bubble.classList.add('on'); await sleep(ms); bubble.classList.remove('on'); };
  const onScreen = () => board.getBoundingClientRect().bottom > 200;

  function circle(el) {
    const r = rel(el), pad = 14;
    const w = r.w + pad * 2, h = r.h + pad * 1.4;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'scribble'); svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.style.left = (r.x - pad) + 'px'; svg.style.top = (r.y - pad * 0.5) + 'px';
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const cx = w / 2, cy = h / 2, rx = w / 2 - 3, ry = h / 2 - 3;
    let d = '';
    for (let i = 0; i <= 64; i++) { const a = -2.2 + i / 64 * Math.PI * 2.15, k = 1 + 0.04 * Math.sin(i * 0.7); d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rx * k).toFixed(1) + ' ' + (cy + Math.sin(a) * ry * k).toFixed(1); }
    p.setAttribute('d', d); svg.appendChild(p); board.appendChild(svg);
    p.style.setProperty('--len', p.getTotalLength());
    return svg;
  }

  async function choreography() {
    if (reduce || innerWidth <= 860) { jc.style.display = 'none'; return; }
    await sleep(1500);
    jx = board.clientWidth + 40; jy = board.clientHeight * 0.3; place();
    // 1. pick up a sticky and move it
    const s = $('#stickyBuild'), sr = rel(s);
    await glide(sr.x + sr.w * 0.55, sr.y + sr.h * 0.4, 1100);
    jc.classList.add('press'); s.classList.add('dragging'); select(s);
    const bdx = parseFloat(s.style.getPropertyValue('--dx')) || 0, bdy = parseFloat(s.style.getPropertyValue('--dy')) || 0;
    const sx = jx, sy = jy;
    await glide(sx - 80, sy + 36, 900, () => {
      s.style.setProperty('--dx', (bdx + jx - sx) + 'px'); s.style.setProperty('--dy', (bdy + jy - sy) + 'px'); s.style.setProperty('--tilt', '-6deg');
    });
    s.classList.remove('dragging'); s.style.setProperty('--tilt', '0deg'); jc.classList.remove('press');
    await sleep(350); select(null);
    // 2. circle the word that matters
    const love = $('#loveWord'), lr = rel(love);
    await glide(lr.x + lr.w * 0.9, lr.y + lr.h * 0.2, 1000);
    circle(love);
    await glide(lr.x - 10, lr.y + lr.h * 0.9, 1100);
    await sleep(300);
    // 3. hand over the highlighter
    const marker = $('.tool[data-tool="marker"]'), mr = rel(marker);
    await glide(mr.x + mr.w * 0.6, mr.y - 6, 1200);
    marker.classList.add('nudge'); setTimeout(() => marker.classList.remove('nudge'), 1900);
    await say('psst, grab a highlighter and mark anything', 3200);
    // 4. idle: wander and drop the occasional tip
    const tips = ['Try Recruiter mode ↑', 'Stickies are draggable', 'Press S, then click anywhere', 'Scroll for the story ↓'];
    let i = 0;
    while (true) {
      const h = rel($('.headline'));
      await glide(h.x + h.w * (0.25 + Math.random() * 0.7), h.y + h.h * (0.2 + Math.random() * 0.8), 2200 + Math.random() * 1200);
      await sleep(2500 + Math.random() * 2500);
      if (onScreen() && i < 12) await say(tips[i++ % tips.length], 2600);
    }
  }
  choreography();
})();
