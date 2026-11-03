/*
 * Add / edit form: edit.html (new) or edit.html?id=<firearm id> (edit).
 */
(async function () {
  "use strict";

  const { store, esc, slugify, icons, toast } = window.FC;
  const $ = (sel) => document.querySelector(sel);
  const form = $("#firearm-form");

  const CATEGORIES = ["Pistol", "Revolver", "Rifle", "Shotgun", "Carbine", "Other"];
  const TEXT_FIELDS = ["manufacturer", "model", "name", "modelNumber", "category", "caliber", "action",
    "barrelLength", "overallLength", "weight", "capacity", "finish", "description", "productUrl"];
  const MAX_UPLOAD_MB = 20;
  const MAX_IMAGE_SIDE = 1600;

  $("#choose-photo").innerHTML = `${icons.image} Choose photo`;
  $("#remove-photo").innerHTML = `${icons.trash} Remove photo`;
  $("#add-spec").innerHTML = `${icons.plus} Add specification`;

  // ---------- Load ----------
  const editId = new URLSearchParams(location.search).get("id");
  let all = [];
  let existing = null;
  try {
    all = await store.all();
    existing = editId ? all.find((f) => f.id === editId) || null : null;
  } catch (err) {
    console.error(err);
    showFormError("The wishlist couldn't be loaded. Please refresh the page.");
  }

  if (editId && !existing) {
    showFormError("This firearm no longer exists. It may have been deleted.");
    form.hidden = true;
    return;
  }

  // Photo state: what will be saved.
  let imageBlob = existing?.imageBlob || null;
  let imagePath = existing?.image || null;
  let previewUrl = existing ? store.imageSrc(existing) : null;

  // ---------- Populate ----------
  const unique = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  $("#manufacturer-list").innerHTML = unique(all.map((f) => f.manufacturer)).map((v) => `<option value="${esc(v)}">`).join("");
  $("#caliber-list").innerHTML = unique(all.map((f) => f.caliber)).map((v) => `<option value="${esc(v)}">`).join("");
  const categories = [...new Set([...CATEGORIES, ...all.map((f) => f.category).filter(Boolean)])];
  $("#category-select").innerHTML = categories.map((c) => `<option>${esc(c)}</option>`).join("");

  if (existing) {
    document.title = `Edit ${existing.name} · Welch's Firearm Wishlist`;
    $("#form-eyebrow").textContent = existing.manufacturer;
    $("#form-title").textContent = `Edit ${existing.model}`;
    $("#save-btn").textContent = "Save changes";
    TEXT_FIELDS.forEach((k) => {
      if (form.elements[k]) form.elements[k].value = existing[k] || "";
    });
  } else {
    form.elements.category.value = "Pistol";
  }

  // Live placeholder for the full name.
  const updateNamePlaceholder = () => {
    const auto = `${form.elements.manufacturer.value} ${form.elements.model.value}`.trim();
    form.elements.name.placeholder = auto || "Leave blank to use Manufacturer + Model";
  };
  form.elements.manufacturer.addEventListener("input", updateNamePlaceholder);
  form.elements.model.addEventListener("input", updateNamePlaceholder);
  updateNamePlaceholder();

  // ---------- Additional specs ----------
  function addSpecRow(label = "", value = "") {
    const row = document.createElement("div");
    row.className = "spec-edit";
    row.innerHTML = `
      <input class="field" data-spec="label" placeholder="Name (e.g. Twist)" maxlength="60" aria-label="Specification name">
      <input class="field field-value" data-spec="value" placeholder='Value (e.g. 1:8" RH)' maxlength="300" aria-label="Specification value">
      <button type="button" class="icon-btn" aria-label="Remove specification">${icons.trash}</button>`;
    row.querySelector('[data-spec="label"]').value = label;
    row.querySelector('[data-spec="value"]').value = value;
    row.querySelector("button").addEventListener("click", () => row.remove());
    $("#spec-rows").appendChild(row);
    return row;
  }
  (existing?.extraSpecs?.length ? existing.extraSpecs : [{ label: "", value: "" }]).forEach((s) => addSpecRow(s.label, s.value));
  $("#add-spec").addEventListener("click", () => addSpecRow().querySelector("input").focus());

  // ---------- Photo ----------
  const dropzone = $("#dropzone");
  const imageInput = $("#image-input");

  function renderPhoto() {
    dropzone.innerHTML = previewUrl
      ? `<div class="photo"><img src="${esc(previewUrl)}" alt="Selected photo preview"></div>`
      : `<button type="button" class="dropzone-empty" data-pick>
           ${icons.image}
           <strong>Click to choose a photo, or drag &amp; drop it here</strong>
           <span>JPG, PNG, WebP, GIF or AVIF, up to ${MAX_UPLOAD_MB} MB</span>
         </button>`;
    $("#remove-photo").hidden = !previewUrl;
    $("#choose-photo").innerHTML = `${icons.image} ${previewUrl ? "Replace photo" : "Choose photo"}`;
  }

  function setImageError(message) {
    const el = $("#error-image");
    el.textContent = message || "";
    el.hidden = !message;
    dropzone.classList.toggle("invalid", Boolean(message));
  }

  /** Resizes the photo so it stores compactly in the browser. */
  function processImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; // flatten transparency onto the white catalog backdrop
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.type === "image/webp") return resolve(blob);
            canvas.toBlob((jpg) => (jpg ? resolve(jpg) : reject(new Error("Encoding failed"))), "image/jpeg", 0.88);
          },
          "image/webp",
          0.86,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Unreadable image"));
      };
      img.src = url;
    });
  }

  async function chooseFile(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return setImageError("Please choose a JPG, PNG, WebP, GIF or AVIF image.");
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return setImageError(`Image must be ${MAX_UPLOAD_MB} MB or smaller.`);
    try {
      imageBlob = await processImage(file);
      imagePath = null;
      previewUrl = URL.createObjectURL(imageBlob);
      setImageError("");
      renderPhoto();
    } catch (err) {
      console.error(err);
      setImageError("That image couldn't be read. Please try a different file.");
    }
  }

  dropzone.addEventListener("click", (e) => e.target.closest("[data-pick]") && imageInput.click());
  $("#choose-photo").addEventListener("click", () => imageInput.click());
  imageInput.addEventListener("change", () => {
    chooseFile(imageInput.files[0]);
    imageInput.value = "";
  });
  $("#remove-photo").addEventListener("click", () => {
    imageBlob = null;
    imagePath = null;
    previewUrl = null;
    renderPhoto();
  });
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragging");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragging");
    chooseFile(e.dataTransfer.files[0]);
  });
  renderPhoto();

  // ---------- Validation & save ----------
  function showFormError(message) {
    const el = $("#form-error");
    el.textContent = message || "";
    el.hidden = !message;
    if (message) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setFieldError(name, message) {
    const input = form.elements[name];
    const el = form.querySelector(`[data-error="${name}"]`);
    if (input) {
      input.classList.toggle("invalid", Boolean(message));
      input.setAttribute("aria-invalid", String(Boolean(message)));
    }
    if (el) {
      el.textContent = message || "";
      el.hidden = !message;
    }
  }

  function validate(values) {
    const errors = {};
    if (!values.manufacturer) errors.manufacturer = "Manufacturer is required.";
    if (!values.model) errors.model = "Model is required.";
    if (values.productUrl && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(values.productUrl)) {
      errors.productUrl = "Enter a full web address starting with http:// or https://";
    }
    return errors;
  }

  function uniqueId(name) {
    const base = slugify(name);
    const taken = new Set(all.map((f) => f.id));
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    return id;
  }

  form.addEventListener("input", (e) => {
    if (e.target.classList.contains("invalid")) setFieldError(e.target.name, "");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showFormError("");

    const values = {};
    TEXT_FIELDS.forEach((k) => (values[k] = String(form.elements[k].value || "").trim()));
    const errors = validate(values);
    ["manufacturer", "model", "productUrl"].forEach((k) => setFieldError(k, errors[k]));
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      form.elements[firstError].focus();
      return;
    }

    values.name = values.name || `${values.manufacturer} ${values.model}`;
    const extraSpecs = [...$("#spec-rows").children]
      .map((row) => ({
        label: row.querySelector('[data-spec="label"]').value.trim(),
        value: row.querySelector('[data-spec="value"]').value.trim(),
      }))
      .filter((s) => s.label && s.value);

    const now = new Date().toISOString();
    const record = {
      ...values,
      // Keep the id stable when editing so favorites and links keep working.
      id: existing ? existing.id : uniqueId(values.name),
      extraSpecs,
      image: imageBlob ? null : imagePath,
      imageBlob,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    const btn = $("#save-btn");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      await store.put(record);
      location.href = `manage.html?saved=${encodeURIComponent(record.id)}`;
    } catch (err) {
      console.error(err);
      const full = err && err.name === "QuotaExceededError";
      showFormError(full ? "Browser storage is full. Try a smaller photo, or delete unused firearms." : "Something went wrong while saving. Please try again.");
      btn.disabled = false;
      btn.textContent = existing ? "Save changes" : "Add to wishlist";
      toast("Not saved");
    }
  });
})();
