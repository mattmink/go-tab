/* Export / import (SPEC §4 Settings → Backup). The export format is the config shape (§5)
   with any background image embedded as a data URL. */
(function (GT) {
  'use strict';

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }

  /* Local date, so a backup made in the evening isn't dated tomorrow. */
  function today() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /* Returns an error message, or null if `raw` looks like a Go Tab backup. */
  function validate(raw) {
    if (!isObj(raw) || !Array.isArray(raw.items) || !Array.isArray(raw.groups)) return 'That file isn’t a Go Tab backup.';
    if (typeof raw.version === 'number' && raw.version > 1) return 'That backup was made by a newer version of Go Tab.';
    if (raw.items.some((it) => !isObj(it) || typeof it.url !== 'string')) return 'That backup is damaged and can’t be imported.';
    return null;
  }

  function pickFile() {
    return new Promise((resolve) => {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
      input.addEventListener('change', () => resolve(input.files[0] || null), { once: true });
      input.addEventListener('cancel', () => resolve(null), { once: true });
      input.click();
    });
  }

  /* Store an embedded image in IndexedDB and return its metadata (or null). */
  async function restoreImage(img) {
    if (!isObj(img) || typeof img.dataUrl !== 'string' || !img.dataUrl.startsWith('data:image/')) return null;
    try {
      const blob = await (await fetch(img.dataUrl)).blob();
      const info = await GT.bgImage.describe(blob);
      const id = await GT.bgImage.put(blob);
      return { id, name: typeof img.name === 'string' ? img.name : '', ...info };
    } catch {
      return null;
    }
  }

  GT.backup = {
    async export() {
      const config = structuredClone(GT.store.get());
      const img = config.background?.image;
      if (img) {
        const blob = await GT.bgImage.blob(img.id);
        if (blob) img.dataUrl = await blobToDataUrl(blob);
        delete img.id;
      }
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `go-tab-backup-${today()}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    /**
     * File picker → validate → confirm ("Replace your current N links and M groups?") → apply.
     * Resolves to an error message for the caller to show, or null.
     * @param {object} o
     * @param {HTMLElement|Function} o.returnFocus
     */
    async import({ returnFocus } = {}) {
      const file = await pickFile();
      if (!file) return null;
      let raw;
      try {
        raw = JSON.parse(await file.text());
      } catch {
        return 'That file isn’t a Go Tab backup.';
      }
      const error = validate(raw);
      if (error) return error;

      const current = GT.store.get();
      /* Nothing to lose on a fresh install, so no confirmation. */
      if (current.items.length || current.groups.length) {
        const ok = await GT.confirm.replace({
          title: `Replace your current ${plural(current.items.length, 'link', 'links')} and ${plural(current.groups.length, 'group', 'groups')}?`,
          body: `The backup has ${plural(raw.items.length, 'link', 'links')} and ${plural(raw.groups.length, 'group', 'groups')}. This can’t be undone.`,
          returnFocus
        });
        if (!ok) return null;
      }

      const oldImageId = current.background?.image?.id;
      const background = isObj(raw.background) ? { ...raw.background, image: await restoreImage(raw.background.image) } : null;
      await GT.store.set({ ...raw, background });
      if (oldImageId) GT.bgImage.remove(oldImageId);
      GT.announce?.(`Imported ${plural(raw.items.length, 'link', 'links')}`, { clearAfter: 3000 });
      return null;
    }
  };
})(window.GT = window.GT || {});
