/* Boot: paint from the cache synchronously, then reconcile with chrome.storage. */
(function (GT) {
  'use strict';

  const root = document.getElementById('app');

  /* Everything but the background: when only the background changed (a colour picker or
     angle slider moving), repaint just the background and tone, not every tile. */
  let lastLayout = null;
  const layoutKey = (c) => JSON.stringify({ ...c, background: null });

  function paint(config, { force = false } = {}) {
    const key = layoutKey(config);
    if (!force && key === lastLayout && root.querySelector('.stage')) {
      GT.render.background(root, config);
      GT.settings.afterPaint();
      return;
    }
    lastLayout = key;
    const hadFocus = root.contains(document.activeElement);
    GT.drag.abort();
    if (config.items.length === 0 && config.groups.length === 0) GT.edit.on = false;
    GT.render(root, config, { editing: GT.edit.on, settings: GT.settings.isOpen() });
    GT.size.fit(root, config);
    GT.roving.apply();
    GT.settings.afterPaint();
    if (config.items.length === 0 && config.groups.length === 0 && !hadFocus && !GT.settings.isOpen()) {
      /* Chrome keeps focus in the omnibox on a new tab, so this only lands once the page has focus. */
      root.querySelector('[data-action="add-item"]')?.focus();
    }
  }

  /* A short message bottom-centre, for import errors from the empty state. */
  function toast(message) {
    root.querySelector(':scope > .toast')?.remove();
    const el = GT.ui.h('div', { class: 'toast', role: 'alert' }, GT.ui.h('span', { text: message }),
      GT.ui.h('button', { class: 'btn btn-quiet btn-sm', type: 'button', text: 'Dismiss' }));
    el.querySelector('button').addEventListener('click', () => el.remove());
    root.append(el);
    setTimeout(() => el.remove(), 8000);
  }

  /* Add item: preselect the group whose Add tile was used, else the first group. */
  function addItem(btn) {
    const config = GT.store.get();
    const fromGhost = btn?.dataset.groupId;
    const groupId = fromGhost !== undefined
      ? fromGhost || null
      : (config.grouping && config.groups[0]?.id) || null;
    GT.itemDialog.add({ groupId, returnFocus: btn ? GT.focus.locator(btn) : document.activeElement });
  }

  const inTile = (btn) => btn.closest('.tw[data-id]').dataset.id;

  const actions = {
    'add-item': addItem,
    edit: () => GT.edit.enter(),
    'edit-done': () => GT.edit.exit(),
    'add-group': () => GT.edit.addGroup(),
    'tile-edit': (btn) => GT.itemDialog.edit(inTile(btn), { returnFocus: GT.focus.locator(btn) }),
    'tile-delete': (btn) => GT.confirm.deleteItem(inTile(btn), { returnFocus: GT.focus.locator(btn) }),
    'group-menu': (btn) => GT.edit.openGroupMenu(btn),
    import: async (btn) => {
      const msg = await GT.backup.import({ returnFocus: GT.focus.locator(btn) });
      if (msg) toast(msg);
    },
    settings: (btn) => GT.settings.open(btn)
  };

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn && actions[btn.dataset.action]) actions[btn.dataset.action](btn);
  });

  /* Right-click, Shift+F10 and the Menu key all arrive as contextmenu. */
  root.addEventListener('contextmenu', (e) => {
    const tile = e.target.closest('.tw[data-id] .tile');
    if (!tile) return;
    e.preventDefault();
    tile.focus();
    GT.menu.openForTile(tile);
  });

  const isTyping = (el) =>
    el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.shiftKey && e.key !== 'F10' && e.key !== 'N') return;
    if (GT.dialog.isOpen() || GT.menu.isOpen() || isTyping(document.activeElement)) return;
    if (GT.settings.isOpen()) {
      if (e.key === 'Escape') GT.settings.close();
      return;
    }

    /* E and Del on a focused tile: the keyboard path to edit and delete outside edit mode. */
    const tile = document.activeElement?.closest?.('.tw[data-id] .tile');
    if (tile) {
      const id = tile.closest('.tw').dataset.id;
      /* Handled here as well as via contextmenu, which not every platform fires for these keys;
         preventDefault stops the native contextmenu from opening it twice. */
      if ((e.key === 'F10' && e.shiftKey) || e.key === 'ContextMenu') {
        e.preventDefault();
        GT.menu.openForTile(tile);
        return;
      }
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        GT.itemDialog.edit(id, { returnFocus: GT.focus.locator(tile) });
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        GT.confirm.deleteItem(id, { returnFocus: GT.focus.locator(tile) });
        return;
      }
    }

    /* E with nothing focused enters edit mode; Esc leaves it. */
    const nothingFocused = !root.contains(document.activeElement) || document.activeElement === root;
    if ((e.key === 'e' || e.key === 'E') && nothingFocused && !GT.edit.on) {
      e.preventDefault();
      GT.edit.enter();
      return;
    }
    if (e.key === 'Escape' && GT.edit.on) {
      e.preventDefault();
      GT.edit.exit();
      return;
    }

    /* N opens Add item anywhere on the page when no field is focused (SPEC §4, Empty state). */
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      addItem(null);
    }
  });

  /* ---------- XS tooltips: 400ms after hover, immediately on keyboard focus ---------- */

  let tipTimer = 0;
  function showTip(tw) {
    hideTip();
    const link = tw.querySelector('.tile[data-title]');
    if (!link) return;
    const tip = document.createElement('span');
    tip.className = 'tip';
    tip.setAttribute('aria-hidden', 'true'); /* The link's aria-label already carries the title. */
    tip.textContent = link.dataset.title;
    tw.append(tip);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    root.querySelector('.tip')?.remove();
  }
  const isXs = () => root.classList.contains('sz-xs');

  root.addEventListener('pointerover', (e) => {
    const tw = e.target.closest('.tw');
    if (!tw || !isXs() || tw.contains(e.relatedTarget)) return;
    hideTip();
    tipTimer = setTimeout(() => showTip(tw), 400);
  });
  root.addEventListener('pointerout', (e) => {
    const tw = e.target.closest('.tw');
    if (tw && !tw.contains(e.relatedTarget)) hideTip();
  });
  root.addEventListener('focusin', (e) => {
    if (isXs() && e.target.matches('.tile:focus-visible')) showTip(e.target.parentElement);
  });
  root.addEventListener('focusout', hideTip);

  /* ---------- Boot ---------- */

  paint(GT.store.get());
  /* First-paint budget check: compare go-tab:boot in DevTools → Performance (user timings). */
  performance.mark('go-tab:painted');
  performance.measure('go-tab:boot', 'go-tab:start', 'go-tab:painted');
  GT.store.subscribe(paint);
  GT.siteIcon.watch();
  GT.favicon.recheck();
  GT.store.init().catch((err) => console.error('[go-tab] storage read failed', err));

  GT.app = { repaint: () => paint(GT.store.get(), { force: true }) };

  /* Re-fit on resize (debounced), without re-rendering and with no transition between steps. */
  let resizeTimer = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => GT.size.fit(root, GT.store.get()), 100);
  });
})(window.GT);
