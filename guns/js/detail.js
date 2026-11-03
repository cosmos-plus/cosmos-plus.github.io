/*
 * Firearm detail page: firearm.html?id=<firearm id>
 */
(async function () {
  "use strict";

  const { store, esc, safeUrl, photo, icons, formatDate, syncFavoriteButtons, NOT_SPECIFIED } = window.FC;
  const root = document.getElementById("detail");
  const id = new URLSearchParams(location.search).get("id");

  let f = null;
  try {
    f = id ? await store.get(id) : null;
  } catch (err) {
    console.error(err);
  }

  if (!f) {
    document.title = "Not found · Welch's Firearm Wishlist";
    root.innerHTML = `
      <div class="empty" style="margin-top:64px">
        <h3>Firearm not found</h3>
        <p>It may have been deleted, or the link is incorrect.</p>
        <a class="btn btn-primary" href="index.html#collection">Back to wishlist</a>
      </div>`;
    return;
  }

  document.title = `${f.name} · Welch's Firearm Wishlist`;

  const value = (v) => (v ? esc(v) : `<span class="not-specified">${NOT_SPECIFIED}</span>`);
  const rows = (list) =>
    list.map((r) => `<div class="spec-row"><dt>${esc(r.label)}</dt><dd>${value(r.value)}</dd></div>`).join("");

  const specs = [
    { label: "Manufacturer", value: f.manufacturer },
    { label: "Model", value: f.model },
    { label: "Model number", value: f.modelNumber },
    { label: "Firearm type", value: f.category },
    { label: "Caliber", value: f.caliber },
    { label: "Action", value: f.action },
    { label: "Barrel length", value: f.barrelLength },
    { label: "Overall length", value: f.overallLength },
    { label: "Weight", value: f.weight },
    { label: "Magazine capacity", value: f.capacity },
    { label: "Finish", value: f.finish },
  ];

  // Short values for the highlight tiles, e.g. "4.02 in (102 mm)" -> "4.02 in".
  const short = (v) => String(v || "").split(/[;(]/)[0].trim();
  const highlights = [
    { label: "Caliber", value: f.caliber },
    { label: "Capacity", value: short(f.capacity) },
    { label: "Barrel", value: short(f.barrelLength) },
    { label: "Weight", value: short(f.weight) },
  ];

  const extra = (f.extraSpecs || []).filter((s) => s.label && s.value);
  const url = safeUrl(f.productUrl);
  let host = "";
  try {
    host = url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch (e) {}

  root.innerHTML = `
    <div class="detail-top">
      <a href="index.html#collection" class="btn btn-ghost">${icons.arrowLeft} Back to wishlist</a>
      <a href="edit.html?id=${encodeURIComponent(f.id)}" class="btn btn-ghost">${icons.edit} Edit</a>
    </div>

    <div class="detail-grid">
      <div class="detail-photo fade-up">${photo(f, { eager: true })}</div>

      <div class="fade-up" style="animation-delay:80ms">
        <div class="pills">
          <span class="pill pill-accent">${esc(f.category)}</span>
          ${f.modelNumber ? `<span class="pill">Model #${esc(f.modelNumber)}</span>` : ""}
        </div>
        <p class="eyebrow" style="margin-top:20px">${esc(f.manufacturer)}</p>
        <h1 class="detail-name">${esc(f.name)}</h1>

        <dl class="highlights">
          ${highlights.map((h) => `<div class="highlight"><dt>${h.label}</dt><dd>${value(h.value)}</dd></div>`).join("")}
        </dl>

        ${f.description ? `<h2 class="sr-only">Description</h2><p class="description">${esc(f.description)}</p>` : ""}

        <div class="actions">
          ${url ? `<a class="btn btn-primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Official product page ${icons.external}</a>` : ""}
          <button type="button" class="btn btn-ghost" data-fav="${esc(f.id)}" data-name="${esc(f.name)}" aria-pressed="false">
            ${icons.heart}<span data-fav-label>Add to favorites</span>
          </button>
        </div>
        ${host ? `<p class="source-note">Source: ${esc(host)}</p>` : ""}
      </div>
    </div>

    <div class="spec-grid">
      <section class="panel">
        <h2 class="panel-title">Specifications</h2>
        <dl class="spec-table">${rows(specs)}</dl>
      </section>
      <div class="stack">
        ${extra.length ? `<section class="panel"><h2 class="panel-title">Additional Specifications</h2><dl class="spec-table">${rows(extra)}</dl></section>` : ""}
        <section class="panel">
          <h2 class="panel-title">Official Source</h2>
          <div class="panel-body">
            ${url ? `<a class="accent-link break-all" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a>` : `<span class="not-specified">${NOT_SPECIFIED}</span>`}
            <p class="source-note" style="margin-top:12px">Last updated ${esc(formatDate(f.updatedAt, { dateStyle: "medium" }))}</p>
          </div>
        </section>
      </div>
    </div>`;

  syncFavoriteButtons();
})();
