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

  /* ============ Live redesign slider ============ */
  const cmp = document.getElementById("cmp");
  const handle = document.getElementById("cmpHandle");
  const stamp = document.getElementById("cmpStamp");
  const status = document.getElementById("cmpStatus");
  const tagAfter = cmp.querySelector(".tag-after");
  const tagBefore = cmp.querySelector(".tag-before");
  const dCursor = document.getElementById("designCursor");
  const metrics = [
    { v: document.getElementById("mLoad"), b: document.getElementById("bLoad"), from: 6.2, to: 0.9, fmt: (x) => x.toFixed(1) + "s", good: (x) => 1 - (x - 0.9) / 5.3 },
    { v: document.getElementById("mConv"), b: document.getElementById("bConv"), from: 0.8, to: 4.6, fmt: (x) => x.toFixed(1) + "%", good: (x) => (x - 0.8) / 3.8 },
    { v: document.getElementById("mMob"), b: document.getElementById("bMob"), from: 38, to: 99, fmt: (x) => Math.round(x), good: (x) => (x - 38) / 61 },
  ];
  const heat = (g) => g < 0.34 ? "#E5484D" : g < 0.7 ? "#E8A13A" : "#2FB36B";
  let pos = 6, stamped = false, touched = false;

  const setPos = (p) => {
    pos = clamp(p, 0, 100);
    cmp.style.setProperty("--pos", pos + "%");
    handle.setAttribute("aria-valuenow", Math.round(pos));
    const t = pos / 100;
    metrics.forEach((m) => {
      const x = lerp(m.from, m.to, t), g = clamp(m.good(x), 0, 1);
      m.v.textContent = m.fmt(x);
      m.v.parentElement.style.setProperty("--mc", heat(g));
      m.b.style.width = 8 + g * 92 + "%";
    });
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
  onView(cmp, () => setTimeout(intro, 700), 0.5);

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

  /* ============ Shape your site ============ */
  const pv = document.getElementById("pv");
  const copy = pv.querySelector(".pv-copy");
  const $ = (id) => document.getElementById(id);
  const industries = {
    home:   { brand: "Verde",  url: "verdehomes.com",  kicker: "Homes in Lisbon",     h: "Find a home that feels like you.",   p: "Hand picked homes and an agent who actually calls back.", cta: "Browse homes",   nav: "Book a viewing", art: "orb",   acc: "#7CC4F5", tint: "#DCEFFF" },
    clinic: { brand: "Solace", url: "solaceclinic.com", kicker: "Family clinic",      h: "Care that fits your life.",          p: "Same week appointments with doctors who listen.",          cta: "Book a visit",   nav: "Book a visit",   art: "rings", acc: "#9C86F0", tint: "#EEE8FF" },
    law:    { brand: "Atlas",  url: "atlaslegal.com",  kicker: "Business law",        h: "Clear advice. Better outcomes.",     p: "Senior lawyers, fixed fees and answers within a day.",     cta: "Get advice",     nav: "Talk to us",     art: "bars",  acc: "#E0B25E", tint: "#FBEFD9" },
    cafe:   { brand: "Crumb",  url: "crumbcoffee.com", kicker: "Neighbourhood café",  h: "Slow coffee for fast mornings.",     p: "Fresh pastries at seven. Your usual, remembered.",          cta: "See the menu",   nav: "Order ahead",    art: "orb",   acc: "#F29A6B", tint: "#FFE9DC" },
    saas:   { brand: "Pulse",  url: "pulse.app",       kicker: "Analytics for teams", h: "Reports your team will actually read.", p: "Connect your tools and get one clear weekly story.",   cta: "Start free",     nav: "Sign in",        art: "bars",  acc: "#9BD24A", tint: "#EDF8D6" },
  };
  const moods = {
    calm:    { type: "SF Pro Semibold", radius: "18px", bg: "#F7F6F2" },
    bold:    { type: "SF Pro Heavy",    radius: "6px",  bg: "#111317" },
    playful: { type: "SF Pro Rounded",  radius: "40px", bg: null },
  };
  let ind = "home", mood = "calm";

  const applyShape = (animate = true) => {
    const d = industries[ind], m = moods[mood];
    pv.style.setProperty("--acc", d.acc);
    pv.style.setProperty("--tint", d.tint);
    pv.dataset.mood = mood;
    pv.dataset.art = d.art;
    $("specSw").style.setProperty("--acc", d.acc);
    $("specColor").textContent = (m.bg || d.tint).toUpperCase();
    $("specType").textContent = m.type;
    $("specRadius").textContent = m.radius;
    $("pvUrl").textContent = d.url;
    $("pvBrand").textContent = d.brand;
    $("pvNavCta").textContent = d.nav;
    $("pvCta").textContent = d.cta;
    const setText = () => { $("pvKicker").textContent = d.kicker; $("pvH").textContent = d.h; $("pvP").textContent = d.p; };
    if (!animate) return setText();
    copy.classList.add("swap");
    setTimeout(() => { setText(); copy.classList.remove("swap"); }, 260);
  };

  const segs = [["segIndustry", (v) => (ind = v)], ["segMood", (v) => (mood = v)]];
  const movePill = (seg) => {
    const on = seg.querySelector("button.on"), pill = seg.querySelector(".seg-pill");
    pill.style.width = on.offsetWidth + "px";
    pill.style.transform = `translateX(${on.offsetLeft}px)`;
  };
  segs.forEach(([id, set]) => {
    const seg = $(id);
    seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      set(b.dataset.v); movePill(seg); applyShape();
    }));
  });
  const pickRandom = (id, current) => {
    const opts = [...$(id).querySelectorAll("button")].filter((b) => b.dataset.v !== current);
    return opts[Math.floor(Math.random() * opts.length)];
  };
  $("shuffle").addEventListener("click", () => {
    const a = pickRandom("segIndustry", ind), b = Math.random() < 0.75 ? pickRandom("segMood", mood) : null;
    a.click(); if (b) b.click();
  });
  const layoutPills = () => segs.forEach(([id]) => movePill($(id)));
  layoutPills();
  addEventListener("resize", layoutPills);
  document.fonts && document.fonts.ready.then(layoutPills);
  applyShape(false);

  /* ============ Process line fill ============ */
  const tl = document.querySelector(".timeline");
  const fill = document.getElementById("lineFill");
  const days = tl.querySelectorAll(".day");
  const onScroll = () => {
    const r = tl.getBoundingClientRect();
    const p = clamp((innerHeight * 0.7 - r.top) / (r.height + innerHeight * 0.2), 0, 1);
    fill.style.transform = `scaleX(${p})`;
    days.forEach((d, i) => d.classList.toggle("on", p >= i / 2 - 0.001 && p > 0.02));
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ============ Testimonials ============ */
  const deck = document.getElementById("deck");
  onView(deck, () => deck.classList.add("fan"));
  deck.querySelectorAll(".t-card").forEach((c) => c.addEventListener("click", () => c.classList.toggle("flipped")));

  /* ============ CTA form ============ */
  document.getElementById("ctaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("sent");
  });
})();
