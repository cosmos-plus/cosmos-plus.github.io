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
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("Database is blocked by another tab"));
    })
      .then(async (db) => {
        // Seed once. Deleting every firearm later will not bring the seed back.
        const seeded = await request(db.transaction(META).objectStore(META).get("seeded"));
        if (!seeded) {
          const tx = db.transaction([STORE, META], "readwrite");
          seedRecords().forEach((r) => tx.objectStore(STORE).put(r));
          tx.objectStore(META).put(new Date().toISOString(), "seeded");
          await txDone(tx);
        }
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
