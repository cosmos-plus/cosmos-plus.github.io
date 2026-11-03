/*
 * Shared UI: header, footer, theme toggle, favorites, icons and card markup.
 * Loaded on every page after store.js.
 */
(function () {
  "use strict";

  const FC = (window.FC = window.FC || {});
  const NOT_SPECIFIED = "Not specified";

  // ---------- Helpers ----------
  const esc = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  /** Only allow http(s) links from user-entered data. */
  const safeUrl = (url) => (/^https?:\/\//i.test(String(url || "").trim()) ? String(url).trim() : "");

  const slugify = (text) =>
    String(text)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[™]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "firearm";

  const formatDate = (iso, opts = { month: "short", day: "numeric", year: "numeric" }) => {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("en-US", opts);
  };

  const detailUrl = (f) => "firearm.html?id=" + encodeURIComponent(f.id);

  /** True for an extra spec that holds a price (MSRP, "Price (…)", "Suggested retail"). */
  const isPriceSpec = (s) => /msrp|price|retail/i.test(s?.label || "") && /\d/.test(s?.value || "");

  /** The firearm's price in dollars, taken from its first price spec, or null. */
  function priceOf(f) {
    const spec = (f.extraSpecs || []).find(isPriceSpec);
    const n = spec && parseFloat(spec.value.replace(/[^0-9.]/g, ""));
    return n > 0 ? n : null;
  }

  const formatPrice = (n) =>
    n == null ? NOT_SPECIFIED : "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

  // Different spellings of the same cartridge, so "9x19 mm" and "9mm" filter together.
  const CALIBER_GROUPS = [
    [/\.?380\b|9\s*mm\s*(short|kurz)/i, ".380 ACP"],
    [/\b9\s*(x\s*19|mm)\b|9mm|luger|parabellum/i, "9mm"],
    [/\.?40\s*s\s*&?\s*w/i, ".40 S&W"],
    [/\.?45\s*acp/i, ".45 ACP"],
    [/5\.56|\.223/i, "5.56 NATO / .223"],
    [/7\.62\s*(x\s*51|nato)|\.308/i, ".308 Win / 7.62 NATO"],
    [/\.?30-30/i, ".30-30 Win"],
    [/\.?22\s*(lr|long rifle)/i, ".22 LR"],
  ];

  /** A caliber's common name: "9x19 mm" → "9mm", "12-Gauge (2-3/4\", 3\")" → "12 Gauge". */
  function caliberGroup(caliber) {
    const c = String(caliber || "").trim();
    if (!c) return "";
    const gauge = c.match(/(\d+)\s*-?\s*(ga\b|gauge)/i);
    if (gauge) return `${gauge[1]} Gauge`;
    const hit = CALIBER_GROUPS.find(([re]) => re.test(c));
    return hit ? hit[1] : c;
  }

  // ---------- Icons ----------
  const svg = (body, extra = "") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

  const icons = {
    crosshair: svg('<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    heart: svg('<path d="M12 20.5s-7.5-4.6-7.5-10.3A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.6c0 5.7-7.5 10.3-7.5 10.3Z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>'),
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    arrowLeft: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    arrowRight: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    edit: svg('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'),
    image: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 8"/>'),
    download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    upload: svg('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'),
    reset: svg('<path d="M4 4v6h6"/><path d="M5.5 15a7 7 0 1 0 1.7-7.3L4 10"/>'),
  };

  // ---------- Theme ----------
  const isDark = () => document.documentElement.dataset.theme !== "light";
  function setTheme(dark) {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch (e) {}
    document.querySelectorAll("[data-theme-toggle]").forEach(renderThemeButton);
  }
  function renderThemeButton(btn) {
    btn.innerHTML = isDark() ? icons.sun : icons.moon;
    btn.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
    btn.title = isDark() ? "Light theme" : "Dark theme";
  }

  // ---------- Favorites (per browser) ----------
  const FAV_KEY = "favorites";
  const favorites = {
    ids() {
      try {
        const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    },
    has(id) {
      return favorites.ids().includes(id);
    },
    toggle(id) {
      const ids = favorites.ids();
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch (e) {}
      document.dispatchEvent(new CustomEvent("favorites-change"));
      return next.includes(id);
    },
  };

  function syncFavoriteButtons() {
    document.querySelectorAll("[data-fav]").forEach((btn) => {
      const on = favorites.has(btn.dataset.fav);
      btn.setAttribute("aria-pressed", String(on));
      const name = btn.dataset.name || "firearm";
      btn.setAttribute("aria-label", (on ? "Remove " : "Add ") + name + (on ? " from favorites" : " to favorites"));
      const label = btn.querySelector("[data-fav-label]");
      if (label) label.textContent = on ? "Favorited" : "Add to favorites";
      if (btn.classList.contains("btn")) btn.classList.toggle("btn-active", on);
    });
  }

  // Event delegation for every heart button on the page.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fav]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    favorites.toggle(btn.dataset.fav);
  });
  document.addEventListener("favorites-change", syncFavoriteButtons);
  window.addEventListener("storage", (e) => e.key === FAV_KEY && document.dispatchEvent(new CustomEvent("favorites-change")));

  // ---------- Markup builders ----------
  function photo(f, { eager = false, alt } = {}) {
    const src = FC.store.imageSrc(f);
    const altText = esc(alt ?? f.name);
    return src
      ? `<div class="photo"><img src="${esc(src)}" alt="${altText}" loading="${eager ? "eager" : "lazy"}" decoding="async"></div>`
      : `<div class="photo"><div class="photo-empty">${icons.image}No photo yet</div></div>`;
  }

  function card(f, index = 0) {
    const url = detailUrl(f);
    return `
      <article class="card fade-up" style="animation-delay:${Math.min(index, 8) * 40}ms">
        <a href="${url}" tabindex="-1" aria-hidden="true">${photo(f, { eager: index < 3 })}</a>
        <span class="card-badge">${esc(f.category)}</span>
        <button type="button" class="fav-btn" data-fav="${esc(f.id)}" data-name="${esc(f.name)}" aria-pressed="false">${icons.heart}</button>
        <div class="card-body">
          <p class="eyebrow">${esc(f.manufacturer)}</p>
          <h3 class="card-title"><a href="${url}">${esc(f.model)}</a></h3>
          <dl class="card-specs">
            <div><dt>Caliber</dt><dd>${esc(caliberGroup(f.caliber) || NOT_SPECIFIED)}</dd></div>
            <div><dt>Price</dt><dd class="card-price">${esc(formatPrice(priceOf(f)))}</dd></div>
          </dl>
          <div class="card-cta-wrap"><span class="card-cta">View Details ${icons.arrowRight}</span></div>
        </div>
      </article>`;
  }

  function toast(message) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  // ---------- Header & footer ----------
  const NAV = [
    { href: "index.html", label: "Wishlist", page: "home" },
    { href: "favorites.html", label: "Favorites", page: "favorites" },
    { href: "manage.html", label: "Manage", page: "manage" },
  ];

  function renderChrome() {
    const page = document.body.dataset.page;
    const links = (cls) =>
      NAV.map((n) => `<a class="${cls}" href="${n.href}"${n.page === page ? ' aria-current="page"' : ""}>${n.label}</a>`).join("");

    const header = document.getElementById("site-header");
    if (header) {
      header.className = "site-header";
      header.innerHTML = `
        <div class="container header-inner">
          <a href="index.html" class="brand" aria-label="Welch's Firearm Wishlist home">
            <span class="brand-mark">${icons.crosshair}</span>
            <span class="brand-name">Welch's <span><span class="brand-long">Firearm </span>Wishlist</span></span>
          </a>
          <nav class="nav" aria-label="Main">
            ${links("nav-link")}
            <button type="button" class="icon-btn" data-theme-toggle style="margin-left:8px"></button>
            <button type="button" class="icon-btn menu-btn" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">${icons.menu}</button>
          </nav>
        </div>
        <nav id="mobile-nav" class="mobile-nav" aria-label="Mobile">${links("")}</nav>`;

      const menuBtn = header.querySelector(".menu-btn");
      menuBtn.addEventListener("click", () => {
        const open = header.classList.toggle("open");
        menuBtn.setAttribute("aria-expanded", String(open));
        menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
        menuBtn.innerHTML = open ? icons.close : icons.menu;
      });
    }

    const footer = document.getElementById("site-footer");
    if (footer) {
      footer.className = "site-footer";
      footer.innerHTML = `
        <div class="container footer-grid">
          <div>
            <a href="index.html" class="brand"><span class="brand-mark">${icons.crosshair}</span><span class="brand-name">Welch's Firearm Wishlist</span></a>
            <p class="footer-about">Welch's firearm wishlist, with specs for every pick. Specifications are sourced from manufacturer pages where available and may change without notice.</p>
          </div>
          <div>
            <h2 class="eyebrow">Browse</h2>
            <ul class="footer-links">
              <li><a href="index.html#collection">Full wishlist</a></li>
              <li><a href="favorites.html">Favorites</a></li>
            </ul>
          </div>
          <div>
            <h2 class="eyebrow">Manage</h2>
            <ul class="footer-links">
              <li><a href="manage.html">Manage wishlist</a></li>
              <li><a href="edit.html">Add a firearm</a></li>
              <li><a href="manage.html#backup">Backup &amp; restore</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom"><p class="container">© ${new Date().getFullYear()} Welch's Firearm Wishlist · For personal reference only. Always follow applicable laws and safe handling practices.</p></div>`;
    }

    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      renderThemeButton(btn);
      btn.addEventListener("click", () => setTheme(!isDark()));
    });
  }

  renderChrome();

  Object.assign(FC, { NOT_SPECIFIED, esc, safeUrl, slugify, formatDate, detailUrl, isPriceSpec, priceOf, formatPrice, caliberGroup, icons, favorites, syncFavoriteButtons, photo, card, toast });
})();
