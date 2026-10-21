/* Background image blobs live in IndexedDB (too large for storage quotas, SPEC §5).
   The config only holds { id, name, w, h, average }. Object URLs are cached per id so
   repaints after the first load are instant. */
(function (GT) {
  'use strict';

  const DB = 'go-tab';
  const STORE = 'images';
  const urls = new Map();
  let dbPromise = null;

  function db() {
    dbPromise ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error);
    });
  }

  const newId = () => 'bg' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  GT.bgImage = {
    cachedUrl: (id) => urls.get(id) || null,

    async url(id) {
      if (urls.has(id)) return urls.get(id);
      const blob = await GT.bgImage.blob(id);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urls.set(id, url);
      return url;
    },

    blob: (id) => tx('readonly', (s) => s.get(id)).catch(() => null),

    /* Stores a blob and returns its new id. */
    async put(blob) {
      const id = newId();
      await tx('readwrite', (s) => s.put(blob, id));
      urls.set(id, URL.createObjectURL(blob));
      return id;
    },

    async remove(id) {
      if (!id) return;
      const url = urls.get(id);
      if (url) URL.revokeObjectURL(url);
      urls.delete(id);
      await tx('readwrite', (s) => s.delete(id)).catch(() => {});
    },

    /* Decode a blob for its size and average colour (for auto tone). */
    async describe(blob) {
      const url = URL.createObjectURL(blob);
      try {
        const img = await GT.images.loaded(url);
        return { w: img.naturalWidth, h: img.naturalHeight, average: GT.tone.imageAverage(img) };
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  };
})(window.GT = window.GT || {});
