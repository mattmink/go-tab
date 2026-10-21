/* Custom icon images: validated, decoded and downscaled to a 128px PNG data URL (SPEC §5). */
(function (GT) {
  'use strict';

  const MAX_BYTES = 1024 * 1024;
  const MAX_SIDE = 128;
  const TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];
  const EXT = /\.(png|jpe?g|svg|webp|ico)$/i;

  const accepts = (file) =>
    file.size <= MAX_BYTES && (TYPES.includes(file.type) || (!file.type && EXT.test(file.name)));

  /* Resolves once the image has loaded. Not img.decode(): that waits for rendering and never
     settles in a tab that isn't being painted (a background tab). */
  function loaded(src, crossOrigin = false) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = src;
    });
  }

  async function rasterize(src, crossOrigin) {
    const img = await loaded(src, crossOrigin);
    /* SVGs without intrinsic size report 0; draw them at full size. */
    const w = img.naturalWidth || MAX_SIDE;
    const h = img.naturalHeight || MAX_SIDE;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    /* Throws if the image is cross-origin without CORS (a tainted canvas). */
    return { dataUrl: canvas.toDataURL('image/png'), w, h };
  }

  function nameFromUrl(url) {
    try {
      const seg = new URL(url).pathname.split('/').filter(Boolean).pop();
      return seg ? decodeURIComponent(seg) : new URL(url).hostname;
    } catch {
      return url;
    }
  }

  GT.images = {
    accepts,

    /* Rejects with { code: 'type' } for a wrong type or size, otherwise { code: 'load' }. */
    async fromFile(file) {
      if (!accepts(file)) throw { code: 'type' };
      const url = URL.createObjectURL(file);
      try {
        return { ...(await rasterize(url, false)), name: file.name };
      } catch {
        throw { code: 'load' };
      } finally {
        URL.revokeObjectURL(url);
      }
    },

    /* With site access the image is fetched directly; without it only servers that allow
       cross-origin requests work. */
    /* Decode and downscale a blob already in hand (no type or size checks). */
    async fromBlob(blob) {
      const url = URL.createObjectURL(blob);
      try {
        return await rasterize(url, false);
      } finally {
        URL.revokeObjectURL(url);
      }
    },

    async fromUrl(url, hasAccess = false) {
      try {
        if (!hasAccess) return { ...(await rasterize(url, true)), name: nameFromUrl(url) };
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) throw new Error(String(res.status));
        const blobUrl = URL.createObjectURL(await res.blob());
        try {
          return { ...(await rasterize(blobUrl, false)), name: nameFromUrl(url) };
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      } catch {
        throw { code: 'load' };
      }
    },

    /* Natural size of a stored data URL, for the "Custom image" status line. */
    loaded,

    async sizeOf(dataUrl) {
      try {
        const img = await loaded(dataUrl);
        return { w: img.naturalWidth, h: img.naturalHeight };
      } catch {
        return null;
      }
    }
  };
})(window.GT = window.GT || {});
