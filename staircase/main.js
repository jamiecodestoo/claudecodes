/*
 * THE CLIMB — a scroll-driven, illustrated 2.5D journey.
 *
 * One monumental switchback staircase rises out of a living city into the
 * clouds. The protagonist climbs it; chapters are platforms beside it.
 *
 * Timeline (P, 0 → END), all driven by scroll:
 *   0.0  FAR     hero establishing shot, title in the sky
 *   0.3  MEDIUM  the camera enters the world; the first steps
 *   2.3  NSUT    the stair reaches the workshop platform
 *   3.3  CLOSE   the drafting board; the engineering drawing
 *   4.4          the drawing becomes grid, wireframe, interface
 *   6.6  ZOOM OUT back to the platform and the stair
 *   6.9  CLIMB   on toward the next landing, faint in the haze
 *
 * Rendering: flat-shaded planes, painter-sorted, with precomputed sun
 * shadows; the character is a hand-built 2D rig drawn in world space.
 */
(() => {
  'use strict';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ================================================================ utils
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
  const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  function rng(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ================================================================ world constants
  const RISE = 0.17, NR = 24, RUNS = 0.5;
  const FR = RISE * NR;            // 3.4 m per flight
  const FL = RUNS * NR;            // 8.4 m run
  const XL = -FL / 2, XR = FL / 2;
  const LX = XR + 2.8;             // landing outer edge
  const NF = 13;                   // flights drawn; the stair continues into cloud
  const NSUT_Y = 2 * FR;           // 8.16 — first chapter landing
  const NEXT_Y = 5 * FR;           // 20.4 — next landing, only glimpsed
  const L = norm([0.55, -0.72, -0.42]);   // sunlight from upper left, behind the viewer
  const END = 9;
  const VH_PER_P = 0.95;           // viewports of scroll per timeline unit

  // Palette: warm ivory, stone, dusty blue, muted green, terracotta.
  const MAT = {
    tread:   [0.965, 0.940, 0.890],
    riser:   [0.930, 0.895, 0.840],
    terra:   [0.860, 0.575, 0.470],
    soffit:  [0.800, 0.520, 0.430],
    stone:   [0.915, 0.885, 0.830],
    ground:  [0.845, 0.835, 0.780],
    concrete:[0.820, 0.805, 0.770],
    steel:   [0.260, 0.265, 0.280],
    wood:    [0.780, 0.660, 0.520],
    paper:   [0.985, 0.978, 0.960],
    ink:     [0.150, 0.145, 0.140],
  };
  const BUILDING = ['#EFE8DA', '#E2D6C3', '#D29F88', '#B8C4CE', '#D8CDB6', '#A9B7B0', '#E8DFD0', '#C9B39C'].map(hex);
  const ACCENT = hex('#C2603D');
  const INK = MAT.ink;

  // ================================================================ scene graph
  const items = [], casters = [], lamps = [];
  function add(min, max, o = {}) {
    const it = Object.assign({ min, max, solid: true, casts: true, recv: true, mat: 'stone', col: null, top: null, mass: false }, o);
    it.c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    if (!o.ghost) items.push(it);
    if (it.solid && it.casts) casters.push(it);
    return it;
  }
  const B = (x0, y0, z0, x1, y1, z1, o) => add([x0, y0, z0], [x1, y1, z1], o);

  let ground = null, board = null;
  const cars = [], trees = [];

  function build() {
    ground = B(-600, -2, -700, 600, 0, 60, { mat: 'ground', ground: true, casts: false, under: drawGroundMarks });

    // ---- the staircase: floating stone treads on terracotta stringers, framed by four pylons
    for (let k = 0; k < NF; k++) {
      const back = k % 2 === 0, y0 = k * FR;
      add([XL, y0 - 0.6, back ? -3.6 : 0.2], [XR, y0 + FR + 1.1, back ? -0.2 : 3.6],
        { solid: false, draw: drawFlight, k, back, dir: back ? 1 : -1, y0, x0: back ? XL : XR });
      for (let s = 0; s < 4; s++) {
        const dir = back ? 1 : -1, xa = (back ? XL : XR) + dir * s * FL / 4, xb = xa + dir * FL / 4;
        B(Math.min(xa, xb), y0 + s * FR / 4 - 0.3, back ? -3.6 : 0.2, Math.max(xa, xb), y0 + (s + 1) * FR / 4 + 0.2, back ? -0.2 : 3.6, { ghost: true, recv: false });
      }
      const ly = y0 + FR, right = back;
      B(right ? XR : -LX, ly - 0.5, -3.6, right ? LX : XL, ly, 3.6, { mat: 'terra', top: 'tread', mass: true, landing: true });
      lamps.push({ p: [right ? XR + 1.4 : XL - 1.4, ly + 2.8, 0], kind: 'landing', k });
    }
    B(-LX - 0.8, -0.3, -4.0, XL, 0, 4.0, { mat: 'terra', top: 'tread', mass: true });
    for (let m = 0; m < NF + 2; m++) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x0 = sx > 0 ? LX : -LX - 1.0, z0 = sz > 0 ? 3.2 : -4.2;
      B(x0, m * FR - (m === 0 ? 0.3 : 0), z0, x0 + 1.0, (m + 1) * FR, z0 + 1.0, { mat: 'terra', mass: true, pylon: true });
    }
    // cloud banks the stair disappears into
    [[-13, 38, 9, 26], [12, 40, 11, 30], [-2, 44, 8, 36], [20, 37, 14, 18], [-24, 42, 13, 20], [4, 50, 6, 30], [-9, 54, 5, 26]].forEach(([x, y, z, w], i) =>
      add([x - w / 2, y - 3, z - 1], [x + w / 2, y + 6, z + 1], { solid: false, draw: drawCloudBank, x, y, z, w, seed: 40 + i }));

    buildCity();
    buildNsut();
    buildNext();
  }

  // ---- the city: plaza, streets, blocks, trees, traffic
  const ROADS = [
    { a: 'x', lo: 17, hi: 24, from: -600, to: 600 },     // boulevard in front of the plaza
    { a: 'x', lo: -36, hi: -30, from: -600, to: 600 },
    { a: 'z', lo: 40, hi: 46, from: -700, to: 40 },
    { a: 'z', lo: -46, hi: -40, from: -700, to: 40 },
    { a: 'x', lo: -96, hi: -90, from: -600, to: 600 },
  ];
  function inRoad(x0, z0, x1, z1) {
    for (const r of ROADS) {
      if (r.a === 'x' && z1 > r.lo - 2 && z0 < r.hi + 2) return true;
      if (r.a === 'z' && x1 > r.lo - 2 && x0 < r.hi + 2) return true;
    }
    return false;
  }
  function buildCity() {
    const r = rng(21);
    const block = (x, z, w, d, h, ci) => {
      if (inRoad(x, z, x + w, z + d)) return;
      B(x, 0, z, x + w, h, z + d, { col: BUILDING[ci % BUILDING.length], mass: true, building: true, seed: Math.floor(r() * 1e6) });
    };
    // behind the plaza
    for (let x = -210; x < 210; x += 15) {
      if (x > -46 && x < 36) continue;      // keep the axis behind the stair open
      block(x + r() * 2, -84 + r() * 6, 9 + r() * 4, 12 + r() * 10, 14 + r() * 34, Math.floor(r() * 8));
      block(x + r() * 2, -66 + r() * 4, 9 + r() * 4, 10 + r() * 8, 10 + r() * 22, Math.floor(r() * 8));
    }
    for (let x = -30; x < 28; x += 13) block(x, -128 + r() * 8, 10 + r() * 3, 14, 26 + r() * 40, Math.floor(r() * 8));
    // flanks
    for (const side of [-1, 1]) for (let z = -40; z < 2; z += 13) {
      for (let c = 0; c < 5; c++) {
        const x = side > 0 ? 64 + c * 16 : -64 - c * 16 - 12;
        block(x + r() * 2, z + r() * 2, 10 + r() * 3, 9 + r() * 3, 8 + r() * (18 + c * 4), Math.floor(r() * 8));
      }
    }
    // low foreground rows, framing the edges
    for (const side of [-1, 1]) for (let c = 0; c < 4; c++) {
      const x = side > 0 ? 96 + c * 15 : -96 - c * 15 - 11;
      block(x, 30 + r() * 4, 11, 10, 6 + r() * 7, Math.floor(r() * 8));
    }
    B(22, 0, -34, 44, 11, -16, { col: BUILDING[1], mass: true, building: true, seed: 991 });
    // trees along the boulevard and the plaza edge
    const tree = (x, z, s) => { const h = 4 + s * 3.5, rad = 1.7 + s * 1.2; trees.push(add([x - rad, 0, z - rad], [x + rad, h + rad, z + rad], { solid: false, draw: drawTree, base: [x, 0, z], h, rad, seed: Math.floor(x * 7 + z * 13) })); };
    for (let x = -120; x <= 120; x += 10) { if (Math.abs(x) < 34) continue; tree(x + 1, 13.5, hash(x) * 0.8); tree(x + 4, 27, hash(x + 3) * 0.8); }
    for (let z = -24; z <= 8; z += 8) { tree(28, z + 3, 0.6 + hash(z + 5) * 0.4); }
    for (let x = -8; x <= 30; x += 9) if (Math.abs(x) > 14) tree(x, -24, 0.5 + hash(x * 2) * 0.5);
    // traffic
    const carCols = ['#F1ECE2', '#9FB2C4', '#C9765A', '#3E4046', '#D9CBAE', '#7F9A8C'].map(hex);
    const lanes = [[0, 18.6, 1], [0, 22.4, -1], [0, -34.5, 1], [0, -31.5, -1], [1, 42, -1], [1, 44.6, 1], [1, -44.6, 1], [1, -41.6, -1]];
    lanes.forEach(([axis, off, dir], li) => {
      for (let i = 0; i < 4; i++) {
        const it = add([0, 0, 0], [1, 1, 1], { solid: false, draw: drawCar, axis, off, dir, phase: hash(li * 9 + i) * 600, speed: 7 + hash(li + i * 3) * 5, col: carCols[(li + i) % carCols.length] });
        cars.push(it);
      }
    });
  }

  // ---- Chapter 01: NSUT — a workshop platform beside the stair, fronting the university
  let bench = null;
  function buildNsut() {
    const y = NSUT_Y, X = -3.3;   // shift from the original layout
    B(-44, 0, -30, -14, 18, -11, { mat: 'concrete', mass: true, facade: 'uni' });
    B(-44, 18, -28, -22, 19.8, -13, { mat: 'concrete', mass: true });
    B(-18.7, y - 0.45, -11, -15.5, y, -3.6, { mat: 'concrete', top: 'stone', mass: true });
    B(-18.7, y - 0.5, -3.6, -LX - 1.0, y, 3.6, { mat: 'concrete', top: 'stone', mass: true, platform: true });
    for (const [x, z] of [[-18.4, -3.3], [-18.4, 3.1], [-11.4, 3.1]]) B(x, 0, z, x + 0.3, y - 0.5, z + 0.3, { mat: 'steel', mass: true });
    for (const x of [-18.5, -11.2]) {
      B(x, y, -3.4, x + 0.14, y + 3.4, -3.26, { mat: 'steel' });
      B(x, y, 3.2, x + 0.14, y + 3.4, 3.34, { mat: 'steel' });
      B(x, y + 3.4, -3.4, x + 0.14, y + 3.58, 3.34, { mat: 'steel' });
    }
    B(-18.5, y + 3.4, -0.1, -11.06, y + 3.56, 0.06, { mat: 'steel' });
    lamps.push({ p: [-14.7, y + 2.7, -0.6], kind: 'workshop', k: 1 });
    add([-14.9, y + 2.6, -0.8], [-14.5, y + 3.4, -0.4], { solid: false, draw: drawShopLamp, p: [-14.7, y + 2.7, -0.6], top: y + 3.4 });
    add([-18.7, y, 3.35], [-10.6, y + 1.05, 3.6], { solid: false, draw: drawRailing, y });
    bench = B(-18.0 , y + 0.84, -2.0, -15.9, y + 0.9, -0.9, { mat: 'wood' });
    for (const [x, z] of [[-17.95, -1.95], [-16.0, -1.95], [-17.95, -0.98], [-16.0, -0.98]]) B(x, y, z, x + 0.06, y + 0.84, z + 0.06, { mat: 'steel', recv: false });
    B(-17.8, y + 0.9, -1.75, -17.3, y + 0.912, -1.3, { mat: 'paper' });
    B(-17.2, y + 0.9, -1.55, -17.02, y + 0.93, -1.3, { mat: 'steel' });
    add([-16.9, y + 0.9, -1.8], [-16.4, y + 1.35, -1.6], { solid: false, draw: drawLaptop, y, dx: X });
    add([-16.25, y + 0.9, -1.45], [-15.95, y + 1.22, -1.25], { solid: false, draw: drawGear, c: [-16.1, y + 1.06, -1.35], r: 0.15 });
    const tilt = 0.26;
    board = add([-15.5, y, -1.35], [-14.1, y + 1.85, -0.85], { solid: false, draw: drawBoard, y, tilt,
      c: [-14.8, y + 1.3, -1.1], u: [1, 0, 0], v: [0, Math.cos(tilt), -Math.sin(tilt)], n: [0, Math.sin(tilt), Math.cos(tilt)], w: 1.3, h: 0.9 });
  }

  // ---- the next landing, only glimpsed through haze
  function buildNext() {
    const y = NEXT_Y;
    B(LX + 1.0, y - 0.5, -3.6, LX + 9.2, y, 3.6, { mat: 'terra', top: 'tread', mass: true, faint: true });
    add([LX + 1.2, y, -3.4], [LX + 9.0, y + 3.6, 3.4], { solid: false, draw: drawNextHint, y });
  }

  // ================================================================ shadows (precomputed)
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
    for (const R of items) {
      if (!R.solid || !R.recv) continue;
      R.shadows = [];
      for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
        if (-s * L[a] <= 0.001) continue;
        const v = s > 0 ? R.max[a] : R.min[a];
        const u = (a + 1) % 3, w = (a + 2) % 3;
        const polys = [];
        for (const C of casters) {
          if (C === R) continue;
          if (R.ground && !(C.mass || C.ghost)) continue;
          if (s > 0 ? C.min[a] < v - 1e-4 : C.max[a] > v + 1e-4) continue;
          if (C.max[1] < R.min[1] - 1e-4) continue;
          if (!R.ground) {
            const dx = Math.max(0, Math.max(C.min[0] - R.max[0], R.min[0] - C.max[0]));
            const dz = Math.max(0, Math.max(C.min[2] - R.max[2], R.min[2] - C.max[2]));
            if (Math.hypot(dx, dz) > 75) continue;
          }
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
          if (poly.length < 3 || area2(poly) < 1e-3) continue;
          polys.push(poly.map(q => { const p = [0, 0, 0]; p[a] = v; p[u] = q[0]; p[w] = q[1]; return p; }));
        }
        R.shadows[a * 2 + (s > 0 ? 1 : 0)] = polys;
      }
    }
  }

  // ================================================================ camera
  const NEAR = 0.06;
  const cam = { p: [0, 0, 10], r: [1, 0, 0], u: [0, 1, 0], f: [0, 0, -1], focal: 800, cx: 0, cy: 0 };
  function aim(pos, target) {
    cam.p = pos;
    cam.f = norm(sub(target, pos));
    cam.r = norm(cross(cam.f, [0, 1, 0]));
    cam.u = cross(cam.r, cam.f);
  }
  const toCam = p => { const d = sub(p, cam.p); return [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)]; };
  const scr = c => [cam.cx + cam.focal * c[0] / c[2], cam.cy - cam.focal * c[1] / c[2]];
  const project = p => { const c = toCam(p); return c[2] < NEAR ? null : scr(c); };
  const projDir = d => { const c = [dot(d, cam.r), dot(d, cam.u), dot(d, cam.f)]; return c[2] <= 0.01 ? null : scr(c); };
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
  // affine frame for drawing on a plane: origin, unit u, unit v (v drawn downward)
  function planeFrame(o, u, v) {
    const O = project(o), U = project(add3(o, u)), V = project(add3(o, v));
    if (!O || !U || !V) return null;
    return [U[0] - O[0], U[1] - O[1], V[0] - O[0], V[1] - O[1], O[0], O[1]];
  }

  // ================================================================ environment
  const DAY = {
    sun: [0.40, 0.36, 0.29], amb: [0.70, 0.735, 0.80],
    sky0: hex('#8FB2CF'), sky1: hex('#C9D9E2'), sky2: hex('#F6E6D2'),
    haze: [0.905, 0.915, 0.915], hill: hex('#A9BCCB'), far: hex('#B9C8D3'), near: hex('#9EB0C0'),
    cloud: [1, 0.985, 0.955], cloudS: hex('#D9DEE6'), paper: hex('#F4F0E8'),
  };
  const NIGHT = {
    sun: [0.05, 0.06, 0.09], amb: [0.13, 0.14, 0.18],
    sky0: hex('#070A12'), sky1: hex('#111623'), sky2: hex('#2A2628'),
    haze: [0.075, 0.085, 0.11], hill: hex('#11151E'), far: hex('#141925'), near: hex('#0E121A'),
    cloud: hex('#2A2F3C'), cloudS: hex('#161A24'), paper: hex('#0E0E10'),
  };
  const env = {};
  function computeEnv(night) {
    for (const k in DAY) env[k] = mix3(DAY[k], NIGHT[k], night);
    env.night = night; env.day = 1 - night;
    env.lamp = smooth(0.2, 1, night);
    env.lampCol = [1.0, 0.80, 0.58];
    env.fog = lerp(0.62, 0.7, night);
    env.poche = mix3([0.20, 0.19, 0.18], [0.03, 0.03, 0.035], night);
  }

  const lampI = lp => Math.max(env.lamp, lp.boost || 0);
  function light(center, n) {
    const ndl = n ? Math.max(0, -dot(n, L)) : 0.5;
    let dark = env.amb.slice();
    let lit = add3(dark, sc3(env.sun, ndl));
    let acc = 0;
    for (const lp of lamps) {
      const I = lampI(lp); if (I < 0.01) continue;
      const dx = lp.p[0] - center[0], dy = lp.p[1] - center[1], dz = lp.p[2] - center[2];
      const d = Math.hypot(dx, dy, dz);
      const R = lp.kind === 'workshop' ? 7 : lp.kind === 'board' ? 2.2 : 9;
      if (d > R) continue;
      const nd = n ? (n[0] * dx + n[1] * dy + n[2] * dz) / (d || 1) : 0.6;
      const f = 1 - d / R;
      acc += I * f * f * (0.3 + 0.7 * Math.max(0, nd));
    }
    if (acc > 0) { const a = sc3(env.lampCol, Math.min(acc, 1.2) * 0.75); lit = add3(lit, a); dark = add3(dark, a); }
    return [lit, dark];
  }
  function fogMix(c, center, extra = 0) {
    const d = Math.hypot(center[0] - cam.p[0], center[1] - cam.p[1], center[2] - cam.p[2]);
    const t = clamp(env.fog * (1 - Math.exp(-d / 230)) + extra, 0, 1);
    return mix3(c, env.haze, t);
  }
  function shadeN(alb, n, center, extraFog) {
    const [l, d] = light(center, n);
    return [fogMix(mul3(alb, l), center, extraFog), fogMix(mul3(alb, d), center, extraFog)];
  }

  // ================================================================ canvases
  const cvSky = document.getElementById('sky'), cvScene = document.getElementById('scene');
  const cSky = cvSky.getContext('2d'), cScene = cvScene.getContext('2d');
  let W = 0, Hh = 0, DPR = 1, portrait = false;
  function resize() {
    W = innerWidth; Hh = innerHeight; portrait = W / Hh < 0.8;
    DPR = Math.min(devicePixelRatio || 1, W < 760 ? 2 : 1.75);
    for (const cv of [cvSky, cvScene]) { cv.width = Math.round(W * DPR); cv.height = Math.round(Hh * DPR); }
    for (const c of [cSky, cScene]) c.setTransform(DPR, 0, 0, DPR, 0, 0);
    cam.cx = W / 2; cam.cy = Hh / 2;
    cam.focal = Math.min(Hh * 0.98, W * 1.22);
    document.getElementById('track').style.height = Math.round(Hh * (1 + END * VH_PER_P)) + 'px';
  }

  // ================================================================ solid boxes
  const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  function faceVerts(it, a, s) {
    const v = s > 0 ? it.max[a] : it.min[a];
    const u = (a + 1) % 3, w = (a + 2) % 3;
    return [[it.min[u], it.min[w]], [it.max[u], it.min[w]], [it.max[u], it.max[w]], [it.min[u], it.max[w]]]
      .map(([uu, ww]) => { const p = [0, 0, 0]; p[a] = v; p[u] = uu; p[w] = ww; return p; });
  }
  function albedo(it, a, s) {
    if (a === 1 && s > 0 && it.top) return MAT[it.top];
    return it.col || MAT[it.mat] || MAT.stone;
  }
  function drawSolid(ctx, it) {
    const extra = it.faint ? 0.45 : 0;
    for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
      const v = s > 0 ? it.max[a] : it.min[a];
      if (s * (cam.p[a] - v) <= 1e-6) continue;
      if (it.ground && !(a === 1 && s > 0)) continue;
      const pts = faceVerts(it, a, s);
      if (!tracePoly(ctx, pts)) continue;
      const n = AX[a].map(c => c * s);
      const center = it.ground ? [cam.p[0], 0, cam.p[2] - 60] : [0, 1, 2].map(i => (pts[0][i] + pts[2][i]) / 2);
      const [lit, dark] = shadeN(albedo(it, a, s), n, center, extra);
      const ndl = -dot(n, L);
      ctx.fillStyle = css(ndl > 0 ? lit : dark); ctx.fill();
      if (it.under) it.under(ctx);
      const sh = it.shadows && it.shadows[a * 2 + (s > 0 ? 1 : 0)];
      if (ndl > 0 && sh && sh.length) {
        ctx.fillStyle = css(dark);
        for (const poly of sh) if (tracePoly(ctx, poly)) ctx.fill();
      }
      if (it.building && a === 2 && s > 0) drawWindows(ctx, it, lit, dark);
      if (it.facade && a === 2 && s > 0) drawUniFacade(ctx, it);
      if (!it.ground) {
        tracePoly(ctx, pts);
        ctx.strokeStyle = css(INK, (it.building ? 0.06 : 0.14) + env.night * 0.2);
        ctx.lineWidth = 0.6; ctx.stroke();
      }
    }
  }

  function drawWindows(ctx, it, lit, dark) {
    const w = it.max[0] - it.min[0], h = it.max[1];
    const cols = Math.max(2, Math.floor(w / 2.6)), rows = Math.max(1, Math.floor((h - 2) / 3.3));
    const z = it.max[2] + 0.01, cw = w / cols;
    const px = pxSize(cw, [it.c[0], h / 2, z]);
    if (px < 1.2) return;
    const glass = mix3(mix3(env.sky1, dark, 0.62), [0.08, 0.09, 0.12], env.night * 0.9);
    ctx.fillStyle = css(glass, 0.7);
    const ribbon = hash(it.seed) > 0.55;
    ctx.beginPath();
    const lit_ = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (ribbon && c > 0) continue;
      const x0 = ribbon ? it.min[0] + 0.6 : it.min[0] + c * cw + cw * 0.22, x1 = ribbon ? it.max[0] - 0.6 : x0 + cw * 0.56;
      const y0 = 1.6 + r * 3.3, y1 = y0 + (ribbon ? 1.4 : 1.9);
      const a = project([x0, y0, z]), b = project([x1, y1, z]); if (!a || !b) continue;
      ctx.rect(a[0], b[1], b[0] - a[0], a[1] - b[1]);
      if (env.lamp > 0.02 && hash(it.seed + r * 17 + c * 5) > 0.55) lit_.push([a[0], b[1], b[0] - a[0], a[1] - b[1], hash(it.seed + r + c * 3)]);
    }
    ctx.fill();
    if (lit_.length) {
      for (const [x, y, ww, hh, k] of lit_) { ctx.fillStyle = css(mix3([1, 0.78, 0.5], [1, 0.9, 0.72], k), env.lamp * (0.55 + k * 0.4)); ctx.fillRect(x, y, ww, hh); }
    }
    void lit;
  }

  // The university facade: fins, a glazed workshop wall, and the chapter inscription.
  function drawUniFacade(ctx, it) {
    const z = it.max[2] + 0.02;
    const [l, d] = light([-28, 8, z], [0, 0, 1]);
    const glass = fogMix(mix3(mul3([0.46, 0.55, 0.62], l), [0.95, 0.8, 0.58], env.lamp * 0.6), [-24, 8, z]);
    const fin = fogMix(mul3(MAT.concrete, d), [-24, 8, z]);
    // glazed band
    ctx.fillStyle = css(glass);
    for (let r = 0; r < 3; r++) if (tracePoly(ctx, [[-43, 1.4 + r * 5.6, z], [-15, 1.4 + r * 5.6, z], [-15, 4.9 + r * 5.6, z], [-43, 4.9 + r * 5.6, z]])) ctx.fill();
    ctx.fillStyle = css(fin);
    for (let x = -43.5; x <= -14.5; x += 1.9) if (tracePoly(ctx, [[x, 0, z + 0.01], [x + 0.35, 0, z + 0.01], [x + 0.35, 18, z + 0.01], [x, 18, z + 0.01]])) ctx.fill();
  }

  function drawGroundMarks(ctx) {
    const col = (c, center) => css(fogMix(mul3(c, env.amb.map((a, i) => a + env.sun[i] * 0.7)), center));
    const quad = (x0, z0, x1, z1, c, y = 0.005) => { if (tracePoly(ctx, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]])) { ctx.fillStyle = col(c, [(x0 + x1) / 2, 0, (z0 + z1) / 2]); ctx.fill(); } };
    // plaza and parterres
    quad(-38, -28, 38, 15, [0.93, 0.905, 0.855]);
    for (const [x0, z0, x1, z1] of [[-34, -22, -14, -6], [14, -22, 34, -6], [-34, 2, -14, 12], [14, 2, 34, 12]]) quad(x0, z0, x1, z1, [0.70, 0.76, 0.60], 0.01);
    // pavement grid
    ctx.strokeStyle = css(INK, 0.05 + env.night * 0.08); ctx.lineWidth = 0.6;
    for (let x = -36; x <= 36; x += 4) strokeWorld(ctx, [x, 0.012, -28], [x, 0.012, 15]);
    for (let z = -26; z <= 14; z += 4) strokeWorld(ctx, [-38, 0.012, z], [38, 0.012, z]);
    // roads
    for (const r of ROADS) {
      if (r.a === 'x') { quad(r.from, r.lo - 1.5, r.to, r.lo, [0.90, 0.88, 0.84]); quad(r.from, r.hi, r.to, r.hi + 1.5, [0.90, 0.88, 0.84]); quad(r.from, r.lo, r.to, r.hi, [0.70, 0.69, 0.67], 0.008); }
      else { quad(r.lo - 1.5, r.from, r.lo, r.to, [0.90, 0.88, 0.84]); quad(r.hi, r.from, r.hi + 1.5, r.to, [0.90, 0.88, 0.84]); quad(r.lo, r.from, r.hi, r.to, [0.70, 0.69, 0.67], 0.008); }
    }
    ctx.fillStyle = css(fogMix([0.95, 0.93, 0.88], [0, 0, 0]), 0.8);
    for (const r of ROADS) {
      const mid = (r.lo + r.hi) / 2;
      const c0 = r.a === 'x' ? cam.p[0] : cam.p[2];
      for (let t = Math.floor((c0 - 160) / 6) * 6; t < c0 + 160; t += 6) {
        if (t < r.from || t > r.to) continue;
        const pts = r.a === 'x' ? [[t, 0.012, mid - 0.08], [t + 2.8, 0.012, mid - 0.08], [t + 2.8, 0.012, mid + 0.08], [t, 0.012, mid + 0.08]]
          : [[mid - 0.08, 0.012, t], [mid + 0.08, 0.012, t], [mid + 0.08, 0.012, t + 2.8], [mid - 0.08, 0.012, t + 2.8]];
        if (tracePoly(ctx, pts)) ctx.fill();
      }
    }
  }

  // ================================================================ the staircase
  function facePoly(ctx, pts, alb, n, extra) {
    const c = [0, 0, 0]; for (const p of pts) { c[0] += p[0] / pts.length; c[1] += p[1] / pts.length; c[2] += p[2] / pts.length; }
    if (dot(n, sub(cam.p, c)) <= 0) return false;
    if (!tracePoly(ctx, pts)) return false;
    const [lit, dark] = shadeN(alb, n, c, extra);
    ctx.fillStyle = css(-dot(n, L) > 0 ? lit : dark); ctx.fill();
    return true;
  }
  // A flight: floating travertine treads carried by two terracotta stringers.
  function boxFaces(ctx, min, max, alb, extra, top, stroke) {
    const faces = [[1, 1], [1, -1], [0, 1], [0, -1], [2, 1], [2, -1]];
    for (const [a, s] of faces) {
      const f = faceVerts({ min, max }, a, s);
      const n = AX[a].map(c => c * s);
      if (facePoly(ctx, f, a === 1 && s > 0 && top ? top : alb, n, extra) && stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.5; ctx.stroke(); }
    }
  }
  function drawFlight(ctx, it) {
    const { dir, y0, x0, back } = it;
    const za = back ? -3.6 : 0.2, zb = back ? -0.2 : 3.6;
    const xe = x0 + dir * FL;
    const extra = it.k > 9 ? (it.k - 9) * 0.1 : 0;
    const line = css(INK, 0.12 + env.night * 0.15);
    const nose = x => y0 + ((x - x0) * dir / RUNS) * RISE + RISE * 0.5;
    // stringers: sloped beams along both sides
    const stringer = (z0, z1) => {
      const t0 = nose(x0) + 0.2, t1 = nose(xe) + 0.2, b0 = t0 - 0.62, b1 = t1 - 0.62;
      const sN = norm([-dir * RISE, RUNS, 0]), bN = norm([dir * RISE, -RUNS, 0]);
      facePoly(ctx, [[x0, b0, z0], [xe, b1, z0], [xe, b1, z1], [x0, b0, z1]], MAT.soffit, bN, extra);
      facePoly(ctx, [[x0, t0, z0], [xe, t1, z0], [xe, t1, z1], [x0, t0, z1]], MAT.terra, sN, extra);
      for (const [z, nz] of [[z0, -1], [z1, 1]]) if (facePoly(ctx, [[x0, b0, z], [xe, b1, z], [xe, t1, z], [x0, t0, z]], MAT.terra, [0, 0, nz], extra)) { ctx.strokeStyle = line; ctx.lineWidth = 0.6; ctx.stroke(); }
    };
    const sIn = back ? [-0.36, -0.2] : [0.2, 0.36], sOut = back ? [-3.6, -3.44] : [3.44, 3.6];
    const nearFirst = cam.p[2] > (za + zb) / 2;
    const farS = nearFirst ? (back ? sOut : sIn) : (back ? sIn : sOut), nearS = farS === sOut ? sIn : sOut;
    stringer(farS[0], farS[1]);
    // treads, far from the camera first
    const order = [];
    for (let i = 0; i < NR; i++) order.push(i);
    const cx = i => x0 + dir * (i + 0.5) * RUNS;
    order.sort((a, b) => Math.abs(cx(b) - cam.p[0]) - Math.abs(cx(a) - cam.p[0]));
    for (const i of order) {
      const xa = x0 + dir * i * RUNS - dir * 0.03, xb = x0 + dir * (i + 1) * RUNS;
      const top = y0 + (i + 1) * RISE;
      boxFaces(ctx, [Math.min(xa, xb), top - 0.09, za + 0.16], [Math.max(xa, xb), top, zb - 0.16], MAT.riser, extra, MAT.tread, line);
    }
    stringer(nearS[0], nearS[1]);
    // handrail on the outer stringer
    const zr = back ? -3.52 : 3.52;
    ctx.strokeStyle = css(fogMix(mul3(MAT.steel, env.amb), [0, y0, zr], extra)); ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.6, pxSize(0.05, [x0, y0, zr]));
    strokeWorld(ctx, [x0, nose(x0) + 1.0, zr], [xe, nose(xe) + 1.0, zr]);
    ctx.lineWidth = Math.max(0.5, pxSize(0.025, [x0, y0, zr]));
    for (let i = 2; i < NR; i += 4) { const x = x0 + dir * i * RUNS; strokeWorld(ctx, [x, nose(x) + 0.2, zr], [x, nose(x) + 1.0, zr]); }
  }

  function drawCloudBank(ctx, it) {
    const r = rng(it.seed);
    const drift = reduceMotion ? 0 : Math.sin(time * 0.03 + it.seed) * 1.2;
    const puffs = [];
    for (let i = 0; i < 9; i++) puffs.push([it.x + drift + (r() - 0.5) * it.w, it.y + r() * 3.2, it.z + (r() - 0.5), 2.8 + r() * 3.4]);
    const base = project([it.x, it.y - 0.5, it.z]); if (!base) return;
    for (const pass of [0, 1]) {
      ctx.fillStyle = css(pass ? env.cloud : env.cloudS, pass ? 0.97 : 0.9);
      ctx.beginPath();
      for (const [x, y, z, rr] of puffs) {
        const p = project([x + (pass ? -0.5 : 0.4), y + (pass ? 0.5 : -0.3), z]); if (!p) continue;
        const pr = pxSize(rr, [x, y, z]);
        ctx.moveTo(p[0] + pr, p[1]); ctx.arc(p[0], p[1], pr, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  function drawTree(ctx, it) {
    const [x, , z] = it.base;
    const sway = reduceMotion ? 0 : Math.sin(time * 0.7 + it.seed) * 0.08;
    const b = project([x, 0, z]), t = project([x, it.h * 0.7, z]); if (!b || !t) return;
    // shadow on the ground
    const sl = it.h / -L[1];
    const s0 = project([x + L[0] * sl, 0.02, z + L[2] * sl]);
    if (s0) { ctx.fillStyle = css(INK, 0.07 * env.day); ctx.beginPath(); ctx.ellipse(s0[0], s0[1], pxSize(it.rad * 1.1, [x, 0, z]), pxSize(it.rad * 0.4, [x, 0, z]), 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = css(fogMix(mul3([0.35, 0.30, 0.25], env.amb), it.base)); ctx.lineWidth = Math.max(1, pxSize(0.25, it.base));
    ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(t[0], t[1]); ctx.stroke();
    const c = [x + sway, it.h, z];
    const leaf = [0.56, 0.64, 0.47];
    const [lit, dark] = shadeN(leaf, [-0.5, 0.7, 0.5], c);
    const cp = project(c); if (!cp) return;
    const R = pxSize(it.rad, c);
    ctx.fillStyle = css(dark); ctx.beginPath(); ctx.arc(cp[0], cp[1], R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = css(lit); ctx.beginPath(); ctx.arc(cp[0] - R * 0.18, cp[1] - R * 0.2, R * 0.78, 0, Math.PI * 2); ctx.fill();
  }

  function carPos(it) {
    const span = 700;
    const t = (it.phase + (reduceMotion ? 0 : time) * it.speed * it.dir);
    const c = it.axis === 0 ? cam.p[0] : cam.p[2];
    const along = ((t - c + span / 2) % span + span) % span - span / 2 + c;
    return it.axis === 0 ? [along, 0, it.off] : [it.off, 0, along];
  }
  function updateCars() {
    for (const it of cars) {
      const p = carPos(it), lx = it.axis === 0 ? 2.1 : 0.8, lz = it.axis === 0 ? 0.8 : 2.1;
      it.min = [p[0] - lx, 0, p[2] - lz]; it.max = [p[0] + lx, 1.5, p[2] + lz]; it.c = p;
    }
  }
  function drawCar(ctx, it) {
    const [x, , z] = it.c;
    const lx = it.axis === 0 ? 2.1 : 0.8, lz = it.axis === 0 ? 0.8 : 2.1;
    const box = (x0, y0, z0, x1, y1, z1, alb) => {
      for (const [a, s] of [[1, 1], [2, 1], [0, 1], [0, -1], [2, -1]]) {
        const f = faceVerts({ min: [x0, y0, z0], max: [x1, y1, z1] }, a, s);
        const n = AX[a].map(c => c * s);
        facePoly(ctx, f, alb, n);
      }
    };
    const sp = project([x, 0.02, z]);
    if (sp) { ctx.fillStyle = css(INK, 0.12 + env.night * 0.2); ctx.beginPath(); ctx.ellipse(sp[0], sp[1], pxSize(lx * 1.1, [x, 0, z]), pxSize(0.4, [x, 0, z]), 0, 0, Math.PI * 2); ctx.fill(); }
    box(x - lx, 0.25, z - lz, x + lx, 0.95, z + lz, it.col);
    const ix = it.axis === 0 ? lx * 0.55 : lx, iz = it.axis === 0 ? lz : lz * 0.55;
    box(x - ix, 0.95, z - iz, x + ix, 1.5, z + iz, mix3(it.col, [0.35, 0.42, 0.5], 0.55));
    if (env.lamp > 0.05) {
      const head = it.axis === 0 ? [x + it.dir * lx, 0.6, z] : [x, 0.6, z + it.dir * lz];
      const tail = it.axis === 0 ? [x - it.dir * lx, 0.6, z] : [x, 0.6, z - it.dir * lz];
      const h = project(head), tt = project(tail);
      if (h) { ctx.fillStyle = css([1, 0.92, 0.75], env.lamp); ctx.beginPath(); ctx.arc(h[0], h[1], Math.max(1, pxSize(0.18, head)), 0, Math.PI * 2); ctx.fill(); }
      if (tt) { ctx.fillStyle = css([0.95, 0.3, 0.2], env.lamp * 0.8); ctx.beginPath(); ctx.arc(tt[0], tt[1], Math.max(0.8, pxSize(0.12, tail)), 0, Math.PI * 2); ctx.fill(); }
    }
  }

  // ================================================================ Chapter 01 objects
  function drawRailing(ctx, it) {
    const y = it.y;
    ctx.strokeStyle = css(fogMix(mul3(MAT.steel, env.amb), [-14, y, 3.5])); ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.8, pxSize(0.045, [-14, y, 3.5]));
    strokeWorld(ctx, [-18.6, y + 1.0, 3.5], [-10.7, y + 1.0, 3.5]);
    ctx.lineWidth = Math.max(0.6, pxSize(0.025, [-14, y, 3.5]));
    strokeWorld(ctx, [-18.6, y + 0.5, 3.5], [-10.7, y + 0.5, 3.5]);
    for (let x = -18.6; x <= -10.6; x += 1.14) strokeWorld(ctx, [x, y, 3.5], [x, y + 1.0, 3.5]);
  }
  function drawShopLamp(ctx, it) {
    const p = it.p;
    ctx.strokeStyle = css(mul3(MAT.steel, env.amb)); ctx.lineWidth = Math.max(0.6, pxSize(0.015, p));
    strokeWorld(ctx, [p[0], it.top, p[2]], [p[0], p[1] + 0.2, p[2]]);
    const c = project([p[0], p[1] + 0.12, p[2]]); if (!c) return;
    const r = pxSize(0.28, p);
    ctx.beginPath(); ctx.moveTo(c[0] - r * 0.25, c[1] - r * 0.35); ctx.lineTo(c[0] + r * 0.25, c[1] - r * 0.35); ctx.lineTo(c[0] + r, c[1] + r * 0.2); ctx.lineTo(c[0] - r, c[1] + r * 0.2); ctx.closePath();
    ctx.fillStyle = css(mul3([0.28, 0.3, 0.33], light(p)[0])); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c[0], c[1] + r * 0.2, r, r * 0.16, 0, 0, Math.PI * 2);
    const lp = lamps.find(l => l.kind === 'workshop');
    ctx.fillStyle = css(mix3([0.85, 0.84, 0.8], [1, 0.9, 0.7], lampI(lp))); ctx.fill();
  }
  function drawLaptop(ctx, it) {
    const y = it.y + 0.9;
    const X = it.dx;
    const base = [[-13.55 + X, y, -1.62], [-13.15 + X, y, -1.62], [-13.15 + X, y, -1.38], [-13.55 + X, y, -1.38]];
    facePoly(ctx, base.map(p => [p[0], p[1] + 0.03, p[2]]), [0.72, 0.71, 0.68], [0, 1, 0]);
    const lid = [[-13.55 + X, y + 0.03, -1.62], [-13.15 + X, y + 0.03, -1.62], [-13.15 + X, y + 0.3, -1.7], [-13.55 + X, y + 0.3, -1.7]];
    const n = norm([0, 0.28, 1]);
    if (dot(n, sub(cam.p, lid[0])) > 0) {
      if (tracePoly(ctx, lid)) { ctx.fillStyle = css(mul3([0.26, 0.26, 0.28], light(lid[0], n)[0])); ctx.fill(); }
      const inner = [[-13.52 + X, y + 0.05, -1.625], [-13.18 + X, y + 0.05, -1.625], [-13.18 + X, y + 0.28, -1.694], [-13.52 + X, y + 0.28, -1.694]];
      if (tracePoly(ctx, inner)) { ctx.fillStyle = css(mix3([0.55, 0.64, 0.7], [0.75, 0.82, 0.86], env.lamp)); ctx.fill(); }
    } else if (tracePoly(ctx, lid)) { ctx.fillStyle = css(mul3([0.7, 0.69, 0.66], light(lid[0], [0, 0, -1])[1])); ctx.fill(); }
  }
  function drawGear(ctx, it) {
    const rot = reduceMotion ? 0 : time * 0.15;
    const pts = [];
    for (let i = 0; i < 12; i++) for (const [f, rr] of [[0, 0.84], [0.2, 1], [0.5, 1], [0.7, 0.84]]) {
      const a = rot + (i + f) * Math.PI * 2 / 12; pts.push([it.c[0] + Math.cos(a) * it.r * rr, it.c[1] + Math.sin(a) * it.r * rr, it.c[2]]);
    }
    const [l, d] = light(it.c, [0, 0, 1]);
    const sp = pts.map(project); if (sp.some(p => !p)) return;
    ctx.beginPath(); sp.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
    const hc = project(it.c), hr = pxSize(it.r * 0.3, it.c);
    ctx.moveTo(hc[0] + hr, hc[1]); ctx.arc(hc[0], hc[1], hr, 0, Math.PI * 2, true);
    ctx.fillStyle = css(mix3(mul3([0.6, 0.6, 0.58], d), mul3([0.6, 0.6, 0.58], l), 0.6)); ctx.fill('evenodd');
    ctx.strokeStyle = css(INK, 0.4); ctx.lineWidth = 0.6; ctx.stroke();
  }
  function drawNextHint(ctx, it) {
    // a canopy and warm light, deliberately indistinct
    const y = it.y, f = 0.55;
    ctx.strokeStyle = css(fogMix(mul3(MAT.steel, env.amb), [11, y, 0], f)); ctx.lineWidth = Math.max(0.6, pxSize(0.08, [11, y, 0]));
    for (const x of [LX + 1.9, LX + 8.3]) { strokeWorld(ctx, [x, y, 3], [x, y + 3.2, 3]); strokeWorld(ctx, [x, y, -3], [x, y + 3.2, -3]); }
    const a = [[LX + 1.5, y + 3.2, -3.3], [LX + 8.7, y + 3.2, -3.3], [LX + 8.7, y + 3.6, 3.3], [LX + 1.5, y + 3.6, 3.3]];
    if (tracePoly(ctx, a)) { ctx.fillStyle = css(fogMix(MAT.terra, [11, y, 0], f)); ctx.fill(); }
    const c = project([LX + 5, y + 1.6, 0]);
    if (c) { const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], pxSize(4, [LX + 5, y, 0])); g.addColorStop(0, css([1, 0.85, 0.62], 0.25 + env.lamp * 0.3)); g.addColorStop(1, css([1, 0.85, 0.62], 0)); ctx.fillStyle = g; ctx.fillRect(c[0] - 400, c[1] - 400, 800, 800); }
  }

  // ---------------------------------------------------------------- the drafting board and its transformation
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Helvetica Neue", Arial, sans-serif';
  function drawBoard(ctx, it) {
    const { c, u, v, n, w, h, y } = it;
    const corner = (a, b) => add3(add3(c, sc3(u, a)), sc3(v, b));
    // stand
    ctx.strokeStyle = css(mul3(MAT.steel, env.amb)); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.8, pxSize(0.04, c));
    strokeWorld(ctx, [c[0] - 0.5, y, c[2] - 0.2], corner(-0.45, -0.3));
    strokeWorld(ctx, [c[0] + 0.5, y, c[2] - 0.2], corner(0.45, -0.3));
    strokeWorld(ctx, [c[0] - 0.5, y, c[2] + 0.1], [c[0] + 0.5, y, c[2] + 0.1]);
    if (dot(n, sub(cam.p, c)) <= 0) return;
    // board and sheet
    const frame = [corner(-w / 2 - 0.04, h / 2 + 0.04), corner(w / 2 + 0.04, h / 2 + 0.04), corner(w / 2 + 0.04, -h / 2 - 0.04), corner(-w / 2 - 0.04, -h / 2 - 0.04)];
    if (tracePoly(ctx, frame)) { ctx.fillStyle = css(mul3(MAT.wood, light(c, n)[0])); ctx.fill(); }
    const o = corner(-w / 2, h / 2);
    const m = planeFrame(o, sc3(u, 1 / 1000), sc3(v, -1 / 1000)); if (!m) return;
    const [lit] = light(c, n);
    ctx.save();
    ctx.transform(...m);
    drawSheet(ctx, lit, pxSize(1 / 1000, c));
    ctx.restore();
  }

  // Sheet space: 1300 × 900 units (1 unit = 1 mm). ENGINEERING → GRID → WIREFRAME → INTERFACE.
  function drawSheet(ctx, lit, pxPerUnit) {
    const S = sheetState;
    const e = S.draw, g = S.grid, wf = S.wire, ui = S.ui;
    const tone = c => css(mul3(c, lit));
    const inkA = a => css(mul3(INK, lit), a);
    const lw = px => Math.max(px / Math.max(pxPerUnit, 1e-4), 0.8);
    const W_ = 1300, H_ = 900;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // paper → canvas
    ctx.fillStyle = tone(mix3(MAT.paper, [0.975, 0.975, 0.97], ui)); ctx.fillRect(0, 0, W_, H_);
    if (pxPerUnit < 0.02) {           // far away: suggest, don't draw
      ctx.strokeStyle = inkA(0.4); ctx.lineWidth = 30; ctx.beginPath(); ctx.arc(360, 440, 210, 0, Math.PI * 2); ctx.stroke(); return;
    }

    const fadeEng = 1 - smooth(0.0, 0.7, wf);
    // ---- grid: dimension lines multiply into a 12-column layout grid
    if (g > 0) {
      ctx.strokeStyle = css(mix3(mul3(INK, lit), ACCENT, 0.4), 0.18 * g * (1 - ui * 0.8)); ctx.lineWidth = lw(0.8);
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) { const xT = 80 + i * (1140 / 12), x = lerp(360, xT, easeInOut(g)); ctx.moveTo(x, 60); ctx.lineTo(x, 840); }
      for (let j = 0; j <= 8; j++) { const yT = 60 + j * (780 / 8), yy = lerp(700, yT, easeInOut(g)); ctx.moveTo(60, yy); ctx.lineTo(1240, yy); }
      ctx.stroke();
    }

    // ---- border and title block → navigation bar
    const wx = easeInOut(smooth(0.35, 1, wf)), wy = easeInOut(smooth(0, 0.55, wf));
    const nav = [lerp(880, 80, wx), lerp(720, 70, wy), lerp(380, 1140, wx), lerp(140, 56, wy)];
    ctx.strokeStyle = inkA(0.8 * fadeEng); ctx.lineWidth = lw(1.2);
    if (fadeEng > 0.01) { ctx.strokeRect(24, 24, W_ - 48, H_ - 48); }
    if (e > 0.6 || wf > 0) {
      const a = smooth(0.6, 0.9, e);
      ctx.strokeStyle = inkA(0.85 * a); ctx.lineWidth = lw(1);
      rr(ctx, nav[0], nav[1], nav[2], nav[3], 18 * wf); ctx.stroke();
      if (ui > 0) { ctx.fillStyle = css(mix3([1, 1, 1], [0.12, 0.13, 0.15], 0), ui); rr(ctx, nav[0], nav[1], nav[2], nav[3], 18); ctx.fill(); ctx.strokeStyle = css([0, 0, 0], 0.06 * ui); ctx.stroke(); }
      ctx.fillStyle = inkA(a * (1 - smooth(0, 0.3, wf)));
      text(ctx, 'NSUT · MECHANICAL ENGINEERING', 900, 762, 14, 650, 1.2);
      text(ctx, 'SPUR GEAR — FRONT VIEW & SECTION A–A', 900, 792, 13, 500, 0.4);
      text(ctx, 'DRG 01     SCALE 1:2     2021', 900, 822, 13, 500, 1);
      if (wf > 0.5) {
        ctx.fillStyle = css(mix3(mul3(INK, lit), [0.1, 0.1, 0.12], ui), smooth(0.5, 1, wf));
        text(ctx, 'Workshop', 124, 106, 22, 650, 0);
        ctx.fillStyle = css(mul3(INK, lit), 0.5 * smooth(0.5, 1, wf));
        for (let i = 0; i < 3; i++) text(ctx, ['Parts', 'Builds', 'People'][i], 860 + i * 110, 106, 18, 500, 0);
        ctx.fillStyle = css(ACCENT, ui); ctx.beginPath(); ctx.arc(1180, 98, 14, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ---- the gear → a progress ring on a card
    const gc = [lerp(360, 330, wf), lerp(440, 380, wf)];
    const R = lerp(230, 130, easeInOut(wf));
    const teeth = 1 - smooth(0.1, 0.6, wf);
    const cardA = [80, lerp(180, 160, wf), 500, lerp(560, 680, wf)];
    if (wf > 0.3) {
      const a = smooth(0.3, 0.8, wf);
      ctx.strokeStyle = inkA(0.7 * a * (1 - ui)); ctx.lineWidth = lw(1);
      rr(ctx, cardA[0], cardA[1], cardA[2], cardA[3], 22); ctx.stroke();
      if (ui > 0) { ctx.fillStyle = css([1, 1, 1], ui); ctx.fill(); ctx.strokeStyle = css([0, 0, 0], 0.07 * ui); ctx.stroke(); }
    }
    ctx.strokeStyle = inkA(0.9); ctx.lineWidth = lw(1.4);
    const gearPathFn = () => {
      ctx.beginPath();
      const N = 24;
      for (let i = 0; i <= N * 8; i++) {
        const a = i / (N * 8) * Math.PI * 2 - Math.PI / 2;
        const ph = (i % 8) / 8;
        const toothy = ph < 0.15 || ph > 0.85 ? 0 : ph < 0.3 || ph > 0.7 ? (ph < 0.3 ? (ph - 0.15) / 0.15 : (0.85 - ph) / 0.15) : 1;
        const r = R * (1 - 0.1 * teeth * (1 - toothy));
        const x = gc[0] + Math.cos(a) * r, y = gc[1] + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
    };
    if (ui < 1) {
      gearPathFn();
      ctx.save(); ctx.setLineDash([2400 * e, 4000]); ctx.strokeStyle = inkA(0.9 * (1 - ui)); ctx.stroke(); ctx.restore();
    }
    // hub and bore, fading as it becomes a component
    if (fadeEng > 0.01) {
      ctx.strokeStyle = inkA(0.85 * fadeEng * smooth(0.2, 0.5, e)); ctx.lineWidth = lw(1.2);
      ctx.beginPath(); ctx.arc(gc[0], gc[1], R * 0.32, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(gc[0], gc[1], R * 0.14, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeRect(gc[0] - 8, gc[1] - R * 0.14 - 14, 16, 16);
      // centre lines
      ctx.save(); ctx.setLineDash([36, 10, 4, 10]); ctx.lineWidth = lw(0.7); ctx.strokeStyle = inkA(0.6 * fadeEng * smooth(0.1, 0.3, e));
      ctx.beginPath(); ctx.moveTo(gc[0] - R - 50, gc[1]); ctx.lineTo(gc[0] + R + 50, gc[1]); ctx.moveTo(gc[0], gc[1] - R - 50); ctx.lineTo(gc[0], gc[1] + R + 50); ctx.stroke(); ctx.restore();
    }
    // ring UI
    if (ui > 0) {
      ctx.lineWidth = 22; ctx.strokeStyle = css([0.93, 0.92, 0.9], ui);
      ctx.beginPath(); ctx.arc(gc[0], gc[1], R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = css(ACCENT, ui); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(gc[0], gc[1], R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.72 * easeInOut(ui)); ctx.stroke();
      ctx.fillStyle = css([0.1, 0.1, 0.12], ui);
      text(ctx, Math.round(72 * easeInOut(ui)) + '%', gc[0] - 52, gc[1] + 16, 46, 650, 0);
      ctx.fillStyle = css([0.1, 0.1, 0.12], 0.5 * ui);
      text(ctx, 'Prototype progress', gc[0] - 88, gc[1] + R + 70, 18, 500, 0);
      ctx.fillStyle = css([0.1, 0.1, 0.12], 0.22 * ui);
      rr(ctx, 120, gc[1] + R + 96, 300, 12, 6); ctx.fill();
      rr(ctx, 120, gc[1] + R + 120, 220, 12, 6); ctx.fill();
    }

    // ---- section A–A → a phone; hatching → a bar chart
    const sec = [lerp(760, 880, wf), lerp(210, 160, wf), lerp(80, 300, easeInOut(wf)), lerp(460, 600, wf)];
    const sa = smooth(0.35, 0.7, e);
    ctx.strokeStyle = inkA(0.9 * sa); ctx.lineWidth = lw(1.4);
    rr(ctx, sec[0], sec[1], sec[2], sec[3], 36 * wf); ctx.stroke();
    if (ui > 0) {
      ctx.fillStyle = css([1, 1, 1], ui); rr(ctx, sec[0], sec[1], sec[2], sec[3], 36); ctx.fill();
      ctx.strokeStyle = css([0.1, 0.1, 0.12], 0.8 * ui); ctx.lineWidth = 6; ctx.stroke();
      // phone content
      const px = sec[0], py = sec[1];
      ctx.save(); rr(ctx, px + 3, py + 3, sec[2] - 6, sec[3] - 6, 33); ctx.clip();
      ctx.fillStyle = css(hex('#9FB6C8'), ui); ctx.fillRect(px, py, sec[2], 190);
      ctx.fillStyle = css([1, 1, 1], ui); text(ctx, 'Hello, James', px + 28, py + 110, 26, 650, 0);
      ctx.fillStyle = css([1, 1, 1], 0.8 * ui); text(ctx, 'Your first build is ready', px + 28, py + 144, 16, 500, 0);
      for (let i = 0; i < 3; i++) {
        const ry = py + 220 + i * 84;
        ctx.fillStyle = css([0.96, 0.95, 0.93], ui); rr(ctx, px + 22, ry, sec[2] - 44, 68, 14); ctx.fill();
        ctx.fillStyle = css([hex('#C9765A'), hex('#7F9A8C'), hex('#D9B46E')][i], ui); ctx.beginPath(); ctx.arc(px + 58, ry + 34, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = css([0.1, 0.1, 0.12], 0.7 * ui); rr(ctx, px + 88, ry + 22, 130 - i * 20, 10, 5); ctx.fill();
        ctx.fillStyle = css([0.1, 0.1, 0.12], 0.3 * ui); rr(ctx, px + 88, ry + 40, 90, 8, 4); ctx.fill();
      }
      const press = smooth(0.8, 0.9, ui) * (1 - smooth(0.9, 1, ui) * 0.5);
      ctx.fillStyle = css(ACCENT, ui); rr(ctx, px + 22, py + sec[3] - 90, sec[2] - 44, 56 - press * 3, 28); ctx.fill();
      ctx.fillStyle = css([1, 1, 1], ui); text(ctx, ui > 0.92 ? 'Built ✓' : 'Start building', px + sec[2] / 2 - 62, py + sec[3] - 54, 19, 600, 0);
      ctx.restore();
    }
    // hatching → bars
    const hatchA = sa * (1 - smooth(0.5, 1, wf));
    const cardB = [620, 160, 220, 680];
    if (wf > 0.35) {
      const a = smooth(0.35, 0.8, wf);
      ctx.strokeStyle = inkA(0.7 * a * (1 - ui)); ctx.lineWidth = lw(1);
      rr(ctx, cardB[0], cardB[1], cardB[2], cardB[3], 22); ctx.stroke();
      if (ui > 0) { ctx.fillStyle = css([1, 1, 1], ui); ctx.fill(); ctx.strokeStyle = css([0, 0, 0], 0.07 * ui); ctx.stroke(); }
    }
    for (let i = 0; i < 7; i++) {
      const t = easeInOut(wf);
      const x0 = lerp(sec[0] + 8 + i * 10, 650 + i * 26, t);
      const barH = [180, 260, 210, 330, 290, 400, 360][i];
      const y0 = lerp(sec[1] + 40 + i * 60, 800 - barH, t), y1 = lerp(sec[1] + 100 + i * 60, 800, t);
      const xShift = lerp(60, 0, t);
      if (hatchA + wf * (1 - ui) > 0.01) {
        ctx.strokeStyle = inkA(Math.max(hatchA, wf * (1 - ui)) * 0.7); ctx.lineWidth = lw(lerp(0.8, 1.4, t));
        ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0 + xShift, y0); ctx.stroke();
      }
      if (ui > 0) { ctx.fillStyle = css(i === 5 ? ACCENT : hex('#B8C7C0'), ui); rr(ctx, 650 + i * 26 - 8, 800 - barH * easeInOut(ui), 16, barH * easeInOut(ui), 6); ctx.fill(); }
    }
    if (ui > 0) { ctx.fillStyle = css([0.1, 0.1, 0.12], 0.8 * ui); text(ctx, 'Builds', 646, 208, 20, 650, 0); ctx.fillStyle = css([0.1, 0.1, 0.12], 0.45 * ui); text(ctx, 'per week', 646, 236, 15, 500, 0); }

    // ---- dimensions (engineering only)
    if (fadeEng > 0.01) {
      const da = smooth(0.55, 0.85, e) * fadeEng * (1 - g * 0.6);
      ctx.strokeStyle = inkA(0.75 * da); ctx.fillStyle = inkA(0.85 * da); ctx.lineWidth = lw(0.8);
      dimH(ctx, gc[0] - R, gc[0] + R, gc[1] + R + 60, 'Ø 460');
      dimV(ctx, sec[1], sec[1] + sec[3], sec[0] + sec[2] + 70, 'Ø 460');
      dimH(ctx, sec[0], sec[0] + sec[2], sec[1] - 40, '80');
      ctx.fillStyle = inkA(0.6 * da);
      text(ctx, 'A', sec[0] - 30, 190, 22, 600, 0);
      text(ctx, 'MATERIAL  EN8 STEEL', 1010, 110, 13, 600, 1);
      text(ctx, 'MODULE  5    TEETH  24', 1010, 134, 13, 600, 1);
    }
  }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function text(ctx, s, x, y, size, weight, spacing) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = spacing + 'px';
    ctx.fillText(s, x, y);
  }
  function arrow(ctx, x, y, ang) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang + 0.3) * 16, y + Math.sin(ang + 0.3) * 16); ctx.lineTo(x + Math.cos(ang - 0.3) * 16, y + Math.sin(ang - 0.3) * 16); ctx.closePath(); ctx.fill(); }
  function dimH(ctx, x0, x1, y, label) {
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.moveTo(x0, y - 16); ctx.lineTo(x0, y + 8); ctx.moveTo(x1, y - 16); ctx.lineTo(x1, y + 8); ctx.stroke();
    arrow(ctx, x0, y, 0); arrow(ctx, x1, y, Math.PI);
    text(ctx, label, (x0 + x1) / 2 - 24, y - 10, 16, 600, 0.5);
  }
  function dimV(ctx, y0, y1, x, label) {
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.moveTo(x - 16, y0); ctx.lineTo(x + 8, y0); ctx.moveTo(x - 16, y1); ctx.lineTo(x + 8, y1); ctx.stroke();
    arrow(ctx, x, y0, Math.PI / 2); arrow(ctx, x, y1, -Math.PI / 2);
    ctx.save(); ctx.translate(x - 10, (y0 + y1) / 2 + 24); ctx.rotate(-Math.PI / 2); text(ctx, label, 0, 0, 16, 600, 0.5); ctx.restore();
  }
  const sheetState = { draw: 1, grid: 0, wire: 0, ui: 0 };

  // ================================================================ the protagonist
  // An editorial character: round glasses, a swept quiff, an indigo hoodie,
  // headphones worn round the neck with terracotta cups. Side, front and back
  // views; turns flip like a paper cut-out.
  const LOOK = {
    hood: hex('#34497A'), hoodD: hex('#28385F'), pants: hex('#2B2A2C'), shoe: hex('#F4F1EA'),
    skin: hex('#E3BE9F'), hair: hex('#1E1A18'), band: hex('#2A2A2E'), cup: ACCENT, string: hex('#F4F1EA'),
  };
  const FS = [], HD = [], STOP = [];
  function buildPath() {
    const fs = (x, y, z) => FS.push([x, y, z]);
    const Z0 = -1.9, Z1 = 1.9;
    fs(-8.1, 0, -1.7); fs(-8.08, 0, -1.95); STOP.push(1);
    for (const x of [-7.7, -7.3, -6.9, -6.5]) fs(x, 0, Z0);
    for (let i = 1; i <= NR; i++) fs(XL + (i - 0.5) * RUNS, i * RISE, Z0);
    for (const [x, z] of [[6.45, Z0], [6.95, -1.7], [7.4, -1.15], [7.6, -0.45], [7.6, 0.35], [7.4, 1.05], [6.95, 1.65], [6.45, Z1]]) fs(x, FR, z);
    for (let j = 1; j <= NR; j++) fs(XR - (j - 0.5) * RUNS, FR + j * RISE, Z1);
    for (const [x, z] of [[-6.45, 1.85], [-6.95, 1.55], [-7.45, 1.2], [-7.95, 0.85], [-8.45, 0.6], [-8.95, 0.4]]) fs(x, NSUT_Y, z);
    for (let x = -9.35; x >= -12.9; x -= 0.4) fs(x, NSUT_Y, lerp(0.35, -0.45, (-9.35 - x) / 3.55));
    fs(-12.95, NSUT_Y, -0.62); STOP.push(FS.length - 1);
    for (let x = -12.55; x <= -7.0; x += 0.4) fs(x, NSUT_Y, lerp(-0.75, Z0, smooth(-12.55, -7.2, x)));
    fs(-6.5, NSUT_Y, Z0);
    for (let i = 1; i <= NR; i++) fs(XL + (i - 0.5) * RUNS, NSUT_Y + i * RISE, Z0);
    for (const [x, z] of [[6.45, Z0], [6.95, -1.65], [7.3, -1.2], [7.35, -1.02]]) fs(x, NSUT_Y + FR, z);
    STOP.push(FS.length - 1);
    for (let i = 0; i < FS.length; i++) {
      const a = FS[Math.max(0, i - 1)], b = FS[Math.min(FS.length - 1, i + 1)];
      HD.push(Math.atan2(b[2] - a[2], b[0] - a[0]));
    }
    HD[0] = HD[1] = 0;
    HD[STOP[1]] = HD[STOP[1] - 1] = Math.PI;
    HD[STOP[2]] = HD[STOP[2] - 1] = Math.PI / 2;
    for (let i = 1; i < HD.length; i++) {
      while (HD[i] - HD[i - 1] > Math.PI) HD[i] -= Math.PI * 2;
      while (HD[i] - HD[i - 1] < -Math.PI) HD[i] += Math.PI * 2;
    }
  }

  const person = { solid: false, person: true, min: [0, 0, 0], max: [0, 0, 0], c: [0, 0, 0], draw: drawPerson };
  const ps = { hip: [0, 0, 0], ground: 0, feet: [[0, 0, 0], [0, 0, 0]], hd: 0, move: 0, slope: 0, phase: 0, tilt: 0, work: 0 };
  const HIP = 0.76;

  function poseAt(q) {
    const n = FS.length;
    q = clamp(q, 0, n - 1.0001);
    const i = Math.floor(q), t = q - i;
    const a = FS[Math.max(0, i - 1)], b = FS[i], c = FS[Math.min(n - 1, i + 1)];
    const m0 = sc3(add3(a, b), 0.5), m1 = sc3(add3(b, c), 0.5);
    const gy = lerp(m0[1], m1[1], easeSine(t));
    ps.hip = [lerp(m0[0], m1[0], t), gy + HIP + Math.sin(Math.PI * t) * 0.02 * ps.move, lerp(m0[2], m1[2], t)];
    ps.ground = gy;
    ps.slope = clamp((c[1] - a[1]) / (Math.hypot(c[0] - a[0], c[2] - a[2]) || 1), -1, 1);
    ps.hd = lerp(HD[i], HD[Math.min(n - 1, i + 1)], easeSine(t));
    const hv = [Math.cos(ps.hd), Math.sin(ps.hd)];
    const lat = (p, side) => [p[0] - hv[1] * 0.085 * side, p[1], p[2] + hv[0] * 0.085 * side];
    const e = easeInOut(t), up = Math.max(0, c[1] - a[1]);
    const lift = Math.sin(Math.PI * t) * (0.06 + up * 0.35) * Math.min(1, ps.move * 3 + 0.2);
    const sw = [lerp(a[0], c[0], e), lerp(a[1], c[1], 1 - (1 - t) * (1 - t)) + lift, lerp(a[2], c[2], e)];
    const st = i % 2;
    ps.feet[st] = lat(b, st ? 1 : -1);
    ps.feet[1 - st] = lat(sw, st ? -1 : 1);
    ps.phase = q;
    const fy = Math.min(ps.feet[0][1], ps.feet[1][1]);
    person.min = [ps.hip[0] - 0.4, fy, ps.hip[2] - 0.3];
    person.max = [ps.hip[0] + 0.4, fy + 1.75, ps.hip[2] + 0.3];
    person.c = [ps.hip[0], fy + 0.85, ps.hip[2]];
  }

  // view: 'R' side facing right, 'L' side facing left, 'F' front, 'B' back
  const view = { cur: 'R', next: 'R', t: 1 };
  function targetView() {
    const h3 = [Math.cos(ps.hd), 0, Math.sin(ps.hd)];
    const s = -dot(h3, cam.f) / (Math.hypot(cam.f[0], cam.f[2]) || 1), c = dot(h3, cam.r);
    if (s > 0.8) return 'F';
    if (s < -0.8) return 'B';
    if (Math.abs(c) > 0.2) return c > 0 ? 'R' : 'L';
    return view.next;
  }
  function updateView(dt) {
    const tv = targetView();
    if (tv !== view.next && view.t >= 1) { view.cur = view.next; view.next = tv; view.t = 0; }
    view.t = Math.min(1, view.t + dt / (reduceMotion ? 0.01 : 0.26));
    if (view.t >= 1) view.cur = view.next;
  }

  function drawPerson(ctx) {
    const Hs = project(ps.hip); if (!Hs) return;
    const k = pxSize(1, ps.hip);
    const dCam = Math.hypot(ps.hip[0] - cam.p[0], ps.hip[1] + 0.6 - cam.p[1], ps.hip[2] - cam.p[2]);
    const alpha = smooth(0.8, 1.6, dCam);
    if (alpha < 0.01 || k < 0.5) return;
    const [lit, dk] = light(ps.hip);
    const lf = mix3(dk, lit, 0.65);
    const P_ = {
      lf, k,
      col: c => css(fogMix(mul3(c, lf), ps.hip)),
      ink: css(env.night > 0.5 ? mix3(INK, [0, 0, 0], 0.5) : INK),
      o: Math.max(0.012, 0.8 / k),
      detail: k > 45,
    };
    // contact shadow
    const f0 = project(ps.feet[0]), f1 = project(ps.feet[1]);
    if (f0 && f1) {
      ctx.fillStyle = css(INK, (0.12 + env.night * 0.1) * alpha);
      ctx.beginPath(); ctx.ellipse((f0[0] + f1[0]) / 2, Math.max(f0[1], f1[1]) + 0.01 * k, 0.32 * k, 0.05 * k, 0, 0, Math.PI * 2); ctx.fill();
    }
    const half = view.t < 0.5;
    const v = half ? view.cur : view.next;
    const squash = half ? 1 - view.t * 2 : view.t * 2 - 1;
    const sx = Math.max(0.04, easeSine(squash));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Hs[0], Hs[1]);
    const dir = v === 'L' ? -1 : 1;
    ctx.scale(k * sx * dir, -k);
    // feet in local space
    const hv = [Math.cos(ps.hd), Math.sin(ps.hd)];
    const local = f => (v === 'F' || v === 'B')
      ? [dot(sub(f, ps.hip), cam.r) * (v === 'B' ? 1 : 1), f[1] - ps.hip[1]]
      : [((f[0] - ps.hip[0]) * hv[0] + (f[2] - ps.hip[2]) * hv[1]), f[1] - ps.hip[1]];
    const feet = [local(ps.feet[0]), local(ps.feet[1])];
    if (v === 'F' || v === 'B') { feet[0][0] *= dir; feet[1][0] *= dir; } else { feet[0][0] = Math.abs(feet[0][0]) * Math.sign(feet[0][0]); }
    if (v === 'F') drawFront(ctx, P_, feet); else if (v === 'B') drawBack(ctx, P_, feet); else drawSide(ctx, P_, feet);
    ctx.restore();
  }

  function stroke2(ctx, P_, pts, w, fill) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); };
    if (P_.detail) { path(); ctx.strokeStyle = P_.ink; ctx.lineWidth = w + P_.o * 2; ctx.stroke(); }
    path(); ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
  }
  function fillPath(ctx, P_, fill, build, outline = true) {
    build(); ctx.fillStyle = fill; ctx.fill();
    if (outline && P_.detail) { ctx.strokeStyle = P_.ink; ctx.lineWidth = P_.o; ctx.stroke(); }
  }
  function ik(h, f, L1, L2, bendSign) {
    let dx = f[0] - h[0], dy = f[1] - h[1], d = Math.hypot(dx, dy) || 1e-4;
    const max = (L1 + L2) * 0.999;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    let px = -dy / d, py = dx / d; if (px * bendSign < 0) { px = -px; py = -py; }
    return { knee: [h[0] + dx * a / d + px * hh, h[1] + dy * a / d + py * hh], end: [h[0] + dx, h[1] + dy] };
  }
  function shoeSide(ctx, P_, ank, far) {
    const c = P_.col(far ? sc3(LOOK.shoe, 0.85) : LOOK.shoe);
    fillPath(ctx, P_, c, () => {
      ctx.beginPath(); ctx.moveTo(ank[0] - 0.06, ank[1] - 0.055); ctx.lineTo(ank[0] + 0.15, ank[1] - 0.055);
      ctx.quadraticCurveTo(ank[0] + 0.17, ank[1] - 0.005, ank[0] + 0.08, ank[1] + 0.02); ctx.lineTo(ank[0] - 0.05, ank[1] + 0.035);
      ctx.quadraticCurveTo(ank[0] - 0.08, ank[1] - 0.01, ank[0] - 0.06, ank[1] - 0.055); ctx.closePath();
    });
    if (P_.detail) { ctx.strokeStyle = P_.ink; ctx.lineWidth = P_.o; ctx.beginPath(); ctx.moveTo(ank[0] - 0.065, ank[1] - 0.035); ctx.lineTo(ank[0] + 0.16, ank[1] - 0.035); ctx.stroke(); }
  }
  function headSide(ctx, P_) {
    // neck
    stroke2(ctx, P_, [[0.0, 0.0], [0.015, 0.07]], 0.07, P_.col(LOOK.skin));
    fillPath(ctx, P_, P_.col(LOOK.skin), () => { ctx.beginPath(); ctx.arc(0.025, 0.2, 0.165, 0, Math.PI * 2); });
    // nose
    fillPath(ctx, P_, P_.col(LOOK.skin), () => { ctx.beginPath(); ctx.moveTo(0.18, 0.21); ctx.quadraticCurveTo(0.225, 0.16, 0.185, 0.145); ctx.closePath(); });
    // ear
    fillPath(ctx, P_, P_.col(sc3(LOOK.skin, 0.94)), () => { ctx.beginPath(); ctx.ellipse(-0.015, 0.185, 0.032, 0.042, 0, 0, Math.PI * 2); });
    // hair: a swept quiff
    fillPath(ctx, P_, P_.col(LOOK.hair), () => {
      ctx.beginPath();
      ctx.moveTo(-0.13, 0.1);
      ctx.bezierCurveTo(-0.2, 0.3, -0.06, 0.42, 0.08, 0.39);
      ctx.bezierCurveTo(0.17, 0.38, 0.23, 0.33, 0.21, 0.27);
      ctx.quadraticCurveTo(0.16, 0.31, 0.1, 0.285);
      ctx.quadraticCurveTo(0.03, 0.3, 0.0, 0.23);
      ctx.quadraticCurveTo(-0.04, 0.19, -0.06, 0.13);
      ctx.quadraticCurveTo(-0.09, 0.1, -0.13, 0.1);
      ctx.closePath();
    });
    // glasses
    const blink = !reduceMotion && (time % 3.7) < 0.12;
    ctx.fillStyle = P_.ink;
    if (P_.detail) {
      if (blink) { ctx.fillRect(0.11, 0.2, 0.035, 0.008); } else { ctx.beginPath(); ctx.arc(0.13, 0.205, 0.014, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = P_.ink; ctx.lineWidth = P_.o * 1.1;
      ctx.beginPath(); ctx.arc(0.125, 0.205, 0.052, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.074, 0.215); ctx.lineTo(0.0, 0.225); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.17, 0.105); ctx.quadraticCurveTo(0.15, 0.09, 0.125, 0.1); ctx.stroke();
    } else { ctx.beginPath(); ctx.arc(0.13, 0.205, 0.03, 0, Math.PI * 2); ctx.fill(); }
  }
  function torsoSide(ctx, P_) {
    fillPath(ctx, P_, P_.col(LOOK.hoodD), () => { ctx.beginPath(); ctx.ellipse(-0.08, 0.43, 0.095, 0.06, 0.4, 0, Math.PI * 2); });
    fillPath(ctx, P_, P_.col(LOOK.hood), () => {
      ctx.beginPath();
      ctx.moveTo(-0.13, -0.08);
      ctx.bezierCurveTo(-0.18, 0.1, -0.17, 0.33, -0.1, 0.43);
      ctx.quadraticCurveTo(-0.02, 0.5, 0.07, 0.46);
      ctx.bezierCurveTo(0.135, 0.42, 0.155, 0.3, 0.145, 0.15);
      ctx.lineTo(0.13, -0.08);
      ctx.quadraticCurveTo(0, -0.11, -0.13, -0.08);
      ctx.closePath();
    });
    if (P_.detail) {
      ctx.strokeStyle = P_.ink; ctx.lineWidth = P_.o * 0.8; ctx.globalAlpha *= 0.6;
      ctx.beginPath(); ctx.moveTo(0.02, 0.02); ctx.quadraticCurveTo(0.08, 0.1, 0.14, 0.08); ctx.stroke();
      ctx.globalAlpha /= 0.6;
      ctx.strokeStyle = P_.col(LOOK.string); ctx.lineWidth = 0.012;
      ctx.beginPath(); ctx.moveTo(0.085, 0.43); ctx.lineTo(0.1, 0.31); ctx.stroke();
    }
    // headphones round the neck
    stroke2(ctx, P_, [[-0.07, 0.47], [0.0, 0.5], [0.08, 0.47]], 0.028, P_.col(LOOK.band));
    fillPath(ctx, P_, P_.col(LOOK.cup), () => { ctx.beginPath(); ctx.ellipse(0.075, 0.45, 0.04, 0.05, 0.2, 0, Math.PI * 2); });
  }
  function armSide(ctx, P_, sgn, far) {
    const work = ps.work;
    let a1 = Math.cos(Math.PI * ps.phase) * 0.45 * ps.move * sgn, a2 = a1 + 0.25 + 0.2 * ps.move;
    if (!far && work > 0) {
      const wig = reduceMotion ? 0 : Math.sin(time * 5) * 0.06;
      a1 = lerp(a1, 1.25, work); a2 = lerp(a2, 1.9 + wig, work);
    }
    const sh = [0.0, 0.39];
    const el = [sh[0] + Math.sin(a1) * 0.25, sh[1] - Math.cos(a1) * 0.25];
    const hd = [el[0] + Math.sin(a2) * 0.23, el[1] - Math.cos(a2) * 0.23];
    stroke2(ctx, P_, [sh, el, hd], 0.085, P_.col(far ? LOOK.hoodD : LOOK.hood));
    fillPath(ctx, P_, P_.col(LOOK.skin), () => { ctx.beginPath(); ctx.arc(hd[0], hd[1], 0.036, 0, Math.PI * 2); });
    if (!far && work > 0.5 && P_.detail) { ctx.strokeStyle = P_.ink; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(hd[0], hd[1]); ctx.lineTo(hd[0] + 0.06, hd[1] + 0.08); ctx.stroke(); }
  }
  function drawSide(ctx, P_, feet) {
    const lean = (0.03 + ps.slope * 0.1) * ps.move + 0.01 + ps.work * 0.06;
    const hip = [0, -0.02];
    const legs = feet.map(f => ik(hip, [f[0], f[1] + 0.055], 0.36, 0.36, 1));
    armSide(ctx, P_, -1, true);
    stroke2(ctx, P_, [hip, legs[1].knee, legs[1].end], 0.105, P_.col(sc3(LOOK.pants, 0.8)));
    shoeSide(ctx, P_, legs[1].end, true);
    stroke2(ctx, P_, [hip, legs[0].knee, legs[0].end], 0.11, P_.col(LOOK.pants));
    shoeSide(ctx, P_, legs[0].end, false);
    ctx.save(); ctx.rotate(-lean);
    const breath = reduceMotion ? 0 : Math.sin(time * 1.7) * 0.004;
    ctx.translate(0, breath);
    torsoSide(ctx, P_);
    ctx.save(); ctx.translate(0.02, 0.47); ctx.rotate(ps.tilt); headSide(ctx, P_); ctx.restore();
    armSide(ctx, P_, 1, false);
    ctx.restore();
  }
  function legsFront(ctx, P_, feet, back) {
    feet.forEach((f, i) => {
      const hx = i === 0 ? 0.08 : -0.08;
      const hip = [hx, -0.02], ank = [f[0], f[1] + 0.055];
      stroke2(ctx, P_, [hip, [lerp(hx, ank[0], 0.5) + (i === 0 ? 0.01 : -0.01), lerp(hip[1], ank[1], 0.5)], ank], 0.11, P_.col(i === 0 ? LOOK.pants : sc3(LOOK.pants, 0.9)));
      fillPath(ctx, P_, P_.col(LOOK.shoe), () => { ctx.beginPath(); ctx.ellipse(ank[0], ank[1] - 0.03, 0.065, 0.04, 0, 0, Math.PI * 2); });
    });
    void back;
  }
  function torsoFront(ctx, P_, back) {
    fillPath(ctx, P_, P_.col(LOOK.hood), () => {
      ctx.beginPath();
      ctx.moveTo(-0.16, -0.08); ctx.lineTo(0.16, -0.08);
      ctx.bezierCurveTo(0.19, 0.12, 0.2, 0.3, 0.17, 0.39);
      ctx.quadraticCurveTo(0.12, 0.47, 0.05, 0.47); ctx.lineTo(-0.05, 0.47);
      ctx.quadraticCurveTo(-0.12, 0.47, -0.17, 0.39);
      ctx.bezierCurveTo(-0.2, 0.3, -0.19, 0.12, -0.16, -0.08); ctx.closePath();
    });
    if (back) {
      fillPath(ctx, P_, P_.col(LOOK.hoodD), () => { ctx.beginPath(); ctx.moveTo(-0.12, 0.45); ctx.quadraticCurveTo(0, 0.22, 0.12, 0.45); ctx.quadraticCurveTo(0, 0.5, -0.12, 0.45); ctx.closePath(); });
    } else if (P_.detail) {
      ctx.strokeStyle = P_.ink; ctx.lineWidth = P_.o * 0.8; ctx.globalAlpha *= 0.55;
      ctx.beginPath(); ctx.moveTo(-0.09, 0.0); ctx.lineTo(-0.1, 0.1); ctx.lineTo(0.1, 0.1); ctx.lineTo(0.09, 0.0); ctx.stroke();
      ctx.globalAlpha /= 0.55;
      ctx.strokeStyle = P_.col(LOOK.string); ctx.lineWidth = 0.012;
      ctx.beginPath(); ctx.moveTo(-0.035, 0.44); ctx.lineTo(-0.04, 0.3); ctx.moveTo(0.035, 0.44); ctx.lineTo(0.04, 0.3); ctx.stroke();
    }
    stroke2(ctx, P_, [[-0.12, 0.47], [0, 0.43], [0.12, 0.47]], 0.03, P_.col(LOOK.band));
    if (!back) for (const s of [-1, 1]) fillPath(ctx, P_, P_.col(LOOK.cup), () => { ctx.beginPath(); ctx.ellipse(s * 0.13, 0.46, 0.045, 0.052, 0, 0, Math.PI * 2); });
  }
  function headFront(ctx, P_, back) {
    stroke2(ctx, P_, [[0, 0.46], [0, 0.53]], 0.075, P_.col(LOOK.skin));
    for (const s of [-1, 1]) fillPath(ctx, P_, P_.col(sc3(LOOK.skin, 0.94)), () => { ctx.beginPath(); ctx.ellipse(s * 0.162, 0.645, 0.032, 0.042, 0, 0, Math.PI * 2); });
    fillPath(ctx, P_, P_.col(LOOK.skin), () => { ctx.beginPath(); ctx.arc(0, 0.665, 0.165, 0, Math.PI * 2); });
    if (back) {
      fillPath(ctx, P_, P_.col(LOOK.hair), () => { ctx.beginPath(); ctx.arc(0, 0.69, 0.168, Math.PI * 1.08, Math.PI * 1.92, true); ctx.quadraticCurveTo(0, 0.55, -0.155, 0.62); ctx.closePath(); });
      return;
    }
    fillPath(ctx, P_, P_.col(LOOK.hair), () => {
      ctx.beginPath();
      ctx.moveTo(-0.17, 0.64);
      ctx.bezierCurveTo(-0.2, 0.88, 0.1, 0.93, 0.19, 0.76);
      ctx.quadraticCurveTo(0.2, 0.68, 0.17, 0.62);
      ctx.quadraticCurveTo(0.14, 0.72, 0.06, 0.73);
      ctx.quadraticCurveTo(-0.06, 0.77, -0.12, 0.7);
      ctx.quadraticCurveTo(-0.15, 0.66, -0.17, 0.64);
      ctx.closePath();
    });
    if (!P_.detail) return;
    const blink = !reduceMotion && (time % 3.7) < 0.12;
    ctx.fillStyle = P_.ink; ctx.strokeStyle = P_.ink; ctx.lineWidth = P_.o * 1.1;
    for (const s of [-1, 1]) {
      if (blink) ctx.fillRect(s * 0.065 - 0.018, 0.655, 0.036, 0.008); else { ctx.beginPath(); ctx.arc(s * 0.065, 0.66, 0.014, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.arc(s * 0.065, 0.66, 0.05, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-0.017, 0.665); ctx.quadraticCurveTo(0, 0.675, 0.017, 0.665); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0.6, 0.04, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  }
  function armsFront(ctx, P_, back) {
    for (const s of [-1, 1]) {
      const sw = Math.cos(Math.PI * ps.phase) * 0.05 * ps.move * s;
      const sh = [s * 0.17, 0.38], el = [s * 0.2, 0.13 + sw], hd = [s * 0.205, -0.09 + sw * 1.5];
      stroke2(ctx, P_, [sh, el, hd], 0.085, P_.col(LOOK.hood));
      if (!back) fillPath(ctx, P_, P_.col(LOOK.skin), () => { ctx.beginPath(); ctx.arc(hd[0], hd[1], 0.036, 0, Math.PI * 2); });
    }
  }
  function drawFront(ctx, P_, feet) { legsFront(ctx, P_, feet, false); torsoFront(ctx, P_, false); armsFront(ctx, P_, false); headFront(ctx, P_, false); }
  function drawBack(ctx, P_, feet) { legsFront(ctx, P_, feet, true); armsFront(ctx, P_, true); torsoFront(ctx, P_, true); headFront(ctx, P_, true); }

  // ================================================================ painter's order
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
      if (O.solid && O.max[1] <= Pp.min[1] + 0.3) return after;
      if (O.draw === drawFlight && ((O.back && Pp.c[2] < -0.1) || (!O.back && Pp.c[2] > 0.1))) return after;
      const r = relBase(A, Bb);
      return r !== 0 ? r : after;
    }
    return relBase(A, Bb);
  }

  const visible = [];
  function drawScene(ctx) {
    ctx.clearRect(0, 0, W, Hh);
    visible.length = 0;
    const pad = 30;
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
      if (!it.ground && !behind && (x1 - x0) < 0.6 && (y1 - y0) < 0.6) continue;
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
    drawNightLights(ctx);
  }

  function drawNightLights(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const lp of lamps) {
      const I = lampI(lp); if (I < 0.02) continue;
      const c = project(lp.p); if (!c) continue;
      const r = pxSize(lp.kind === 'workshop' ? 3.2 : lp.kind === 'board' ? 1.2 : 3.6, lp.p);
      if (r < 2) continue;
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r);
      g.addColorStop(0, css([1, 0.84, 0.62], 0.2 * I)); g.addColorStop(1, css([1, 0.8, 0.55], 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, Math.PI * 2); ctx.fill();
    }
    // step lights along the outer stringers
    if (env.lamp > 0.02) {
      for (let k = 0; k < NF; k++) {
        const back = k % 2 === 0, dir = back ? 1 : -1, x0 = back ? XL : XR, y0 = k * FR, z = back ? -3.62 : 3.62;
        for (let i = 1; i < NR; i += 3) {
          const x = x0 + dir * i * RUNS, y = y0 + i * RISE + 0.3;
          const p = project([x, y, z]); if (!p) continue;
          const r = pxSize(0.9, [x, y, z]);
          ctx.fillStyle = css([1, 0.84, 0.6], env.lamp * 0.9);
          ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(0.7, r * 0.08), 0, Math.PI * 2); ctx.fill();
          if (r > 3) { const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r); g.addColorStop(0, css([1, 0.8, 0.55], 0.28 * env.lamp)); g.addColorStop(1, css([1, 0.8, 0.55], 0)); ctx.fillStyle = g; ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); }
        }
      }
    }
    // street lights along the boulevard
    if (env.lamp > 0.02) {
      for (let x = Math.floor((cam.p[0] - 200) / 16) * 16; x < cam.p[0] + 200; x += 16) for (const z of [15.2, 25.8]) {
        const p = project([x, 5, z]); if (!p) continue;
        const r = Math.min(46, pxSize(2.2, [x, 5, z])); if (r < 1) continue;
        const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
        g.addColorStop(0, css([1, 0.85, 0.6], 0.32 * env.lamp)); g.addColorStop(1, css([1, 0.85, 0.6], 0));
        ctx.fillStyle = g; ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
      }
    }
    ctx.restore();
  }

  // ================================================================ sky and distance
  const stars = Array.from({ length: 160 }, (_, i) => { const r = rng(1000 + i); const az = (r() - 0.5) * 2.6, el = 0.03 + Math.pow(r(), 0.8) * 1.1; return { d: [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)], m: 0.25 + r() * 0.6, s: r() * 10 }; });
  const clouds = Array.from({ length: 9 }, (_, i) => {
    const r = rng(300 + i);
    return { x: (r() - 0.5) * 1400, y: 70 + r() * 150, z: -500 - r() * 500, puffs: Array.from({ length: 6 + Math.floor(r() * 5) }, () => [(r() - 0.5) * 90, r() * 10, 12 + r() * 16]), v: 0.8 + r() * 1.2 };
  });
  const ridge = (x, f, s) => 0.55 + 0.25 * Math.sin(x * f + s) + 0.13 * Math.sin(x * f * 2.3 + s * 1.7) + 0.07 * Math.sin(x * f * 5.1 + s * 3.1);

  function drawSky(ctx) {
    const hz = projDir([0, 0, -1]);
    const hy = hz ? hz[1] : Hh / 2;
    const g = ctx.createLinearGradient(0, hy - Hh * 1.3, 0, hy);
    g.addColorStop(0, css(env.sky0)); g.addColorStop(0.62, css(env.sky1)); g.addColorStop(1, css(env.sky2));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
    ctx.fillStyle = css(env.sky2); ctx.fillRect(0, hy, W, Hh - hy + 2);
    // sunlight from the upper left
    if (env.day > 0.01) {
      const s = ctx.createRadialGradient(W * 0.08, hy - Hh * 0.9, 0, W * 0.08, hy - Hh * 0.9, Math.max(W, Hh) * 1.1);
      s.addColorStop(0, css([1, 0.93, 0.8], 0.55 * env.day)); s.addColorStop(1, css([1, 0.93, 0.8], 0));
      ctx.fillStyle = s; ctx.fillRect(0, 0, W, Hh);
    }
    if (env.night > 0.3) {
      for (const st of stars) {
        const p = projDir(st.d); if (!p || p[1] > hy - 6) continue;
        const tw = reduceMotion ? 1 : 0.7 + 0.3 * Math.sin(time * (0.5 + st.m) + st.s);
        ctx.fillStyle = css([0.96, 0.94, 0.9], smooth(0.3, 1, env.night) * st.m * tw);
        ctx.fillRect(p[0] - 0.5, p[1] - 0.5, 1, 1);
      }
      const m = projDir(norm([-0.45, 0.55, -1]));
      if (m) { ctx.fillStyle = css([0.95, 0.93, 0.86], smooth(0.3, 1, env.night)); ctx.beginPath(); ctx.arc(m[0], m[1], Math.min(W, Hh) * 0.018, 0, Math.PI * 2); ctx.fill(); }
    }
    // high clouds
    for (const c of clouds) {
      const span = 2000;
      let x = c.x + (reduceMotion ? 0 : time * c.v);
      x = ((x - cam.p[0] + span / 2) % span + span) % span - span / 2 + cam.p[0];
      for (const [col, oy] of [[env.cloudS, -1.8], [env.cloud, 0]]) {
        ctx.fillStyle = css(col, lerp(0.95, 0.5, env.night));
        ctx.beginPath();
        for (const [px, py, pr] of c.puffs) {
          const p = project([x + px, c.y + py + oy, c.z]); if (!p) continue;
          const r = pr * cam.focal / (cam.p[2] - c.z);
          ctx.moveTo(p[0] + r, p[1]); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }
    // hills and two depths of skyline
    band(ctx, -1400, env.hill, 0.7, (X) => -10 + 120 * ridge(X, 1 / 300, 1.3));
    band(ctx, -800, env.far, 0.55, (X) => { const c = Math.floor(X / 22); return hash(c) > 0.25 ? 18 + hash(c + 1) * 60 + (hash(c + 2) > 0.9 ? 50 : 0) : 8; }, true);
    band(ctx, -420, env.near, 0.42, (X) => { const c = Math.floor(X / 16); return hash(c + 50) > 0.2 ? 14 + hash(c + 51) * 40 + (hash(c + 52) > 0.92 ? 40 : 0) : 6; }, true);
  }
  function band(ctx, z, col, fade, hfn, blocky) {
    const D = cam.p[2] - z;
    const c = mix3(col, env.sky2, fade * 0.5);
    ctx.fillStyle = css(c);
    ctx.beginPath();
    let first = true;
    const step = blocky ? 3 : 8;
    for (let sx = -40; sx <= W + 40; sx += step) {
      const X = cam.p[0] + (sx - cam.cx) * D / cam.focal;
      const p = project([X, hfn(X), z]); if (!p) continue;
      if (first) { ctx.moveTo(p[0], Hh + 10); ctx.lineTo(p[0], p[1]); first = false; } else ctx.lineTo(p[0], p[1]);
    }
    ctx.lineTo(W + 40, Hh + 10); ctx.closePath(); ctx.fill();
    if (blocky && env.lamp > 0.05) {
      ctx.fillStyle = css([1, 0.82, 0.55], env.lamp * 0.6);
      for (let sx = 0; sx < W; sx += 5) {
        const X = cam.p[0] + (sx - cam.cx) * D / cam.focal, h = hfn(X);
        for (let yy = 4; yy < h - 2; yy += 7) {
          if (hash(Math.floor(X) * 7 + yy) < 0.9) continue;
          const p = project([X, yy, z]); if (p) ctx.fillRect(p[0], p[1], 1.2, 1.2);
        }
      }
    }
  }

  // ================================================================ timeline
  function readScroll() { return clamp(scrollY / Math.max(1, innerHeight * VH_PER_P), 0, END); }
  const scrollFor = p => p * innerHeight * VH_PER_P;
  const walk = (a, b, q0, q1, x) => lerp(q0, q1, easeSine(clamp((x - a) / (b - a), 0, 1)));
  const qFor = p => (p < 6 ? walk(0.32, 2.6, STOP[0], STOP[1], p) : walk(6.85, 8.3, STOP[1], STOP[2], p));

  function updateTimeline(p) {
    sheetState.draw = smooth(3.15, 3.95, p);
    sheetState.grid = smooth(4.35, 4.95, p);
    sheetState.wire = smooth(4.75, 5.6, p);
    sheetState.ui = smooth(5.45, 6.2, p);
    ps.work = smooth(2.62, 2.85, p) * (1 - smooth(6.6, 6.85, p));
    ps.tilt = p < 0.6 ? 0.22 * (1 - smooth(0.2, 0.6, p)) : 0;
    const wl = lamps.find(l => l.kind === 'workshop');
    wl.boost = 0.35 * smooth(2.2, 2.7, p) * (1 - smooth(7.2, 7.8, p));
  }

  // Camera shots. Each returns [position, target] for the current frame.
  const SHOTS = {
    hero: () => portrait ? [[0, 3, 60], [0, 31, 0]] : [[0, 4, 88], [0, 27.5, 0]],
    follow: () => {
      const lead = 1.1 * Math.cos(ps.hd) * ps.move;
      const tx = lerp(ps.hip[0], 0, 0.25) + lead;
      const t = [tx, ps.ground + 1.1, ps.hip[2] * 0.5];
      return [[tx * 0.9, ps.ground + 5.2, t[2] + (portrait ? 21 : 15.5)], t];
    },
    wide: () => {
      const t = [ps.hip[0] * 0.25, ps.ground + 3, 0];
      return [[t[0], ps.ground + 9, portrait ? 60 : 44], t];
    },
    approach: () => portrait ? [[-13.6, NSUT_Y + 3.8, 14.5], [-14.4, NSUT_Y + 1.1, -1.5]] : [[-12.6, NSUT_Y + 3.4, 13.5], [-14.1, NSUT_Y + 1.2, -2]],
    desk: () => portrait ? [[-14.6, NSUT_Y + 1.8, 3.6], [-14.9, NSUT_Y + 1.2, -1.1]] : [[-14.5, NSUT_Y + 1.75, 3.3], [-14.9, NSUT_Y + 1.2, -1.2]],
    drawing: () => {
      const b = board, d = portrait ? 0.62 : 1.06;
      const pan = portrait ? lerp(-0.27, 0.37, smooth(4.9, 5.7, P)) : 0;
      const c = add3(b.c, sc3(b.u, pan));
      return [add3(c, sc3(b.n, d)), c];
    },
    farEnd: () => portrait ? [[4, 16, 72], [4, 17.5, 0]] : [[4.5, 15.5, 52], [4.5, 16.8, 0]],
  };
  const KEYS = [
    [0.0, 'hero'], [0.22, 'hero'], [1.1, 'follow'], [1.45, 'follow'], [1.75, 'wide'], [2.0, 'follow'],
    [2.25, 'approach'], [2.7, 'approach'], [3.0, 'desk'], [3.35, 'drawing'], [6.45, 'drawing'],
    [6.8, 'desk'], [7.05, 'approach'], [7.45, 'follow'], [8.1, 'follow'], [8.75, 'farEnd'], [9.0, 'farEnd'],
  ];
  function desiredCamera(p) {
    let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const [p0, s0] = KEYS[i], [p1, s1] = KEYS[i + 1];
    const t = easeInOut(clamp((p - p0) / (p1 - p0), 0, 1));
    const A = SHOTS[s0](), Bs = SHOTS[s1]();
    return [mix3(A[0], Bs[0], t), mix3(A[1], Bs[1], t)];
  }

  // ================================================================ HUD
  const root = document.documentElement;
  const heroLines = [...document.querySelectorAll('.hero .ln')];
  const heroEl = document.getElementById('hero');
  const cue = document.getElementById('cue');
  const story = document.getElementById('story'), storyK = document.getElementById('storyK'), storyT = document.getElementById('storyT');
  const crumb = document.getElementById('crumb');
  const chap = document.getElementById('chap'), next = document.getElementById('next');
  const mMark = document.getElementById('mMark'), mRead = document.getElementById('mRead'), mScale = document.getElementById('mScale');

  const STORY = [
    { a: 3.55, b: 4.4, k: 'NSUT · Mechanical Engineering', t: 'I started by learning how things work.' },
    { a: 4.8, b: 5.55, k: 'Somewhere between the drawings', t: 'Eventually, I became more interested in why people use them.' },
    { a: 5.95, b: 6.7, k: 'The first step', t: 'That’s where I discovered UX.' },
  ];
  const TOP = NEXT_Y;
  for (let i = 0; i <= 30; i++) { const t = document.createElement('i'); t.style.bottom = (i / 30 * 100) + '%'; mScale.appendChild(t); }
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => goTo(+b.dataset.go)));

  let tween = null;
  function goTo(p) {
    const to = scrollFor(p), from = scrollY;
    if (reduceMotion) { scrollTo(0, to); return; }
    tween = { from, to, t0: performance.now(), dur: clamp(900 + Math.abs(to - from) / innerHeight * 240, 1000, 3600) };
  }
  ['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, () => { tween = null; }, { passive: true }));

  function place(el, world, dx = 0, dy = 0) {
    const s = project(world); if (!s) return false;
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.transform = `translate3d(${clamp(s[0] + dx, 16, W - w - 16).toFixed(1)}px, ${clamp(s[1] + dy, 76, Hh - h - 24).toFixed(1)}px, 0)`;
    return true;
  }

  let lastStory = -1, lastCrumb = '';
  function updateHud(p) {
    heroLines.forEach((el, i) => {
      const t = smooth(0.02 + i * 0.03, 0.12 + i * 0.03, p);
      el.style.opacity = (1 - t).toFixed(3);
      el.style.transform = t > 0 ? `translate3d(0, ${(-t * 40).toFixed(1)}px, 0)` : '';
      el.style.filter = t > 0.01 ? `blur(${(t * 6).toFixed(1)}px)` : '';
    });
    heroEl.toggleAttribute('data-gone', p > 0.25);
    cue.style.opacity = (1 - smooth(0, 0.05, p)).toFixed(3);

    // story lines
    let si = -1, sa = 0;
    STORY.forEach((s, i) => { const a = smooth(s.a, s.a + 0.18, p) * (1 - smooth(s.b - 0.18, s.b, p)); if (a > sa) { sa = a; si = i; } });
    if (si !== lastStory && si >= 0) { storyK.textContent = STORY[si].k; storyT.textContent = STORY[si].t; lastStory = si; }
    story.style.opacity = sa.toFixed(3);
    story.style.transform = `translate3d(-50%, ${((1 - sa) * 14).toFixed(1)}px, 0)`;
    story.toggleAttribute('data-off', sa < 0.01);

    // chapter tag on the facade, then the next landing
    const ca = smooth(2.15, 2.5, p) * (1 - smooth(3.0, 3.3, p)) + smooth(6.9, 7.2, p) * (1 - smooth(7.5, 7.8, p));
    chap.style.opacity = ca.toFixed(3); chap.toggleAttribute('data-off', ca < 0.01);
    if (ca > 0.01) place(chap, [-18.5, NSUT_Y + 5.6, 0.5]);
    const na = smooth(8.35, 8.75, p);
    next.style.opacity = na.toFixed(3); next.toggleAttribute('data-off', na < 0.01);
    if (na > 0.01) place(next, [LX + 1.6, NEXT_Y + 4.6, 0]);

    // where am I
    const label = p < 0.3 ? 'The Climb' : p < 2.2 ? 'Climbing · Chapter 01 ahead' : p < 6.85 ? 'Chapter 01 · NSUT' : 'Climbing · Chapter 02 ahead';
    if (label !== lastCrumb) { crumb.textContent = label; lastCrumb = label; }
    crumb.style.opacity = smooth(0.15, 0.4, p).toFixed(3);

    const el = clamp(ps.ground, 0, TOP);
    mMark.style.bottom = (el / TOP * 100).toFixed(2) + '%';
    mRead.textContent = '+' + el.toFixed(1) + ' m';
    mRead.style.opacity = (Math.abs(el - NSUT_Y) < 1.6 || el < 0.8 || el > TOP - 0.8) ? 0 : 1;
  }

  // ================================================================ theme
  const mqDark = matchMedia('(prefers-color-scheme: dark)');
  const themeBtn = document.getElementById('theme');
  const isDark = () => { const t = root.getAttribute('data-theme'); return t ? t === 'dark' : mqDark.matches; };
  let night = isDark() ? 1 : 0;
  const syncThemeLabel = () => themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
  themeBtn.addEventListener('click', () => {
    const nx = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', nx);
    try { localStorage.setItem('ascent-theme', nx); } catch (e) {}
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

  // ================================================================ loop
  let P = 0, time = 0;
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
    P = reduceMotion ? target : P + (target - P) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(target - P) < 2e-5) P = target;
    idle = Math.abs(target - P) < 4e-4 ? idle + dt : 0;

    const q = qFor(P);
    const qT = idle > 0.3 ? Math.round(q) : q;
    const prevQ = qDisp;
    qDisp = reduceMotion ? qT : qDisp + (qT - qDisp) * (1 - Math.exp(-dt * 7));
    const speed = Math.abs(qDisp - prevQ) / Math.max(dt, 1e-3);
    ps.move = lerp(ps.move, clamp(speed / 1.6, 0, 1), 1 - Math.exp(-dt * 6));

    updateTimeline(P);
    poseAt(qDisp);
    updateView(dt);
    updateCars();
    night += ((isDark() ? 1 : 0) - night) * (1 - Math.exp(-dt * (reduceMotion ? 60 : 2.6)));
    computeEnv(night);

    const [dp, dtg] = desiredCamera(P);
    if (!camP || reduceMotion) { camP = dp; camT = dtg; }
    const k = 1 - Math.exp(-dt * 3.2);
    camP = mix3(camP, dp, k); camT = mix3(camT, dtg, k);
    const sway = reduceMotion ? 0 : 1;
    const dist = Math.hypot(...sub(camP, camT));
    const drift = [Math.sin(time * 0.23) * 0.004 * dist * sway, Math.sin(time * 0.17) * 0.003 * dist * sway, 0];
    aim(add3(camP, drift), camT);

    drawSky(cSky);
    drawScene(cScene);
    updateHud(P);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
