(() => {
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const onView = (el, fn, threshold = 0.35) => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { fn(); o.disconnect(); } }, { threshold });
    o.observe(el);
  };

  /* Reveal on scroll */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.2, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal, .cta-card").forEach((el) => io.observe(el));

  /* Nav hides on scroll down */
  const nav = document.querySelector(".nav");
  let lastY = 0;
  addEventListener("scroll", () => {
    nav.classList.toggle("hide", scrollY > lastY && scrollY > 240);
    lastY = scrollY;
  }, { passive: true });

  /* Mouse shine + tilt */
  document.querySelectorAll(".shine-card").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      el.style.setProperty("--mx", x + "px");
      el.style.setProperty("--my", y + "px");
      if (el.classList.contains("tall")) {
        el.style.setProperty("--tx", ((x / r.width) - 0.5) * 10 + "deg");
        el.style.setProperty("--ty", (0.5 - (y / r.height)) * 10 + "deg");
      }
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--tx", "0deg");
      el.style.setProperty("--ty", "0deg");
    });
  });

  /* Magnetic buttons */
  if (fine) document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });

  /* Parallax for floating art */
  const layers = document.querySelectorAll(".depth");
  if (fine) addEventListener("pointermove", (e) => {
    const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
    layers.forEach((l) => {
      const d = +l.dataset.depth;
      l.style.setProperty("--px", nx * d + "px");
      l.style.setProperty("--py", ny * d + "px");
    });
  });


  /* ============ Hero: comet on a semicircle ============ */
  const cPath = document.getElementById("cometPath");
  const cLit = document.getElementById("cometLit");
  const cTail = document.getElementById("cometTail");
  const cGlow = document.getElementById("cometGlow");
  const cCore = document.getElementById("cometCore");
  const L = cPath.getTotalLength();
  const TAIL = 34;
  const tailDots = Array.from({ length: TAIL }, (_, i) => {
    const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    c.setAttribute("r", (3.6 * (1 - i / TAIL) + 0.4).toFixed(2));
    c.setAttribute("opacity", (0.85 * Math.pow(1 - i / TAIL, 1.6)).toFixed(3));
    cTail.append(c);
    return c;
  });
  cLit.style.strokeDasharray = `220 ${L}`;
  const COMET = 7000, REST = 1400;
  const cometLoop = (now) => {
    const t = (now % (COMET + REST)) / COMET;
    const k = Math.min(t, 1), d = easeInOut(k) * L;
    const fade = k >= 1 ? 0 : Math.min(1, k * 8, (1 - k) * 8);
    const p = cPath.getPointAtLength(d);
    cGlow.setAttribute("cx", p.x); cGlow.setAttribute("cy", p.y);
    cCore.setAttribute("cx", p.x); cCore.setAttribute("cy", p.y);
    cGlow.style.opacity = cCore.style.opacity = fade;
    tailDots.forEach((c, i) => {
      const q = cPath.getPointAtLength(Math.max(0, d - i * 7));
      c.setAttribute("cx", q.x); c.setAttribute("cy", q.y);
    });
    cTail.style.opacity = fade;
    cLit.style.strokeDashoffset = -(d - 220);
    cLit.style.opacity = fade * 0.55;
    requestAnimationFrame(cometLoop);
  };
  if (!reduced) requestAnimationFrame(cometLoop);

  /* ============ Hero: slider expands as you scroll ============ */
  const redesign = document.getElementById("redesign");
  let startTop = 0;
  /* keep exactly 40% of the slider in the first viewport */
  const hero = document.querySelector(".hero");
  const frame = document.getElementById("cmpFrame");
  const fitFold = () => {
    redesign.style.marginTop = ""; hero.style.paddingTop = "";
    redesign.style.setProperty("--sp", 0);
    const base = parseFloat(getComputedStyle(redesign).marginTop) || 0;
    const pad = parseFloat(getComputedStyle(hero).paddingTop) || 0;
    /* first fold ends just below the "Browse homes" button of the redesigned site */
    const btn = redesign.querySelector(".g-btn").getBoundingClientRect();
    const btnBottom = btn.bottom + scrollY;
    const want = innerHeight - Math.max(20, innerHeight * 0.035);
    let margin = base + (want - btnBottom);
    const MIN = 72, MAX = 140;
    if (margin > MAX) { hero.style.paddingTop = pad + Math.min(90, margin - MAX) + "px"; margin = MAX; }
    redesign.style.marginTop = Math.max(MIN, margin) + "px";
    /* still too tall? start the slider a little smaller so the fold ends at the button */
    let s0 = 0.84;
    redesign.style.setProperty("--s0", s0);
    for (let i = 0; i < 4; i++) {
      const top = frame.getBoundingClientRect().top + scrollY;
      const bottom = redesign.querySelector(".g-btn").getBoundingClientRect().bottom + scrollY;
      if (bottom <= want + 1) break;
      s0 = clamp(s0 * (want - top) / (bottom - top), 0.5, 0.84);
      redesign.style.setProperty("--s0", s0.toFixed(4));
    }
  };
  const measure = () => { fitFold(); startTop = redesign.getBoundingClientRect().top + scrollY; };
  const expand = () => {
    const sp = clamp(scrollY / Math.max(1, startTop - 120), 0, 1);
    redesign.style.setProperty("--sp", (1 - Math.pow(1 - sp, 2)).toFixed(4));
  };
  measure(); expand();
  document.fonts && document.fonts.ready.then(() => { measure(); expand(); });
  addEventListener("scroll", expand, { passive: true });
  addEventListener("resize", () => { measure(); expand(); });

  /* ============ X-ray: blueprint mirrors the real page ============ */
  document.getElementById("bpContent").innerHTML = document.getElementById("xrayPage").innerHTML;

  /* ============ Live redesign slider ============ */
  const cmp = document.getElementById("cmp");
  const handle = document.getElementById("cmpHandle");
  const stamp = document.getElementById("cmpStamp");
  const status = document.getElementById("cmpStatus");
  const tagAfter = cmp.querySelector(".tag-after");
  const tagBefore = cmp.querySelector(".tag-before");
  const dCursor = document.getElementById("designCursor");
  let pos = 6, stamped = false, touched = false;

  const setPos = (p) => {
    pos = clamp(p, 0, 100);
    cmp.style.setProperty("--pos", pos + "%");
    handle.setAttribute("aria-valuenow", Math.round(pos));
    const t = pos / 100;
    tagAfter.style.opacity = clamp((pos - 10) / 10, 0, 1);
    tagBefore.style.opacity = clamp((90 - pos) / 10, 0, 1);
    status.textContent = pos > 97 ? "Redesigned" : pos < 3 ? "Built in 2009" : "Redesigning…";
    status.style.setProperty("--st", pos > 97 ? "#2FB36B" : pos < 3 ? "#E5484D" : "#E8A13A");
    if (pos > 97 && !stamped) {
      stamped = true;
      stamp.classList.add("show");
      confetti(cmp);
      setTimeout(() => stamp.classList.remove("show"), 1800);
    }
    if (pos < 90) stamp.classList.remove("show");
    if (pos < 80) stamped = false;
  };

  const fromEvent = (e) => {
    const r = cmp.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };
  let dragging = false;
  cmp.addEventListener("pointerdown", (e) => {
    dragging = true; touch();
    cmp.classList.add("dragging");
    cmp.setPointerCapture(e.pointerId);
    setPos(fromEvent(e));
  });
  cmp.addEventListener("pointermove", (e) => { if (dragging) setPos(fromEvent(e)); });
  const end = () => { dragging = false; cmp.classList.remove("dragging"); };
  cmp.addEventListener("pointerup", end);
  cmp.addEventListener("pointercancel", end);
  handle.addEventListener("keydown", (e) => {
    const step = e.shiftKey ? 10 : 4;
    if (e.key === "ArrowRight") { touch(); setPos(pos + step); e.preventDefault(); }
    if (e.key === "ArrowLeft") { touch(); setPos(pos - step); e.preventDefault(); }
    if (e.key === "Home") { touch(); setPos(0); e.preventDefault(); }
    if (e.key === "End") { touch(); setPos(100); e.preventDefault(); }
  });
  function touch() {
    touched = true;
    cmp.classList.add("touched");
    dCursor.classList.remove("show");
  }

  /* Intro: the DesignMe cursor grabs the handle and drags it across */
  const tween = (dur, fn) => new Promise((res) => {
    const t0 = performance.now();
    const step = (now) => {
      if (touched) return res(false);
      const k = clamp((now - t0) / dur, 0, 1);
      fn(easeInOut(k));
      k < 1 ? requestAnimationFrame(step) : res(true);
    };
    requestAnimationFrame(step);
  });
  const placeCursor = (x, y) => (dCursor.style.transform = `translate(${x}px, ${y}px)`);
  const intro = async () => {
    if (touched || reduced) return;
    const W = cmp.clientWidth, H = cmp.clientHeight;
    const hx = () => (pos / 100) * W, hy = H / 2 + 4;
    const sx = W * 0.72, sy = H * 0.82;
    placeCursor(sx, sy);
    dCursor.classList.add("show");
    await new Promise((r) => setTimeout(r, 500));
    if (!(await tween(1100, (k) => placeCursor(lerp(sx, hx(), k), lerp(sy, hy, k))))) return;
    cmp.classList.add("dragging");
    await new Promise((r) => setTimeout(r, 250));
    const from = pos;
    const ok = await tween(2600, (k) => { setPos(lerp(from, 62, k)); placeCursor(hx(), hy); });
    cmp.classList.remove("dragging");
    if (!ok) return;
    await tween(900, (k) => placeCursor(lerp(hx(), W * 0.86, k), lerp(hy, H * 0.3, k)));
    setTimeout(() => dCursor.classList.remove("show"), 400);
  };
  setPos(pos);
  onView(cmp, () => setTimeout(intro, 500), 0.75);

  function confetti(host) {
    const colors = ["#D9F65A", "#9AD8FF", "#C9B8FF", "#F2D7A4", "#15171C"];
    for (let i = 0; i < 26; i++) {
      const s = document.createElement("span");
      const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 180;
      s.className = "burst";
      s.style.background = colors[i % colors.length];
      s.style.setProperty("--dx", Math.cos(a) * d + "px");
      s.style.setProperty("--dy", Math.sin(a) * d + "px");
      s.style.setProperty("--rot", Math.random() * 360 + "deg");
      host.append(s);
      setTimeout(() => s.remove(), 1200);
    }
  }

  /* ============ Design X-ray lens ============ */
  const xray = document.getElementById("xrayBox");
  let lx = 0, ly = 0, tx = 0, ty = 0, hovering = false, rr = 0, tr = 0;
  const lensR = () => Math.max(90, xray.clientWidth * 0.15);
  xray.addEventListener("pointerenter", () => { hovering = true; tr = lensR(); });
  xray.addEventListener("pointerleave", () => { hovering = false; });
  xray.addEventListener("pointermove", (e) => {
    const r = xray.getBoundingClientRect();
    tx = e.clientX - r.left; ty = e.clientY - r.top;
  });
  xray.addEventListener("pointerdown", (e) => {
    const r = xray.getBoundingClientRect();
    tx = e.clientX - r.left; ty = e.clientY - r.top; hovering = true; tr = lensR();
  });
  let xrayOn = false;
  onView(xray, () => { xrayOn = true; lx = xray.clientWidth * 0.3; ly = xray.clientHeight * 0.45; tr = lensR(); }, 0.3);
  const lensLoop = (now) => {
    if (xrayOn) {
      if (!hovering) {
        const W = xray.clientWidth, H = xray.clientHeight, t = now / 1000;
        tx = W * (0.5 + 0.34 * Math.sin(t * 0.45));
        ty = H * (0.5 + 0.26 * Math.sin(t * 0.8 + 1));
      }
      lx += (tx - lx) * 0.14; ly += (ty - ly) * 0.14; rr += (tr - rr) * 0.12;
      xray.style.setProperty("--lx", lx + "px");
      xray.style.setProperty("--ly", ly + "px");
      xray.style.setProperty("--r", rr + "px");
    }
    requestAnimationFrame(lensLoop);
  };
  requestAnimationFrame(lensLoop);
  addEventListener("resize", () => { tr = lensR(); });

  /* ============ Founder story: words light up as you scroll ============ */
  const story = document.getElementById("story");
  const units = [];
  const splitWords = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(" ");
          const w = document.createElement("span");
          w.className = "sw"; w.textContent = part;
          frag.append(w); units.push(w);
        });
        n.replaceWith(frag);
      } else if (n.classList.contains("brand")) {
        n.classList.add("sw"); units.push(n);
      } else splitWords(n);
    });
  };
  splitWords(story);
  const hls = [...story.querySelectorAll(".hl")];
  const lightStory = () => {
    const r = story.getBoundingClientRect();
    const p = clamp((innerHeight * 0.82 - r.top) / (r.height + innerHeight * 0.3), 0, 1);
    const lit = Math.round(p * units.length);
    units.forEach((u, i) => u.classList.toggle("lit", i < lit));
    hls.forEach((h) => { const ws = h.querySelectorAll(".sw"); h.classList.toggle("in", ws[ws.length - 1].classList.contains("lit")); });
  };
  addEventListener("scroll", lightStory, { passive: true }); lightStory();

  /* ============ 72 hour dial (process) ============ */
  const stage = document.getElementById("stage");
  const tl = document.querySelector(".timeline");
  const fill = document.getElementById("lineFill");
  const days = tl.querySelectorAll(".day");
  const NS = "http://www.w3.org/2000/svg";
  const ticksG = document.getElementById("ticks");
  const ticks = [];
  for (let h = 0; h < 72; h++) {
    const a = (h / 72) * Math.PI * 2 - Math.PI / 2;
    const major = h % 6 === 0;
    const r1 = major ? 192 : 198, r2 = 206;
    const l = document.createElementNS(NS, "line");
    l.setAttribute("x1", 220 + Math.cos(a) * r1); l.setAttribute("y1", 220 + Math.sin(a) * r1);
    l.setAttribute("x2", 220 + Math.cos(a) * r2); l.setAttribute("y2", 220 + Math.sin(a) * r2);
    l.setAttribute("class", "tk" + (major ? " major" : ""));
    ticksG.append(l); ticks.push(l);
  }
  const C = 2 * Math.PI * 176;
  const arc = stage.querySelector(".dial-arc");
  const marker = stage.querySelector(".dial-marker");
  const nodes = stage.querySelectorAll(".dial-nodes circle");
  const hoursEl = document.getElementById("hours");
  const phaseEl = document.getElementById("phase");
  const dial = stage.querySelector(".dial");
  const milestones = stage.querySelectorAll(".milestone");
  const RUN = 6400, HOLD = 2600;
  let t0 = null, lastH = -1, running = false;

  const setHour = (h) => {
    const off = C * (1 - h / 72);
    fill.style.transform = `scaleX(${h / 72})`;
    arc.style.strokeDashoffset = off;
    marker.style.strokeDashoffset = off;
    const hi = Math.floor(h);
    if (hi === lastH) return;
    lastH = hi;
    hoursEl.textContent = hi;
    ticks.forEach((t, i) => t.classList.toggle("on", i < hi));
    nodes.forEach((n, i) => n.classList.toggle("on", hi >= i * 24));
    phaseEl.textContent = hi >= 72 ? "Live" : hi >= 48 ? "Launch" : hi >= 24 ? "Build" : "Design";
    milestones.forEach((m) => m.classList.toggle("on", hi >= +m.dataset.at));
    dial.classList.toggle("done", hi >= 72);
    days.forEach((d, i) => d.classList.toggle("on", hi >= i * 24 + (i ? 1 : 0)));
    if (hi === 72) burst();
  };

  const burst = () => {
    const colors = ["#D9F65A", "#9AD8FF", "#C9B8FF", "#F2D7A4", "#15171C"];
    for (let i = 0; i < 22; i++) {
      const s = document.createElement("span");
      const a = Math.random() * Math.PI * 2, d = 170 + Math.random() * 120;
      s.className = "burst";
      s.style.background = colors[i % colors.length];
      s.style.setProperty("--dx", Math.cos(a) * d + "px");
      s.style.setProperty("--dy", Math.sin(a) * d + "px");
      s.style.setProperty("--rot", Math.random() * 360 + "deg");
      dial.append(s);
      setTimeout(() => s.remove(), 1200);
    }
  };

  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const loop = (now) => {
    if (t0 === null) t0 = now;
    const t = now - t0;
    if (t < RUN) setHour(72 * ease(t / RUN));
    else if (t < RUN + HOLD) setHour(72);
    else { t0 = now; lastH = -1; }
    requestAnimationFrame(loop);
  };
  if (reduced) setHour(72);
  else new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; setTimeout(() => requestAnimationFrame(loop), 900); }
  }, { threshold: 0.3 }).observe(stage);

  /* Collaborator cursors wander around the stage */
  const cursors = stage.querySelectorAll(".collab.wander");
  const spots = [[160, 40], [760, 90], [300, 480], [840, 440], [480, 20], [120, 380], [700, 250], [900, 150]];
  let k = 0;
  const wander = () => {
    const sw = stage.clientWidth / 1080;
    cursors.forEach((c, i) => {
      const [x, y] = spots[(k + i * 3) % spots.length];
      c.style.transform = `translate(${x * sw}px, ${y}px)`;
    });
    k++;
  };
  wander(); setInterval(wander, 2600);

  /* ============ Testimonials ============ */
  const deck = document.getElementById("deck");
  onView(deck, () => deck.classList.add("fan"));
  deck.querySelectorAll(".t-card").forEach((c) => c.addEventListener("click", () => c.classList.toggle("flipped")));

  /* ============ CTA: launch day is today + 72 hours ============ */
  const launch = new Date(Date.now() + 72 * 3600 * 1000);
  document.getElementById("liveDay").textContent = launch.toLocaleDateString("en-US", { weekday: "long" });

  /* ============ CTA form ============ */
  document.getElementById("ctaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("sent");
  });
})();
