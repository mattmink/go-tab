/* Config mutations shared by dialogs, menus and (later) edit mode. Order is array order. */
(function (GT) {
  'use strict';

  const newId = (prefix) => prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  /* Move item `id` to the end of the items in `groupId` (null = Others). */
  function placeAtEndOfGroup(items, item, groupId) {
    item.groupId = groupId;
    let at = -1;
    items.forEach((it, i) => {
      if (it.groupId === groupId && it !== item) at = i;
    });
    items.splice(at + 1, 0, item);
  }

  GT.ops = {
    newId,

    /* Returns the new group's id. */
    addGroup(name) {
      const id = newId('g');
      GT.store.update((c) => {
        c.groups.push({ id, name });
      });
      return id;
    },

    /* `item` without id; `newGroupName` creates a group to put it in. Returns the new id. */
    addItem(item, newGroupName) {
      const id = newId('i');
      GT.store.update((c) => {
        let groupId = item.groupId;
        if (newGroupName) {
          groupId = newId('g');
          c.groups.push({ id: groupId, name: newGroupName });
        }
        placeAtEndOfGroup(c.items, { ...item, id }, groupId);
      });
      return id;
    },

    updateItem(id, patch, newGroupName) {
      GT.store.update((c) => {
        const item = c.items.find((it) => it.id === id);
        if (!item) return;
        const oldGroupId = item.groupId;
        let groupId = patch.groupId === undefined ? oldGroupId : patch.groupId;
        if (newGroupName) {
          groupId = newId('g');
          c.groups.push({ id: groupId, name: newGroupName });
        }
        Object.assign(item, patch, { groupId });
        /* Same group keeps its position; a new group puts it last there. */
        if (groupId !== oldGroupId) {
          c.items.splice(c.items.indexOf(item), 1);
          placeAtEndOfGroup(c.items, item, groupId);
        }
      });
    },

    /* In the side-by-side layout, start this group on a new row. */
    setGroupNewRow(id, on) {
      GT.store.update((c) => {
        const g = c.groups.find((x) => x.id === id);
        if (g) g.newRow = !!on;
      });
    },

    renameGroup(id, name) {
      GT.store.update((c) => {
        const g = c.groups.find((x) => x.id === id);
        if (g) g.name = name;
      });
    },

    /* Put group `id` at `index` in the group order. */
    moveGroup(id, index) {
      GT.store.update((c) => {
        const i = c.groups.findIndex((g) => g.id === id);
        if (i < 0) return;
        const [g] = c.groups.splice(i, 1);
        c.groups.splice(Math.max(0, Math.min(index, c.groups.length)), 0, g);
      });
    },

    /* Drag and drop result: item `id` goes into `groupId`, before item `beforeId`
       (or last in that group when beforeId is null). */
    reorder(id, groupId, beforeId) {
      GT.store.update((c) => {
        const i = c.items.findIndex((it) => it.id === id);
        if (i < 0) return;
        const [item] = c.items.splice(i, 1);
        const at = beforeId ? c.items.findIndex((it) => it.id === beforeId) : -1;
        if (at < 0) placeAtEndOfGroup(c.items, item, groupId);
        else {
          item.groupId = groupId;
          c.items.splice(at, 0, item);
        }
      });
    },

    moveItemToGroup(id, groupId) {
      GT.store.update((c) => {
        const i = c.items.findIndex((it) => it.id === id);
        if (i < 0) return;
        const [item] = c.items.splice(i, 1);
        placeAtEndOfGroup(c.items, item, groupId);
      });
    },

    deleteItem(id) {
      GT.store.update((c) => {
        c.items = c.items.filter((it) => it.id !== id);
      });
    },

    /* mode: 'move' sends the group's items to Others, 'delete' removes them too. */
    deleteGroup(id, mode) {
      GT.store.update((c) => {
        c.groups = c.groups.filter((g) => g.id !== id);
        if (mode === 'delete') c.items = c.items.filter((it) => it.groupId !== id);
        else
          for (const it of c.items) if (it.groupId === id) it.groupId = null;
      });
    }
  };
})(window.GT = window.GT || {});
