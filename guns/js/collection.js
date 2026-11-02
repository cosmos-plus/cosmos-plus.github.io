/*
 * Home & Favorites pages: stats, recently added, search, filters, sorting and grid.
 */
(async function () {
  "use strict";

  const { store, esc, card, photo, formatDate, detailUrl, favorites, syncFavoriteButtons, NOT_SPECIFIED } = window.FC;
  const $ = (sel) => document.querySelector(sel);

  const state = {
    query: "",
    category: "All",
    manufacturer: "",
    caliber: "",
    sort: "newest",
    favoritesOnly: document.body.dataset.page === "favorites",
  };

  let firearms = [];
  try {
    firearms = await store.all();
  } catch (err) {
    console.error(err);
    $("#grid").innerHTML = `<div class="empty"><h3>Couldn't load the collection</h3><p>Please refresh the page to try again.</p></div>`;
    return;
  }

  const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const compare = (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });

  // ---------- Stats ----------
  const setText = (sel, v) => {
    const el = $(sel);
    if (el) el.textContent = v;
  };
  setText("#stat-total", firearms.length);
  setText("#stat-makers", unique(firearms.map((f) => f.manufacturer)).length);
  setText("#stat-categories", unique(firearms.map((f) => f.category)).length);
  setText("#collection-count", firearms.length);

  // ---------- Recently added ----------
  const recentEl = $("#recent-grid");
  if (recentEl) {
    const recent = firearms.slice(0, 4);
    $("#recent").hidden = recent.length === 0;
    recentEl.innerHTML = recent
      .map(
        (f) => `
        <a class="recent-card" href="${detailUrl(f)}">
          ${photo(f)}
          <div class="recent-body">
            <p class="recent-maker truncate">${esc(f.manufacturer)}</p>
            <p class="recent-model truncate">${esc(f.model)}</p>
            <p class="recent-date">Added ${esc(formatDate(f.createdAt))}</p>
          </div>
        </a>`,
      )
      .join("");
  }

  // ---------- Filter controls ----------
  const fillSelect = (el, placeholder, values) => {
    el.innerHTML = `<option value="">${placeholder}</option>` + values.map((v) => `<option>${esc(v)}</option>`).join("");
  };
  fillSelect($("#filter-manufacturer"), "All manufacturers", unique(firearms.map((f) => f.manufacturer)));
  fillSelect($("#filter-caliber"), "All calibers", unique(firearms.map((f) => f.caliber)));

  function renderChips() {
    const categories = ["All", ...unique(firearms.map((f) => f.category))];
    $("#category-chips").innerHTML = categories
      .map((c) => {
        const count = c === "All" ? firearms.length : firearms.filter((f) => f.category === c).length;
        return `<button type="button" class="chip" data-category="${esc(c)}" aria-pressed="${state.category === c}">${
          c === "All" ? "All categories" : esc(c)
        }<small>${count}</small></button>`;
      })
      .join("");
  }

  function renderFavToggle() {
    const btn = $("#filter-favorites");
    const count = favorites.ids().filter((id) => firearms.some((f) => f.id === id)).length;
    btn.setAttribute("aria-pressed", String(state.favoritesOnly));
    btn.classList.toggle("btn-active", state.favoritesOnly);
    btn.querySelector("span").textContent = "Favorites" + (count ? ` (${count})` : "");
  }

  // ---------- Results ----------
  function filtered() {
    const terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
    const favIds = favorites.ids();
    return firearms
      .filter((f) => {
        if (state.favoritesOnly && !favIds.includes(f.id)) return false;
        if (state.category !== "All" && f.category !== state.category) return false;
        if (state.manufacturer && f.manufacturer !== state.manufacturer) return false;
        if (state.caliber && f.caliber !== state.caliber) return false;
        if (!terms.length) return true;
        const haystack = [f.name, f.manufacturer, f.model, f.modelNumber, f.caliber, f.category].join(" ").toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
      .sort((a, b) => {
        if (state.sort === "manufacturer") return compare(a.manufacturer, b.manufacturer) || compare(a.model, b.model);
        if (state.sort === "model") return compare(a.model, b.model) || compare(a.manufacturer, b.manufacturer);
        return compare(b.createdAt, a.createdAt);
      });
  }

  function render() {
    const results = filtered();
    const hasFilters = Boolean(state.query || state.category !== "All" || state.manufacturer || state.caliber || state.favoritesOnly);

    $("#results-count").innerHTML = `Showing <strong>${results.length}</strong> of ${firearms.length} firearm${firearms.length === 1 ? "" : "s"}`;
    $("#clear-filters").hidden = !hasFilters;
    $("#search-clear").hidden = !state.query;
    renderChips();
    renderFavToggle();

    if (results.length) {
      $("#grid").className = "grid";
      $("#grid").innerHTML = results.map(card).join("");
      syncFavoriteButtons();
      return;
    }

    const noFavs = state.favoritesOnly && favorites.ids().length === 0;
    const [title, text, action] =
      firearms.length === 0
        ? ["The collection is empty", "Add your first firearm from the Manage page.", `<a class="btn btn-primary" href="edit.html">Add a firearm</a>`]
        : noFavs
          ? ["No favorites yet", "Tap the heart on any firearm to bookmark it here.", `<a class="btn btn-ghost" href="index.html#collection">Browse the collection</a>`]
          : ["No firearms match your filters", "Try a different search term or clear the filters.", `<button type="button" class="btn btn-ghost" data-reset>Show all firearms</button>`];
    $("#grid").className = "";
    $("#grid").innerHTML = `<div class="empty"><h3>${title}</h3><p>${text}</p>${action}</div>`;
  }

  function reset() {
    Object.assign(state, { query: "", category: "All", manufacturer: "", caliber: "", favoritesOnly: false });
    $("#search").value = "";
    $("#filter-manufacturer").value = "";
    $("#filter-caliber").value = "";
    render();
  }

  // ---------- Events ----------
  $("#search").addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });
  $("#search-clear").addEventListener("click", () => {
    $("#search").value = "";
    state.query = "";
    render();
    $("#search").focus();
  });
  $("#filter-manufacturer").addEventListener("change", (e) => {
    state.manufacturer = e.target.value;
    render();
  });
  $("#filter-caliber").addEventListener("change", (e) => {
    state.caliber = e.target.value;
    render();
  });
  $("#sort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });
  $("#filter-favorites").addEventListener("click", () => {
    state.favoritesOnly = !state.favoritesOnly;
    render();
  });
  $("#category-chips").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-category]");
    if (!chip) return;
    state.category = chip.dataset.category;
    render();
  });
  $("#clear-filters").addEventListener("click", reset);
  $("#grid").addEventListener("click", (e) => e.target.closest("[data-reset]") && reset());

  // Re-filter when a heart is toggled (matters when "Favorites only" is on).
  document.addEventListener("favorites-change", () => {
    if (state.favoritesOnly) render();
    else renderFavToggle();
  });

  render();
})();
