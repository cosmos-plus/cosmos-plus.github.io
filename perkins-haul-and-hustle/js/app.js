/* =========================================================
   Perkins Haul and Hustle: site script
   ========================================================= */

/* ---------------------------------------------------------
   SITE CONFIGURATION: edit these values before launch.
   See README.md for details.
   --------------------------------------------------------- */
const CONFIG = {
  // Where scheduling requests are POSTed (FormData, expects a 2xx response).
  // Works with form services such as Formspree, Basin, Getform, or your own
  // endpoint. While this is empty, the form validates input but tells the
  // visitor plainly that the request was NOT sent.
  formEndpoint: "",

  // Only enable if the endpoint above accepts multipart file uploads.
  allowPhotoUpload: false,
  maxPhotos: 3,
  maxPhotoMB: 10,

  // Shown in the footer and Schedule section only when filled in.
  contact: {
    phone: "", // e.g. "(904) 555-0123"
    email: "", // e.g. "hello@example.com"
  },

  // Displayed wherever an element has data-config="serviceArea".
  serviceArea: "Jacksonville, Florida",
};

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Config-driven content ---------- */
  function applyConfig() {
    $$('[data-config="serviceArea"]').forEach((el) => { el.textContent = CONFIG.serviceArea; });
    $$("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });

    const phone = CONFIG.contact.phone.trim();
    const email = CONFIG.contact.email.trim();
    $$('[data-contact="phone"]').forEach((a) => {
      if (!phone) return;
      a.href = "tel:" + phone.replace(/[^\d+]/g, "");
      a.textContent = phone;
      a.hidden = false;
    });
    $$('[data-contact="email"]').forEach((a) => {
      if (!email) return;
      a.href = "mailto:" + email;
      a.textContent = email;
      a.hidden = false;
    });
    if (phone || email) $$("[data-contact-block]").forEach((el) => { el.hidden = false; });
  }

  /* ---------- Navigation ---------- */
  function initNav() {
    const header = $(".site-header");
    const toggle = $(".nav-toggle");
    const nav = $("#site-nav");
    const toggleLabel = $(".sr-only", toggle);

    const setOpen = (open) => {
      header.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggleLabel.textContent = open ? "Close menu" : "Open menu";
    };

    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && header.classList.contains("is-open")) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 861px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });

    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Highlight the nav link for the section in view.
    const links = $$(".nav-links a");
    const sectionFor = { home: "home", services: "services", about: "about", why: "about", "how-it-works": "about", contact: "contact" };
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = sectionFor[entry.target.id];
        links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + target));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(sectionFor).forEach((id) => { const el = document.getElementById(id); if (el) spy.observe(el); });
  }

  /* ---------- Navbar logo: hidden while the hero is on screen ----------
     Two IntersectionObservers on the hero give a hysteresis band, so the
     state can't flicker when the visitor hovers around the boundary:
       - show once the hero's bottom edge has passed under the navbar
       - hide again only once it's back at least HYSTERESIS px below the navbar
     Observers report on creation, so a refresh at a restored scroll position
     starts in the correct state. They're rebuilt when the navbar height changes
     at the mobile breakpoint. */
  function initNavLogo() {
    const header = $(".site-header");
    const hero = $("#home");
    if (!header || !hero || !("IntersectionObserver" in window)) {
      if (header) header.classList.add("logo-visible");
      return;
    }
    const HYSTERESIS = 48;
    let observers = [];

    function setup() {
      observers.forEach((o) => o.disconnect());
      const navH = Math.round(header.getBoundingClientRect().height);
      const show = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) header.classList.add("logo-visible");
      }, { rootMargin: `-${navH}px 0px 0px 0px` });
      const hide = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) header.classList.remove("logo-visible");
      }, { rootMargin: `-${navH + HYSTERESIS}px 0px 0px 0px` });
      show.observe(hero);
      hide.observe(hero);
      observers = [show, hide];
    }

    setup();
    window.matchMedia("(max-width: 860px)").addEventListener("change", setup);
  }

  /* ---------- Schedule buttons: scroll to the form and focus it ---------- */
  function initScheduleLinks() {
    const shell = $("#schedule");
    $$("[data-schedule]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        shell.scrollIntoView({ behavior: reducedMotionQuery.matches ? "auto" : "smooth", block: "start" });
        // Move focus to the first field without jumping the scroll position.
        window.setTimeout(() => $("#f-name").focus({ preventScroll: true }), reducedMotionQuery.matches ? 0 : 450);
        if (history.replaceState) history.replaceState(null, "", "#schedule");
      });
    });

    // Hide the sticky mobile CTA while the hero buttons or the form are on screen.
    const bar = $(".mobile-cta");
    if (bar) {
      const onScreen = new Set();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? onScreen.add(entry.target) : onScreen.delete(entry.target)));
        bar.classList.toggle("is-hidden", onScreen.size > 0);
      }, { threshold: 0.05 });
      io.observe($(".hero-actions"));
      io.observe($("#contact"));
    }
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    const items = $$(".reveal");
    if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("is-visible")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    items.forEach((el) => io.observe(el));
  }

  /* =========================================================
     Hero speed background (canvas)
     Layered light trails streaming past, curved route lines
     with travelling pulses, drifting particles, and a light
     pointer parallax. Pauses off-screen and in hidden tabs;
     renders a single still frame for reduced motion.
     ========================================================= */
  function initHeroCanvas() {
    const canvas = $(".hero-canvas");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    const hero = canvas.parentElement;

    const LAYERS = [
      { depth: 0.35, speed: 220, width: 1, alpha: 0.35, len: [80, 220] },
      { depth: 0.65, speed: 520, width: 1.6, alpha: 0.6, len: [140, 360] },
      { depth: 1, speed: 980, width: 2.4, alpha: 0.9, len: [220, 560] },
    ];
    const COLORS = ["46,197,255", "59,130,246", "190,238,255"];

    let w = 0, h = 0, dpr = 1;
    let trails = [], particles = [], routes = [], pulses = [];
    let sprites = {};
    let running = false, visible = true, rafId = 0, last = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const rand = (a, b) => a + Math.random() * (b - a);

    // Pre-render a gradient streak per colour; drawn scaled for each trail (much
    // cheaper than building a gradient per trail per frame).
    function makeSprite(rgb) {
      const c = document.createElement("canvas");
      c.width = 256; c.height = 8;
      const g = c.getContext("2d");
      const grad = g.createLinearGradient(0, 0, 256, 0);
      grad.addColorStop(0, `rgba(${rgb},1)`);
      grad.addColorStop(0.04, `rgba(${rgb},0.9)`);
      grad.addColorStop(0.35, `rgba(${rgb},0.35)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, 4); g.quadraticCurveTo(2, 0.5, 14, 1.5); g.lineTo(256, 4); g.lineTo(14, 6.5); g.quadraticCurveTo(2, 7.5, 0, 4);
      g.fill();
      return c;
    }
    COLORS.forEach((rgb) => { sprites[rgb] = makeSprite(rgb); });

    // Soft round particle sprite. Drawing a bitmap at fractional positions is
    // smoothly filtered, whereas tiny sub-pixel fillRects shimmer as they move.
    const dot = document.createElement("canvas");
    dot.width = dot.height = 16;
    (() => {
      const g = dot.getContext("2d");
      const grad = g.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, "rgba(200,235,255,1)");
      grad.addColorStop(0.35, "rgba(200,235,255,0.6)");
      grad.addColorStop(1, "rgba(200,235,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 16, 16);
    })();

    // The truck glow never moves, so render it once per resize instead of
    // rebuilding a full-screen gradient every frame.
    const glowLayer = document.createElement("canvas");
    function renderGlow() {
      glowLayer.width = canvas.width;
      glowLayer.height = canvas.height;
      const g = glowLayer.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gx = logoBox.w ? logoBox.x + logoBox.w * 0.5 : w * 0.5;
      const gy = logoBox.h ? logoBox.y + logoBox.h * 0.3 : h * 0.4;
      const glow = g.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.6);
      glow.addColorStop(0, "rgba(46,197,255,0.10)");
      glow.addColorStop(0.5, "rgba(59,130,246,0.04)");
      glow.addColorStop(1, "rgba(8,11,16,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
    }

    // Pulse tail opacity bands, precomputed (avoids building colour strings per frame).
    const PULSE_TAIL = 24, PULSE_BANDS = 6;
    const PULSE_STYLES = Array.from({ length: PULSE_BANDS }, (_, j) => `rgba(46,197,255,${((1 - j / PULSE_BANDS) * 0.75).toFixed(3)})`);

    // Hero logo + copy areas (relative to the hero), used to centre the glow on
    // the truck and to dim trails behind the logo and text so they stay legible.
    let logoBox = { x: 0, y: 0, w: 0, h: 0 };
    let copyBox = { x: 0, y: 0, w: 0, h: 0 };
    function measure() {
      const heroRect = hero.getBoundingClientRect();
      const rel = (el) => {
        if (!el) return { x: 0, y: 0, w: 0, h: 0 };
        const r = el.getBoundingClientRect();
        return { x: r.left - heroRect.left, y: r.top - heroRect.top, w: r.width, h: r.height };
      };
      logoBox = rel($(".hero-logo .brand-logo"));
      copyBox = rel($(".hero-content"));
    }

    function newTrail(layerIndex, scatter) {
      const L = LAYERS[layerIndex];
      const len = rand(L.len[0], L.len[1]) * (w < 640 ? 0.6 : 1);
      // Cluster trails around the truck's speed-line band, with a wider spread
      // across the rest of the hero.
      const band = logoBox.h ? logoBox.y + logoBox.h * 0.25 : h * 0.4;
      const spread = (Math.random() + Math.random() + Math.random() - 1.5);
      const y = Math.random() < 0.55 ? band + spread * Math.max(120, logoBox.h * 0.9) : h * (0.5 + spread * 0.5);
      return {
        layer: layerIndex,
        x: scatter ? rand(-len, w + len) : w + rand(0, w * 0.5),
        y,
        len,
        speed: L.speed * rand(0.7, 1.3) * (w < 640 ? 0.7 : 1),
        width: L.width * rand(0.8, 1.3),
        alpha: L.alpha * rand(0.4, 1),
        color: layerIndex === 2 && Math.random() < 0.35 ? COLORS[2] : COLORS[Math.random() < 0.75 ? 0 : 1],
        dim: -1, // eased legibility dimming; -1 = snap to target on first draw
      };
    }

    // How much to quiet a trail at (x..x1, y): softly ramped near the logo and
    // copy edges rather than a hard on/off at the box boundary.
    function dimTarget(x0, x1, y) {
      const zone = (b, floor, feather) => {
        if (!b.w || x1 < b.x || x0 > b.x + b.w) return 1;
        const d = Math.max(b.y - y, y - (b.y + b.h)); // <0 inside, >0 outside
        if (d >= feather) return 1;
        if (d <= 0) return floor;
        return floor + (1 - floor) * (d / feather);
      };
      return Math.min(zone(logoBox, 0.28, 40), zone(copyBox, 0.5, 30));
    }

    function buildRoutes() {
      routes = [];
      const count = w < 640 ? 3 : 5;
      for (let i = 0; i < count; i++) {
        // Long, gently curving, mostly horizontal paths, like the logo's speed lines.
        const y0 = h * rand(0.1, 0.92);
        const y3 = y0 + h * rand(-0.18, 0.18);
        const p = [
          { x: -w * 0.05, y: y0 },
          { x: w * rand(0.25, 0.45), y: y0 + rand(-0.12, 0.12) * h },
          { x: w * rand(0.55, 0.75), y: y3 + rand(-0.12, 0.12) * h },
          { x: w * 1.05, y: y3 },
        ];
        const pts = [];
        const steps = 160;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps, mt = 1 - t;
          pts.push({
            x: mt * mt * mt * p[0].x + 3 * mt * mt * t * p[1].x + 3 * mt * t * t * p[2].x + t * t * t * p[3].x,
            y: mt * mt * mt * p[0].y + 3 * mt * mt * t * p[1].y + 3 * mt * t * t * p[2].y + t * t * t * p[3].y,
          });
        }
        routes.push({ pts, depth: rand(0.2, 0.6) });
      }
      pulses = routes.map((_, i) => ({ route: i, t: Math.random(), speed: rand(0.06, 0.13) }));
    }

    const randomLayer = () => { const r = Math.random(); return r < 0.45 ? 0 : r < 0.82 ? 1 : 2; };
    const newParticle = () => ({ x: rand(0, w), y: rand(0, h), r: rand(0.4, 1.6), speed: rand(15, 70), a: rand(0.15, 0.6), tw: rand(0, Math.PI * 2) });

    // Resizes the backing store to match the element exactly (no CSS stretching),
    // then rescales the existing scene so motion continues seamlessly instead of
    // re-scattering everything. Counts are topped up / trimmed to suit the area.
    function resize() {
      const rect = hero.getBoundingClientRect();
      const nw = Math.max(1, Math.round(rect.width));
      const nh = Math.max(1, Math.round(rect.height));
      const first = !w;
      const sx = first ? 1 : nw / w, sy = first ? 1 : nh / h;
      w = nw; h = nh;
      dpr = Math.min(window.devicePixelRatio || 1, w < 640 ? 1.5 : 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      measure();
      renderGlow();

      if (first) {
        buildRoutes();
      } else {
        trails.forEach((t) => { t.x *= sx; t.y *= sy; t.dim = -1; });
        particles.forEach((p) => { p.x *= sx; p.y *= sy; });
        routes.forEach((r) => r.pts.forEach((pt) => { pt.x *= sx; pt.y *= sy; }));
      }

      const area = w * h;
      const trailCount = Math.round(Math.min(90, Math.max(26, area / 16000)));
      while (trails.length < trailCount) trails.push(newTrail(randomLayer(), first));
      if (trails.length > trailCount) trails.length = trailCount;
      const particleCount = Math.round(Math.min(70, Math.max(20, area / 22000)));
      while (particles.length < particleCount) particles.push(newParticle());
      if (particles.length > particleCount) particles.length = particleCount;

      draw(0); // repaint immediately; the resize cleared the canvas
    }

    // Point at fractional index f along a sampled route (linear interpolation),
    // so pulses glide continuously instead of stepping between samples.
    function pointAt(pts, f) {
      const n = pts.length - 1;
      const c = Math.max(0, Math.min(n, f));
      const i = Math.min(n - 1, Math.floor(c));
      const k = c - i;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
    }

    function drawRoutes(px, py) {
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      routes.forEach((r) => {
        const ox = px * r.depth, oy = py * r.depth;
        ctx.strokeStyle = "rgba(120,170,220,0.07)";
        ctx.beginPath();
        r.pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x + ox, pt.y + oy) : ctx.moveTo(pt.x + ox, pt.y + oy)));
        ctx.stroke();
      });
      // Travelling pulses with a fading tail. Every tail point is sampled at a
      // fractional position, so the whole streak glides rather than stepping.
      ctx.lineWidth = 2;
      ctx.lineCap = "butt"; // round caps would double up into beads where bands meet
      const per = PULSE_TAIL / PULSE_BANDS;
      pulses.forEach((p) => {
        const r = routes[p.route];
        if (!r || !Number.isFinite(p.t)) return;
        const n = r.pts.length - 1;
        const head = p.t * n;
        const ox = px * r.depth, oy = py * r.depth;
        for (let j = 0; j < PULSE_BANDS; j++) {
          const f0 = head - j * per, f1 = f0 - per;
          if (f0 <= 0 || f1 >= n) continue;
          ctx.strokeStyle = PULSE_STYLES[j];
          ctx.beginPath();
          for (let f = f0, s = 0; s <= per; s++, f--) {
            const pt = pointAt(r.pts, f);
            s ? ctx.lineTo(pt.x + ox, pt.y + oy) : ctx.moveTo(pt.x + ox, pt.y + oy);
          }
          ctx.stroke();
        }
        if (head >= 0 && head <= n) {
          const hp = pointAt(r.pts, head);
          ctx.fillStyle = "rgba(190,238,255,0.95)";
          ctx.beginPath();
          ctx.arc(hp.x + ox, hp.y + oy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    function draw(dt) {
      // Ease pointer parallax.
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 4);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 4);
      const px = pointer.x * 24, py = pointer.y * 18;

      // Soft glow centred on the truck (pre-rendered; a single blit per frame).
      // Drawn with "copy" so it also clears the previous frame.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "copy";
      ctx.drawImage(glowLayer, 0, 0);
      ctx.restore();

      drawRoutes(px, py);

      // Particles: soft sprites at sub-pixel positions (no shimmer).
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x -= p.speed * dt;
        p.tw += dt * 2;
        if (p.x < -6) { p.x = w + 6; p.y = rand(0, h); }
        const s = p.r * 3;
        ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.tw));
        ctx.drawImage(dot, p.x + px * 0.3 - s / 2, p.y + py * 0.3 - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // Light trails, back to front, additive blending for a glow.
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < trails.length; i++) {
        const t = trails[i];
        t.x -= t.speed * dt;
        if (t.x + t.len < 0) { trails[i] = newTrail(t.layer, false); continue; }
        const d = LAYERS[t.layer].depth;
        const x = t.x + px * d, y = t.y + py * d;
        // Keep streaks quiet behind the logo and copy so they never hurt
        // legibility, easing the change so trails never pop in brightness.
        const target = dimTarget(x, x + t.len, y);
        t.dim = t.dim < 0 ? target : t.dim + (target - t.dim) * Math.min(1, dt * 6);
        ctx.globalAlpha = t.alpha * t.dim;
        ctx.drawImage(sprites[t.color], x, y - t.width * 2, t.len, t.width * 4);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      pulses.forEach((p) => {
        p.t += p.speed * dt;
        if (p.t > 1.15) { p.t = 0; p.speed = rand(0.06, 0.13); }
      });
    }

    function frame(now) {
      if (!running) return;
      // rAF timestamps can precede performance.now() on the first frame; clamp
      // to [0, 50ms] so motion never runs backwards or leaps after a hitch.
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0));
      last = now;
      draw(dt);
      rafId = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reducedMotionQuery.matches || !visible || document.hidden) return;
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(rafId);
    }

    // Reduced motion: one still frame with trails and pulses frozen in place.
    function renderStill() {
      stop();
      pointer.x = pointer.tx = pointer.y = pointer.ty = 0;
      draw(0);
    }

    function syncMotion() { reducedMotionQuery.matches ? renderStill() : start(); }

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    }).observe(hero);

    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    reducedMotionQuery.addEventListener("change", syncMotion);

    if (window.matchMedia("(pointer: fine)").matches) {
      // Read the hero's position once per entry rather than on every move.
      let heroRect = null;
      hero.addEventListener("pointerenter", () => { heroRect = hero.getBoundingClientRect(); });
      hero.addEventListener("pointermove", (e) => {
        if (!heroRect) heroRect = hero.getBoundingClientRect();
        pointer.tx = (e.clientX - heroRect.left) / heroRect.width - 0.5;
        pointer.ty = (e.clientY - heroRect.top) / heroRect.height - 0.5;
      });
      window.addEventListener("scroll", () => { heroRect = null; }, { passive: true });
      hero.addEventListener("pointerleave", () => { pointer.tx = 0; pointer.ty = 0; });
    }

    // Resizing rescales the existing scene, so it can run immediately on every
    // size change (no stretched canvas while waiting on a debounce).
    const currentSize = () => {
      const rect = hero.getBoundingClientRect();
      return Math.round(rect.width) + "x" + Math.round(rect.height) + "@" + (window.devicePixelRatio || 1);
    };
    resize();
    let sizeKey = currentSize();
    new ResizeObserver(() => {
      const key = currentSize();
      if (key === sizeKey) return;
      sizeKey = key;
      resize();
    }).observe(hero);

    syncMotion();

    // Copy height can change once web fonts arrive, and the logo settles 14px
    // after its entrance; re-measure the dim zones and glow at both points.
    const remeasure = () => { measure(); renderGlow(); if (!running) draw(0); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    const stage = $(".hero-stage");
    if (stage) stage.addEventListener("animationend", (e) => { if (e.target === stage) remeasure(); });
  }

  /* =========================================================
     Scheduling form
     ========================================================= */
  function initForm() {
    const form = $("#schedule-form");
    if (!form) return;
    const status = $(".form-status", form);
    const submitBtn = $('button[type="submit"]', form);
    const submitLabel = $(".btn-label", submitBtn);
    const serviceSelect = $("#f-service");
    const dateInput = $("#f-date");
    const photoField = $("[data-photo-field]");
    const photoInput = $("#f-photos");

    // Build service options from the Services section so they always match.
    $$(".service[data-service]").forEach((el) => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = el.dataset.service;
      serviceSelect.appendChild(opt);
    });
    const other = document.createElement("option");
    other.value = other.textContent = "Other / Not sure";
    serviceSelect.appendChild(other);

    // Earliest selectable date is today (local time).
    const today = new Date();
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dateInput.min = iso(today);

    const photosEnabled = CONFIG.allowPhotoUpload && !!CONFIG.formEndpoint;
    if (photosEnabled) {
      photoField.hidden = false;
      $("#f-photos-hint").textContent = `Up to ${CONFIG.maxPhotos} images, ${CONFIG.maxPhotoMB} MB each (JPG, PNG, WEBP, HEIC).`;
      form.enctype = "multipart/form-data";
    } else {
      photoInput.disabled = true; // excluded from FormData
    }

    const validators = {
      name: (v) => (v.trim().length < 2 ? "Please enter your full name." : ""),
      phone: (v) => {
        const digits = v.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
        if (!v.trim()) return "Please enter a phone number.";
        return digits.length === 10 ? "" : "Please enter a valid 10-digit phone number.";
      },
      email: (v) => {
        if (!v.trim()) return "Please enter your email address.";
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Please enter a valid email address.";
      },
      address: (v) => (v.trim().length < 6 ? "Please enter the pickup address." : ""),
      service: (v) => (v ? "" : "Please choose a type of service."),
      items: (v) => (v.trim().length < 10 ? "Please describe the items to remove (a short list is fine)." : ""),
      date: (v) => {
        if (!v) return "Please choose a preferred pickup date.";
        return v < dateInput.min ? "Please choose today or a future date." : "";
      },
      time: (v) => (v ? "" : "Please choose a preferred time."),
      photos: () => {
        if (!photosEnabled) return "";
        const files = Array.from(photoInput.files || []);
        if (files.length > CONFIG.maxPhotos) return `Please attach no more than ${CONFIG.maxPhotos} photos.`;
        if (files.some((f) => !/^image\//.test(f.type) && !/\.heic$/i.test(f.name))) return "Photos must be image files.";
        if (files.some((f) => f.size > CONFIG.maxPhotoMB * 1024 * 1024)) return `Each photo must be under ${CONFIG.maxPhotoMB} MB.`;
        return "";
      },
    };

    function validateField(name) {
      const input = form.elements[name];
      if (!input) return true;
      const message = validators[name](input.value || "");
      const field = input.closest(".field");
      const err = $(".field-error", field);
      field.classList.toggle("is-invalid", !!message);
      input.setAttribute("aria-invalid", message ? "true" : "false");
      err.textContent = message;
      return !message;
    }

    // Validate on blur once touched, then live while correcting.
    Object.keys(validators).forEach((name) => {
      const input = form.elements[name];
      if (!input) return;
      input.addEventListener("blur", () => { if (input.value) input.dataset.touched = "1"; if (input.dataset.touched) validateField(name); });
      input.addEventListener("input", () => { if (input.closest(".field").classList.contains("is-invalid")) validateField(name); });
      input.addEventListener("change", () => { input.dataset.touched = "1"; validateField(name); });
    });

    function summary() {
      const f = form.elements;
      return [
        "Pickup request: Perkins Haul and Hustle",
        "",
        `Name: ${f.name.value.trim()}`,
        `Phone: ${f.phone.value.trim()}`,
        `Email: ${f.email.value.trim()}`,
        `Pickup address: ${f.address.value.trim()}`,
        `Service: ${f.service.value}`,
        `Preferred date: ${f.date.value}`,
        `Preferred time: ${f.time.value}`,
        "",
        "Items to remove:",
        f.items.value.trim(),
      ].join("\n");
    }

    function showStatus(type, html) {
      status.className = "form-status is-" + type;
      status.innerHTML = html;
      status.hidden = false;
    }

    function setBusy(busy) {
      submitBtn.disabled = busy;
      submitLabel.textContent = busy ? "Sending…" : "Send Pickup Request";
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      status.hidden = true;

      const results = Object.keys(validators).map((name) => [name, validateField(name)]);
      const firstInvalid = results.find(([, ok]) => !ok);
      if (firstInvalid) {
        form.elements[firstInvalid[0]].focus();
        showStatus("error", "<p>Please fix the highlighted fields and try again.</p>");
        return;
      }

      // Honeypot filled: silently drop (likely a bot).
      if (form.elements._gotcha.value) return;

      // ---------------------------------------------------------------
      // INTEGRATION POINT: no endpoint configured, so nothing is sent.
      // ---------------------------------------------------------------
      if (!CONFIG.formEndpoint) {
        console.info("[Perkins Haul and Hustle] Form endpoint not configured (CONFIG.formEndpoint in js/app.js). Request was not sent.");
        const email = CONFIG.contact.email.trim();
        const phone = CONFIG.contact.phone.trim();
        let direct = "Direct contact details will be listed here soon.";
        if (phone || email) {
          direct = "Please reach out directly" +
            (phone ? ` by phone at <a href="tel:${phone.replace(/[^\d+]/g, "")}">${escapeHtml(phone)}</a>` : "") +
            (phone && email ? " or" : "") +
            (email ? ` by email at <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : "") + ".";
        }
        showStatus("warn",
          "<strong>Your request has not been sent.</strong>" +
          "<p>Online scheduling isn't connected yet. " + direct + "</p>" +
          '<div class="status-actions">' +
          '<button type="button" class="btn btn-ghost" data-copy>Copy my request details</button>' +
          (email ? `<a class="btn btn-ghost" href="mailto:${escapeHtml(email)}?subject=${encodeURIComponent("Pickup request")}&body=${encodeURIComponent(summary())}">Email this request</a>` : "") +
          "</div>");
        return;
      }

      setBusy(true);
      try {
        const res = await fetch(CONFIG.formEndpoint, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        form.reset();
        $$(".field", form).forEach((f) => f.classList.remove("is-invalid"));
        $$("[data-touched]", form).forEach((el) => delete el.dataset.touched);
        showStatus("ok",
          "<strong>Request sent. Thanks!</strong>" +
          "<p>We received your pickup request. Your pickup isn't confirmed until the team follows up with you to coordinate the details.</p>");
      } catch (err) {
        console.error("[Perkins Haul and Hustle] Form submission failed:", err);
        showStatus("error",
          "<strong>Your request could not be sent.</strong>" +
          "<p>Something went wrong on our end. Please check your connection and try again.</p>" +
          '<div class="status-actions"><button type="button" class="btn btn-ghost" data-copy>Copy my request details</button></div>');
      } finally {
        setBusy(false);
      }
    });

    // Copy-to-clipboard so visitors don't lose what they typed.
    status.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-copy]");
      if (!btn) return;
      try {
        await navigator.clipboard.writeText(summary());
        btn.textContent = "Copied to clipboard";
      } catch {
        btn.textContent = "Couldn't copy. Please select and copy manually.";
      }
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- Boot ---------- */
  applyConfig();
  initNav();
  initNavLogo();
  initScheduleLinks();
  initReveal();
  initHeroCanvas();
  initForm();
})();
