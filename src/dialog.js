/* Modal dialogs (SPEC §4): scrim, inert background, focus trap, Esc to cancel,
   focus returned to the trigger. Dialogs stack, e.g. Delete opened from Edit item. */
(function (GT) {
  'use strict';

  const root = document.getElementById('app');
  const stack = [];

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusables(el) {
    return [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
  }

  /* Inert is worked out from what is open right now, never saved and restored: a repaint while
     a dialog is open (Save, Delete, Import…) replaces the page elements, so anything saved
     would point at detached nodes and the new ones would stay inert after the dialog closes.
     - A dialog is open: everything behind it, including lower dialogs and the settings panel.
     - The settings panel is open: the page (visible beside it, but not interactive). */
  function syncInert() {
    const modal = stack.length > 0;
    const sheetOpen = !!root.querySelector(':scope > .sheet');
    for (const el of root.querySelectorAll(':scope > .toolbar, :scope > .editbar, :scope > .sheet, :scope > .toast')) el.inert = modal;
    for (const el of root.querySelectorAll(':scope > .stage')) el.inert = modal || sheetOpen;
    stack.forEach((h, i) => (h.scrim.inert = i < stack.length - 1));
  }

  /* `trigger` may be an element or a function returning one; it's resolved at close time
     because a repaint may have replaced the original element. */
  function restoreFocus(trigger) {
    const el = GT.focus.resolve(trigger);
    if (el && el.isConnected) el.focus();
  }

  /* Focus targets that survive a repaint: an item id, an element, or a function returning one. */
  GT.focus = {
    tile: (id) => (id ? root.querySelector(`.tw[data-id="${CSS.escape(id)}"] .tile`) : null),

    /* A function that finds `el` (or its replacement after a repaint) again later. */
    locator(el) {
      if (!el) return () => null;
      const tw = el.closest('.tw[data-id]');
      const group = el.closest('.group[data-group-id]');
      const scope = tw
        ? `.tw[data-id="${CSS.escape(tw.dataset.id)}"] `
        : group ? `.group[data-group-id="${CSS.escape(group.dataset.groupId)}"] ` : '';
      let sel = null;
      if (el.classList.contains('tile')) sel = `${scope}.tile`;
      else if (el.dataset.action) {
        sel = `${scope}[data-action="${el.dataset.action}"]` +
          (el.dataset.groupId !== undefined ? `[data-group-id="${CSS.escape(el.dataset.groupId)}"]` : '');
      }
      return () => (el.isConnected || !sel ? el : root.querySelector(sel));
    },

    resolve(target) {
      if (typeof target === 'string') return GT.focus.tile(target);
      if (typeof target === 'function') return target();
      return target || null;
    }
  };

  GT.dialog = {
    isOpen: () => stack.length > 0,

    /* Called after every render and when the settings panel opens or closes. */
    syncInert,

    /**
     * Show `form` (a .dialog element) modally.
     * @param {object} o
     * @param {HTMLElement} o.form
     * @param {HTMLElement|Function} [o.initialFocus]
     * @param {HTMLElement|Function} [o.returnFocus]
     * @param {Function} [o.onCancel] called on Esc or close().
     */
    open({ form, initialFocus, returnFocus, onCancel }) {
      const scrim = GT.ui.h('div', { class: 'scrim' }, form);

      const handle = {
        form,
        scrim,
        closed: false,
        close(cancelled = false) {
          if (handle.closed) return;
          handle.closed = true;
          stack.splice(stack.indexOf(handle), 1);
          scrim.remove();
          syncInert();
          if (cancelled && onCancel) onCancel();
          restoreFocus(returnFocus);
        }
      };

      scrim.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          handle.close(true);
        } else if (e.key === 'Tab') {
          const items = focusables(form);
          if (!items.length) return;
          const first = items[0];
          const last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        /* Keep page shortcuts (N, E, Delete…) from firing behind the dialog. */
        e.stopPropagation();
      });

      stack.push(handle);
      root.append(scrim);
      syncInert();
      const target = typeof initialFocus === 'function' ? initialFocus() : initialFocus;
      (target || focusables(form)[0])?.focus();
      return handle;
    }
  };
})(window.GT = window.GT || {});
