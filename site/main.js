(() => {
  const fine = matchMedia("(hover: hover)").matches;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Split headings into words */
  document.querySelectorAll(".split").forEach((el) => {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.append(" ");
            const w = document.createElement("span");
            w.className = "w";
            w.innerHTML = `<span style="--i:${i++}">${part}</span>`;
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  });

  /* Reveal on scroll */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal, .split").forEach((el) => io.observe(el));

  /* Cursor */
  const cursor = document.querySelector(".cursor");
  let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;
  addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; });
  if (fine) {
    (function loop() {
      cx += (mx - cx) * 0.18; cy += (my - cy) * 0.18;
      cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll("a, button, input").forEach((el) => {
      el.addEventListener("pointerenter", () => cursor.classList.add("big"));
      el.addEventListener("pointerleave", () => cursor.classList.remove("big"));
    });
  }

  /* Magnetic buttons */
  if (fine) document.querySelectorAll(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });

  /* Tilt */
  if (fine) document.querySelectorAll(".tilt").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });

  /* Hide nav on scroll down */
  const nav = document.querySelector(".nav");
  let lastY = 0;
  addEventListener("scroll", () => {
    const y = scrollY;
    nav.classList.toggle("hide", y > lastY && y > 200);
    lastY = y;
  }, { passive: true });

  /* Live lead feed */
  const feed = document.getElementById("leadFeed");
  const leads = [
    ["✦", "New lead", "Kinfolk Dental", "now"],
    ["◎", "Call booked", "Verde Homes · Thu 3pm", "2m"],
    ["↗", "Reply received", "Atlas Legal", "5m"],
    ["✦", "New lead", "Mono Studio", "9m"],
    ["◎", "Call booked", "Solace Clinic · Fri 11am", "12m"],
  ];
  let li = 0;
  const pushLead = () => {
    const [icon, title, sub, t] = leads[li++ % leads.length];
    const el = document.createElement("div");
    el.className = "lead";
    el.innerHTML = `<span class="dot">${icon}</span><div><b>${title}</b><small>${sub}</small></div><time>${t}</time>`;
    feed.prepend(el);
    if (feed.children.length > 3) {
      const last = feed.lastElementChild;
      last.classList.add("out");
      setTimeout(() => last.remove(), 500);
    }
  };
  pushLead(); setTimeout(pushLead, 900);
  setInterval(pushLead, 2800);

  /* Machine steps: scroll driven panel switch */
  const steps = document.querySelectorAll(".step");
  const panels = document.querySelectorAll(".panel");
  const stepIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const n = e.target.dataset.step;
      steps.forEach((s) => s.classList.toggle("active", s === e.target));
      panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === n));
    });
  }, { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach((s) => stepIO.observe(s));
  steps[0].classList.add("active");

  /* Counters */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, end = +el.dataset.count, suf = el.dataset.suffix || "";
      const t0 = performance.now(), dur = 1800;
      const tick = (t) => {
        const p = Math.min((t - t0) / dur, 1), k = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(end * k) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      countIO.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll("[data-count]").forEach((el) => countIO.observe(el));

  /* Hero field: drifting particles with links, pulled toward the pointer */
  const cv = document.getElementById("field");
  const ctx = cv.getContext("2d");
  let W, H, dpr, pts = [];
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((W * H) / 16000);
    pts = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
    }));
  };
  resize();
  addEventListener("resize", resize);
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    const r = cv.getBoundingClientRect();
    const px = mx - r.left, py = my - r.top;
    const g = ctx.createRadialGradient(px, py, 0, px, py, 420);
    g.addColorStop(0, "rgba(154,216,255,0.10)");
    g.addColorStop(1, "rgba(154,216,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const p of pts) {
      const dx = px - p.x, dy = py - p.y, d = Math.hypot(dx, dy);
      if (d < 200) { p.vx += dx / d * 0.012; p.vy += dy / d * 0.012; }
      p.vx *= 0.985; p.vy *= 0.985;
      p.vx += (Math.random() - 0.5) * 0.02; p.vy += (Math.random() - 0.5) * 0.02;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 110) {
          ctx.strokeStyle = `rgba(154,216,255,${(1 - d / 110) * 0.18})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      ctx.fillStyle = "rgba(243,239,231,0.55)";
      ctx.beginPath(); ctx.arc(a.x, a.y, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    if (!reduced) requestAnimationFrame(draw);
  };
  draw();
})();
