/*
 * Manage page: list, delete, export/import backups, reset to the starting catalog.
 */
(async function () {
  "use strict";

  const { store, esc, photo, icons, detailUrl, toast, NOT_SPECIFIED } = window.FC;
  const $ = (sel) => document.querySelector(sel);

  $("#export-btn").innerHTML = `${icons.download} Export backup`;
  $("#import-btn").innerHTML = `${icons.upload} Import backup`;
  $("#reset-btn").innerHTML = `${icons.reset} Reset to starting catalog`;

  let firearms = [];

  async function load() {
    try {
      firearms = await store.all();
    } catch (err) {
      console.error(err);
      $("#admin-list").innerHTML = `<li class="admin-item text-danger">The wishlist couldn't be loaded. Please refresh the page.</li>`;
      return;
    }
    $("#storage-warning").hidden = store.persistent;
    render();
  }

  function render() {
    $("#manage-summary").textContent = `${firearms.length} firearm${firearms.length === 1 ? "" : "s"} · changes are saved in this browser automatically`;

    if (!firearms.length) {
      $("#admin-list").innerHTML = `
        <li class="admin-item" style="display:block">
          <div class="empty" style="margin:0;border:0">
            <h3>No firearms yet</h3>
            <p>Add your first firearm to start the wishlist.</p>
            <a href="edit.html" class="btn btn-primary">Add firearm</a>
          </div>
        </li>`;
      return;
    }

    $("#admin-list").innerHTML = firearms
      .map(
        (f) => `
        <li class="admin-item">
          <a class="admin-main" href="${detailUrl(f)}">
            ${photo(f, { alt: "" })}
            <div style="min-width:0">
              <p class="recent-maker">${esc(f.manufacturer)}</p>
              <p class="admin-model truncate">${esc(f.model)}</p>
              <p class="admin-meta truncate">${esc(f.category)} · ${esc(f.caliber || NOT_SPECIFIED)}${
                f.image || f.imageBlob ? "" : ' <span class="text-danger">· No photo</span>'
              }</p>
            </div>
          </a>
          <div class="admin-btns">
            <a class="btn btn-ghost" href="edit.html?id=${encodeURIComponent(f.id)}">${icons.edit} Edit</a>
            <button type="button" class="btn btn-danger" data-delete="${esc(f.id)}">${icons.trash} Delete</button>
          </div>
        </li>`,
      )
      .join("");
  }

  // ---------- Delete ----------
  $("#admin-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;
    const f = firearms.find((x) => x.id === btn.dataset.delete);
    if (!f || !confirm(`Delete "${f.name}" from the wishlist?\n\nThis cannot be undone (unless you have a backup).`)) return;
    btn.disabled = true;
    try {
      await store.remove(f.id);
      firearms = firearms.filter((x) => x.id !== f.id);
      render();
      toast(`${f.name} was deleted.`);
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      toast("Something went wrong while deleting. Please try again.");
    }
  });

  // ---------- Export ----------
  const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  function dataUrlToBlob(dataUrl) {
    const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
    if (!match || !match[2] || !/^image\//.test(match[1])) return null;
    const bytes = atob(match[3]);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: match[1] });
  }

  $("#export-btn").addEventListener("click", async () => {
    try {
      const records = await Promise.all(
        (await store.all()).map(async ({ imageBlob, ...rest }) => ({
          ...rest,
          imageData: imageBlob instanceof Blob ? await blobToDataUrl(imageBlob) : null,
        })),
      );
      const payload = { app: "firearms-collection", version: 1, exportedAt: new Date().toISOString(), firearms: records };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `firearms-collection-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast(`Exported ${records.length} firearm${records.length === 1 ? "" : "s"}.`);
    } catch (err) {
      console.error(err);
      toast("Export failed. Please try again.");
    }
  });

  // ---------- Import ----------
  const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

  function normalize(raw) {
    if (!raw || typeof raw !== "object" || !raw.id || !raw.manufacturer || !raw.model) return null;
    const now = new Date().toISOString();
    return {
      id: str(raw.id),
      manufacturer: str(raw.manufacturer),
      model: str(raw.model),
      name: str(raw.name) || `${raw.manufacturer} ${raw.model}`,
      modelNumber: str(raw.modelNumber),
      category: str(raw.category) || "Other",
      caliber: str(raw.caliber),
      action: str(raw.action),
      barrelLength: str(raw.barrelLength),
      overallLength: str(raw.overallLength),
      weight: str(raw.weight),
      capacity: str(raw.capacity),
      finish: str(raw.finish),
      description: str(raw.description),
      productUrl: str(raw.productUrl),
      extraSpecs: Array.isArray(raw.extraSpecs)
        ? raw.extraSpecs.filter((s) => s && s.label && s.value).map((s) => ({ label: str(s.label), value: str(s.value) }))
        : [],
      image: typeof raw.image === "string" && !raw.imageData ? raw.image : null,
      imageBlob: typeof raw.imageData === "string" ? dataUrlToBlob(raw.imageData) : null,
      createdAt: str(raw.createdAt) || now,
      updatedAt: str(raw.updatedAt) || now,
    };
  }

  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : data.firearms;
      if (!Array.isArray(list)) throw new Error("No firearms list in file");
      const records = list.map(normalize).filter(Boolean);
      if (!records.length) throw new Error("No valid firearms in file");
      const skipped = list.length - records.length;
      if (!confirm(`Replace the current wishlist (${firearms.length}) with ${records.length} firearm${records.length === 1 ? "" : "s"} from "${file.name}"?`)) return;
      await store.replaceAll(records);
      await load();
      toast(`Imported ${records.length} firearm${records.length === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped)` : ""}.`);
    } catch (err) {
      console.error(err);
      toast("That file isn't a valid wishlist backup.");
    }
  });

  // ---------- Reset ----------
  $("#reset-btn").addEventListener("click", async () => {
    const count = (window.SEED_FIREARMS || []).length;
    if (!confirm(`Reset to the starting catalog of ${count} firearms?\n\nAll firearms you added or edited will be removed. Export a backup first if you want to keep them.`)) return;
    try {
      await store.resetToDefaults();
      await load();
      toast("Wishlist reset to the starting catalog.");
    } catch (err) {
      console.error(err);
      toast("Reset failed. Please try again.");
    }
  });

  // ---------- "Saved" notice after returning from the editor ----------
  const savedId = new URLSearchParams(location.search).get("saved");
  await load();
  if (savedId) {
    const f = firearms.find((x) => x.id === savedId);
    if (f) {
      const notice = $("#saved-notice");
      notice.innerHTML = `<span><strong>${esc(f.name)}</strong> was saved.</span><a class="accent-link" style="font-weight:600" href="${detailUrl(f)}">View page →</a>`;
      notice.hidden = false;
    }
    history.replaceState(null, "", "manage.html");
  }
})();
