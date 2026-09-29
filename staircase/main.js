/*
 * The Ascent — core staircase experience.
 *
 * A section-perspective drawing of a stair tower, rendered as flat
 * "architectural gouache" planes on three layered canvases:
 *   sky   — atmosphere, stars, clouds, landscape bands (slow parallax)
 *   scene — the building itself, with hard sun shadows and lamp light
 *   fore  — out-of-focus foliage and mist close to the lens (fast parallax)
 * Scroll drives a camera that climbs the stair; landings are soft holds.
 */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- utils
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
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
    return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a.toFixed(3)})`;
  };
  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = i => { let x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------------------------------------------------------------- scene constants
  const N = 6;                    // landings above ground; N is the roof
  const H = 4.2;                  // floor to floor
  const T = 0.3;                  // slab thickness
  const STEPS = 12;
  const RISE = H / 2 / STEPS;     // 0.175
  const RUN = 0.3;
  const XA = -1.8, XB = 1.8;      // flight ends
  const L = norm([0.42, -0.62, -1]); // sun direction (light travels along L)

  const MAT = {
    plaster: [0.95, 0.92, 0.87],
    stone:   [0.93, 0.90, 0.83],
    oak:     [0.78, 0.66, 0.54],
    ground:  [0.80, 0.77, 0.60],
    planter: [0.86, 0.80, 0.72],
  };
  // One quiet Barragán-style colour wall per landing.
  const TINT = [null, [0.93, 0.74, 0.68], [0.94, 0.82, 0.60], [0.74, 0.81, 0.71], [0.79, 0.77, 0.87], [0.91, 0.67, 0.55], null];

  // ---------------------------------------------------------------- scene graph
  const items = [];
  const lamps = [];
  const railPath = [];

  function add(min, max, o = {}) {
    const it = Object.assign({ min, max, solid: true, casts: true, recv: true, mat: 'plaster', top: null, tint: null, mass: false }, o);
    it.c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    items.push(it);
    return it;
  }
  const B = (x0, y0, z0, x1, y1, z1, o) => add([x0, y0, z0], [x1, y1, z1], o);

  function build() {
    // Earth — cut in section at z = 0.
    B(-400, -12, -42, 400, -T, 0, { mat: 'ground', ground: true, casts: false });
    // Ground-floor stair hall paving.
    B(XA, -T, -3.0, 3.4, 0, 0, { top: 'stone', mass: true });

    for (let k = 0; k <= N; k++) {
      const y = k * H;
      const roof = k === N;
      const wt = roof ? y + 1.05 : y + H - T;  // wall top for this storey
      const yb = y - T;

      // Room ("chapter") floor slab and walls.
      B(-6.2, yb, -7.5, XA, y, 0, { top: roof ? 'stone' : 'oak', mass: true });
      B(-6.6, yb, -7.9, -6.2, wt, 0, { mass: true });
      if (roof) {
        B(-6.2, yb, -7.9, XA, wt, -7.5, { mass: true });
      } else {
        // back wall with a large window onto the landscape
        B(-6.2, yb, -7.9, XA, y + 0.7, -7.5, { mass: true });
        B(-6.2, y + 3.25, -7.9, XA, wt, -7.5, { mass: true });
        B(-6.2, y + 0.7, -7.9, -5.3, y + 3.25, -7.5, { mass: true });
        B(-2.7, y + 0.7, -7.9, XA, y + 3.25, -7.5, { mass: true });
        B(-4.035, y + 0.7, -7.62, -3.965, y + 3.25, -7.55, { recv: false, mat: 'steel' }); // mullion
        B(-5.3, y + 0.62, -7.5, -2.7, y + 0.7, -7.34, { top: 'stone' });                // sill
      }
      B(XA, yb, -7.9, -1.4, wt, -3.4, { mass: true, tint: TINT[k] });  // colour wall

      // Stair hall walls. Back wall has a slit window above the mid landing.
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

      // Mid landing.
      B(XB, y + H / 2 - T, -3.0, 3.4, y + H / 2, 0, { top: 'stone', mass: true });

      // Back flight: floating cantilevered treads, rising to +x.
      for (let i = 0; i < STEPS; i++) {
        const top = y + (i + 1) * RISE;
        B(XA + i * RUN, top - 0.14, -3.0, XA + (i + 1) * RUN, top, -1.62, { mat: 'stone' });
      }
      // Front flight: folded plate, rising to -x, cut by the section plane.
      for (let j = 0; j < STEPS; j++) {
        const top = y + H / 2 + (j + 1) * RISE;
        B(XB - (j + 1) * RUN, top - RISE - 0.16, -1.5, XB - j * RUN, top, 0, { mat: 'stone' });
      }

      // Handrails (continuous path used by the hero light).
      railPath.push([[XA, y + RISE + 0.9, -2.95], [XB, y + H / 2 + 0.9, -2.95]]);
      railPath.push([[XB, y + H / 2 + RISE + 0.95, -1.54], [XA, y + H + 0.95, -1.54]]);
      add([XA, y + H / 2, -1.585], [XB, y + H + 1.0, -1.5], { solid: false, draw: drawFrontRail, k, y });

      // Lamps.
      const lp = [-4.0, y + 2.45, -3.8];
      lamps.push({ p: lp, k, kind: 'pendant' });
      add([-4.36, y + 2.3, -4.16], [-3.64, y + H - T, -3.44], { solid: false, draw: drawPendant, lamp: lp, ceil: y + H - T });
      lamps.push({ p: [3.1, y + H / 2 + 1.95, -2.9], k, kind: 'sconce' });
    }

    // Roof terrace: planter and olive tree.
    const yr = N * H;
    B(-5.4, yr, -5.9, -3.6, yr + 0.62, -4.3, { mat: 'planter' });
    add([-6.1, yr + 0.62, -6.4], [-2.9, yr + 4.2, -3.8], { solid: false, draw: drawOlive, base: [-4.5, yr + 0.62, -5.1], seed: 7 });

    // Cypresses on the ground, either side of the tower.
    const cyp = [[-9.2, -3.5, 7.2], [-11.4, -6.5, 8.4], [-14.5, -2.4, 6.1], [6.3, -5.0, 7.8], [8.6, -2.8, 6.2], [10.4, -7.5, 9.0], [-18, -9, 7], [14, -12, 8.5]];
    cyp.forEach(([x, z, h], i) => add([x - 0.75, -T, z - 0.75], [x + 0.75, -T + h, z + 0.75], { solid: false, draw: drawCypress, base: [x, -T, z], h, seed: i + 3 }));
  }

  // ---------------------------------------------------------------- shadows (precomputed once)
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
    const edges = [[0, x0, 1], [0, x1, -1], [1, y0, 1], [1, y1, -1]];
    let out = poly;
    for (const [ax, v, s] of edges) {
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
        if (a === 2 && s > 0 && v >= -1e-6) continue; // section cut (poché)
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

  // ---------------------------------------------------------------- environment (time of day × theme)
  const DAY = [
    { u: 0,  sun: [0.40, 0.31, 0.25], amb: [0.75, 0.74, 0.77], sky0: [0.66, 0.74, 0.84], sky1: [0.97, 0.88, 0.80], haze: [0.94, 0.89, 0.85], land: [0.63, 0.66, 0.61] },
    { u: .5, sun: [0.33, 0.32, 0.29], amb: [0.80, 0.79, 0.77], sky0: [0.56, 0.69, 0.83], sky1: [0.92, 0.92, 0.89], haze: [0.89, 0.90, 0.89], land: [0.64, 0.66, 0.55] },
    { u: 1,  sun: [0.46, 0.31, 0.17], amb: [0.73, 0.68, 0.68], sky0: [0.58, 0.60, 0.74], sky1: [0.99, 0.82, 0.64], haze: [0.97, 0.85, 0.74], land: [0.60, 0.55, 0.49] },
  ];
  const NIGHT = [
    { u: 0,  sun: [0.22, 0.18, 0.25], amb: [0.25, 0.25, 0.32], sky0: [0.14, 0.15, 0.25], sky1: [0.52, 0.38, 0.39], haze: [0.34, 0.28, 0.31], land: [0.13, 0.13, 0.16] },
    { u: .5, sun: [0.16, 0.18, 0.25], amb: [0.20, 0.21, 0.27], sky0: [0.07, 0.08, 0.14], sky1: [0.22, 0.21, 0.30], haze: [0.18, 0.18, 0.24], land: [0.09, 0.09, 0.12] },
    { u: 1,  sun: [0.17, 0.19, 0.27], amb: [0.17, 0.18, 0.24], sky0: [0.04, 0.05, 0.10], sky1: [0.16, 0.15, 0.24], haze: [0.13, 0.13, 0.19], land: [0.07, 0.07, 0.10] },
  ];
  const KEYS = ['sun', 'amb', 'sky0', 'sky1', 'haze', 'land'];
  function sample(stops, u) {
    let i = 0; while (i < stops.length - 2 && u > stops[i + 1].u) i++;
    const a = stops[i], b = stops[i + 1], t = smooth(0, 1, (u - a.u) / (b.u - a.u));
    const o = {}; for (const k of KEYS) o[k] = mix3(a[k], b[k], t); return o;
  }
  const env = {};
  function computeEnv(u, night, time) {
    const d = sample(DAY, u), n = sample(NIGHT, u);
    for (const k of KEYS) env[k] = mix3(d[k], n[k], night);
    const flicker = reduceMotion ? 1 : 0.93 + 0.07 * Math.sin(time * 0.13) * Math.sin(time * 0.071 + 1);
    env.sun = sc3(env.sun, lerp(flicker, 1, night));
    env.night = night;
    env.day = 1 - night;
    env.lamp = smooth(0.2, 1, night);
    env.lampCol = [1.0, 0.67, 0.37];
    env.poche = mix3([0.17, 0.15, 0.13], [0.045, 0.04, 0.036], night);
    env.line = mix3([0.16, 0.13, 0.11], [0.0, 0.0, 0.0], night);
    env.fog = lerp(0.32, 0.55, night);
    env.stars = smooth(0.45, 1, night) * (0.45 + 0.55 * u);
    env.brass = mix3([0.74, 0.55, 0.30], [0.55, 0.40, 0.24], night);
    env.leaf = mix3([0.30, 0.33, 0.24], [0.035, 0.035, 0.045], night);
    env.leaf2 = mix3([0.40, 0.43, 0.30], [0.06, 0.06, 0.07], night);
    env.accent = mix3([0.78, 0.36, 0.20], [0.98, 0.72, 0.40], night);
  }

  // ---------------------------------------------------------------- shading
  function albedo(it, a, s) {
    if (a === 1 && s > 0 && it.top) return MAT[it.top];
    if (it.mat === 'steel') return [0.30, 0.28, 0.27];
    if (it.tint && a === 0 && s < 0) return it.tint;
    return MAT[it.mat] || MAT.plaster;
  }
  function shade(it, a, s, center) {
    const alb = albedo(it, a, s);
    const ndl = Math.max(0, -s * L[a]);
    let dark = mul3(alb, env.amb);
    let lit = add3(dark, mul3(alb, sc3(env.sun, ndl * 1.05)));
    if (env.lamp > 0.01) {
      let acc = 0;
      for (const lp of lamps) {
        const dx = lp.p[0] - center[0], dy = lp.p[1] - center[1], dz = lp.p[2] - center[2];
        const d = Math.hypot(dx, dy, dz);
        const R = lp.kind === 'pendant' ? 6.5 : 4.2;
        if (d > R) continue;
        const nd = (a === 0 ? dx : a === 1 ? dy : dz) * s / (d || 1);
        const f = (1 - d / R); acc += f * f * (0.35 + 0.65 * Math.max(0, nd)) * (lp.kind === 'pendant' ? 1 : 0.7);
      }
      if (acc > 0) { const add = mul3(alb, sc3(env.lampCol, env.lamp * Math.min(acc, 1.3) * 0.95)); lit = add3(lit, add); dark = add3(dark, add); }
    }
    const dist = Math.hypot(center[0] - cam.p[0], center[1] - cam.p[1], center[2] - cam.p[2]);
    const ft = it.ground ? env.fog * 0.35 : env.fog * (1 - Math.exp(-dist / 70));
    return [mix3(lit, env.haze, ft), mix3(dark, env.haze, ft)];
  }

  // ---------------------------------------------------------------- canvases
  const cvSky = document.getElementById('sky');
  const cvScene = document.getElementById('scene');
  const cvFore = document.getElementById('fore');
  const cSky = cvSky.getContext('2d');
  const cScene = cvScene.getContext('2d');
  const cFore = cvFore.getContext('2d');
  let W = 0, Hh = 0, DPR = 1;

  function resize() {
    W = innerWidth; Hh = innerHeight;
    DPR = Math.min(devicePixelRatio || 1, W < 760 ? 2 : 1.75);
    for (const cv of [cvSky, cvScene, cvFore]) { cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); }
    for (const c of [cSky, cScene, cFore]) c.setTransform(DPR, 0, 0, DPR, 0, 0);
    cam.cx = W / 2; cam.cy = Hh / 2;
    cam.focal = Math.min(Hh * 0.98, W * 1.22);
    document.getElementById('track').style.height = Math.round(Hh * (1 + N * 1.55)) + 'px';
    buildRail();
  }

  // ---------------------------------------------------------------- scene drawing
  const faceScratch = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  function faceVerts(it, a, s) {
    const v = s > 0 ? it.max[a] : it.min[a];
    const u = (a + 1) % 3, w = (a + 2) % 3;
    const q = [[it.min[u], it.min[w]], [it.max[u], it.min[w]], [it.max[u], it.max[w]], [it.min[u], it.max[w]]];
    return q.map(([uu, ww]) => { const p = [0, 0, 0]; p[a] = v; p[u] = uu; p[w] = ww; return p; });
  }

  function drawSolid(ctx, it) {
    const lineCss = css(env.line, 0.2 + env.night * 0.25);
    for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
      const v = s > 0 ? it.max[a] : it.min[a];
      if (s * (cam.p[a] - v) <= 1e-6) continue;
      const pts = faceVerts(it, a, s);
      if (!tracePoly(ctx, pts)) continue;
      if (a === 2 && s > 0 && v >= -1e-6) { // section cut
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
        tracePoly(ctx, pts);
      }
      if (!it.ground) { ctx.strokeStyle = lineCss; ctx.lineWidth = 0.7; ctx.stroke(); }
    }
    if (it.rail !== undefined && it.rail >= 0) drawBackRail(ctx, it.rail);
  }

  function hatch(ctx) {
    ctx.save(); ctx.clip();
    ctx.strokeStyle = css(mix3(env.poche, env.haze, 0.18), 0.55); ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let x = -Hh; x < W + Hh; x += 9) { ctx.moveTo(x, Hh); ctx.lineTo(x + Hh, 0); }
    ctx.stroke(); ctx.restore();
  }

  function pxSize(worldSize, p) { const c = toCam(p); return c[2] < NEAR ? 0 : worldSize * cam.focal / c[2]; }

  function strokeWorld(ctx, a, b) {
    const pa = project(a), pb = project(b);
    if (!pa || !pb) return;
    ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
  }

  function drawBackRail(ctx, k) {
    const y = k * H;
    const a = [XA, y + RISE + 0.9, -2.95], b = [XB, y + H / 2 + 0.9, -2.95];
    // soft shadow of the rail on the wall
    const t = 0.05 / -L[2];
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(mul3(MAT.plaster, env.amb), 0.9 * env.day);
    ctx.lineWidth = Math.max(0.8, pxSize(0.05, a));
    strokeWorld(ctx, [a[0] + L[0] * t, a[1] + L[1] * t, -3.0], [b[0] + L[0] * t, b[1] + L[1] * t, -3.0]);
    ctx.strokeStyle = css(env.brass);
    ctx.lineWidth = Math.max(0.9, pxSize(0.045, a));
    strokeWorld(ctx, a, b);
    ctx.lineWidth = Math.max(0.6, pxSize(0.025, a));
    for (const x of [XA + 0.35, 0, XB - 0.35]) {
      const yy = lerp(a[1], b[1], (x - XA) / (XB - XA));
      strokeWorld(ctx, [x, yy, -2.95], [x, yy, -3.0]);
    }
    drawRailGlow(ctx, k * 2);
  }

  function drawFrontRail(ctx, it) {
    const y = it.y;
    const a = [XB, y + H / 2 + RISE + 0.95, -1.54], b = [XA, y + H + 0.95, -1.54];
    ctx.lineCap = 'round';
    ctx.strokeStyle = css(mix3(env.brass, env.poche, 0.25));
    ctx.lineWidth = Math.max(0.6, pxSize(0.022, a));
    for (let j = 1; j < STEPS; j += 3) {
      const x = XB - (j + 0.5) * RUN, top = y + H / 2 + (j + 1) * RISE;
      strokeWorld(ctx, [x, top, -1.54], [x, top + 0.95 - RISE * 0.5, -1.54]);
    }
    ctx.strokeStyle = css(env.brass);
    ctx.lineWidth = Math.max(0.9, pxSize(0.045, a));
    strokeWorld(ctx, a, b);
    drawRailGlow(ctx, it.k * 2 + 1);
  }

  // Hero light: a warm pulse that travels up the handrail, flight by flight.
  let heroGlow = 1, glowClock = 0;
  function drawRailGlow(ctx, idx) {
    if (heroGlow < 0.01) return;
    const seg = railPath[idx]; if (!seg) return;
    const span = 1.35;             // seconds per flight
    const head = (glowClock / span) % (railPath.length + 4);
    const len = 2.4;               // flights lit behind the head
    const s0 = clamp(head - len - idx, 0, 1), s1 = clamp(head - idx, 0, 1);
    const fade = Math.min(1, heroGlow * 1.2);
    // steady ember on the lower flights, plus the travelling pulse
    const base = 0.35 * fade * Math.max(0, 1 - idx / 6);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = css(env.accent, 0.9);
    ctx.shadowBlur = 14;
    ctx.strokeStyle = css(env.accent, 1);
    const a = seg[0], b = seg[1];
    const pt = t => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), a[2]];
    if (base > 0.01) { ctx.globalAlpha = base; ctx.lineWidth = Math.max(1.2, pxSize(0.05, a)); strokeWorld(ctx, a, b); }
    if (s1 > s0) {
      ctx.globalAlpha = fade;
      ctx.lineWidth = Math.max(1.6, pxSize(0.07, a));
      strokeWorld(ctx, pt(s0), pt(s1));
    }
    ctx.restore();
  }

  function drawPendant(ctx, it) {
    const lp = it.lamp;
    ctx.strokeStyle = css(mix3(env.poche, env.haze, 0.2), 0.8);
    ctx.lineWidth = 0.8;
    strokeWorld(ctx, [lp[0], it.ceil, lp[2]], [lp[0], lp[1] + 0.25, lp[2]]);
    const c = project([lp[0], lp[1] + 0.12, lp[2]]); if (!c) return;
    const r = pxSize(0.34, lp);
    // dome
    ctx.beginPath();
    ctx.ellipse(c[0], c[1], r, r * 0.8, 0, Math.PI, 0);
    ctx.lineTo(c[0] + r, c[1]);
    ctx.closePath();
    ctx.fillStyle = css(mix3(mul3([0.55, 0.42, 0.28], add3(env.amb, sc3(env.sun, 0.3))), [1, 0.8, 0.55], env.lamp * 0.15));
    ctx.fill();
    // lit rim
    ctx.beginPath(); ctx.ellipse(c[0], c[1], r, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = css(mix3([0.85, 0.80, 0.72], [1.0, 0.88, 0.62], env.lamp));
    ctx.fill();
  }

  function drawCypress(ctx, it) {
    const [x, y, z] = it.base;
    const sway = reduceMotion ? 0 : Math.sin(time * 0.6 + it.seed) * 0.08;
    const b = project([x, y, z]), t = project([x + sway, y + it.h, z]);
    if (!b || !t) return;
    const w = pxSize(0.62 + it.h * 0.035, [x, y + it.h * 0.4, z]);
    const lit = shade({ mat: 'x', tint: null }, 1, 1, [x, y + it.h * 0.5, z]);
    const col = mix3([0.30, 0.36, 0.25], env.haze, 0.18);
    const dist = Math.hypot(x - cam.p[0], z - cam.p[2]);
    const fog = env.fog * (1 - Math.exp(-dist / 60));
    const base = mul3(col, add3(env.amb, sc3(env.sun, 0.5)));
    const shadeC = mul3(col, env.amb);
    const mx = (b[0] + t[0]) / 2;
    const path = side => {
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.bezierCurveTo(b[0] + side * w * 1.05, b[1] - (b[1] - t[1]) * 0.18, mx + side * w * 0.95, t[1] + (b[1] - t[1]) * 0.45, t[0], t[1]);
      ctx.bezierCurveTo(mx - side * w * 0.2, t[1] + (b[1] - t[1]) * 0.5, b[0] - side * w * 0.15, b[1] - (b[1] - t[1]) * 0.1, b[0], b[1]);
      ctx.closePath();
    };
    ctx.fillStyle = css(mix3(shadeC, env.haze, fog)); path(1); ctx.fill();
    ctx.fillStyle = css(mix3(base, env.haze, fog)); path(-1); ctx.fill();
    void lit;
  }

  function drawOlive(ctx, it) {
    const [x, y, z] = it.base;
    const r = rng(it.seed);
    const trunkTop = [x + 0.1, y + 1.7, z];
    ctx.strokeStyle = css(mul3([0.35, 0.30, 0.25], add3(env.amb, sc3(env.sun, 0.3))));
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, pxSize(0.14, trunkTop));
    strokeWorld(ctx, [x, y, z], trunkTop);
    ctx.lineWidth = Math.max(1, pxSize(0.07, trunkTop));
    strokeWorld(ctx, trunkTop, [x - 0.6, y + 2.5, z]);
    strokeWorld(ctx, trunkTop, [x + 0.7, y + 2.4, z]);
    const sway = reduceMotion ? 0 : Math.sin(time * 0.7) * 0.05;
    const blobs = [];
    for (let i = 0; i < 16; i++) blobs.push([x + (r() - 0.5) * 2.6 + sway, y + 2.2 + r() * 1.5, z + (r() - 0.5) * 1.6, 0.35 + r() * 0.35]);
    const leaf = [0.52, 0.56, 0.42];
    for (const pass of [0, 1]) {
      ctx.fillStyle = css(pass ? mul3(leaf, add3(env.amb, sc3(env.sun, 0.55))) : mul3(leaf, env.amb));
      for (const [bx, by, bz, br] of blobs) {
        const c = project([bx + (pass ? -0.08 : 0.06), by + (pass ? 0.08 : -0.05), bz]); if (!c) continue;
        const rr = pxSize(br * (pass ? 0.78 : 1), [bx, by, bz]);
        ctx.beginPath(); ctx.ellipse(c[0], c[1], rr, rr * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // Painter's ordering: axis-separated boxes give an exact pairwise relation;
  // a topological sort resolves the frame's draw order.
  function relation(A, Bb) {
    for (let a = 0; a < 3; a++) {
      if (A.max[a] <= Bb.min[a] + 1e-4) { const c = cam.p[a]; if (c >= Bb.min[a]) return 1; if (c <= A.max[a]) return -1; return 0; }
      if (Bb.max[a] <= A.min[a] + 1e-4) { const c = cam.p[a]; if (c >= A.min[a]) return -1; if (c <= Bb.max[a]) return 1; return 0; }
    }
    return 0;
  }

  const visible = [];
  function drawScene(ctx) {
    ctx.clearRect(0, 0, W, Hh);
    visible.length = 0;
    const pad = 40;
    for (const it of items) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
      for (let c = 0; c < 8; c++) {
        const p = [c & 1 ? it.max[0] : it.min[0], c & 2 ? it.max[1] : it.min[1], c & 4 ? it.max[2] : it.min[2]];
        const q = toCam(p);
        if (q[2] < NEAR) { behind = true; continue; }
        const s = scr(q);
        if (s[0] < x0) x0 = s[0]; if (s[0] > x1) x1 = s[0]; if (s[1] < y0) y0 = s[1]; if (s[1] > y1) y1 = s[1];
      }
      if (behind) { x0 = -1e5; y0 = -1e5; x1 = 1e5; y1 = 1e5; }
      if (x1 < -pad || x0 > W + pad || y1 < -pad || y0 > Hh + pad) continue;
      const d = Math.hypot(it.c[0] - cam.p[0], it.c[1] - cam.p[1], it.c[2] - cam.p[2]);
      visible.push({ it, x0, y0, x1, y1, d });
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
      if (pick < 0) pick = fallback; // break a cycle
      done[pick] = 1;
      for (const j of adj[pick]) indeg[j]--;
      const it = visible[pick].it;
      if (it.solid) drawSolid(ctx, it); else it.draw(ctx, it);
    }
    drawAtmosphere(ctx);
  }

  // Light shafts, dust in the sun, and lamp glow — drawn over the geometry.
  const motes = Array.from({ length: 22 }, (_, i) => { const r = rng(90 + i); return [r(), r(), r(), r()]; });
  function drawAtmosphere(ctx) {
    const kc = Math.round((cam.p[1] - 2) / H);
    ctx.save();
    // Sun shafts through the (invisible) glazed front, in the nearest rooms.
    if (env.day > 0.02) {
      ctx.globalCompositeOperation = 'screen';
      for (let k = Math.max(0, kc - 1); k <= Math.min(N - 1, kc + 1); k++) {
        const y = k * H, yc = y + H - T;
        const t = (yc - y) / -L[1];
        for (const [x0, x1] of [[-6.1, -5.2], [-4.7, -3.7], [-3.2, -2.3]]) {
          const A = [x0, yc, 0], Bp = [x1, yc, 0];
          const C = [x1 + L[0] * t, y, L[2] * t], D = [x0 + L[0] * t, y, L[2] * t];
          const pa = project(A), pd = project(D); if (!pa || !pd) continue;
          if (!tracePoly(ctx, [A, Bp, C, D])) continue;
          const g = ctx.createLinearGradient(pa[0], pa[1], pd[0], pd[1]);
          const col = mix3(env.sun, [1, 1, 1], 0.4);
          g.addColorStop(0, css(col, 0.16 * env.day));
          g.addColorStop(1, css(col, 0));
          ctx.fillStyle = g; ctx.fill();
        }
      }
      // Dust motes drifting in the current room's light.
      if (!reduceMotion) {
        const y = clamp(kc, 0, N - 1) * H;
        for (const [a, b, c, d] of motes) {
          const px = -6 + a * 4 + Math.sin(time * 0.2 + d * 9) * 0.25;
          const py = y + 0.6 + ((b * 3.2 + time * 0.05 * (0.4 + d)) % 3.2);
          const pz = -0.6 - c * 3.2;
          const s = project([px, py, pz]); if (!s) continue;
          const tw = 0.5 + 0.5 * Math.sin(time * (0.8 + d) + a * 20);
          ctx.fillStyle = css([1, 0.96, 0.88], 0.5 * tw * env.day);
          ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(0.6, pxSize(0.012, [px, py, pz])), 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // Lamp glow after dark.
    if (env.lamp > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      for (const lp of lamps) {
        if (Math.abs(lp.p[1] - cam.p[1]) > 16) continue;
        const c = project(lp.p); if (!c) continue;
        const pend = lp.kind === 'pendant';
        const r = pxSize(pend ? 3.4 : 2.2, lp.p);
        const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
        g.addColorStop(0, css([1, 0.72, 0.42], 0.34 * env.lamp));
        g.addColorStop(0.25, css([1, 0.6, 0.3], 0.12 * env.lamp));
        g.addColorStop(1, css([1, 0.5, 0.2], 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, Math.PI * 2); ctx.fill();
        if (pend) {
          const f = project([lp.p[0], lp.k * H + 0.01, lp.p[2]]); if (!f) continue;
          const rx = pxSize(2.6, [lp.p[0], lp.k * H, lp.p[2]]);
          const ry = rx * clamp(Math.abs(cam.p[1] - lp.k * H) / 9, 0.12, 0.6);
          ctx.save(); ctx.translate(f[0], f[1]); ctx.scale(1, ry / rx);
          const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          g2.addColorStop(0, css([1, 0.7, 0.4], 0.22 * env.lamp));
          g2.addColorStop(1, css([1, 0.6, 0.3], 0));
          ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- sky & landscape
  const stars = Array.from({ length: 220 }, (_, i) => {
    const r = rng(1000 + i); const az = (r() - 0.5) * 2.4, el = 0.02 + Math.pow(r(), 0.8) * 0.95;
    return { d: [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)], m: 0.3 + r() * 0.7, s: r() * 10, big: r() > 0.94 };
  });
  const clouds = Array.from({ length: 9 }, (_, i) => {
    const r = rng(300 + i);
    const puffs = Array.from({ length: 6 + Math.floor(r() * 5) }, () => [(r() - 0.5) * 60, r() * 9, 8 + r() * 12]);
    return { x: (r() - 0.5) * 900, y: 38 + r() * 90, z: -520 - r() * 380, puffs, v: 0.8 + r() * 1.4 };
  });
  const ridge = (x, f, s) => 0.55 + 0.25 * Math.sin(x * f + s) + 0.13 * Math.sin(x * f * 2.3 + s * 1.7) + 0.07 * Math.sin(x * f * 5.1 + s * 3.1);
  const LAYERS = [
    { z: -1100, amp: 120, lift: -8, fade: 0.8, f: 1 / 260, s: 1.3 },
    { z: -520, amp: 44, lift: -3, fade: 0.62, f: 1 / 120, s: 4.2 },
    { z: -230, amp: 15, lift: -1, fade: 0.44, f: 1 / 55, s: 2.2, trees: true },
    { z: -75, town: true, fade: 0.24 },
  ];

  function drawSky(ctx, time) {
    const hz = projDir([0, 0, -1]);
    const hy = hz ? hz[1] : Hh / 2;
    const g = ctx.createLinearGradient(0, Math.min(0, hy - Hh), 0, hy);
    g.addColorStop(0, css(env.sky0));
    g.addColorStop(0.72, css(mix3(env.sky0, env.sky1, 0.55)));
    g.addColorStop(1, css(env.sky1));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = css(env.haze); ctx.fillRect(0, hy, W, Hh - hy + 2);

    // day: warm bloom from the (off-screen) sun, upper left
    if (env.day > 0.01) {
      const rg = ctx.createRadialGradient(W * 0.05, -Hh * 0.1, 0, W * 0.05, -Hh * 0.1, Math.max(W, Hh) * 0.9);
      rg.addColorStop(0, css(mix3(env.sun, [1, 1, 1], 0.5), 0.45 * env.day));
      rg.addColorStop(1, css(env.sky1, 0));
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, Hh);
    }
    // night: stars and moon
    if (env.stars > 0.01) {
      for (const s of stars) {
        const p = projDir(s.d); if (!p || p[1] > hy - 4) continue;
        const tw = reduceMotion ? 1 : 0.65 + 0.35 * Math.sin(time * (0.6 + s.m) + s.s);
        ctx.fillStyle = css([1, 0.96, 0.9], env.stars * s.m * tw * clamp((hy - p[1]) / 120, 0, 1));
        const r = s.big ? 1.3 : 0.75;
        ctx.fillRect(p[0] - r / 2, p[1] - r / 2, r, r);
      }
    }
    if (env.night > 0.01) {
      const m = projDir(norm([-0.34, 0.545, -0.766]));
      if (m) {
        const R = Math.min(W, Hh) * 0.028;
        const halo = ctx.createRadialGradient(m[0], m[1], R, m[0], m[1], R * 9);
        halo.addColorStop(0, css([0.85, 0.86, 0.95], 0.18 * env.night));
        halo.addColorStop(1, css([0.85, 0.86, 0.95], 0));
        ctx.fillStyle = halo; ctx.fillRect(m[0] - R * 9, m[1] - R * 9, R * 18, R * 18);
        ctx.fillStyle = css([0.95, 0.93, 0.86], env.night);
        ctx.beginPath(); ctx.arc(m[0], m[1], R, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = css(env.sky0, env.night * 0.9);
        ctx.beginPath(); ctx.arc(m[0] + R * 0.45, m[1] - R * 0.2, R * 0.92, 0, Math.PI * 2); ctx.fill();
      }
    }

    // clouds
    for (const c of clouds) {
      const span = 1400;
      let x = c.x + (reduceMotion ? 0 : time * c.v);
      x = ((x - cam.p[0] + span / 2) % span + span) % span - span / 2 + cam.p[0];
      const lit = mix3(mix3([1, 0.98, 0.95], env.sky1, 0.35), env.sky0, env.night * 0.75);
      const dk = mix3(lit, env.sky0, 0.28);
      for (const [col, oy] of [[dk, -2.2], [lit, 0]]) {
        ctx.fillStyle = css(col, lerp(0.92, 0.32, env.night));
        ctx.beginPath();
        for (const [px, py, pr] of c.puffs) {
          const p = project([x + px, c.y + py + oy * 0.4, c.z]); if (!p) continue;
          const r = pr * cam.focal / (cam.p[2] - c.z);
          ctx.moveTo(p[0] + r, p[1]); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      // flat base
      const bl = project([x, c.y + 1.5, c.z]);
      if (bl) { ctx.fillStyle = css(env.sky1, 0); }
    }

    // landscape bands
    for (const Ly of LAYERS) {
      const D = cam.p[2] - Ly.z;
      const col = mix3(env.land, env.haze, Ly.fade);
      if (Ly.town) { drawTown(ctx, Ly, D, col, time); continue; }
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

    // birds, now and then, by day
    if (env.day > 0.3 && !reduceMotion) {
      const cyc = 38, ph = (time % cyc) / cyc;
      if (ph < 0.6) {
        const k = ph / 0.6;
        ctx.strokeStyle = css(mix3(env.land, [0.2, 0.2, 0.22], 0.6), 0.55 * env.day);
        ctx.lineWidth = 1.1; ctx.lineCap = 'round';
        for (let i = 0; i < 5; i++) {
          const bx = cam.p[0] - 140 + k * 280 + i * 3.2 - (i % 2) * 1.5, by = cam.p[1] + 14 + (i % 3) * 1.4 + Math.sin(k * 6 + i) * 0.6;
          const p = project([bx, by, -160]); if (!p) continue;
          const s = 2.4 + (i % 2), fl = Math.sin(time * 9 + i * 1.7) * s * 0.6;
          ctx.beginPath(); ctx.moveTo(p[0] - s, p[1] - fl); ctx.quadraticCurveTo(p[0] - s * 0.3, p[1] - fl * 0.2, p[0], p[1]);
          ctx.quadraticCurveTo(p[0] + s * 0.3, p[1] - fl * 0.2, p[0] + s, p[1] - fl); ctx.stroke();
        }
      }
    }
  }

  function drawTown(ctx, Ly, D, col, time) {
    const x0 = cam.p[0] + (-60 - cam.cx) * D / cam.focal, x1 = cam.p[0] + (W + 60 - cam.cx) * D / cam.focal;
    const cell = 3.4;
    // ground band under the town
    const g0 = project([cam.p[0], -T, Ly.z]);
    if (g0) { ctx.fillStyle = css(mix3(col, env.land, 0.25)); ctx.fillRect(0, g0[1], W, Hh - g0[1] + 2); }
    for (let i = Math.floor(x0 / cell); i <= Math.ceil(x1 / cell); i++) {
      if (hash(i * 3.1) < 0.18) continue;
      const w = cell * (0.55 + hash(i) * 0.4), h = 1.8 + hash(i + 17) * 4.8 + (hash(i + 5) > 0.93 ? 5 : 0);
      const bx = i * cell + hash(i + 2) * (cell - w);
      const a = project([bx, -T, Ly.z]), b = project([bx + w, -T + h, Ly.z]); if (!a || !b) continue;
      const tone = 0.93 + hash(i + 40) * 0.1;
      ctx.fillStyle = css(sc3(col, tone));
      ctx.fillRect(a[0], b[1], b[0] - a[0], a[1] - b[1]);
      if (env.lamp > 0.05) {
        const rows = Math.floor(h / 1.2), cols = Math.max(1, Math.floor(w / 1.1));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const hk = hash(i * 31 + r * 7 + c * 13);
          if (hk < 0.62) continue;
          const on = reduceMotion ? 1 : (Math.sin(time * 0.05 + hk * 40) > -0.85 ? 1 : 0);
          const wx = bx + (c + 0.35) * (w / cols), wy = -T + 0.6 + r * 1.2;
          const p = project([wx, wy, Ly.z]); if (!p) continue;
          const s = Math.max(1, 0.35 * cam.focal / D);
          ctx.fillStyle = css([1, 0.76, 0.45], env.lamp * on * (0.5 + hk * 0.5));
          ctx.fillRect(p[0], p[1] - s, s, s);
        }
      }
    }
  }

  // ---------------------------------------------------------------- foreground (close to the lens, blurred)
  const clusters = [
    { c: [-13.8, 0.4, 6.0], r: 2.6, n: 90, seed: 11 },
    { c: [5.8, 10.5, 7.5], r: 2.4, n: 80, seed: 12 },
    { c: [-10.5, 5.5, 3.2], r: 1.6, n: 50, seed: 13 },
    { c: [7.4, 1.8, 3.5], r: 1.8, n: 60, seed: 14 },
  ].map(cl => {
    const r = rng(cl.seed);
    cl.leaves = Array.from({ length: cl.n }, () => {
      const th = r() * Math.PI * 2, rr = Math.sqrt(r()) * cl.r;
      return [Math.cos(th) * rr, Math.sin(th) * rr * 0.75, (r() - 0.5) * 1.2, r() * Math.PI, 0.14 + r() * 0.12, r()];
    });
    return cl;
  });
  const mists = [[-2, 12.8, 2.4, 9], [3, 17.6, 3.1, 11], [-5, 21.8, 2.2, 10], [1, 26.4, 3.4, 13]];

  function drawFore(ctx, time) {
    ctx.clearRect(0, 0, W, Hh);
    for (const cl of clusters) {
      const cc = toCam(cl.c); if (cc[2] < 0.6) continue;
      const sc = scr(cc); const R = cl.r * cam.focal / cc[2];
      if (sc[0] + R < -50 || sc[0] - R > W + 50 || sc[1] + R < -50 || sc[1] - R > Hh + 50) continue;
      // branch
      ctx.strokeStyle = css(env.leaf); ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, 0.07 * cam.focal / cc[2]);
      const edge = cl.c[0] < 0 ? [cl.c[0] - cl.r * 2.2, cl.c[1] - cl.r * 1.4, cl.c[2]] : [cl.c[0] + cl.r * 2.2, cl.c[1] + cl.r * 1.2, cl.c[2]];
      strokeWorld(ctx, edge, cl.c);
      for (const [dx, dy, dz, ang, s, ph] of cl.leaves) {
        const sw = reduceMotion ? 0 : Math.sin(time * 1.1 + ph * 6) * 0.07;
        const p = [cl.c[0] + dx + sw, cl.c[1] + dy, cl.c[2] + dz];
        const q = toCam(p); if (q[2] < 0.5) continue;
        const pp = scr(q); const k = cam.focal / q[2];
        ctx.fillStyle = css(dy > 0.2 ? env.leaf2 : env.leaf, 0.96);
        ctx.beginPath(); ctx.ellipse(pp[0], pp[1], s * k, s * 0.36 * k, ang + sw * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const [mx, my, mz, mw] of mists) {
      const x = mx + (reduceMotion ? 0 : Math.sin(time * 0.05 + my) * 2.5);
      const q = toCam([x, my, mz]); if (q[2] < 0.6) continue;
      const p = scr(q); const r = mw * cam.focal / q[2];
      if (p[1] + r * 0.3 < 0 || p[1] - r * 0.3 > Hh) continue;
      ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(1, 0.18);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      const col = mix3([1, 0.98, 0.95], [0.6, 0.65, 0.8], env.night);
      g.addColorStop(0, css(col, lerp(0.22, 0.06, env.night)));
      g.addColorStop(1, css(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- scroll → camera
  const holdEase = p => { const k = Math.floor(p); const f = p - k; return k + f - 0.82 * Math.sin(2 * Math.PI * f) / (2 * Math.PI); };
  function readScroll() {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? clamp(scrollY / max, 0, 1) * N : 0;
  }

  let P = 0, Pvel = 0, time = 0;
  function cameraFor(P, t) {
    const portrait = W / Hh < 0.8;
    const k = Math.min(N, Math.floor(P)), f = P - k, y0 = k * H;
    const w = (1 - Math.cos(2 * Math.PI * f)) / 2;           // 0 on a landing, 1 at the half-landing
    let x = lerp(portrait ? -3.9 : -3.1, portrait ? 1.7 : 0.9, w);
    let y = y0 + f * H + 2.05;
    let z = (portrait ? 12.8 : 9.8) - 0.8 * (1 - w);          // dolly in on arrival
    let tx = x * 0.72 - (portrait ? 1.1 : 0.9), ty = y - 1.15, tz = -6;

    // Roof: pull back and lift the gaze to the open sky.
    const e = smooth(N - 0.55, N, P);
    x = lerp(x, -2.4, e); y += e * 1.4; z += e * 4.5; tx = lerp(tx, -1.6, e); ty += e * 2.6;

    // Hero: low establishing shot, looking up the tower.
    const h = easeInOut(1 - smooth(0, 0.62, P));
    if (h > 0) {
      const hp = portrait ? [-1.2, -0.4, 26.5] : [-2.6, 3.6, 21];
      const ht = portrait ? [-1.4, 13.5, -3] : [-9.6, 8.4, -3];
      x = lerp(x, hp[0], h); y = lerp(y, hp[1], h); z = lerp(z, hp[2], h);
      tx = lerp(tx, ht[0], h); ty = lerp(ty, ht[1], h); tz = lerp(tz, ht[2], h);
    }

    // Breath and footfall.
    if (!reduceMotion) {
      x += Math.sin(t * 0.31) * 0.03; y += Math.sin(t * 0.23) * 0.025;
      const stepPhase = P * STEPS * 2;
      y += Math.sin(stepPhase * Math.PI * 2) * 0.035 * clamp(Math.abs(Pvel) * 1.6, 0, 1);
    }
    aim([x, y, z], [tx, ty, tz]);
  }

  // ---------------------------------------------------------------- HUD
  const root = document.documentElement;
  const heroEl = document.getElementById('hero');
  const landingEl = document.getElementById('landing');
  const lNum = document.getElementById('lNum'), lElev = document.getElementById('lElev'), lKicker = document.getElementById('lKicker');
  const railFill = document.getElementById('railFill'), railMarker = document.getElementById('railMarker'), railStops = document.getElementById('railStops');
  const stage = document.querySelector('.stage');

  function buildRail() {
    railStops.innerHTML = '';
    for (let k = 0; k <= N; k++) {
      const li = document.createElement('li');
      li.style.bottom = (k / N * 100) + '%';
      const b = document.createElement('button');
      b.type = 'button';
      const label = k === 0 ? 'Ground' : k === N ? 'Roof' : 'Landing ' + String(k).padStart(2, '0');
      b.setAttribute('aria-label', 'Go to ' + label);
      b.innerHTML = `<span>${k === 0 ? 'G' : k === N ? 'R' : String(k).padStart(2, '0')}</span>`;
      b.addEventListener('click', () => goTo(k));
      li.appendChild(b); railStops.appendChild(li);
    }
  }
  let tween = null;
  function goTo(k) {
    const max = document.documentElement.scrollHeight - innerHeight;
    const to = max * k / N, from = scrollY;
    if (reduceMotion) { scrollTo(0, to); return; }
    const dur = clamp(700 + Math.abs(to - from) / innerHeight * 180, 800, 2600);
    tween = { from, to, t0: performance.now(), dur };
  }
  ['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, () => { tween = null; }, { passive: true }));

  let lastLanding = -1, lastActive = -1;
  function updateHud() {
    const hero = 1 - smooth(0.02, 0.4, P);
    root.style.setProperty('--hero', hero.toFixed(3));
    stage.style.setProperty('--hero', hero.toFixed(3));
    heroEl.style.setProperty('--hero-shift', (-(1 - hero) * 60).toFixed(1) + 'px');
    if (hero < 0.005) heroEl.setAttribute('data-gone', ''); else heroEl.removeAttribute('data-gone');

    const kn = Math.round(P), near = Math.abs(P - kn) < 0.09 && kn >= 1;
    if (near && kn !== lastLanding) {
      lastLanding = kn;
      lKicker.textContent = kn === N ? 'Roof terrace' : 'Landing';
      lNum.textContent = kn === N ? 'R' : String(kn).padStart(2, '0');
      lElev.textContent = 'Elev. +' + (kn * H).toFixed(2) + ' m';
    }
    landingEl.classList.toggle('on', near);

    const pct = P / N * 100;
    railFill.style.height = pct + '%';
    railMarker.style.bottom = pct + '%';
    const act = Math.round(P);
    if (act !== lastActive) {
      [...railStops.children].forEach((li, i) => li.classList.toggle('active', i === act));
      lastActive = act;
    }
  }

  // ---------------------------------------------------------------- theme
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  const themeBtn = document.getElementById('theme');
  const isDark = () => { const t = root.getAttribute('data-theme'); return t ? t === 'dark' : mqDark.matches; };
  let night = isDark() ? 1 : 0;
  function syncThemeLabel() { themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode'); }
  themeBtn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ascent-theme', next); } catch (e) {}
    syncThemeLabel();
  });
  mqDark.addEventListener && mqDark.addEventListener('change', syncThemeLabel);
  syncThemeLabel();
  document.getElementById('mark').addEventListener('click', e => { e.preventDefault(); goTo(0); });

  // ---------------------------------------------------------------- grain
  (function grain() {
    const g = document.createElement('canvas'); g.width = g.height = 180;
    const c = g.getContext('2d'); const img = c.createImageData(180, 180); const r = rng(5);
    for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (r() - 0.5) * 70; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    c.putImageData(img, 0, 0);
    document.querySelector('.grain').style.backgroundImage = `url(${g.toDataURL()})`;
  })();

  // ---------------------------------------------------------------- loop
  build();
  computeShadows();
  resize();
  addEventListener('resize', resize);

  P = holdEase(readScroll());
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    time += dt; glowClock += dt;
    if (tween) {
      const k = clamp((now - tween.t0) / tween.dur, 0, 1);
      scrollTo(0, lerp(tween.from, tween.to, easeInOut(k)));
      if (k >= 1) tween = null;
    }
    const target = holdEase(readScroll());
    const prev = P;
    P = reduceMotion ? target : P + (target - P) * (1 - Math.exp(-dt * 4.2));
    if (Math.abs(target - P) < 1e-4) P = target;
    Pvel = lerp(Pvel, (P - prev) / Math.max(dt, 1e-3), 0.2);

    night += ((isDark() ? 1 : 0) - night) * (1 - Math.exp(-dt * (reduceMotion ? 60 : 2.8)));
    heroGlow = 1 - smooth(0.05, 0.7, P);
    if (heroGlow < 0.01) glowClock = 0;

    cameraFor(P, time);
    computeEnv(P / N, night, time);
    drawSky(cSky, time);
    drawScene(cScene);
    drawFore(cFore, time);
    updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
