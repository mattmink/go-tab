/* Config storage: chrome.storage.local is the source of truth; localStorage holds a
   synchronous copy so the first paint never waits on an async read (SPEC §5). */
(function (GT) {
  'use strict';

  const KEY = 'config';
  const CACHE_KEY = 'go-tab:config';
  const VERSION = 1;
  const STEPS = ['xs', 's', 'm', 'l', 'xl'];
  const BG_TYPES = ['solid', 'gradient', 'image'];

  const area = globalThis.chrome && chrome.storage && chrome.storage.local;

  /* First run. `background: null` means the default slate gradient (`.bg-default`). */
  function defaults() {
    return {
      version: VERSION,
      grouping: true,
      groupLayout: 'flow',
      size: { mode: 'auto', step: 'm' },
      background: null,
      groups: [],
      items: []
    };
  }

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
  const HEX = /^#[0-9a-f]{6}$/i;

  function normalizeBackground(bg) {
    if (!isObj(bg) || !BG_TYPES.includes(bg.type)) return null;
    const stops = Array.isArray(bg.stops)
      ? bg.stops
          .filter((s) => Array.isArray(s) && HEX.test(s[0]) && Number.isFinite(s[1]))
          .slice(0, 5)
          .map(([c, p]) => [c, Math.min(100, Math.max(0, p))])
      : [];
    return {
      type: bg.type,
      color: HEX.test(bg.color) ? bg.color : '#232B40',
      stops: stops.length >= 2 ? stops : [['#1F3B57', 0], ['#5B4B8A', 100]],
      angle: Number.isFinite(bg.angle) ? ((bg.angle % 360) + 360) % 360 : 135,
      image: normalizeImage(bg.image)
    };
  }

  /* Image metadata only; the blob itself is in IndexedDB (bg-image.js). */
  function normalizeImage(img) {
    if (!isObj(img) || !str(img.id)) return null;
    const num = (v) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
    return { id: img.id, name: str(img.name), w: num(img.w), h: num(img.h), average: HEX.test(img.average) ? img.average : null };
  }

  /* Coerce anything (stored data, an imported file) into a valid config.
     Unknown fields are dropped; items pointing at missing groups go to Others. */
  function normalize(raw) {
    const base = defaults();
    if (!isObj(raw)) return base;

    const groups = [];
    const groupIds = new Set();
    for (const g of Array.isArray(raw.groups) ? raw.groups : []) {
      if (!isObj(g) || !str(g.id) || groupIds.has(g.id)) continue;
      groupIds.add(g.id);
      groups.push({ id: g.id, name: str(g.name).trim() || 'Untitled', newRow: g.newRow === true });
    }

    const items = [];
    const itemIds = new Set();
    for (const it of Array.isArray(raw.items) ? raw.items : []) {
      if (!isObj(it) || !str(it.id) || !str(it.url) || itemIds.has(it.id)) continue;
      itemIds.add(it.id);
      items.push({
        id: it.id,
        url: it.url,
        title: str(it.title),
        groupId: groupIds.has(it.groupId) ? it.groupId : null,
        icon: str(it.icon) || null
      });
    }

    const size = isObj(raw.size) ? raw.size : {};
    return {
      version: VERSION,
      grouping: typeof raw.grouping === 'boolean' ? raw.grouping : base.grouping,
      /* 'flow': groups sit side by side and wrap; 'rows': every group starts its own row. */
      groupLayout: raw.groupLayout === 'rows' ? 'rows' : 'flow',
      size: {
        mode: size.mode === 'manual' ? 'manual' : 'auto',
        step: STEPS.includes(size.step) ? size.step : 'm'
      },
      background: normalizeBackground(raw.background),
      groups,
      items
    };
  }

  function readCache() {
    try {
      const text = localStorage.getItem(CACHE_KEY);
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }

  function writeCache(config) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(config));
    } catch {
      /* Quota or disabled storage: the cache is an optimisation only. */
    }
  }

  let current = normalize(readCache());
  const listeners = new Set();

  let persistTimer = 0;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = 0;
    writeCache(current);
    return area ? area.set({ [KEY]: current }) : Promise.resolve();
  }
  /* Don't lose a deferred save when the tab closes. */
  addEventListener('pagehide', () => persistTimer && persist());
  document.addEventListener('visibilitychange', () => document.hidden && persistTimer && persist());

  function emit() {
    for (const fn of listeners) fn(current);
  }

  function adopt(raw) {
    const next = normalize(raw);
    if (JSON.stringify(next) === JSON.stringify(current)) return false;
    current = next;
    writeCache(current);
    return true;
  }

  GT.store = {
    STEPS,
    defaults,
    normalize,

    /* Synchronous: the cached config (or defaults). Safe to render from immediately. */
    get() {
      return current;
    },

    /* Reads the authoritative copy. Seeds storage on first run. Resolves to the config;
       subscribers are notified only if it differs from the cache. */
    async init() {
      if (area) {
        const { [KEY]: stored } = await area.get(KEY);
        if (stored === undefined) {
          await area.set({ [KEY]: current });
          writeCache(current);
        } else if (adopt(stored)) {
          emit();
        }
        chrome.storage.onChanged.addListener((changes, name) => {
          if (name === 'local' && changes[KEY] && adopt(changes[KEY].newValue)) emit();
        });
      } else {
        /* Opened outside the extension (e.g. as a plain file): localStorage only. */
        writeCache(current);
      }
      return current;
    },

    /* Replace the config. Memory updates and subscribers run synchronously. With `defer`
       (settings sliders, colour pickers) saving waits until edits pause for ~300ms. */
    set(next, { defer = false } = {}) {
      current = normalize(next);
      if (defer) {
        emit();
        clearTimeout(persistTimer);
        persistTimer = setTimeout(persist, 300);
        return Promise.resolve();
      }
      writeCache(current);
      emit();
      return persist();
    },

    /* Apply a change to a copy of the config: `store.update(c => { c.grouping = false; })`. */
    update(mutator, opts) {
      const draft = structuredClone(current);
      mutator(draft);
      return this.set(draft, opts);
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
})(window.GT = window.GT || {});
