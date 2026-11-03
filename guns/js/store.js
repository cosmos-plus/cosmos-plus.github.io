/*
 * Collection storage.
 *
 * The collection is saved in the browser's IndexedDB database, so additions,
 * edits, deletions and uploaded photos survive page refreshes and restarts.
 * The first time the site is opened, it is filled from js/data.js.
 *
 * Browser storage belongs to one browser on one device — use
 * "Export backup" on the Manage page to copy the collection elsewhere.
 */
(function () {
  "use strict";

  const DB_NAME = "firearms-collection";
  const DB_VERSION = 1;
  const STORE = "firearms";
  const META = "meta";

  let dbPromise = null;
  let memory = null; // used only when IndexedDB is unavailable
  const blobUrls = new Map();

  function request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function txDone(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Transaction aborted"));
    });
  }

  function seedRecords() {
    return (window.SEED_FIREARMS || []).map((f) => ({
      ...f,
      imageBlob: null,
      updatedAt: f.updatedAt || f.createdAt,
    }));
  }

  /**
   * Adds entries from js/data.js that this browser hasn't seen yet, so firearms
   * appended to data.js show up without resetting. Each entry is added only once,
   * so a firearm you delete stays deleted.
   */
  async function syncSeed(db) {
    const meta = db.transaction(META).objectStore(META);
    let seen = await request(meta.get("seedIds"));
    if (!Array.isArray(seen)) {
      // Older versions only stored the date the starting catalog was loaded.
      const seededAt = await request(meta.get("seeded"));
      seen = seededAt ? seedRecords().filter((r) => r.createdAt <= seededAt).map((r) => r.id) : [];
    }
    const fresh = seedRecords().filter((r) => !seen.includes(r.id));
    if (!fresh.length) return;

    const existing = new Set(await request(db.transaction(STORE).objectStore(STORE).getAllKeys()));
    const tx = db.transaction([STORE, META], "readwrite");
    fresh.filter((r) => !existing.has(r.id)).forEach((r) => tx.objectStore(STORE).put(r));
    tx.objectStore(META).put([...seen, ...fresh.map((r) => r.id)], "seedIds");
    await txDone(tx);
  }

  const MARKS = /\s*[®™]/g;
  const stripMarks = (v) => (typeof v === "string" ? v.replace(MARKS, "") : v);

  /** Removes ® and ™ from saved firearms, including ones loaded before data.js dropped them. */
  async function stripTrademarks(db) {
    const records = await request(db.transaction(STORE).objectStore(STORE).getAll());
    const fields = ["name", "manufacturer", "model", "caliber", "action", "finish", "capacity", "description", "extraSpecs"];
    const snapshot = (r) => JSON.stringify(fields.map((k) => r[k]));
    const changed = records.filter((r) => {
      const before = snapshot(r);
      fields.slice(0, -1).forEach((k) => (r[k] = stripMarks(r[k])));
      if (Array.isArray(r.extraSpecs)) r.extraSpecs = r.extraSpecs.map((s) => ({ ...s, label: stripMarks(s.label), value: stripMarks(s.value) }));
      return snapshot(r) !== before;
    });
    if (!changed.length) return;
    const tx = db.transaction(STORE, "readwrite");
    changed.forEach((r) => tx.objectStore(STORE).put(r));
    await txDone(tx);
  }

  /** Copies a price from js/data.js onto saved catalog firearms that don't have one yet. */
  async function backfillPrices(db) {
    const isPrice = (s) => /msrp|price|retail/i.test(s?.label || "");
    const seeds = new Map(seedRecords().map((r) => [r.id, r]));
    const records = await request(db.transaction(STORE).objectStore(STORE).getAll());
    const changed = records.filter((r) => {
      const seedPrice = (seeds.get(r.id)?.extraSpecs || []).find(isPrice);
      if (!seedPrice || (r.extraSpecs || []).some(isPrice)) return false;
      r.extraSpecs = [...(r.extraSpecs || []), { ...seedPrice }];
      return true;
    });
    if (!changed.length) return;
    const tx = db.transaction(STORE, "readwrite");
    changed.forEach((r) => tx.objectStore(STORE).put(r));
    await txDone(tx);
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB not supported"));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      };
      req.onsuccess = () => {
        // Let other tabs upgrade or delete the database instead of hanging.
        req.result.onversionchange = () => req.result.close();
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("Database is blocked by another tab"));
    })
      .then(async (db) => {
        await syncSeed(db);
        await stripTrademarks(db);
        await backfillPrices(db);
        return db;
      })
      .catch((err) => {
        console.warn("Browser storage unavailable; changes will not be saved.", err);
        memory = new Map(seedRecords().map((r) => [r.id, r]));
        store.persistent = false;
        return null;
      });
    return dbPromise;
  }

  const byNewest = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt));

  const store = {
    /** False when the browser blocks storage (e.g. some private modes). */
    persistent: true,

    async all() {
      const db = await openDb();
      const list = db ? await request(db.transaction(STORE).objectStore(STORE).getAll()) : [...memory.values()];
      return list.sort(byNewest);
    },

    async get(id) {
      const db = await openDb();
      if (!db) return memory.get(id) || null;
      return (await request(db.transaction(STORE).objectStore(STORE).get(id))) || null;
    },

    async put(record) {
      const db = await openDb();
      if (!db) return void memory.set(record.id, record);
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      await txDone(tx);
    },

    async remove(id) {
      const db = await openDb();
      if (!db) return void memory.delete(id);
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      await txDone(tx);
    },

    /** Replaces the whole collection (used by Import and Reset). */
    async replaceAll(records) {
      const db = await openDb();
      blobUrls.clear();
      if (!db) {
        memory = new Map(records.map((r) => [r.id, r]));
        return;
      }
      const tx = db.transaction(STORE, "readwrite");
      const os = tx.objectStore(STORE);
      os.clear();
      records.forEach((r) => os.put(r));
      await txDone(tx);
    },

    async resetToDefaults() {
      await store.replaceAll(seedRecords());
    },

    /** Returns a URL for a firearm's photo, or null if it has none. */
    imageSrc(record) {
      if (record.imageBlob instanceof Blob) {
        const key = record.id + ":" + record.updatedAt;
        if (!blobUrls.has(key)) blobUrls.set(key, URL.createObjectURL(record.imageBlob));
        return blobUrls.get(key);
      }
      return record.image || null;
    },
  };

  window.FC = window.FC || {};
  window.FC.store = store;
})();
