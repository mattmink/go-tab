/* Large site icons. The browser's own favicon store only holds 16/32px icons, which look
   grainy on tiles, so with site access Go Tab fetches each site's larger icon (apple-touch-icon,
   sized <link rel="icon">, web app manifest icons) and caches it at 128px on this device.

   When requests happen (never on a plain tab open):
   - A link is added, or its URL moves to another site.
   - The browser's own favicon for a site changes. That's checked locally on every open
     (_favicon is local, no network), by comparing a pixel sample with the one taken when the
     large icon was fetched.
   - "Refresh icon" in Edit item.
   - Once per site for links that predate this feature (a few per tab open).

   Cost-cutters: one icon per site (origin), shared by its links; a refresh first re-checks the
   remembered icon URL with If-None-Match / If-Modified-Since and only re-reads the page if
   that URL stops working; sites with no large icon are remembered and not retried until
   their favicon changes. Without site access nothing is fetched and tiles keep the favicon. */
(function (GT) {
  'use strict';

  const CACHE_KEY = 'go-tab:site-icons';
  const LOCK_KEY = 'go-tab:site-icon-locks';
  const MIN_SIDE = 64; /* anything smaller is no better than the 32px favicon */
  const MAX_BACKFILL = 5;
  const TIMEOUT = 5000;
  const LOCK_MS = 2 * 60 * 1000;

  /* { [origin]: { data, src, etag, modified, w, h, sig, none, at } } */
  let cache = {};
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    cache = {};
  }

  function save() {
    /* Drop sites no link uses any more. Recent entries stay: Refresh icon in an Add item
       dialog fetches before the link is saved. */
    const live = new Set(GT.store.get().items.map((it) => originOf(it.url)).filter(Boolean));
    const hourAgo = Date.now() - 60 * 60 * 1000;
    for (const [o, e] of Object.entries(cache)) if (!live.has(o) && e.at < hourAgo) delete cache[o];
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* Quota: icons fall back to the favicon. */
    }
  }

  function originOf(url) {
    try {
      const u = new URL(url);
      return /^https?:$/.test(u.protocol) ? u.origin : null;
    } catch {
      return null;
    }
  }

  async function get(url, opts = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      return await fetch(url, { credentials: 'omit', cache: 'no-store', signal: ctl.signal, ...opts });
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- Discovery ---------- */

  const sizeOf = (sizes) => {
    if (!sizes) return 0;
    if (/any/i.test(sizes)) return 512;
    return Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
  };

  /* Candidate icon URLs from the page and its manifest, best first. */
  async function discover(origin, pageUrl) {
    const found = [];
    try {
      const res = await get(pageUrl);
      if (res.ok && (res.headers.get('content-type') || '').includes('html')) {
        const doc = new DOMParser().parseFromString((await res.text()).slice(0, 500000), 'text/html');
        const base = res.url || pageUrl;
        for (const link of doc.querySelectorAll('link[rel][href]')) {
          const rel = link.getAttribute('rel').toLowerCase().split(/\s+/);
          const href = new URL(link.getAttribute('href'), base).href;
          const svg = /svg/.test(link.getAttribute('type') || '') || /\.svg(\?|$)/i.test(href);
          if (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')) {
            found.push({ url: href, size: sizeOf(link.getAttribute('sizes')) || 180 });
          } else if (rel.includes('icon')) {
            found.push({ url: href, size: svg ? 512 : sizeOf(link.getAttribute('sizes')) });
          } else if (rel.includes('manifest')) {
            try {
              const m = await (await get(href)).json();
              for (const icon of Array.isArray(m.icons) ? m.icons : []) {
                if (icon?.src && !/maskable|monochrome/.test(icon.purpose || '')) {
                  found.push({ url: new URL(icon.src, href).href, size: sizeOf(icon.sizes) });
                }
              }
            } catch {
              /* No usable manifest. */
            }
          }
        }
      }
    } catch {
      /* Page unreachable: try the conventional location below. */
    }
    /* Smallest that's at least 128px, then the biggest of the rest; skip favicon-sized ones.
       The conventional /apple-touch-icon.png is only tried when nothing declared works. */
    const usable = found.filter((c) => c.size === 0 || c.size >= MIN_SIDE);
    const big = usable.filter((c) => c.size >= 128).sort((a, b) => a.size - b.size);
    const rest = usable.filter((c) => c.size < 128).sort((a, b) => b.size - a.size);
    const ordered = [...big, ...rest, { url: `${origin}/apple-touch-icon.png`, size: 180 }];
    return [...new Map(ordered.map((c) => [c.url, c])).values()];
  }

  /* Download and downscale one candidate. Null if it isn't a usable, large-enough image. */
  async function load(url, headers) {
    const res = await get(url, { headers });
    if (res.status === 304) return { notModified: true };
    if (!res.ok || !(res.headers.get('content-type') || 'image/').startsWith('image/')) return null;
    const blob = await res.blob();
    if (blob.size > 2 * 1024 * 1024) return null;
    const img = await GT.images.fromBlob(blob);
    const svg = blob.type.includes('svg');
    if (!svg && Math.min(img.w, img.h) < MIN_SIDE) return null;
    return { data: img.dataUrl, w: img.w, h: img.h, etag: res.headers.get('etag'), modified: res.headers.get('last-modified') };
  }

  /* ---------- Fetching ---------- */

  const inFlight = new Map();

  /* Cross-tab lock, so several new tabs opening at once don't all fetch the same site. */
  function takeLock(origin) {
    let locks = {};
    try {
      locks = JSON.parse(localStorage.getItem(LOCK_KEY)) || {};
    } catch {
      locks = {};
    }
    const now = Date.now();
    for (const [o, t] of Object.entries(locks)) if (now - t > LOCK_MS) delete locks[o];
    if (locks[origin]) return false;
    locks[origin] = now;
    try {
      localStorage.setItem(LOCK_KEY, JSON.stringify(locks));
    } catch {
      /* Worst case two tabs fetch once each. */
    }
    return true;
  }
  function releaseLock(origin) {
    try {
      const locks = JSON.parse(localStorage.getItem(LOCK_KEY)) || {};
      delete locks[origin];
      localStorage.setItem(LOCK_KEY, JSON.stringify(locks));
    } catch {
      /* Expires on its own. */
    }
  }

  /**
   * Fetch or refresh the large icon for `pageUrl`'s site. Resolves to 'updated',
   * 'unchanged', 'none' (no large icon) or 'no-access'.
   * @param {string} pageUrl
   * @param {object} o
   * @param {Promise<boolean>|boolean} [o.access]  site access (from GT.access.ensure() in a gesture)
   * @param {boolean} [o.force]  skip the conditional re-check and re-read the page
   * @param {string} [o.sig]  current favicon sample, remembered for change detection
   */
  function fetchFor(pageUrl, { access, force = false, sig } = {}) {
    const origin = originOf(pageUrl);
    if (!origin) return Promise.resolve('none');
    if (inFlight.has(origin)) return inFlight.get(origin);
    const job = (async () => {
      if (!(await (access ?? GT.access.has()))) return 'no-access';
      if (!takeLock(origin)) return 'unchanged';
      try {
        const prev = cache[origin];
        let result = null;
        /* Cheap path: re-check the icon URL we already know. */
        if (prev?.src && !force) {
          const headers = {};
          if (prev.etag) headers['If-None-Match'] = prev.etag;
          if (prev.modified) headers['If-Modified-Since'] = prev.modified;
          result = await load(prev.src, headers).catch(() => null);
          if (result?.notModified) {
            cache[origin] = { ...prev, sig: sig ?? prev.sig, at: Date.now() };
            save();
            return 'unchanged';
          }
          if (result) result.src = prev.src;
        }
        /* The known URL just failed (e.g. 404): don't try it again from the page's links. */
        const failed = prev?.src && !force && !result ? prev.src : null;
        if (!result) {
          for (const c of await discover(origin, pageUrl)) {
            if (c.url === failed) continue;
            result = await load(c.url).catch(() => null);
            if (result && !result.notModified) {
              result.src = c.url;
              break;
            }
            result = null;
          }
        }
        const sample = sig ?? prev?.sig ?? null;
        /* Nothing found but we had an icon: likely offline or a hiccup; keep what we have. */
        if (!result && prev?.data) {
          cache[origin] = { ...prev, sig: sample, at: Date.now() };
          save();
          return 'unchanged';
        }
        if (!result) {
          cache[origin] = { none: true, sig: sample, at: Date.now() };
          save();
          GT.render.refreshIcons(origin);
          return 'none';
        }
        const changed = result.data !== prev?.data;
        cache[origin] = { data: result.data, src: result.src, etag: result.etag, modified: result.modified, w: result.w, h: result.h, sig: sample, at: Date.now() };
        save();
        if (changed) GT.render.refreshIcons(origin);
        return changed ? 'updated' : 'unchanged';
      } finally {
        releaseLock(origin);
      }
    })().finally(() => inFlight.delete(origin));
    inFlight.set(origin, job);
    return job;
  }

  /* ---------- Change detection (local only) ---------- */

  const queue = [];
  let backfilled = 0;
  let draining = false;

  function enqueue(pageUrl, sig) {
    const origin = originOf(pageUrl);
    if (!origin || queue.some((q) => q.origin === origin) || inFlight.has(origin)) return;
    queue.push({ origin, pageUrl, sig });
    if (!draining) {
      draining = true;
      (globalThis.requestIdleCallback || setTimeout)(drain, { timeout: 5000 });
    }
  }

  /* One site at a time, after the page is idle, and only with site access already granted. */
  async function drain() {
    if (!(await GT.access.has())) {
      queue.length = 0;
      draining = false;
      return;
    }
    while (queue.length) {
      const { pageUrl, sig } = queue.shift();
      await fetchFor(pageUrl, { sig }).catch(() => {});
    }
    draining = false;
  }

  GT.siteIcon = {
    originOf,
    fetchFor,

    /* Cached large icon for a link (data URL), or null. Synchronous, for first paint. */
    get(pageUrl) {
      const e = cache[originOf(pageUrl)];
      return e && e.data ? e.data : null;
    },

    info(pageUrl) {
      return cache[originOf(pageUrl)] || null;
    },

    /* Called with the pixel sample of a site's real favicon (favicon.js). */
    noteFavicon(pageUrl, sig) {
      const origin = originOf(pageUrl);
      if (!origin) return;
      const e = cache[origin];
      if (!e) {
        /* A link from before large icons existed: fetch once, a few sites per tab open. */
        if (backfilled < MAX_BACKFILL) {
          backfilled++;
          enqueue(pageUrl, sig);
        }
      } else if (!e.sig) {
        e.sig = sig;
        save();
      } else if (e.sig !== sig) {
        enqueue(pageUrl, sig);
      }
    },

    /* Tiles showing a large icon don't load the favicon, so sample those sites' favicons in the
       background (local files, no network) to notice when they change. */
    watch() {
      const run = () => {
        const seen = new Set();
        for (const it of GT.store.get().items) {
          const origin = originOf(it.url);
          if (!origin || seen.has(origin) || it.icon || !cache[origin]?.data) continue;
          seen.add(origin);
          const src = GT.favicon.src(it.url);
          if (!src) continue;
          const img = new Image();
          img.onload = () => GT.favicon.check(img, it.url);
          img.src = src;
        }
      };
      (globalThis.requestIdleCallback || setTimeout)(run, { timeout: 5000 });
    }
  };
})(window.GT = window.GT || {});
