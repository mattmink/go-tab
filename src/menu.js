/* Menus (SPEC §4): role="menu", arrow keys, Home/End, Esc closes and returns focus.
   Used for the tile actions menu (right-click, Shift+F10, Menu key) and the group ⋯ menu. */
(function (GT) {
  'use strict';

  const { h, displayTitle } = GT.ui;
  const root = document.getElementById('app');

  /* { menu, sub, opts } */
  let current = null;

  const itemsOf = (menu) => [...menu.querySelectorAll('.mi')];

  function focusItem(menu, index) {
    const list = itemsOf(menu);
    if (!list.length) return;
    const i = (index + list.length) % list.length;
    list.forEach((el, k) => el.classList.toggle('is-active', k === i));
    list[i].focus();
  }

  /* Position at viewport (x, y); flip above when there's no room below. */
  function place(menu, x, y, flipAbove) {
    const rootBox = root.getBoundingClientRect();
    const { width, height } = menu.getBoundingClientRect();
    let top = y;
    if (top + height > innerHeight - 8) top = flipAbove(height);
    const left = Math.max(8, Math.min(x, innerWidth - width - 8));
    menu.style.top = `${Math.max(8, top) - rootBox.top}px`;
    menu.style.left = `${left - rootBox.left}px`;
  }

  function close({ restore = true } = {}) {
    if (!current) return;
    const { menu, sub, opts } = current;
    current = null;
    sub?.remove();
    menu.remove();
    if (opts.trigger) {
      opts.trigger.setAttribute('aria-expanded', 'false');
      opts.trigger.classList.remove('is-on');
    }
    const back = GT.focus.resolve(opts.returnFocus);
    if (restore && back?.isConnected) back.focus();
  }

  function closeSub() {
    if (!current?.sub) return;
    current.sub.remove();
    current.sub = null;
    current.menu.querySelector('[aria-haspopup]')?.setAttribute('aria-expanded', 'false');
  }

  /* Entry: { icon, label, kbd, action, danger, disabled, checked, submenu: () => entries, data } or 'sep'. */
  function build(entries, label) {
    const menu = h('div', { class: 'menu', role: 'menu', 'aria-label': label });
    for (const e of entries) {
      if (e === 'sep') {
        menu.append(h('div', { class: 'msep', role: 'separator' }));
        continue;
      }
      const b = h('button', {
        class: e.danger ? 'mi danger' : 'mi', type: 'button', tabindex: '-1',
        /* An entry with `checked` is a toggle: a menuitemcheckbox with a tick when on. */
        role: e.checked === undefined ? 'menuitem' : 'menuitemcheckbox',
        'aria-checked': e.checked === undefined ? null : String(!!e.checked),
        'aria-haspopup': e.submenu ? 'menu' : null, 'aria-expanded': e.submenu ? 'false' : null,
        'aria-disabled': e.disabled ? 'true' : null
      });
      b.innerHTML = e.icon || '';
      b.append(e.label);
      if (e.kbd) b.append(h('span', { class: 'kbd', html: e.kbd }));
      b.entry = e;
      menu.append(b);
    }
    return menu;
  }

  function activate(b) {
    const e = b?.entry;
    if (!e || e.disabled) return;
    if (e.submenu) return openSub(b);
    const { opts } = current;
    close({ restore: !!e.restoreFocus });
    opts.onSelect(e);
  }

  function wire(menu, { isSub }) {
    menu.addEventListener('keydown', (ev) => {
      const list = itemsOf(menu);
      const i = list.indexOf(document.activeElement);
      const key = ev.key;
      if (key === 'ArrowDown') focusItem(menu, i + 1);
      else if (key === 'ArrowUp') focusItem(menu, i - 1);
      else if (key === 'Home') focusItem(menu, 0);
      else if (key === 'End') focusItem(menu, list.length - 1);
      else if (key === 'ArrowRight' && document.activeElement?.entry?.submenu) openSub(document.activeElement);
      else if (isSub && (key === 'ArrowLeft' || key === 'Escape')) {
        const trigger = current.menu.querySelector('[aria-haspopup]');
        closeSub();
        trigger?.focus();
      } else if (key === 'Escape' || key === 'Tab') close();
      else {
        /* Shortcut letters shown in the menu (E, Del) work while it's open. */
        const hit = !isSub && list.find((b) => b.entry.keys?.includes(key));
        if (!hit) return;
        activate(hit);
      }
      ev.preventDefault();
      ev.stopPropagation();
    });
    menu.addEventListener('click', (ev) => activate(ev.target.closest('.mi')));
    menu.addEventListener('pointerover', (ev) => {
      const b = ev.target.closest('.mi');
      if (!b) return;
      focusItem(menu, itemsOf(menu).indexOf(b));
      if (isSub) return;
      if (b.entry.submenu) openSub(b);
      else closeSub();
    });
  }

  function openSub(trigger) {
    if (!current || current.sub) return;
    const sub = build(trigger.entry.submenu(), trigger.entry.label);
    wire(sub, { isSub: true });
    root.append(sub);
    current.sub = sub;
    trigger.setAttribute('aria-expanded', 'true');

    const box = current.menu.getBoundingClientRect();
    const t = trigger.getBoundingClientRect();
    const subW = sub.getBoundingClientRect().width;
    const x = box.right + 4 + subW > innerWidth - 8 ? box.left - 4 - subW : box.right + 4;
    place(sub, x, t.top - 6, (height) => t.bottom + 6 - height);
    const firstEnabled = itemsOf(sub).findIndex((el) => !el.entry.disabled);
    focusItem(sub, Math.max(0, firstEnabled));
  }

  GT.menu = {
    isOpen: () => !!current,
    close,

    /**
     * @param {object} o
     * @param {HTMLElement} o.anchor   box the menu opens below (left-aligned)
     * @param {number} o.gap           px between anchor and menu
     * @param {string} o.label         accessible name
     * @param {Array} o.entries
     * @param {Function} o.onSelect    called with the chosen entry after the menu closes
     * @param {HTMLElement|Function} o.returnFocus  focus target on Esc
     * @param {HTMLElement} [o.trigger] button that gets aria-expanded
     */
    open(o) {
      close({ restore: false });
      const menu = build(o.entries, o.label);
      wire(menu, { isSub: false });
      root.append(menu);
      current = { menu, sub: null, opts: o };
      if (o.trigger) {
        o.trigger.setAttribute('aria-expanded', 'true');
        o.trigger.classList.add('is-on');
      }
      const box = o.anchor.getBoundingClientRect();
      place(menu, box.left, box.bottom + o.gap, (height) => box.top - o.gap - height);
      focusItem(menu, 0);
    },

    /* Tile actions: Open in new tab · Edit… (E) · Move to group ▸ · Delete… (Del). */
    openForTile(tile) {
      const tw = tile.closest('.tw[data-id]');
      if (!tw) return;
      const id = tw.dataset.id;
      const item = GT.store.get().items.find((it) => it.id === id);
      if (!item) return;
      const back = GT.focus.locator(tile);

      GT.menu.open({
        anchor: tw,
        gap: 12,
        label: `${displayTitle(item)} actions`,
        returnFocus: back,
        entries: [
          { icon: GT.icon.external(), label: 'Open in new tab', action: 'open', restoreFocus: true },
          { icon: GT.icon.pencil(16), label: 'Edit…', kbd: 'E', keys: ['e', 'E'], action: 'edit' },
          {
            icon: GT.icon.folder(), label: 'Move to group', kbd: GT.icon.chevronRight(), action: 'move',
            submenu: () => {
              const config = GT.store.get();
              return [...config.groups, { id: null, name: GT.ui.OTHERS }].map((g) => ({
                label: g.name, action: 'move-to', data: g.id, disabled: g.id === item.groupId
              }));
            }
          },
          'sep',
          { icon: GT.icon.trash(16), label: 'Delete…', kbd: 'Del', keys: ['Delete', 'Backspace'], action: 'delete', danger: true }
        ],
        onSelect(e) {
          if (e.action === 'open') {
            if (globalThis.chrome?.tabs?.create) chrome.tabs.create({ url: item.url, active: false });
            else window.open(item.url, '_blank', 'noopener');
          } else if (e.action === 'edit') {
            GT.itemDialog.edit(id, { returnFocus: back });
          } else if (e.action === 'delete') {
            GT.confirm.deleteItem(id, { returnFocus: back });
          } else if (e.action === 'move-to') {
            GT.ops.moveItemToGroup(id, e.data);
            GT.focus.tile(id)?.focus();
          }
        }
      });
    }
  };

  /* Close on any press outside, and when the page scrolls, resizes or loses focus. */
  document.addEventListener('pointerdown', (e) => {
    if (current && !current.menu.contains(e.target) && !current.sub?.contains(e.target)) close({ restore: false });
  }, true);
  root.addEventListener('scroll', () => close({ restore: false }), true);
  addEventListener('resize', () => close({ restore: false }));
  addEventListener('blur', () => close({ restore: false }));
})(window.GT = window.GT || {});
