(() => {
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  /* Magnetic CTA */
  if (fine) document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.2}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });

  /* Stage parallax */
  const stage = document.getElementById("stage");
  const layers = stage.querySelectorAll(".depth");
  if (fine) addEventListener("pointermove", (e) => {
    const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
    layers.forEach((l) => {
      const d = +l.dataset.depth;
      l.style.setProperty("--px", nx * d + "px");
      l.style.setProperty("--py", ny * d + "px");
    });
  });

  /* 72 hour dial */
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
  const cursors = stage.querySelectorAll(".collab");
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

  /* Process line fill on scroll */
  const tl = document.querySelector(".timeline");
  const fill = document.getElementById("lineFill");
  const days = tl.querySelectorAll(".day");
  const onScroll = () => {
    const r = tl.getBoundingClientRect();
    const p = Math.min(Math.max((innerHeight * 0.7 - r.top) / (r.height + innerHeight * 0.2), 0), 1);
    fill.style.transform = `scaleX(${p})`;
    days.forEach((d, i) => d.classList.toggle("on", p >= i / 2 - 0.001 && p > 0.02));
  };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* Testimonial deck: fan out on view, flip on tap */
  const deck = document.getElementById("deck");
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) deck.classList.add("fan");
  }, { threshold: 0.35 }).observe(deck);
  deck.querySelectorAll(".t-card").forEach((c) => c.addEventListener("click", () => c.classList.toggle("flipped")));

  /* CTA form */
  document.getElementById("ctaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    e.currentTarget.classList.add("sent");
  });
})();
