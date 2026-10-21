/* Edit mode (SPEC §4): edit bar, tile Edit/Delete buttons, group handle and ⋯ menu,
   rename, Alt+↑/↓ group reorder, and the live region used for announcements. */
(function (GT) {
  'use strict';

  const { h, TILE_HINT, GROUP_HINT } = GT.ui;
  const root = document.getElementById('app');

  /* ---------- Live region ---------- */

  /* Polite status pill, bottom-centre. Created empty at load and never re-created, so screen
     readers are already watching it when the first announcement arrives. */
  const live = h('div', { class: 'sr-live', role: 'status', 'aria-live': 'polite' });
  root.append(live);
  let clearTimer = 0;
  GT.announce = (text, { clearAfter = 0 } = {}) => {
    clearTimeout(clearTimer);
    live.textContent = text;
    if (clearAfter) clearTimer = setTimeout(() => (live.textContent = ''), clearAfter);
  };

  /* ---------- Mode ---------- */

  const section = (id) => root.querySelector(`.group[data-group-id="${CSS.escape(id)}"]`);
  const inSection = (id, sel) => section(id)?.querySelector(sel) || null;

  GT.edit = {
    on: false,

    enter() {
      if (GT.edit.on) return;
      GT.edit.on = true;
      GT.app.repaint();
      root.querySelector('[data-action="edit-done"]')?.focus();
    },

    exit() {
      if (!GT.edit.on || GT.drag.active()) return;
      GT.edit.on = false;
      GT.app.repaint();
      GT.announce('', {});
      root.querySelector('[data-action="edit"]')?.focus();
    },

    /* Turn a group's heading into a name field. Enter or blur saves, Esc cancels,
       an empty name reverts. */
    rename(id, { select = false } = {}) {
      const group = GT.store.get().groups.find((g) => g.id === id);
      const heading = inSection(id, '.gh');
      if (!group || !heading) return;
      const inputId = `rename-${id}`;
      const input = h('input', { class: 'gh-input', id: inputId, type: 'text', autocomplete: 'off', spellcheck: 'false' });
      input.value = group.name;
      heading.style.padding = '2px';
      heading.replaceChildren(
        h('label', { class: 'sr-only', for: inputId, text: 'Group name' }),
        input,
        h('span', { class: 'gh-hint', text: 'Enter to save · Esc to cancel' }));
      /* The field is wider than the name and can re-wrap the groups; size again. */
      GT.size.fit(root, GT.store.get());

      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        const name = input.value.trim();
        if (save && name && name !== group.name) GT.ops.renameGroup(id, name);
        else GT.app.repaint();
        inSection(id, '.handle')?.focus();
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
        else return;
        e.preventDefault();
        e.stopPropagation();
      });
      input.addEventListener('blur', () => finish(true));
      input.focus();
      if (select) input.select();
    },

    addGroup() {
      const id = GT.ops.addGroup('New group');
      GT.edit.rename(id, { select: true });
    },

    /* Move a group up (-1) or down (+1), keeping focus on `focusSel` inside it. */
    moveGroup(id, delta, focusSel) {
      const groups = GT.store.get().groups;
      const i = groups.findIndex((g) => g.id === id);
      const to = i + delta;
      if (i < 0 || to < 0 || to >= groups.length) return;
      GT.ops.moveGroup(id, to);
      inSection(id, focusSel)?.focus();
      GT.announce(`${groups[i].name}: position ${to + 1} of ${groups.length}`, { clearAfter: 3000 });
    },

    openGroupMenu(btn) {
      const id = btn.closest('.group').dataset.groupId;
      const { groups, groupLayout } = GT.store.get();
      const i = groups.findIndex((g) => g.id === id);
      if (i < 0) return;
      const back = GT.focus.locator(btn);
      /* "Start on a new row" only matters side by side; in One per row every group already does,
         and so does the first group. */
      const rowsLayout = groupLayout === 'rows';
      const newRow = rowsLayout || i === 0 || groups[i].newRow;
      GT.menu.open({
        anchor: btn.closest('.gh'),
        gap: 6,
        trigger: btn,
        label: `${groups[i].name} group options`,
        returnFocus: back,
        entries: [
          { icon: GT.icon.pencil(16), label: 'Rename', action: 'rename' },
          { icon: GT.icon.arrowUp(), label: 'Move up', kbd: 'Alt ↑', action: 'up', disabled: i === 0 },
          { icon: GT.icon.arrowDown(), label: 'Move down', kbd: 'Alt ↓', action: 'down', disabled: i === groups.length - 1 },
          { icon: GT.icon.newRow(), label: 'Start on a new row', kbd: newRow ? GT.icon.check() : '', action: 'newrow', checked: newRow, disabled: rowsLayout || i === 0 },
          { icon: GT.icon.plus(16), label: 'Add item here', action: 'add' },
          'sep',
          { icon: GT.icon.trash(16), label: 'Delete group…', action: 'delete', danger: true }
        ],
        onSelect(e) {
          if (e.action === 'rename') GT.edit.rename(id);
          else if (e.action === 'up') GT.edit.moveGroup(id, -1, '.gmore');
          else if (e.action === 'down') GT.edit.moveGroup(id, 1, '.gmore');
          else if (e.action === 'newrow') {
            GT.ops.setGroupNewRow(id, !groups[i].newRow);
            inSection(id, '.gmore')?.focus();
            GT.announce(`${groups[i].name}: ${groups[i].newRow ? 'joins the row before' : 'starts a new row'}`, { clearAfter: 3000 });
          }
          else if (e.action === 'add') GT.itemDialog.add({ groupId: id, returnFocus: back });
          else if (e.action === 'delete') GT.confirm.deleteGroup(id, { returnFocus: back });
        }
      });
    }
  };

  /* ---------- Events ---------- */

  root.addEventListener('dblclick', (e) => {
    const name = e.target.closest('.gh-edit .gname');
    if (GT.edit.on && name) GT.edit.rename(name.closest('.group').dataset.groupId, { select: true });
  });

  /* Alt+↑/↓ on a focused handle moves the group. */
  root.addEventListener('keydown', (e) => {
    if (!GT.edit.on || !e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const handle = e.target.closest('.handle');
    if (!handle) return;
    e.preventDefault();
    GT.edit.moveGroup(handle.closest('.group').dataset.groupId, e.key === 'ArrowUp' ? -1 : 1, '.handle');
  });

  /* The edit bar's hint follows what has focus: tiles or group headings. */
  root.addEventListener('focusin', (e) => {
    const hint = root.querySelector('.editbar .hint');
    if (hint) hint.textContent = e.target.closest('.gh-edit') ? GROUP_HINT : TILE_HINT;
  });

  /* Tiles are drag sources in edit mode, not links. */
  root.addEventListener('click', (e) => {
    if (GT.edit.on && e.target.closest('.tile')) e.preventDefault();
  });
  root.addEventListener('auxclick', (e) => {
    if (GT.edit.on && e.target.closest('.tile')) e.preventDefault();
  });
  root.addEventListener('dragstart', (e) => {
    if (GT.edit.on) e.preventDefault();
  });
})(window.GT = window.GT || {});
