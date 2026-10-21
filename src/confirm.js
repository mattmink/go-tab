/* Delete confirmations (SPEC §4): alertdialogs whose initial focus is Cancel, so Enter is safe. */
(function (GT) {
  'use strict';

  const { h, siteIcon, domainLabel, displayTitle } = GT.ui;
  const root = document.getElementById('app');

  const groupName = (config, id) => config.groups.find((g) => g.id === id)?.name || GT.ui.OTHERS;

  /* "A", "A and B", "A, B and C", "A, B, C, D, E and 3 more". */
  function listNames(names, max = 5) {
    if (names.length > max) return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }

  /* Where focus goes once a tile is gone: the next tile, else the previous, else the group's Add tile. */
  function neighbourOf(id) {
    const tw = root.querySelector(`.tw[data-id="${CSS.escape(id)}"]`);
    if (!tw) return null;
    const siblings = [...tw.parentElement.children].filter((el) => el.matches('.tw[data-id]'));
    const i = siblings.indexOf(tw);
    const next = siblings[i + 1] || siblings[i - 1];
    if (next) return next.dataset.id;
    const ghost = tw.parentElement.querySelector('.ghost');
    return ghost ? GT.focus.locator(ghost) : () => root.querySelector('.tile, .ghost');
  }

  function shell({ title, describedBy, sm, body, confirmLabel }) {
    const form = h('form', {
      class: sm ? 'dialog sm' : 'dialog', role: 'alertdialog', 'aria-modal': 'true',
      'aria-labelledby': 'dlg-t', 'aria-describedby': describedBy
    });
    form.append(
      h('div', { class: 'dh' }, h('div', {}, h('h2', { id: 'dlg-t', text: title }), ...(body.head || []))),
      ...(body.rest || []),
      h('div', { class: 'df' },
        h('button', { class: 'btn btn-secondary', type: 'button', 'data-r': 'cancel', text: 'Cancel' }),
        h('button', { class: 'btn btn-danger', type: 'submit', text: confirmLabel })));
    return form;
  }

  GT.confirm = {
    /* Import confirmation. Resolves true for Replace, false for Cancel/Esc. */
    replace({ title, body, returnFocus }) {
      return new Promise((resolve) => {
        const form = shell({
          title, describedBy: 'dlg-d', sm: true, confirmLabel: 'Replace',
          body: { head: [h('p', { class: 'dbody', id: 'dlg-d', text: body })] }
        });
        let ok = false;
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          ok = true;
          handle.close();
        });
        form.querySelector('[data-r="cancel"]').addEventListener('click', () => handle.close(true));
        const handle = GT.dialog.open({
          form,
          initialFocus: form.querySelector('[data-r="cancel"]'),
          returnFocus: () => {
            resolve(ok);
            return GT.focus.resolve(returnFocus);
          }
        });
      });
    },

    /**
     * @param {string} id
     * @param {object} o
     * @param {HTMLElement|Function} [o.returnFocus] where focus goes on Cancel
     * @param {Function} [o.onDeleted] called with the focus target after deleting
     */
    deleteItem(id, { returnFocus, onDeleted } = {}) {
      const config = GT.store.get();
      const item = config.items.find((it) => it.id === id);
      if (!item) return;

      const form = shell({
        title: 'Delete this link?', describedBy: 'dlg-d', sm: true, confirmLabel: 'Delete',
        body: {
          rest: [
            h('div', { class: 'itemchip' }, siteIcon(item),
              h('span', { style: 'min-width:0' },
                h('b', { text: displayTitle(item) }),
                h('span', { text: `${domainLabel(item.url)} · ${groupName(config, item.groupId)}` }))),
            h('p', { class: 'dbody', id: 'dlg-d', style: 'margin:0', text: 'It will be removed from your new tab page.' })
          ]
        }
      });

      let after = null;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        after = neighbourOf(id);
        GT.ops.deleteItem(id);
        handle.close();
        onDeleted?.(after);
      });
      form.querySelector('[data-r="cancel"]').addEventListener('click', () => handle.close(true));

      const handle = GT.dialog.open({
        form,
        initialFocus: form.querySelector('[data-r="cancel"]'),
        returnFocus: () => (onDeleted || !after ? GT.focus.resolve(returnFocus) : GT.focus.resolve(after))
      });
    },

    deleteGroup(id, { returnFocus } = {}) {
      const config = GT.store.get();
      const group = config.groups.find((g) => g.id === id);
      if (!group) return;
      const items = config.items.filter((it) => it.groupId === id);
      const n = items.length;

      const desc = h('p', { class: 'dbody', id: 'dlg-d' });
      let rest = [];
      if (n) {
        desc.append('It still has ', h('b', { text: n === 1 ? '1 item' : `${n} items` }),
          `: ${listNames(items.map(displayTitle))}. What should happen to ${n === 1 ? 'it' : 'them'}?`);
        const choice = (value, title, sub, checked) =>
          h('label', { class: checked ? 'choice is-sel' : 'choice' },
            h('input', { type: 'radio', name: 'items', value, checked }),
            h('span', {}, h('b', { text: title }), h('span', { text: sub })));
        const fieldset = h('fieldset', { class: 'choices', style: 'border:0;margin:0;padding:0' },
          h('legend', { class: 'sr-only', text: `What to do with the ${n === 1 ? 'item' : 'items'}` }),
          choice('move', n === 1 ? `Move it to ${GT.ui.OTHERS}` : `Move them to ${GT.ui.OTHERS}`,
            `Keeps the ${n === 1 ? 'link' : 'links'}. You can sort ${n === 1 ? 'it' : 'them'} into other groups later.`, true),
          choice('delete', n === 1 ? 'Delete it too' : 'Delete them too',
            `Removes the group and ${n === 1 ? 'its link' : `all ${n} links`}. This can’t be undone.`, false));
        fieldset.addEventListener('change', () => {
          for (const label of fieldset.querySelectorAll('.choice')) {
            label.classList.toggle('is-sel', label.querySelector('input').checked);
          }
        });
        rest = [fieldset];
      } else {
        desc.textContent = 'The group is empty.';
      }

      const form = shell({
        title: `Delete the “${group.name}” group?`, describedBy: 'dlg-d', confirmLabel: 'Delete group',
        body: { head: [desc], rest }
      });

      let done = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const mode = form.querySelector('input[name="items"]:checked')?.value || 'move';
        GT.ops.deleteGroup(id, mode);
        done = true;
        handle.close();
      });
      form.querySelector('[data-r="cancel"]').addEventListener('click', () => handle.close(true));

      const handle = GT.dialog.open({
        form,
        initialFocus: form.querySelector('[data-r="cancel"]'),
        returnFocus: () => (done ? root.querySelector('.tile, .ghost, [data-action="settings"]') : GT.focus.resolve(returnFocus))
      });
    }
  };
})(window.GT = window.GT || {});
