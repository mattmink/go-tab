/* Site icons via Chromium's _favicon endpoint (SPEC §5), with a monogram fallback.
   _favicon answers every request, returning a generic globe for sites it has no icon for;
   we detect that globe and show the monogram instead. Results are cached per URL so
   repaints draw the right thing immediately. */
(function (GT) {
  'use strict';

  const CACHE_KEY = 'go-tab:favicons';
  const SIZE = 64;
  const SIG = 12;

  const base = globalThis.chrome && chrome.runtime && chrome.runtime.getURL
    ? chrome.runtime.getURL('/_favicon/')
    : null;

  let known = {};
  try {
    known = JSON.parse(localStorage.getItem(CACHE_KEY)) || {};
  } catch {
    known = {};
  }

  let writeTimer = 0;
  function persist() {
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => {
      /* Drop entries for links that no longer exist. */
      const live = new Set(GT.store.get().items.map((i) => i.url));
      for (const url of Object.keys(known)) if (!live.has(url)) delete known[url];
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(known));
      } catch {
        /* Cache only. */
      }
    }, 500);
  }

  function src(pageUrl) {
    if (!base || !/^https?:/i.test(pageUrl)) return null;
    return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=${SIZE}`;
  }

  function signature(img) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIG;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, SIG, SIG);
    return ctx.getImageData(0, 0, SIG, SIG).data.join(',');
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  /* What _favicon returns for a page it knows nothing about. */
  let fallbackSig = null;
  function fallbackSignature() {
    const probe = src('https://go-tab.invalid/');
    fallbackSig ??= probe ? loadImage(probe).then(signature).catch(() => '') : Promise.resolve('');
    return fallbackSig;
  }

  GT.favicon = {
    src,

    /* 1: has its own icon, 0: falls back to the monogram, undefined: not checked yet. */
    known: (pageUrl) => known[pageUrl],

    /* Resolves true if a loaded _favicon image is a real site icon. A real icon's pixel sample
       also goes to site-icon.js, which refreshes the large icon when it changes. */
    async check(img, pageUrl) {
      const sig = signature(img);
      const ok = sig !== (await fallbackSignature());
      if (ok) GT.siteIcon.noteFavicon(pageUrl, sig);
      if (known[pageUrl] !== +ok) {
        known[pageUrl] = +ok;
        persist();
      }
      return ok;
    },

    /* Links marked "no icon" are checked again once per tab open, in the background, against
       the browser's local favicon store (no network). Once the browser has a real favicon for
       one (say, after a first visit), its tiles switch to it, and check() hands the sample to
       site-icon.js as usual. */
    recheck() {
      const run = () => {
        const urls = new Set(GT.store.get().items
          .filter((it) => !it.icon && known[it.url] === 0 && !GT.siteIcon.get(it.url))
          .map((it) => it.url));
        for (const url of urls) {
          const s = GT.favicon.src(url);
          if (!s) continue;
          loadImage(s)
            .then((img) => GT.favicon.check(img, url))
            .then((ok) => ok && GT.render.refreshIcons(GT.siteIcon.originOf(url)))
            .catch(() => {});
        }
      };
      (globalThis.requestIdleCallback || setTimeout)(run, { timeout: 5000 });
    },

    forget(pageUrl) {
      known[pageUrl] = 0;
      persist();
    }
  };
})(window.GT = window.GT || {});
