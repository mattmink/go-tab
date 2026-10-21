/* Roving tabindex for tiles (SPEC §4, Focus): the whole grid is one Tab stop; arrows move
   between tiles, Home/End jump to the first/last. Normal mode only: in edit mode every tile
   is a Tab stop (tile → Edit → Delete) and arrows belong to keyboard drag and drop. */
(function (GT) {
  'use strict';

  const root = document.getElementById('app');
  /* The tile that holds the Tab stop, kept across repaints. */
  let currentId = null;

  const tiles = () => [...root.querySelectorAll('.stage .tw[data-id] > .tile')];
  const idOf = (tile) => tile.parentElement.dataset.id;

  function setCurrent(tile) {
    for (const t of tiles()) t.tabIndex = t === tile ? 0 : -1;
    currentId = idOf(tile);
  }

  /* The nearest tile in the row above or below, measured on the page, so it works across
     groups that sit side by side or stack. */
  function vertical(list, from, down) {
    const a = from.getBoundingClientRect();
    const cy = a.top + a.height / 2;
    const cx = a.left + a.width / 2;
    const boxes = list.map((t) => [t, t.getBoundingClientRect()]).filter(([, b]) => (down ? b.top > cy : b.bottom < cy));
    if (!boxes.length) return null;
    const rowTop = down ? Math.min(...boxes.map(([, b]) => b.top)) : Math.max(...boxes.map(([, b]) => b.top));
    const row = boxes.filter(([, b]) => Math.abs(b.top - rowTop) < 8);
    row.sort(([, x], [, y]) => Math.abs(x.left + x.width / 2 - cx) - Math.abs(y.left + y.width / 2 - cx));
    return row[0][0];
  }

  GT.roving = {
    /* After each render: one tile tabbable (the last one used, else the first). */
    apply() {
      const list = tiles();
      if (!list.length) return;
      if (GT.edit.on) {
        for (const t of list) t.removeAttribute('tabindex');
        return;
      }
      setCurrent(list.find((t) => idOf(t) === currentId) || list[0]);
    }
  };

  root.addEventListener('focusin', (e) => {
    const tile = e.target.closest?.('.stage .tw[data-id] > .tile');
    if (tile && !GT.edit.on && tile.tabIndex !== 0) setCurrent(tile);
  });

  root.addEventListener('keydown', (e) => {
    if (GT.edit.on || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tile = e.target.closest('.stage .tw[data-id] > .tile');
    if (!tile) return;
    const list = tiles();
    const i = list.indexOf(tile);
    let next = null;
    if (e.key === 'ArrowRight') next = list[i + 1];
    else if (e.key === 'ArrowLeft') next = list[i - 1];
    else if (e.key === 'ArrowDown') next = vertical(list, tile, true);
    else if (e.key === 'ArrowUp') next = vertical(list, tile, false);
    else if (e.key === 'Home') next = list[0];
    else if (e.key === 'End') next = list[list.length - 1];
    else return;
    e.preventDefault();
    if (!next) return;
    setCurrent(next);
    next.focus();
  });
})(window.GT = window.GT || {});
