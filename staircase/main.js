/*
 * The Ascent — a scroll-driven section-perspective of a stair tower.
 *
 * One continuous timeline (P from 0 to END):
 *   0.00  hero: centered title, the protagonist at the foot of the stair
 *   0.12  the protagonist starts walking; the camera picks them up
 *   0.95  arrival at Landing 01
 *   1.00  Chapter 01 — NSUT: the room comes into focus, the title appears
 *   1.46  at the drafting desk; the first interface sketch draws itself
 *   2.00  coda: the gaze lifts to the flight that continues
 *
 * Layers: sky (atmosphere, landscape), scene (architecture + person,
 * painter-sorted flat planes with precomputed sun shadows), fore
 * (out-of-focus foliage near the lens). DOM carries the typography.
 */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- utils
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mul3 = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sc3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };
  const css = (c, a = 1) => {
    const r = Math.round(clamp(c[0], 0, 1) * 255), g = Math.round(clamp(c[1], 0, 1) * 255), b = Math.round(clamp(c[2], 0, 1) * 255);
    return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${Math.max(0, a).toFixed(3)})`;
  };
  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------------------------------------------------------------- constants
  const N = 6;                    // storeys drawn (the tower continues above)
  const H = 4.2;                  // floor to floor
  const T = 0.3;                  // slab
  const STEPS = 12;
  const RISE = H / 2 / STEPS;     // 0.175
  const RUN = 0.3;
  const XA = -1.8, XB = 1.8;
  const L = norm([0.42, -0.62, -1]);
  const END = 2;                  // timeline length
  const SEG = [4.6, 3.0];         // viewports of scroll per timeline unit

  // Palette — warm ivory, soft stone, charcoal, muted grey; one accent.
  const MAT = {
    plaster: [0.965, 0.952, 0.925],
    stone:   [0.905, 0.890, 0.862],
    floor:   [0.880, 0.858, 0.818],
    ground:  [0.872, 0.855, 0.815],
    wood:    [0.800, 0.735, 0.640],
    paper:   [0.990, 0.985, 0.970],
    charcoal:[0.215, 0.210, 0.205],
    steel:   [0.520, 0.520, 0.515],
  };
  const ACCENT = [0.706, 0.325, 0.184];
  const INK = [0.17, 0.165, 0.16];

  // ---------------------------------------------------------------- timeline state
  let P = 0, time = 0;
  const tl = { arrive: 0, title: 0, desk: 0, sketch: 0, arrow: 0, coda: 0 };

  // ---------------------------------------------------------------- scene graph
  const items = [];
  const lamps = [];

  function add(min, max, o = {}) {
    const it = Object.assign({ min, max, solid: true, casts: true, recv: true, mat: 'plaster', top: null, mass: false }, o);
    it.c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    items.push(it);
    return it;
  }
  const B = (x0, y0, z0, x1, y1, z1, o) => add([x0, y0, z0], [x1, y1, z1], o);

  function build() {
    B(-400, -1.7, -42, 400, -T, 0, { mat: 'ground', ground: true, casts: false });
    B(XA, -T, -3.0, 3.4, 0, 0, { top: 'stone', mass: true });

    for (let k = 0; k <= N; k++) {
      const y = k * H, roof = k === N;
      const wt = roof ? y + 1.05 : y + H - T;
      const yb = y - T;

      B(-6.2, yb, -7.5, XA, y, 0, { top: roof ? 'stone' : 'floor', mass: true });
      B(-6.6, yb, -7.9, -6.2, wt, 0, { mass: true });
      if (roof) {
        B(-6.2, yb, -7.9, XA, wt, -7.5, { mass: true });
      } else if (k === 1) {
        // Chapter 01: a long wall for drawings, and a slim window.
        B(-6.2, yb, -7.9, -2.85, wt, -7.5, { mass: true, decal: drawNsutWall });
        B(-2.2, yb, -7.9, XA, wt, -7.5, { mass: true });
        B(-2.85, yb, -7.9, -2.2, y + 0.9, -7.5, { mass: true });
        B(-2.85, y + 3.3, -7.9, -2.2, wt, -7.5, { mass: true });
        B(-2.85, y + 0.84, -7.5, -2.2, y + 0.9, -7.36, { top: 'stone' });
      } else {
        B(-6.2, yb, -7.9, XA, y + 0.7, -7.5, { mass: true });
        B(-6.2, y + 3.25, -7.9, XA, wt, -7.5, { mass: true });
        B(-6.2, y + 0.7, -7.9, -5.3, y + 3.25, -7.5, { mass: true });
        B(-2.7, y + 0.7, -7.9, XA, y + 3.25, -7.5, { mass: true });
        B(-4.03, y + 0.7, -7.6, -3.97, y + 3.25, -7.55, { recv: false, mat: 'charcoal' });
        B(-5.3, y + 0.64, -7.5, -2.7, y + 0.7, -7.36, { top: 'stone' });
      }
      B(XA, yb, -7.9, -1.4, wt, -3.4, { mass: true });

      if (roof) {
        B(XA, yb, -3.4, 3.8, wt, -3.0, { mass: true, rail: -1 });
      } else {
        B(XA, yb, -3.4, 2.3, wt, -3.0, { mass: true, rail: k });
        B(2.9, yb, -3.4, 3.8, wt, -3.0, { mass: true });
        B(2.3, yb, -3.4, 2.9, y + 2.55, -3.0, { mass: true });
        B(2.3, y + 3.75, -3.4, 2.9, wt, -3.0, { mass: true });
      }
      B(3.4, yb, -3.0, 3.8, wt, 0, { mass: true });
      if (roof) continue;

      B(XB, y + H / 2 - T, -3.0, 3.4, y + H / 2, 0, { top: 'stone', mass: true });
      for (let i = 0; i < STEPS; i++) {
        const top = y + (i + 1) * RISE;
        B(XA + i * RUN, top - 0.14, -3.0, XA + (i + 1) * RUN, top, -1.62, { mat: 'stone' });
      }
      for (let j = 0; j < STEPS; j++) {
        const top = y + H / 2 + (j + 1) * RISE;
        B(XB - (j + 1) * RUN, top - RISE - 0.16, -1.5, XB - j * RUN, top, 0, { mat: 'stone' });
      }
      add([XA, y + H / 2, -1.585], [XB, y + H + 1.0, -1.5], { solid: false, draw: drawFrontRail, k, y });

      const lx = k === 1 ? -2.75 : -4.0, lz = k === 1 ? -2.5 : -3.8;
      const lp = { p: [lx, y + 2.45, lz], k, kind: 'pendant', boost: 0 };
      lamps.push(lp);
      add([lx - 0.3, y + 2.32, lz - 0.3], [lx + 0.3, y + H - T, lz + 0.3], { solid: false, draw: drawPendant, lamp: lp, ceil: y + H - T });
      lamps.push({ p: [3.1, y + H / 2 + 1.95, -2.9], k, kind: 'sconce', boost: 0 });
    }

    buildNsut();

    const yr = N * H;
    B(-5.4, yr, -5.9, -3.6, yr + 0.62, -4.3, { mat: 'stone' });
    add([-6.1, yr + 0.62, -6.4], [-2.9, yr + 4.2, -3.8], { solid: false, draw: drawOlive, base: [-4.5, yr + 0.62, -5.1], seed: 7 });

    const cyp = [[-9.4, -4.5, 7.4], [-11.6, -7.5, 8.6], [6.4, -6.0, 8.0], [8.7, -3.6, 6.4], [-16, -9, 7], [13, -12, 8.5]];
    cyp.forEach(([x, z, h], i) => add([x - 0.75, -T, z - 0.75], [x + 0.75, -T + h, z + 0.75], { solid: false, draw: drawCypress, base: [x, -T, z], h, seed: i + 3 }));
  }

  // Chapter 01 furniture: a drafting desk, instruments, a gear model on a plinth.
  let deskLamp = null;
  function buildNsut() {
    const y = H;
    B(-5.55, y + 0.76, -7.44, -3.45, y + 0.8, -6.62, { mat: 'wood' });
    for (const [x, z] of [[-5.5, -7.38], [-3.55, -7.38], [-5.5, -6.72], [-3.55, -6.72]]) B(x, y, z, x + 0.05, y + 0.76, z + 0.05, { mat: 'charcoal', recv: false });
    B(-5.25, y + 0.8, -7.2, -4.45, y + 0.805, -6.72, { mat: 'paper' });                 // drawing sheet
    B(-5.3, y + 0.805, -6.86, -4.2, y + 0.82, -6.8, { mat: 'wood', recv: false });      // straightedge
    B(-4.15, y + 0.8, -7.1, -3.8, y + 0.825, -6.78, { mat: 'paper' });                  // notebook
    B(-4.1, y + 0.825, -7.06, -3.84, y + 0.845, -6.82, { mat: 'charcoal' });            // closed notebook
    B(-6.2, y, -3.85, -5.45, y + 0.95, -2.85, { mat: 'stone' });                        // plinth
    add([-6.16, y + 0.95, -3.45], [-5.4, y + 1.73, -3.25], { solid: false, draw: drawGear, c: [-5.78, y + 1.34, -3.3], r: 0.36 });
    deskLamp = { p: [-4.05, y + 1.28, -7.05], k: 1, kind: 'task', boost: 0 };
    lamps.push(deskLamp);
    add([-4.12, y + 0.8, -7.3], [-3.6, y + 1.5, -7.0], { solid: false, draw: drawDeskLamp, y });
  }

  // ---------------------------------------------------------------- shadows (precomputed)
  function hull(pts) {
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-9) lo.pop(); lo.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 1e-9) up.pop(); up.push(p); }
    up.pop(); lo.pop();
    return lo.concat(up);
  }
  function clipRect(poly, x0, x1, y0, y1) {
    let out = poly;
    for (const [ax, v, s] of [[0, x0, 1], [0, x1, -1], [1, y0, 1], [1, y1, -1]]) {
      const inp = out; out = [];
      if (!inp.length) break;
      for (let i = 0; i < inp.length; i++) {
        const a = inp[i], b = inp[(i + 1) % inp.length];
        const da = s * (a[ax] - v), db = s * (b[ax] - v);
        if (da >= 0) out.push(a);
        if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
    }
    return out;
  }
  const area2 = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };

  function computeShadows() {
    const casters = items.filter(i => i.solid && i.casts);
    for (const R of items) {
      if (!R.solid || !R.recv) continue;
      R.shadows = [];
      for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
        if (-s * L[a] <= 0.001) continue;
        const v = s > 0 ? R.max[a] : R.min[a];
        if (a === 2 && s > 0 && v >= -1e-6) continue;
        const u = (a + 1) % 3, w = (a + 2) % 3;
        const polys = [];
        for (const C of casters) {
          if (C === R) continue;
          if (R.ground && !C.mass) continue;
          if (s > 0 ? C.min[a] < v - 1e-4 : C.max[a] > v + 1e-4) continue;
          if (!R.ground && (C.min[1] - R.max[1] > 9 || C.max[1] < R.min[1] - 1e-4)) continue;
          const pts = [];
          let minU = Infinity, maxU = -Infinity, minW = Infinity, maxW = -Infinity;
          for (let c = 0; c < 8; c++) {
            const p = [c & 1 ? C.max[0] : C.min[0], c & 2 ? C.max[1] : C.min[1], c & 4 ? C.max[2] : C.min[2]];
            const t = (v - p[a]) / L[a];
            const q = [p[u] + t * L[u], p[w] + t * L[w]];
            if (q[0] < minU) minU = q[0]; if (q[0] > maxU) maxU = q[0];
            if (q[1] < minW) minW = q[1]; if (q[1] > maxW) maxW = q[1];
            pts.push(q);
          }
          if (maxU <= R.min[u] || minU >= R.max[u] || maxW <= R.min[w] || minW >= R.max[w]) continue;
          const poly = clipRect(hull(pts), R.min[u], R.max[u], R.min[w], R.max[w]);
          if (poly.length < 3 || area2(poly) < 1e-4) continue;
          polys.push(poly.map(q => { const p = [0, 0, 0]; p[a] = v; p[u] = q[0]; p[w] = q[1]; return p; }));
        }
        R.shadows[a * 2 + (s > 0 ? 1 : 0)] = polys;
      }
    }
  }

  // ---------------------------------------------------------------- camera
  const NEAR = 0.08;
  const cam = { p: [0, 0, 10], r: [1, 0, 0], u: [0, 1, 0], f: [0, 0, -1], focal: 800, cx: 0, cy: 0 };
  function aim(pos, target) {
    cam.p = pos;
    cam.f = norm(sub(target, pos));
    cam.r = norm(cross(cam.f, [0, 1, 0]));
    cam.u = cross(cam.r, cam.f);
  }
  function toCam(p) { const d = sub(p, cam.p); return [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)]; }
  function scr(c) { return [cam.cx + cam.focal * c[0] / c[2], cam.cy - cam.focal * c[1] / c[2]]; }
  function project(p) { const c = toCam(p); return c[2] < NEAR ? null : scr(c); }
  function projDir(d) { const c = [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)]; return c[2] <= 0.01 ? null : scr(c); }
  function clipNear(cs) {
    const out = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i], b = cs[(i + 1) % cs.length];
      const ia = a[2] >= NEAR, ib = b[2] >= NEAR;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (NEAR - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); }
    }
    return out;
  }
  function tracePoly(ctx, pts) {
    let cs = pts.map(toCam);
    if (cs.some(c => c[2] < NEAR)) cs = clipNear(cs);
    if (cs.length < 3) return false;
    ctx.beginPath();
    for (let i = 0; i < cs.length; i++) { const s = scr(cs[i]); i ? ctx.lineTo(s[0], s[1]) : ctx.moveTo(s[0], s[1]); }
    ctx.closePath();
    return true;
  }
  const pxSize = (size, p) => { const c = toCam(p); return c[2] < NEAR ? 0 : size * cam.focal / c[2]; };
  function strokeWorld(ctx, a, b) {
    const pa = project(a), pb = project(b);
    if (!pa || !pb) return;
    ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
  }

  // ---------------------------------------------------------------- environment
  const DAY = [
    { sun: [0.24, 0.228, 0.205], amb: [0.83, 0.822, 0.808], sky0: [0.845, 0.855, 0.858], sky1: [0.955, 0.945, 0.918], haze: [0.940, 0.932, 0.908], land: [0.735, 0.735, 0.705] },
    { sun: [0.27, 0.245, 0.205], amb: [0.83, 0.815, 0.795], sky0: [0.830, 0.835, 0.842], sky1: [0.962, 0.940, 0.900], haze: [0.945, 0.928, 0.895], land: [0.740, 0.725, 0.690] },
  ];
  const NIGHT = [
    { sun: [0.060, 0.064, 0.072], amb: [0.172, 0.170, 0.168], sky0: [0.062, 0.063, 0.068], sky1: [0.128, 0.124, 0.120], haze: [0.112, 0.109, 0.106], land: [0.086, 0.086, 0.086] },
    { sun: [0.060, 0.064, 0.072], amb: [0.165, 0.163, 0.160], sky0: [0.055, 0.056, 0.062], sky1: [0.118, 0.114, 0.110], haze: [0.105, 0.102, 0.100], land: [0.080, 0.080, 0.080] },
  ];
  const KEYS = ['sun', 'amb', 'sky0', 'sky1', 'haze', 'land'];
  function sample(stops, u) {
    const t = smooth(0, 1, u), o = {};
    for (const k of KEYS) o[k] = mix3(stops[0][k], stops[1][k], t);
    return o;
  }
  const env = {};
  function computeEnv(u, night) {
    const d = sample(DAY, u), n = sample(NIGHT, u);
    for (const k of KEYS) env[k] = mix3(d[k], n[k], night);
    env.night = night; env.day = 1 - night;
    env.lamp = smooth(0.25, 1, night);
    env.lampCol = [1.0, 0.86, 0.70];
    env.paper = mix3([0.953, 0.945, 0.925], [0.078, 0.078, 0.078], night);
    env.poche = mix3([0.188, 0.184, 0.178], [0.040, 0.040, 0.040], night);
    env.line = mix3([0.10, 0.10, 0.095], [0, 0, 0], night);
    env.fog = lerp(0.30, 0.50, night);
    env.stars = smooth(0.5, 1, night);
    env.rail = mix3([0.46, 0.44, 0.41], [0.30, 0.28, 0.26], night);   // blackened steel
    env.leaf = mix3([0.40, 0.41, 0.38], [0.030, 0.030, 0.032], night);
    env.leaf2 = mix3([0.47, 0.48, 0.45], [0.050, 0.050, 0.052], night);
    env.tree = mix3([0.52, 0.54, 0.50], [0.07, 0.07, 0.075], night);
  }

  function albedo(it, a, s) {
    if (a === 1 && s > 0 && it.top) return MAT[it.top];
    return MAT[it.mat] || MAT.plaster;
  }
  const lampI = lp => Math.max(env.lamp, lp.boost || 0);
  // Light arriving at a point: [lit multiplier, shaded multiplier]. a < 0 means "no particular face".
  function light(center, a, s) {
    const ndl = a < 0 ? 0.5 : Math.max(0, -s * L[a]);
    let dark = env.amb.slice();
    let lit = add3(dark, sc3(env.sun, ndl * 1.05));
    let acc = 0;
    for (const lp of lamps) {
      const I = lampI(lp); if (I < 0.01) continue;
      const dx = lp.p[0] - center[0], dy = lp.p[1] - center[1], dz = lp.p[2] - center[2];
      const d = Math.hypot(dx, dy, dz);
      const R = lp.kind === 'pendant' ? 6.2 : lp.kind === 'task' ? 2.0 : 4.0;
      if (d > R) continue;
      const nd = a < 0 ? 0.6 : (a === 0 ? dx : a === 1 ? dy : dz) * s / (d || 1);
      const f = 1 - d / R;
      acc += I * f * f * (0.3 + 0.7 * Math.max(0, nd)) * (lp.kind === 'sconce' ? 0.65 : 1);
    }
    if (acc > 0) { const add = sc3(env.lampCol, Math.min(acc, 1.2) * 0.72); lit = add3(lit, add); dark = add3(dark, add); }
    return [lit, dark];
  }
  function shade(it, a, s, center) {
    const alb = albedo(it, a, s);
    const [l, d] = light(center, a, s);
    const dist = Math.hypot(center[0] - cam.p[0], center[1] - cam.p[1], center[2] - cam.p[2]);
    const ft = it.ground ? env.fog * 0.3 : env.fog * (1 - Math.exp(-dist / 80));
    return [mix3(mul3(alb, l), env.haze, ft), mix3(mul3(alb, d), env.haze, ft)];
  }

  // ---------------------------------------------------------------- canvases
  const cvSky = document.getElementById('sky'), cvScene = document.getElementById('scene'), cvFore = document.getElementById('fore');
  const cSky = cvSky.getContext('2d'), cScene = cvScene.getContext('2d'), cFore = cvFore.getContext('2d');
  let W = 0, Hh = 0, DPR = 1, portrait = false;

  function resize() {
    W = innerWidth; Hh = innerHeight; portrait = W / Hh < 0.8;
    DPR = Math.min(devicePixelRatio || 1, W < 760 ? 2 : 1.75);
    for (const cv of [cvSky, cvScene, cvFore]) { cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); }
    for (const c of [cSky, cScene, cFore]) c.setTransform(DPR, 0, 0, DPR, 0, 0);
    cam.cx = W / 2; cam.cy = Hh / 2;
    cam.focal = Math.min(Hh * 0.98, W * 1.22);
    document.getElementById('track').style.height = Math.round(Hh * (1 + SEG[0] + SEG[1])) + 'px';
  }

  // ---------------------------------------------------------------- architecture
  function faceVerts(it, a, s) {
    const v = s > 0 ? it.max[a] : it.min[a];
    const u = (a + 1) % 3, w = (a + 2) % 3;
    return [[it.min[u], it.min[w]], [it.max[u], it.min[w]], [it.max[u], it.max[w]], [it.min[u], it.max[w]]]
      .map(([uu, ww]) => { const p = [0, 0, 0]; p[a] = v; p[u] = uu; p[w] = ww; return p; });
  }

  function drawSolid(ctx, it) {
    const lineCss = css(env.line, 0.11 + env.night * 0.3);
    for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
      const v = s > 0 ? it.max[a] : it.min[a];
      if (s * (cam.p[a] - v) <= 1e-6) continue;
      const pts = faceVerts(it, a, s);
      if (!tracePoly(ctx, pts)) continue;
      if (a === 2 && s > 0 && v >= -1e-6) {           // section cut
        ctx.fillStyle = css(env.poche); ctx.fill();
        if (it.ground) hatch(ctx);
        continue;
      }
      const center = [0, 0, 0]; for (const p of pts) { center[0] += p[0] / 4; center[1] += p[1] / 4; center[2] += p[2] / 4; }
      if (it.ground) { center[0] = cam.p[0]; center[2] = Math.max(-40, cam.p[2] - 30); }
      const [lit, dark] = shade(it, a, s, center);
      const ndl = -s * L[a];
      ctx.fillStyle = css(ndl > 0 ? lit : dark);
      ctx.fill();
      const sh = it.shadows && it.shadows[a * 2 + (s > 0 ? 1 : 0)];
      if (ndl > 0 && sh && sh.length) {
        ctx.fillStyle = css(dark);
        for (const poly of sh) if (tracePoly(ctx, poly)) ctx.fill();
      }
      if (it.mass && a !== 1 && it.max[1] - it.min[1] > 2 && !it.ground) occlusion(ctx, it, pts);
      if (!it.ground) { tracePoly(ctx, pts); ctx.strokeStyle = lineCss; ctx.lineWidth = 0.6; ctx.stroke(); }
    }
    if (it.rail !== undefined && it.rail >= 0) drawBackRail(ctx, it.rail);
    if (it.decal) it.decal(ctx, it);
  }

  // Soft occlusion where walls meet the floor and the ceiling.
  function occlusion(ctx, it, pts) {
    const f = pts[0];
    const floorY = it.min[1] + T, ceilY = it.max[1];
    const b0 = project([f[0], floorY, f[2]]), b1 = project([f[0], floorY + 0.55, f[2]]);
    const t0 = project([f[0], ceilY, f[2]]), t1 = project([f[0], ceilY - 0.8, f[2]]);
    const k = 0.07 + env.night * 0.12;
    ctx.save();
    tracePoly(ctx, pts); ctx.clip();
    if (b0 && b1) {
      const g = ctx.createLinearGradient(b0[0], b0[1], b1[0], b1[1]);
      g.addColorStop(0, css(INK, k)); g.addColorStop(1, css(INK, 0));
      ctx.fillStyle = g; ctx.fill();
    }
    if (t0 && t1) {
      const g = ctx.createLinearGradient(t0[0], t0[1], t1[0], t1[1]);
      g.addColorStop(0, css(INK, k * 0.8)); g.addColorStop(1, css(INK, 0));
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.restore();
  }

  function hatch(ctx) {
    ctx.save(); ctx.clip();
    ctx.strokeStyle = css(mix3(env.poche, env.haze, 0.14), 0.6); ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let x = -Hh; x < W + Hh; x += 8) { ctx.moveTo(x, Hh); ctx.lineTo(x + Hh, 0); }
    ctx.stroke(); ctx.restore();
  }

  function drawBackRail(ctx, k) {
    const y = k * H;
    const a = [XA, y + RISE + 0.9, -2.95], b = [XB, y + H / 2 + 0.9, -2.95];
    const t = 0.05 / -L[2];
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(mul3(MAT.plaster, env.amb), 0.8 * env.day);
    ctx.lineWidth = Math.max(0.8, pxSize(0.04, a));
    strokeWorld(ctx, [a[0] + L[0] * t, a[1] + L[1] * t, -3.0], [b[0] + L[0] * t, b[1] + L[1] * t, -3.0]);
    ctx.strokeStyle = css(env.rail);
    ctx.lineWidth = Math.max(0.9, pxSize(0.04, a));
    strokeWorld(ctx, a, b);
    ctx.lineWidth = Math.max(0.6, pxSize(0.02, a));
    for (const x of [XA + 0.35, 0, XB - 0.35]) {
      const yy = lerp(a[1], b[1], (x - XA) / (XB - XA));
      strokeWorld(ctx, [x, yy, -2.95], [x, yy, -3.0]);
    }
  }

  function drawFrontRail(ctx, it) {
    const y = it.y;
    const a = [XB, y + H / 2 + RISE + 0.95, -1.54], b = [XA, y + H + 0.95, -1.54];
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(env.rail);
    ctx.lineWidth = Math.max(0.6, pxSize(0.02, a));
    for (let j = 1; j < STEPS; j += 3) {
      const x = XB - (j + 0.5) * RUN, top = y + H / 2 + (j + 1) * RISE;
      strokeWorld(ctx, [x, top, -1.54], [x, top + 0.95 - RISE * 0.5, -1.54]);
    }
    ctx.lineWidth = Math.max(0.9, pxSize(0.04, a));
    strokeWorld(ctx, a, b);
  }

  function drawPendant(ctx, it) {
    const lp = it.lamp.p;
    ctx.strokeStyle = css(env.poche, 0.7); ctx.lineWidth = 0.7;
    strokeWorld(ctx, [lp[0], it.ceil, lp[2]], [lp[0], lp[1] + 0.2, lp[2]]);
    const c = project([lp[0], lp[1] + 0.1, lp[2]]); if (!c) return;
    const r = pxSize(0.3, lp);
    ctx.beginPath(); ctx.ellipse(c[0], c[1], r, r * 0.72, 0, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = css(mul3(MAT.charcoal, light(lp, -1, 1)[0])); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c[0], c[1], r, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = css(mix3(mul3([0.8, 0.79, 0.77], env.amb), [1, 0.9, 0.72], lampI(it.lamp))); ctx.fill();
  }

  function drawCypress(ctx, it) {
    const [x, y, z] = it.base;
    const sway = reduceMotion ? 0 : Math.sin(time * 0.5 + it.seed) * 0.06;
    const b = project([x, y, z]), t = project([x + sway, y + it.h, z]);
    if (!b || !t) return;
    const w = pxSize(0.6 + it.h * 0.035, [x, y + it.h * 0.4, z]);
    const dist = Math.hypot(x - cam.p[0], z - cam.p[2]);
    const fog = env.fog * (1 - Math.exp(-dist / 60)) + 0.1;
    const lit = mix3(mul3(env.tree, add3(env.amb, sc3(env.sun, 0.5))), env.haze, fog);
    const dk = mix3(mul3(env.tree, sc3(env.amb, 0.85)), env.haze, fog);
    const mx = (b[0] + t[0]) / 2;
    const path = side => {
      ctx.beginPath(); ctx.moveTo(b[0], b[1]);
      ctx.bezierCurveTo(b[0] + side * w * 1.05, b[1] - (b[1] - t[1]) * 0.18, mx + side * w * 0.95, t[1] + (b[1] - t[1]) * 0.45, t[0], t[1]);
      ctx.bezierCurveTo(mx - side * w * 0.2, t[1] + (b[1] - t[1]) * 0.5, b[0] - side * w * 0.15, b[1] - (b[1] - t[1]) * 0.1, b[0], b[1]);
      ctx.closePath();
    };
    ctx.fillStyle = css(dk); path(1); ctx.fill();
    ctx.fillStyle = css(lit); path(-1); ctx.fill();
  }

  function drawOlive(ctx, it) {
    const [x, y, z] = it.base;
    const r = rng(it.seed);
    const top = [x + 0.1, y + 1.7, z];
    ctx.strokeStyle = css(mul3(MAT.charcoal, env.amb)); ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, pxSize(0.12, top));
    strokeWorld(ctx, [x, y, z], top);
    const blobs = [];
    for (let i = 0; i < 16; i++) blobs.push([x + (r() - 0.5) * 2.6, y + 2.2 + r() * 1.5, z + (r() - 0.5) * 1.6, 0.35 + r() * 0.35]);
    for (const pass of [0, 1]) {
      ctx.fillStyle = css(pass ? mul3(env.tree, add3(env.amb, sc3(env.sun, 0.5))) : mul3(env.tree, sc3(env.amb, 0.85)));
      for (const [bx, by, bz, br] of blobs) {
        const c = project([bx + (pass ? -0.08 : 0.06), by + (pass ? 0.08 : -0.05), bz]); if (!c) continue;
        const rr = pxSize(br * (pass ? 0.78 : 1), [bx, by, bz]);
        ctx.beginPath(); ctx.ellipse(c[0], c[1], rr, rr * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------- Chapter 01 objects
  function gearPath(ctx, c, r, z, teeth, rot) {
    const pts = [];
    for (let i = 0; i < teeth; i++) {
      const a0 = rot + i * Math.PI * 2 / teeth, st = Math.PI * 2 / teeth;
      for (const [f, rr] of [[0, r * 0.86], [0.18, r], [0.5, r], [0.68, r * 0.86]]) {
        const a = a0 + f * st; pts.push([c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr, z]);
      }
    }
    const sp = pts.map(project); if (sp.some(p => !p)) return false;
    ctx.beginPath(); sp.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    const hc = project([c[0], c[1], z]), hr = pxSize(r * 0.22, [c[0], c[1], z]);
    ctx.moveTo(hc[0] + hr, hc[1]); ctx.arc(hc[0], hc[1], hr, 0, Math.PI * 2, true);
    return true;
  }
  function drawGear(ctx, it) {
    const rot = reduceMotion ? 0.1 : 0.1 + time * 0.04;
    const [l, d] = light(it.c, 2, 1);
    const lit = mul3(MAT.steel, l), dark = mul3(MAT.steel, d);
    ctx.strokeStyle = css(mul3(MAT.charcoal, env.amb)); ctx.lineWidth = Math.max(1, pxSize(0.05, it.c));
    strokeWorld(ctx, [it.c[0], H + 0.95, -3.3], [it.c[0], it.c[1], -3.3]);
    ctx.fillStyle = css(sc3(dark, 0.72));
    if (gearPath(ctx, it.c, it.r, -3.42, 14, rot)) ctx.fill('evenodd');
    ctx.fillStyle = css(mix3(dark, lit, 0.55));
    if (gearPath(ctx, it.c, it.r, -3.3, 14, rot)) { ctx.fill('evenodd'); ctx.strokeStyle = css(sc3(dark, 0.6), 0.6); ctx.lineWidth = 0.6; ctx.stroke(); }
  }

  function drawDeskLamp(ctx, it) {
    const y = it.y;
    const base = [-3.68, y + 0.8, -7.24], j1 = [-3.72, y + 1.34, -7.22], head = [-4.02, y + 1.42, -7.08];
    const steel = css(mul3(MAT.charcoal, env.amb));
    ctx.strokeStyle = steel; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, pxSize(0.022, base));
    strokeWorld(ctx, base, j1); strokeWorld(ctx, j1, head);
    const b = project(base);
    if (b) { ctx.fillStyle = steel; ctx.beginPath(); ctx.ellipse(b[0], b[1], pxSize(0.09, base), pxSize(0.025, base), 0, 0, Math.PI * 2); ctx.fill(); }
    const h = project(head); if (!h) return;
    const r = pxSize(0.11, head);
    ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(-0.35);
    ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.3); ctx.lineTo(r * 0.4, -r * 0.3); ctx.lineTo(r, r * 0.6); ctx.lineTo(-r, r * 0.6); ctx.closePath();
    ctx.fillStyle = steel; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, r * 0.6, r, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = css(mix3(mul3([0.7, 0.7, 0.68], env.amb), [1, 0.93, 0.78], lampI(deskLamp))); ctx.fill();
    ctx.restore();
  }

  // The chapter wall: typography and drawings painted in the wall's own perspective.
  function wallFrame(x0, yTop, z) {
    const O = project([x0, yTop, z]), U = project([x0 + 1, yTop, z]), V = project([x0, yTop - 1, z]);
    if (!O || !U || !V) return null;
    return [U[0] - O[0], U[1] - O[1], V[0] - O[0], V[1] - O[1], O[0], O[1]];
  }
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif';

  function partialPath(ctx, segs, r) {
    let total = 0;
    for (const pl of segs) for (let i = 1; i < pl.length; i++) total += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    let left = total * r;
    ctx.beginPath();
    for (const pl of segs) {
      if (left <= 0) break;
      ctx.moveTo(pl[0][0], pl[0][1]);
      for (let i = 1; i < pl.length && left > 0; i++) {
        const d = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
        if (d <= left) { ctx.lineTo(pl[i][0], pl[i][1]); left -= d; }
        else { const t = left / d; ctx.lineTo(lerp(pl[i - 1][0], pl[i][0], t), lerp(pl[i - 1][1], pl[i][1], t)); left = 0; }
      }
    }
  }
  function rrect(x, y, w, h, r) {
    const p = [], n = 5;
    const arc = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
    arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI);
    p.push(p[0]);
    return p;
  }

  function drawNsutWall(ctx) {
    const top = H + H - T;
    const m = wallFrame(-6.2, top, -7.5); if (!m) return;
    const lw = light([-4.5, H + 2, -7.5], 2, 1)[1];
    const paper = mul3(MAT.paper, lw), ink = mul3(INK, lw), accent = mul3(ACCENT, lw);
    ctx.save();
    ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    const px = 1 / Math.hypot(m[0], m[1]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // NSUT, painted on the wall.
    const ta = tl.title;
    if (ta > 0.001) {
      ctx.save();
      ctx.globalAlpha = ta;
      ctx.translate(0.32, 1.06 + (1 - ta) * 0.05);
      ctx.scale(0.0072, 0.0072);
      ctx.font = `600 100px ${FONT}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '-3px';
      ctx.fillStyle = css(ink);
      ctx.fillText('NSUT', 0, 0);
      ctx.restore();
      ctx.globalAlpha = ta;
      ctx.strokeStyle = css(ink, 0.5); ctx.lineWidth = Math.max(px * 0.8, 0.004);
      ctx.beginPath(); ctx.moveTo(0.32, 1.2); ctx.lineTo(lerp(0.32, 3.0, easeInOut(ta)), 1.2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // FIG. 01 — a gear, drawn the engineer's way.
    const s1 = [0.32, 1.62, 1.3, 0.86];
    sheet(ctx, s1, paper, ink, px);
    const gc = [s1[0] + 0.5, s1[1] + 0.42], gr = 0.23;
    ctx.strokeStyle = css(ink, 0.85); ctx.lineWidth = Math.max(px * 0.9, 0.004);
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * Math.PI * 2, r = gr * ((Math.floor(i / 2) % 2) ? 0.86 : 1);
      i ? ctx.lineTo(gc[0] + Math.cos(a) * r, gc[1] + Math.sin(a) * r) : ctx.moveTo(gc[0] + r, gc[1]);
    }
    ctx.stroke();
    ctx.beginPath(); ctx.arc(gc[0], gc[1], gr * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([0.03, 0.012, 0.004, 0.012]); ctx.lineWidth = Math.max(px * 0.6, 0.003);
    ctx.beginPath(); ctx.moveTo(gc[0] - gr * 1.3, gc[1]); ctx.lineTo(gc[0] + gr * 1.3, gc[1]); ctx.moveTo(gc[0], gc[1] - gr * 1.3); ctx.lineTo(gc[0], gc[1] + gr * 1.3); ctx.stroke();
    ctx.setLineDash([]);
    const ex = s1[0] + 0.92;
    ctx.lineWidth = Math.max(px * 0.9, 0.004);
    ctx.strokeRect(ex, gc[1] - gr, 0.07, gr * 2);
    ctx.strokeRect(ex - 0.03, gc[1] - gr * 0.3, 0.13, gr * 0.6);
    ctx.lineWidth = Math.max(px * 0.6, 0.003);
    ctx.beginPath(); ctx.moveTo(gc[0] - gr, gc[1] + gr + 0.08); ctx.lineTo(gc[0] + gr, gc[1] + gr + 0.08); ctx.stroke();
    tick(ctx, gc[0] - gr, gc[1] + gr + 0.08); tick(ctx, gc[0] + gr, gc[1] + gr + 0.08);
    microText(ctx, 'FIG. 01', s1[0] + 0.07, s1[1] + s1[3] - 0.07, ink, 0.035);

    // FIG. 02 — the first interface, sketched once the protagonist reaches the desk.
    const s2 = [1.9, 1.62, 1.05, 0.86];
    if (tl.desk > 0.001) {
      ctx.globalAlpha = tl.desk;
      sheet(ctx, s2, paper, ink, px);
      const ph = [s2[0] + 0.38, s2[1] + 0.1, 0.28, 0.58];
      const segs = [
        rrect(ph[0], ph[1], ph[2], ph[3], 0.04),
        [[ph[0] + 0.05, ph[1] + 0.1], [ph[0] + 0.2, ph[1] + 0.1]],
        [[ph[0] + 0.05, ph[1] + 0.16], [ph[0] + 0.25, ph[1] + 0.16]],
        rrect(ph[0] + 0.05, ph[1] + 0.22, 0.2, 0.14, 0.012),
        [[ph[0] + 0.05, ph[1] + 0.41], [ph[0] + 0.25, ph[1] + 0.41]],
        [[ph[0] + 0.05, ph[1] + 0.45], [ph[0] + 0.18, ph[1] + 0.45]],
      ];
      ctx.strokeStyle = css(ink, 0.8); ctx.lineWidth = Math.max(px * 0.9, 0.004);
      partialPath(ctx, segs, tl.sketch); ctx.stroke();
      const btn = smooth(0.82, 1, tl.sketch);
      if (btn > 0) {
        ctx.fillStyle = css(accent, btn);
        const bp = rrect(ph[0] + 0.05, ph[1] + 0.51, 0.2, 0.06, 0.03);
        ctx.beginPath(); bp.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.fill();
      }
      microText(ctx, 'FIG. 02', s2[0] + 0.07, s2[1] + s2[3] - 0.07, ink, 0.035);
      ctx.globalAlpha = 1;
      if (tl.arrow > 0.001) {
        const a0 = [s1[0] + s1[2] - 0.2, s1[1] - 0.04], c = [1.75, 1.28], a1 = [s2[0] + 0.22, s2[1] - 0.05];
        const pl = [];
        for (let i = 0; i <= 24; i++) { const t = i / 24; pl.push([(1 - t) * (1 - t) * a0[0] + 2 * (1 - t) * t * c[0] + t * t * a1[0], (1 - t) * (1 - t) * a0[1] + 2 * (1 - t) * t * c[1] + t * t * a1[1]]); }
        ctx.strokeStyle = css(ink, 0.7); ctx.lineWidth = Math.max(px * 0.8, 0.004);
        partialPath(ctx, [pl], tl.arrow); ctx.stroke();
        if (tl.arrow > 0.98) { ctx.beginPath(); ctx.moveTo(a1[0] - 0.05, a1[1] - 0.03); ctx.lineTo(a1[0], a1[1]); ctx.lineTo(a1[0] - 0.035, a1[1] + 0.04); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
  function sheet(ctx, [x, y, w, h], paper, ink, px) {
    ctx.fillStyle = css(INK, 0.06);
    ctx.fillRect(x + 0.012, y + 0.018, w, h);
    ctx.fillStyle = css(paper); ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = css(ink, 0.35); ctx.lineWidth = Math.max(px * 0.6, 0.003);
    ctx.strokeRect(x + 0.04, y + 0.04, w - 0.08, h - 0.08);
    ctx.strokeRect(x + w - 0.34, y + h - 0.13, 0.3, 0.09);
    ctx.fillStyle = css(ink, 0.8);
    for (const [qx, qy] of [[x + 0.02, y + 0.02], [x + w - 0.02, y + 0.02]]) { ctx.beginPath(); ctx.arc(qx, qy, 0.009, 0, Math.PI * 2); ctx.fill(); }
  }
  function tick(ctx, x, y) { ctx.beginPath(); ctx.moveTo(x - 0.012, y + 0.012); ctx.lineTo(x + 0.012, y - 0.012); ctx.stroke(); }
  function microText(ctx, s, x, y, ink, size) {
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 70, size / 70);
    ctx.font = `600 100px ${FONT}`; if ('letterSpacing' in ctx) ctx.letterSpacing = '12px';
    ctx.fillStyle = css(ink, 0.7); ctx.fillText(s, 0, 0); ctx.restore();
  }

  // ---------------------------------------------------------------- the protagonist
  // Footsteps are planted on real treads; the body is interpolated between them.
  const FS = [], HD = [], STOP = [];
  function buildPath() {
    const fs = (x, y, z) => FS.push([x, y, z]);
    fs(-3.58, 0, -2.2); fs(-3.55, 0, -2.36); STOP.push(1);
    for (const x of [-3.25, -2.95, -2.65, -2.35, -2.05]) fs(x, 0, -2.3);
    for (let j = 1; j <= STEPS; j++) fs(XA + (j - 0.5) * RUN, j * RISE, -2.3);
    fs(2.0, 2.1, -2.3); fs(2.34, 2.1, -2.2); fs(2.6, 2.1, -1.88); fs(2.7, 2.1, -1.47); fs(2.6, 2.1, -1.06); fs(2.34, 2.1, -0.8); fs(2.02, 2.1, -0.75);
    for (let j = 1; j <= STEPS; j++) fs(XB - (j - 0.5) * RUN, 2.1 + j * RISE, -0.75);
    fs(-1.98, H, -0.8); fs(-2.3, H, -0.94); fs(-2.6, H, -1.1); fs(-2.63, H, -1.27); STOP.push(FS.length - 1);
    const p0 = [-2.63, -1.27], c = [-4.6, -2.0], p1 = [-4.55, -5.85];
    let prev = p0, acc = 0;
    for (let i = 1; i <= 200; i++) {
      const t = i / 200;
      const q = [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]];
      acc += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q;
      if (acc >= 0.34 || i === 200) { fs(q[0], H, q[1]); acc = 0; }
    }
    fs(-4.72, H, -5.9); STOP.push(FS.length - 1);
    for (let i = 0; i < FS.length; i++) {
      const a = FS[Math.max(0, i - 1)], b = FS[Math.min(FS.length - 1, i + 1)];
      HD.push(Math.atan2(b[2] - a[2], b[0] - a[0]));
    }
    HD[0] = HD[1] = 0;
    HD[STOP[1]] = HD[STOP[1] - 1] = Math.PI;
    HD[STOP[2]] = HD[STOP[2] - 1] = -Math.PI / 2;
    for (let i = 1; i < HD.length; i++) {
      while (HD[i] - HD[i - 1] > Math.PI) HD[i] -= Math.PI * 2;
      while (HD[i] - HD[i - 1] < -Math.PI) HD[i] += Math.PI * 2;
    }
  }

  const person = { solid: false, person: true, min: [0, 0, 0], max: [0, 0, 0], c: [0, 0, 0], draw: drawPerson };
  const ps = { hip: [0, 0, 0], ground: 0, feet: [[0, 0, 0], [0, 0, 0]], hd: 0, move: 0, slope: 0, phase: 0 };

  function poseAt(q) {
    const n = FS.length;
    q = clamp(q, 0, n - 1.0001);
    const i = Math.floor(q), t = q - i;
    const a = FS[Math.max(0, i - 1)], b = FS[i], c = FS[Math.min(n - 1, i + 1)];
    const m0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const m1 = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2, (b[2] + c[2]) / 2];
    const gy = lerp(m0[1], m1[1], easeSine(t));
    const bob = Math.sin(Math.PI * t) * 0.022 * ps.move;
    ps.hip = [lerp(m0[0], m1[0], t), gy + 0.9 + bob, lerp(m0[2], m1[2], t)];
    ps.ground = gy;
    ps.slope = clamp((c[1] - a[1]) / (Math.hypot(c[0] - a[0], c[2] - a[2]) || 1), -1, 1);
    const e = easeInOut(t), up = Math.max(0, c[1] - a[1]);
    const lift = Math.sin(Math.PI * t) * (0.06 + up * 0.32) * Math.min(1, ps.move * 3 + 0.2);
    const sw = [lerp(a[0], c[0], e), lerp(a[1], c[1], 1 - (1 - t) * (1 - t)) + lift, lerp(a[2], c[2], e)];
    const st = i % 2;
    ps.feet[st] = b.slice();
    ps.feet[1 - st] = sw;
    ps.hd = lerp(HD[i], HD[Math.min(n - 1, i + 1)], easeSine(t));
    ps.phase = q;
    const fy = Math.min(ps.feet[0][1], ps.feet[1][1]);
    person.min = [ps.hip[0] - 0.35, fy, ps.hip[2] - 0.25];
    person.max = [ps.hip[0] + 0.35, fy + 1.85, ps.hip[2] + 0.25];
    person.c = [ps.hip[0], fy + 0.9, ps.hip[2]];
  }

  const LOOK = {
    top: ACCENT,                 // the accent: the one colour the eye follows
    trouser: [0.20, 0.205, 0.215],
    shoe: [0.93, 0.92, 0.89],
    skin: [0.80, 0.63, 0.52],
    hair: [0.13, 0.12, 0.115],
  };
  let lastDir = 1;
  function drawPerson(ctx) {
    const Hs = project(ps.hip); if (!Hs) return;
    const k = pxSize(1, ps.hip);
    const s = Math.cos(ps.hd);
    const away = Math.max(0, -Math.sin(ps.hd));
    if (Math.abs(s) > 0.2) lastDir = s > 0 ? 1 : -1;
    const dir = lastDir, as = Math.abs(s), side = Math.max(0.28, as);
    const [lit, dk] = light(ps.hip, -1, 1);
    const lf = mix3(dk, lit, 0.6);
    const col = c => css(mul3(c, lf));
    const colD = c => css(sc3(mul3(c, lf), 0.8));

    const f0 = project(ps.feet[0]), f1 = project(ps.feet[1]);
    if (!f0 || !f1) return;
    ctx.fillStyle = css(INK, 0.1 + env.night * 0.15);
    ctx.beginPath(); ctx.ellipse((f0[0] + f1[0]) / 2, Math.max(f0[1], f1[1]) + k * 0.01, k * (0.3 + 0.12 * as), k * 0.045, 0, 0, Math.PI * 2); ctx.fill();

    const breath = reduceMotion ? 0 : Math.sin(time * 1.6) * 0.004 * (1 - ps.move);
    const lean = (0.03 + ps.slope * 0.09) * ps.move + 0.01;
    const hipW = k * lerp(0.34, 0.22, as), shW = k * lerp(0.42, 0.25, as);
    const neck = [Hs[0] + dir * lean * k * as, Hs[1] - (0.56 + breath) * k];
    const lat = (hipW / 2 - k * 0.06) * (1 - as);

    const leg = (foot, off, color, w) => {
      const h = [Hs[0] + off, Hs[1]];
      const fp = project(foot); if (!fp) return;
      const f = [fp[0], fp[1] - k * 0.07];
      const L1 = 0.44 * k;
      let dx = f[0] - h[0], dy = f[1] - h[1], d = Math.hypot(dx, dy) || 1e-3;
      if (d > L1 * 2 * 0.999) { const r = L1 * 2 * 0.999 / d; dx *= r; dy *= r; d = L1 * 2 * 0.999; }
      const hk = Math.sqrt(Math.max(0, L1 * L1 - (d / 2) * (d / 2))) * side;
      let px = -dy / d, py = dx / d; if (px * dir < 0) { px = -px; py = -py; }
      const knee = [h[0] + dx / 2 + px * hk, h[1] + dy / 2 + py * hk];
      const ank = [h[0] + dx, h[1] + dy];
      ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w * k;
      ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(knee[0], knee[1]); ctx.lineTo(ank[0], ank[1]); ctx.stroke();
      ctx.strokeStyle = col(LOOK.shoe); ctx.lineWidth = 0.075 * k;
      const toe = 0.17 * k * Math.max(0.35, as);
      ctx.beginPath(); ctx.moveTo(ank[0] - dir * 0.04 * k * as, ank[1] + 0.035 * k); ctx.lineTo(ank[0] + dir * toe, ank[1] + 0.045 * k); ctx.stroke();
    };
    const arm = (sgn, color, off) => {
      const sh = [neck[0] + off - dir * 0.02 * k * as, neck[1] + 0.07 * k];
      const sw = (reduceMotion ? 0 : 1) * Math.cos(Math.PI * ps.phase) * 0.42 * ps.move * sgn;
      const a1 = sw * side, a2 = a1 + 0.28 * ps.move + 0.08;
      const el = [sh[0] + Math.sin(a1) * dir * 0.29 * k, sh[1] + Math.cos(a1) * 0.29 * k];
      const hd = [el[0] + Math.sin(a2) * dir * 0.27 * k, el[1] + Math.cos(a2) * 0.27 * k];
      ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = 0.085 * k;
      ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.lineTo(el[0], el[1]); ctx.lineTo(hd[0], hd[1]); ctx.stroke();
      ctx.fillStyle = col(LOOK.skin); ctx.beginPath(); ctx.arc(hd[0], hd[1], 0.042 * k, 0, Math.PI * 2); ctx.fill();
    };

    arm(-1, colD(LOOK.top), -lat * 1.4);
    leg(ps.feet[1], -lat, colD(LOOK.trouser), 0.12);
    leg(ps.feet[0], lat, col(LOOK.trouser), 0.125);
    ctx.fillStyle = col(LOOK.trouser);
    ctx.beginPath(); ctx.ellipse(Hs[0], Hs[1] - 0.02 * k, hipW / 2, 0.09 * k, 0, 0, Math.PI * 2); ctx.fill();
    const chest = dir * 0.03 * k * as;
    ctx.fillStyle = col(LOOK.top);
    ctx.beginPath();
    ctx.moveTo(Hs[0] - hipW / 2, Hs[1] - 0.04 * k);
    ctx.lineTo(Hs[0] + hipW / 2, Hs[1] - 0.04 * k);
    ctx.quadraticCurveTo(neck[0] + shW / 2 + chest, lerp(Hs[1], neck[1], 0.55), neck[0] + shW / 2, neck[1] + 0.06 * k);
    ctx.quadraticCurveTo(neck[0], neck[1] - 0.02 * k, neck[0] - shW / 2, neck[1] + 0.06 * k);
    ctx.quadraticCurveTo(neck[0] - shW / 2 + chest * 0.3, lerp(Hs[1], neck[1], 0.55), Hs[0] - hipW / 2, Hs[1] - 0.04 * k);
    ctx.fill();
    const hr = 0.105 * k;
    const hc = [neck[0] + dir * 0.025 * k * as, neck[1] - 0.15 * k];
    ctx.strokeStyle = col(LOOK.skin); ctx.lineWidth = 0.06 * k;
    ctx.beginPath(); ctx.moveTo(neck[0], neck[1]); ctx.lineTo(hc[0], hc[1] + hr * 0.6); ctx.stroke();
    ctx.fillStyle = col(LOOK.skin);
    ctx.beginPath(); ctx.arc(hc[0], hc[1], hr, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(hc[0], hc[1], hr * 1.06, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = col(LOOK.hair);
    const hx = hc[0] - dir * hr * 0.42 * as, hy = hc[1] - hr * lerp(0.48, -0.25, away) * (1 - 0.2 * as);
    ctx.beginPath(); ctx.arc(hx, hy, hr * lerp(0.98, 1.12, away), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    arm(1, col(LOOK.top), lat * 1.4);
  }

  // ---------------------------------------------------------------- painter's order
  function relBase(A, Bb) {
    for (let a = 0; a < 3; a++) {
      if (A.max[a] <= Bb.min[a] + 1e-4) { const c = cam.p[a]; if (c >= Bb.min[a]) return 1; if (c <= A.max[a]) return -1; return 0; }
      if (Bb.max[a] <= A.min[a] + 1e-4) { const c = cam.p[a]; if (c >= A.min[a]) return -1; if (c <= Bb.max[a]) return 1; return 0; }
    }
    return 0;
  }
  function relation(A, Bb) {
    if (A.person || Bb.person) {
      const Pp = A.person ? A : Bb, O = A.person ? Bb : A;
      const after = A.person ? -1 : 1;
      if (O.solid && O.max[1] <= Pp.min[1] + 0.26) return after;
      const r = relBase(A, Bb);
      return r !== 0 ? r : after;
    }
    return relBase(A, Bb);
  }

  const visible = [];
  function drawScene(ctx) {
    ctx.clearRect(0, 0, W, Hh);
    visible.length = 0;
    const pad = 40;
    for (const it of items.concat(person)) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
      for (let c = 0; c < 8; c++) {
        const q = toCam([c & 1 ? it.max[0] : it.min[0], c & 2 ? it.max[1] : it.min[1], c & 4 ? it.max[2] : it.min[2]]);
        if (q[2] < NEAR) { behind = true; continue; }
        const s = scr(q);
        if (s[0] < x0) x0 = s[0]; if (s[0] > x1) x1 = s[0]; if (s[1] < y0) y0 = s[1]; if (s[1] > y1) y1 = s[1];
      }
      if (behind) { x0 = -1e5; y0 = -1e5; x1 = 1e5; y1 = 1e5; }
      if (x1 < -pad || x0 > W + pad || y1 < -pad || y0 > Hh + pad) continue;
      visible.push({ it, x0, y0, x1, y1, d: Math.hypot(it.c[0] - cam.p[0], it.c[1] - cam.p[1], it.c[2] - cam.p[2]) });
    }
    const n = visible.length;
    const adj = Array.from({ length: n }, () => []);
    const indeg = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const A = visible[i];
      for (let j = i + 1; j < n; j++) {
        const Bv = visible[j];
        if (A.x1 < Bv.x0 || Bv.x1 < A.x0 || A.y1 < Bv.y0 || Bv.y1 < A.y0) continue;
        const r = relation(A.it, Bv.it);
        if (r > 0) { adj[i].push(j); indeg[j]++; } else if (r < 0) { adj[j].push(i); indeg[i]++; }
      }
    }
    const done = new Uint8Array(n);
    for (let count = 0; count < n; count++) {
      let pick = -1, best = -1, fallback = -1, fbest = -1;
      for (let i = 0; i < n; i++) {
        if (done[i]) continue;
        if (indeg[i] === 0 && visible[i].d > best) { best = visible[i].d; pick = i; }
        if (visible[i].d > fbest) { fbest = visible[i].d; fallback = i; }
      }
      if (pick < 0) pick = fallback;
      done[pick] = 1;
      for (const j of adj[pick]) indeg[j]--;
      const it = visible[pick].it;
      if (it.solid) drawSolid(ctx, it); else it.draw(ctx, it);
    }
    drawLampLight(ctx);
    // The section ends on paper, like a drawing.
    const eb = project([cam.p[0], -1.7, 0]);
    if (eb && eb[1] < Hh) { ctx.fillStyle = css(env.paper); ctx.fillRect(0, eb[1], W, Hh - eb[1]); }
  }

  // Warm light from the lamps: soft pools only.
  function drawLampLight(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const lp of lamps) {
      const I = lampI(lp); if (I < 0.02) continue;
      if (Math.abs(lp.p[1] - cam.p[1]) > 14) continue;
      const c = project(lp.p); if (!c) continue;
      const r = pxSize(lp.kind === 'task' ? 1.1 : lp.kind === 'pendant' ? 2.8 : 1.8, lp.p);
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
      g.addColorStop(0, css([1, 0.8, 0.58], 0.16 * I));
      g.addColorStop(0.4, css([1, 0.74, 0.5], 0.05 * I));
      g.addColorStop(1, css([1, 0.7, 0.45], 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- sky & landscape
  const stars = Array.from({ length: 110 }, (_, i) => {
    const r = rng(1000 + i); const az = (r() - 0.5) * 2.4, el = 0.04 + Math.pow(r(), 0.8) * 0.95;
    return { d: [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)], m: 0.25 + r() * 0.55, s: r() * 10 };
  });
  const clouds = Array.from({ length: 5 }, (_, i) => {
    const r = rng(300 + i);
    const puffs = Array.from({ length: 5 + Math.floor(r() * 4) }, () => [(r() - 0.5) * 70, r() * 6, 7 + r() * 10]);
    return { x: (r() - 0.5) * 900, y: 45 + r() * 80, z: -560 - r() * 380, puffs, v: 0.6 + r() * 0.9 };
  });
  const ridge = (x, f, s) => 0.55 + 0.25 * Math.sin(x * f + s) + 0.13 * Math.sin(x * f * 2.3 + s * 1.7) + 0.07 * Math.sin(x * f * 5.1 + s * 3.1);
  const LAYERS = [
    { z: -1100, amp: 110, lift: -8, fade: 0.82, f: 1 / 260, s: 1.3 },
    { z: -520, amp: 40, lift: -3, fade: 0.66, f: 1 / 120, s: 4.2 },
    { z: -230, amp: 14, lift: -1, fade: 0.5, f: 1 / 55, s: 2.2, trees: true },
    { z: -75, town: true, fade: 0.32 },
  ];

  function drawSky(ctx) {
    const hz = projDir([0, 0, -1]);
    const hy = hz ? hz[1] : Hh / 2;
    const g = ctx.createLinearGradient(0, Math.min(0, hy - Hh), 0, hy);
    g.addColorStop(0, css(env.sky0));
    g.addColorStop(1, css(env.sky1));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = css(env.haze); ctx.fillRect(0, hy, W, Hh - hy + 2);

    if (env.stars > 0.01) {
      for (const s of stars) {
        const p = projDir(s.d); if (!p || p[1] > hy - 4) continue;
        const tw = reduceMotion ? 1 : 0.75 + 0.25 * Math.sin(time * (0.5 + s.m) + s.s);
        ctx.fillStyle = css([0.95, 0.93, 0.9], env.stars * s.m * tw * clamp((hy - p[1]) / 140, 0, 1));
        ctx.fillRect(p[0] - 0.4, p[1] - 0.4, 0.8, 0.8);
      }
      const m = projDir(norm([0.5, 0.42, -1]));
      if (m) {
        ctx.fillStyle = css([0.93, 0.92, 0.88], env.stars * 0.9);
        ctx.beginPath(); ctx.arc(m[0], m[1], Math.min(W, Hh) * 0.016, 0, Math.PI * 2); ctx.fill();
      }
    }

    for (const c of clouds) {
      const span = 1400;
      let x = c.x + (reduceMotion ? 0 : time * c.v);
      x = ((x - cam.p[0] + span / 2) % span + span) % span - span / 2 + cam.p[0];
      ctx.fillStyle = css(mix3(mix3([1, 0.995, 0.985], env.sky1, 0.25), env.sky0, env.night * 0.6), lerp(0.75, 0.12, env.night));
      ctx.beginPath();
      for (const [px, py, pr] of c.puffs) {
        const p = project([x + px, c.y + py, c.z]); if (!p) continue;
        const r = pr * cam.focal / (cam.p[2] - c.z);
        ctx.moveTo(p[0] + r, p[1]); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    for (const Ly of LAYERS) {
      const D = cam.p[2] - Ly.z;
      const col = mix3(env.land, env.haze, Ly.fade);
      if (Ly.town) { drawTown(ctx, Ly, D, col); continue; }
      ctx.fillStyle = css(col);
      ctx.beginPath();
      let first = true;
      for (let sx = -30; sx <= W + 30; sx += 7) {
        const X = cam.p[0] + (sx - cam.cx) * D / cam.focal;
        let h = Ly.lift + Ly.amp * ridge(X, Ly.f, Ly.s);
        if (Ly.trees) { const cell = Math.floor(X / 7); const fx = X / 7 - cell; if (hash(cell) > 0.55) h += Math.max(0, 1 - Math.abs(fx - 0.5) * 7) * 6 * (0.6 + hash(cell + 9)); }
        const p = project([X, h, Ly.z]); if (!p) continue;
        if (first) { ctx.moveTo(p[0], Hh + 10); ctx.lineTo(p[0], p[1]); first = false; } else ctx.lineTo(p[0], p[1]);
      }
      ctx.lineTo(W + 30, Hh + 10); ctx.closePath(); ctx.fill();
    }
  }

  function drawTown(ctx, Ly, D, col) {
    const x0 = cam.p[0] + (-60 - cam.cx) * D / cam.focal, x1 = cam.p[0] + (W + 60 - cam.cx) * D / cam.focal;
    const cell = 3.4;
    const g0 = project([cam.p[0], -T, Ly.z]);
    if (g0) { ctx.fillStyle = css(mix3(col, env.land, 0.2)); ctx.fillRect(0, g0[1], W, Hh - g0[1] + 2); }
    for (let i = Math.floor(x0 / cell); i <= Math.ceil(x1 / cell); i++) {
      if (hash(i * 3.1) < 0.18) continue;
      const w = cell * (0.55 + hash(i) * 0.4), h = 1.8 + hash(i + 17) * 4.8 + (hash(i + 5) > 0.93 ? 5 : 0);
      const bx = i * cell + hash(i + 2) * (cell - w);
      const a = project([bx, -T, Ly.z]), b = project([bx + w, -T + h, Ly.z]); if (!a || !b) continue;
      ctx.fillStyle = css(sc3(col, 0.95 + hash(i + 40) * 0.07));
      ctx.fillRect(a[0], b[1], b[0] - a[0], a[1] - b[1]);
      if (env.lamp > 0.05) {
        const rows = Math.floor(h / 1.2), cols = Math.max(1, Math.floor(w / 1.1));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const hk = hash(i * 31 + r * 7 + c * 13);
          if (hk < 0.7) continue;
          const p = project([bx + (c + 0.35) * (w / cols), -T + 0.6 + r * 1.2, Ly.z]); if (!p) continue;
          const s = Math.max(1, 0.32 * cam.focal / D);
          ctx.fillStyle = css([1, 0.8, 0.56], env.lamp * (0.35 + hk * 0.4));
          ctx.fillRect(p[0], p[1] - s, s, s);
        }
      }
    }
  }

  // ---------------------------------------------------------------- foreground
  const clusters = [
    { c: [-11.5, -0.4, 15], r: 2.8, n: 90, seed: 11 },
    { c: [5.6, 0.6, 14.5], r: 2.2, n: 70, seed: 12 },
    { c: [-10.8, 5.2, 3.2], r: 1.6, n: 50, seed: 13 },
    { c: [7.6, 2.2, 3.4], r: 1.8, n: 60, seed: 14 },
  ].map(cl => {
    const r = rng(cl.seed);
    cl.leaves = Array.from({ length: cl.n }, () => {
      const th = r() * Math.PI * 2, rr = Math.sqrt(r()) * cl.r;
      return [Math.cos(th) * rr, Math.sin(th) * rr * 0.75, (r() - 0.5) * 1.2, r() * Math.PI, 0.13 + r() * 0.12, r()];
    });
    return cl;
  });
  function drawFore(ctx) {
    ctx.clearRect(0, 0, W, Hh);
    for (const cl of clusters) {
      const cc = toCam(cl.c); if (cc[2] < 0.8) continue;
      const sc = scr(cc); const R = cl.r * cam.focal / cc[2];
      if (sc[0] + R < -50 || sc[0] - R > W + 50 || sc[1] + R < -50 || sc[1] - R > Hh + 50) continue;
      ctx.strokeStyle = css(env.leaf); ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, 0.06 * cam.focal / cc[2]);
      const edge = cl.c[0] < 0 ? [cl.c[0] - cl.r * 2.2, cl.c[1] - cl.r * 1.4, cl.c[2]] : [cl.c[0] + cl.r * 2.2, cl.c[1] - cl.r * 1.2, cl.c[2]];
      strokeWorld(ctx, edge, cl.c);
      for (const [dx, dy, dz, ang, s, ph] of cl.leaves) {
        const sw = reduceMotion ? 0 : Math.sin(time * 0.9 + ph * 6) * 0.06;
        const q = toCam([cl.c[0] + dx + sw, cl.c[1] + dy, cl.c[2] + dz]); if (q[2] < 0.6) continue;
        const pp = scr(q); const k = cam.focal / q[2];
        ctx.fillStyle = css(dy > 0.2 ? env.leaf2 : env.leaf, 0.95);
        ctx.beginPath(); ctx.ellipse(pp[0], pp[1], s * k, s * 0.34 * k, ang + sw * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ---------------------------------------------------------------- scroll → timeline
  function readScroll() {
    const s = scrollY / Math.max(1, innerHeight);
    return clamp(s < SEG[0] ? s / SEG[0] : 1 + (s - SEG[0]) / SEG[1], 0, END);
  }
  const scrollFor = p => innerHeight * (p <= 1 ? p * SEG[0] : SEG[0] + (p - 1) * SEG[1]);

  const walk = (a, b, q0, q1, x) => lerp(q0, q1, easeSine(clamp((x - a) / (b - a), 0, 1)));
  const qFor = p => (p < 1.05 ? walk(0.12, 0.95, STOP[0], STOP[1], p) : walk(1.12, 1.46, STOP[1], STOP[2], p));

  function updateTimeline(p) {
    tl.arrive = smooth(0.88, 1.06, p);
    tl.title = smooth(0.96, 1.14, p);
    tl.desk = smooth(1.36, 1.5, p);
    tl.sketch = smooth(1.46, 1.74, p);
    tl.arrow = smooth(1.66, 1.84, p);
    tl.coda = easeInOut(smooth(1.84, 2.0, p));
    for (const lp of lamps) lp.boost = lp.k === 1 && lp.kind === 'pendant' ? 0.24 * tl.arrive : 0;
    deskLamp.boost = 0.55 * smooth(1.42, 1.52, p);
  }

  // Camera: hero, follow and room shots blended by the timeline, then eased with inertia.
  function desiredCamera(p) {
    const fy = ps.ground;
    const lead = 0.7 * Math.cos(ps.hd) * ps.move;
    const fT = [ps.hip[0] + lead, fy + 1.05, ps.hip[2]];
    const fP = [fT[0] * 0.9 - 0.25, fy + 2.4, -1.5 + (portrait ? 13.5 : 10.4)];
    const hx = FS[STOP[0]][0] + 0.25;
    const hT = [hx, portrait ? 6.2 : 6.4, -2.3];
    const hP = [hx, 2.4, -1.5 + (portrait ? 23 : 31)];
    const rT = portrait ? [-4.45, H + 1.72, -7.5] : [-4.0, H + 1.82, -7.5];
    const rP = portrait ? [-4.45, H + 1.6, -1.9] : [-4.0, H + 1.72, 4.7];
    const c1 = easeInOut(smooth(0.02, 0.5, p));
    const c2 = easeInOut(smooth(0.9, 1.34, p));
    let tt = mix3(mix3(hT, fT, c1), rT, c2);
    let pp = mix3(mix3(hP, fP, c1), rP, c2);
    const c3 = tl.coda;
    tt = add3(tt, [c3 * 3.2, c3 * 1.9, c3 * 2.5]);
    pp = add3(pp, [c3 * 2.2, c3 * 0.35, c3 * (portrait ? 7.5 : 2.2)]);
    return [pp, tt];
  }

  // ---------------------------------------------------------------- HUD
  const root = document.documentElement;
  const heroLines = [...document.querySelectorAll('.hero .ln')];
  const heroEl = document.getElementById('hero');
  const cue = document.getElementById('cue');
  const stage = document.querySelector('.stage');
  const annoA = document.getElementById('annoA'), annoB = document.getElementById('annoB'), annoK = document.getElementById('annoK');
  const meter = document.getElementById('meter'), mMark = document.getElementById('mMark'), mRead = document.getElementById('mRead');
  const mScale = document.getElementById('mScale'), mLabel = document.getElementById('mLabel');

  for (let i = 0; i <= STEPS * 2; i++) {
    const t = document.createElement('i');
    t.style.bottom = (i / (STEPS * 2) * 100) + '%';
    if (i === STEPS) t.className = 'mid';
    mScale.appendChild(t);
  }
  meter.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => goTo(+b.dataset.k)));

  let tween = null;
  function goTo(k) {
    const to = scrollFor(k === 0 ? 0 : 1.2), from = scrollY;
    if (reduceMotion) { scrollTo(0, to); return; }
    tween = { from, to, t0: performance.now(), dur: clamp(900 + Math.abs(to - from) / innerHeight * 260, 1000, 3200) };
  }
  ['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, () => { tween = null; }, { passive: true }));

  function place(el, world, align, above) {
    const s = project(world); if (!s) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    const x = clamp(align === 'center' ? s[0] - w / 2 : s[0], 16, W - w - 16);
    const y = clamp(above ? s[1] - h : s[1], 84, Hh - h - 28);
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  let lastLabel = '';
  function updateHud(p) {
    heroLines.forEach((el, i) => {
      const t = smooth(0.012 + i * 0.022, 0.07 + i * 0.022, p);
      el.style.opacity = (1 - t).toFixed(3);
      el.style.transform = t > 0 ? `translate3d(0, ${(-t * 26).toFixed(1)}px, 0)` : '';
      el.style.filter = t > 0.01 ? `blur(${(t * 7).toFixed(1)}px)` : '';
    });
    heroEl.toggleAttribute('data-gone', p > 0.16);
    cue.style.opacity = (1 - smooth(0, 0.04, p)).toFixed(3);

    const veil = lerp(1, 0.4, easeInOut(smooth(0.02, 0.5, p))) * (1 - easeInOut(smooth(0.9, 1.3, p))) + tl.coda * 0.35;
    stage.style.setProperty('--veil', veil.toFixed(3));

    const aA = tl.title, aB = smooth(1.5, 1.66, p) * (1 - tl.coda * 0.6);
    annoA.style.opacity = aA.toFixed(3);
    annoK.style.opacity = aA.toFixed(3);
    annoK.toggleAttribute('data-off', aA < 0.01);
    annoB.style.opacity = aB.toFixed(3);
    annoA.toggleAttribute('data-off', aA < 0.01);
    annoB.toggleAttribute('data-off', aB < 0.01);
    if (aA > 0.01) { place(annoA, [-5.88, H + H - T - 1.27, -7.5], 'left'); place(annoK, [-5.88, H + H - T - 0.4, -7.5], 'left', true); }
    if (aB > 0.01) place(annoB, portrait ? [-4.45, H + 0.3, -4.4] : [-4.0, H + 0.02, -3.0], 'center');

    const el = clamp(ps.ground, 0, H);
    mMark.style.bottom = (el / H * 100).toFixed(2) + '%';
    mRead.textContent = '+' + el.toFixed(2) + ' m';
    const label = p > 0.97 ? 'Landing 01 · NSUT' : p > 0.12 ? 'Climbing' : 'Ground';
    if (label !== lastLabel) { mLabel.textContent = label; lastLabel = label; }
  }

  // ---------------------------------------------------------------- theme
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  const themeBtn = document.getElementById('theme');
  const isDark = () => { const t = root.getAttribute('data-theme'); return t ? t === 'dark' : mqDark.matches; };
  let night = isDark() ? 1 : 0;
  const syncThemeLabel = () => themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
  themeBtn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ascent-theme', next); } catch (e) {}
    syncThemeLabel();
  });
  if (mqDark.addEventListener) mqDark.addEventListener('change', syncThemeLabel);
  syncThemeLabel();
  document.getElementById('mark').addEventListener('click', e => { e.preventDefault(); goTo(0); });

  (function grain() {
    const g = document.createElement('canvas'); g.width = g.height = 160;
    const c = g.getContext('2d'); const img = c.createImageData(160, 160); const r = rng(5);
    for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (r() - 0.5) * 56; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    c.putImageData(img, 0, 0);
    document.querySelector('.grain').style.backgroundImage = `url(${g.toDataURL()})`;
  })();

  // ---------------------------------------------------------------- loop
  build();
  buildPath();
  computeShadows();
  resize();
  addEventListener('resize', resize);

  P = readScroll();
  let qDisp = qFor(P), idle = 0, last = performance.now();
  let camP = null, camT = null;
  updateTimeline(P); poseAt(qDisp);

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    time += dt;
    if (tween) {
      const k = clamp((now - tween.t0) / tween.dur, 0, 1);
      scrollTo(0, lerp(tween.from, tween.to, easeInOut(k)));
      if (k >= 1) tween = null;
    }
    const target = readScroll();
    P = reduceMotion ? target : P + (target - P) * (1 - Math.exp(-dt * 3.4));
    if (Math.abs(target - P) < 2e-5) P = target;
    idle = Math.abs(target - P) < 4e-4 ? idle + dt : 0;

    // The protagonist follows the scroll; pausing mid-stride, they finish the step.
    const q = qFor(P);
    const qT = idle > 0.3 ? Math.round(q) : q;
    const prevQ = qDisp;
    qDisp = reduceMotion ? qT : qDisp + (qT - qDisp) * (1 - Math.exp(-dt * 7));
    const speed = Math.abs(qDisp - prevQ) / Math.max(dt, 1e-3);
    ps.move = lerp(ps.move, clamp(speed / 1.6, 0, 1), 1 - Math.exp(-dt * 6));

    updateTimeline(P);
    poseAt(qDisp);
    night += ((isDark() ? 1 : 0) - night) * (1 - Math.exp(-dt * (reduceMotion ? 60 : 2.6)));
    computeEnv(P / END, night);

    const [dp, dtg] = desiredCamera(P);
    if (!camP || reduceMotion) { camP = dp; camT = dtg; }
    const k = 1 - Math.exp(-dt * 3.0);
    camP = mix3(camP, dp, k); camT = mix3(camT, dtg, k);
    const drift = reduceMotion ? [0, 0, 0] : [Math.sin(time * 0.29) * 0.025, Math.sin(time * 0.21) * 0.02, 0];
    aim(add3(camP, drift), camT);

    drawSky(cSky);
    drawScene(cScene);
    drawFore(cFore);
    updateHud(P);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
