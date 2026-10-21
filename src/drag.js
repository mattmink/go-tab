/* Drag and drop in edit mode (SPEC §4). Pointer Events plus FLIP transforms; no library.
   - Tiles, pointer: a floating copy follows the pointer, a dashed slot marks the drop point.
   - Tiles, keyboard: Space/Enter picks up, arrows move, Space/Enter drops, Esc cancels.
   - Groups, pointer: drag by the handle. (Keyboard group moves are Alt+↑/↓, in edit.js.) */
(function (GT) {
  'use strict';

  const { h, displayTitle } = GT.ui;
  const root = document.getElementById('app');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const THRESHOLD = 4;

  /* Untransformed layout boxes from the last FLIP, used for hit testing so in-flight
     animations don't make the drop point jitter. */
  const layout = new Map();
  const boxOf = (el) => layout.get(el) || el.getBoundingClientRect();

  /* Animate `els` from where they are to where `mutate` puts them. */
  function flip(selector, mutate) {
    const before = new Map([...root.querySelectorAll(selector)].map((el) => [el, el.getBoundingClientRect()]));
    mutate();
    const els = [...root.querySelectorAll(selector)];
    layout.clear();
    for (const el of els) {
      el.style.transition = 'none';
      el.style.transform = '';
    }
    for (const el of els) layout.set(el, el.getBoundingClientRect());
    if (reducedMotion.matches) return;
    const moved = [];
    for (const el of els) {
      const a = before.get(el);
      const b = layout.get(el);
      if (!a) continue;
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (!dx && !dy) continue;
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      moved.push(el);
    }
    if (!moved.length) return;
    void root.offsetWidth; /* commit the inverted positions before animating back */
    for (const el of moved) {
      el.style.transition = 'transform 150ms ease';
      el.style.transform = '';
    }
  }

  const TILE_ELS = '.stage .tw, .stage .slot';
  const GROUP_ELS = '.stage .group';

  /* ---------- Tile positions ---------- */

  let drag = null;

  const grouped = () => !!root.querySelector('.stage .groups');
  const containers = () =>
    grouped() ? [...root.querySelectorAll('.stage .group > .tiles')] : [...root.querySelectorAll('.stage .grid-flat')];
  const others = (c) => [...c.children].filter((el) => el.matches('.tw[data-id]') && el !== drag.tw);
  const ghostOf = (c) => c.querySelector(':scope > .tw:not([data-id])');
  const marker = () => (drag.mode === 'pointer' ? drag.slot : drag.tw);

  /* The tile the marker sits before (null = end of the container). */
  function nextTile(el) {
    let n = el.nextElementSibling;
    while (n && !(n.matches('.tw[data-id]') && n !== drag.tw)) n = n.nextElementSibling;
    return n;
  }
  function prevTile(el) {
    let n = el.previousElementSibling;
    while (n && !(n.matches('.tw[data-id]') && n !== drag.tw)) n = n.previousElementSibling;
    return n;
  }

  const itemById = (id) => GT.store.get().items.find((it) => it.id === id);
  const groupIdOf = (c) => (c.closest('.group') ? c.closest('.group').dataset.groupId || null : undefined);

  function describe() {
    const m = marker();
    const c = m.parentElement;
    const list = others(c);
    const next = nextTile(m);
    const pos = (next ? list.indexOf(next) : list.length) + 1;
    const where = c.closest('.group') ? `${c.closest('.group').getAttribute('aria-label')}, position` : 'position';
    return `${where} ${pos} of ${list.length + 1}`;
  }

  /* Where the dragged tile would land for a pointer at (x, y), or null if not over a container. */
  function pointerTarget(x, y) {
    let c = null;
    if (grouped()) {
      /* A group accepts drops anywhere in its box (inset −12px), so empty groups work too. */
      const g = [...root.querySelectorAll('.stage .group')].find((el) => {
        const r = el.getBoundingClientRect();
        return x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12;
      });
      c = g?.querySelector('.tiles') || null;
    } else {
      c = containers()[0] || null;
    }
    if (!c) return null;
    for (const tw of others(c)) {
      const r = boxOf(tw);
      if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) return { c, before: tw };
    }
    return { c, before: ghostOf(c) };
  }

  function setDropGroup(c) {
    const target = c.closest('.group');
    for (const g of root.querySelectorAll('.group.is-drop')) if (g !== target) g.classList.remove('is-drop');
    if (target && target !== drag.originGroup) target.classList.add('is-drop');
  }

  function moveMarker(c, before) {
    const m = marker();
    const current = m.parentElement === c ? nextTile(m) || ghostOf(c) : null;
    if (current === before) return false;
    flip(TILE_ELS, () => c.insertBefore(m, before));
    setDropGroup(c);
    return true;
  }

  /* Save a drop. A drop back where it started leaves the config as it was, and a config that
     hasn't changed doesn't redraw the tiles, so redraw here to clear the drag-only DOM (the
     hidden original tile, the slot). */
  function landed(save) {
    const before = JSON.stringify([GT.store.get().items, GT.store.get().groups]);
    save();
    if (JSON.stringify([GT.store.get().items, GT.store.get().groups]) === before) GT.app.repaint();
  }

  /* Commit the marker's DOM position to the config. */
  function commit() {
    const { id } = drag;
    const m = marker();
    const c = m.parentElement;
    const before = nextTile(m);
    let groupId = groupIdOf(c);
    if (groupId === undefined) {
      /* Flat grid: take the group of the neighbour it lands next to. */
      const near = before || prevTile(m);
      groupId = near ? itemById(near.dataset.id)?.groupId ?? null : itemById(id)?.groupId ?? null;
    }
    const beforeId = before ? before.dataset.id : null;
    finish();
    landed(() => GT.ops.reorder(id, groupId, beforeId));
    GT.focus.tile(id)?.focus({ preventScroll: true });
    GT.announce('Dropped', { clearAfter: 2000 });
  }

  function cancel() {
    const { id } = drag;
    finish();
    GT.app.repaint();
    GT.focus.tile(id)?.focus({ preventScroll: true });
    GT.announce('Cancelled', { clearAfter: 2000 });
  }

  /* Tear down drag-only DOM; the next repaint rebuilds the page from the config. */
  function finish() {
    if (!drag) return;
    drag.float?.remove();
    for (const g of root.querySelectorAll('.is-drop, .is-lifted')) g.classList.remove('is-drop', 'is-lifted');
    root.classList.remove('is-dragging');
    layout.clear();
    drag = null;
  }

  /* ---------- Tiles: pointer ---------- */

  let pending = null;
  let suppressClick = false;

  function startPointer(p, e) {
    const tw = p.tile.closest('.tw');
    const r = tw.getBoundingClientRect();
    const item = itemById(tw.dataset.id);
    drag = {
      mode: 'pointer', kind: 'tile', id: tw.dataset.id, tw, title: displayTitle(item),
      originGroup: tw.closest('.group'), dx: p.x - r.left, dy: p.y - r.top
    };
    drag.slot = h('div', { class: 'slot', 'aria-hidden': 'true' });
    drag.float = h('div', { class: 'drag-float', 'aria-hidden': 'true', style: `width:${r.width}px;height:${r.height}px` },
      h('div', { class: 'tw' }, h('div', { class: 'tile', html: p.tile.innerHTML })));
    root.append(drag.float);
    root.classList.add('is-dragging');
    /* The original slot collapses; the drop slot takes its place. */
    flip(TILE_ELS, () => {
      tw.before(drag.slot);
      tw.hidden = true;
    });
    moveFloat(e);
    GT.announce(`${drag.title}: moving to ${describe()}`);
  }

  function moveFloat(e) {
    const rootBox = root.getBoundingClientRect();
    drag.float.style.left = `${e.clientX - drag.dx - rootBox.left}px`;
    drag.float.style.top = `${e.clientY - drag.dy - rootBox.top}px`;
  }

  root.addEventListener('pointerdown', (e) => {
    if (!GT.edit.on || drag || e.button !== 0) return;
    const tile = e.target.closest('.tw[data-id] > .tile');
    const handle = e.target.closest('.gh-edit .handle');
    if (!tile && !handle) return;
    pending = { tile, handle, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
  });

  document.addEventListener('pointermove', (e) => {
    if (pending && e.pointerId === pending.pointerId && !drag) {
      if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) < THRESHOLD) return;
      GT.menu.close({ restore: false });
      if (pending.tile) startPointer(pending, e);
      else startGroup(pending, e);
    }
    if (!drag || drag.mode !== 'pointer') return;
    e.preventDefault();
    if (drag.kind === 'group') return moveGroupPointer(e);
    moveFloat(e);
    const t = pointerTarget(e.clientX, e.clientY);
    if (t && moveMarker(t.c, t.before)) GT.announce(`${drag.title}: moving to ${describe()}`);
  });

  document.addEventListener('pointerup', (e) => {
    const wasDragging = drag && drag.mode === 'pointer';
    pending = null;
    if (!wasDragging) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    if (drag.kind === 'group') commitGroup();
    else commit();
  });

  document.addEventListener('pointercancel', () => {
    pending = null;
    if (drag?.mode === 'pointer') drag.kind === 'group' ? cancelGroup() : cancel();
  });

  /* A drag ends with a click on whatever is under the pointer; swallow it. */
  root.addEventListener('click', (e) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  /* ---------- Tiles: keyboard ---------- */

  let moving = false;

  function keyboardTargets() {
    const out = [];
    for (const c of containers()) {
      for (const tw of others(c)) out.push({ c, before: tw });
      out.push({ c, before: ghostOf(c) });
    }
    return out;
  }

  function keyboardMove(key) {
    const m = drag.tw;
    let t = null;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const list = keyboardTargets();
      const next = nextTile(m) || ghostOf(m.parentElement);
      const i = list.findIndex((p) => p.c === m.parentElement && p.before === next);
      t = list[i + (key === 'ArrowRight' ? 1 : -1)];
    } else {
      /* Up/Down: the nearest position in the next row, measured on the page. */
      const cur = boxOf(m);
      const cy = cur.top + cur.height / 2;
      const cx = cur.left + cur.width / 2;
      const down = key === 'ArrowDown';
      const cands = keyboardTargets()
        .map((p) => ({ ...p, r: boxOf(p.before) }))
        .filter((p) => (down ? p.r.top > cy : p.r.bottom < cy));
      if (cands.length) {
        const rowY = down ? Math.min(...cands.map((p) => p.r.top)) : Math.max(...cands.map((p) => p.r.top));
        const row = cands.filter((p) => Math.abs(p.r.top - rowY) < 8);
        row.sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx));
        t = row[0];
      }
    }
    if (!t) return;
    moving = true;
    moveMarker(t.c, t.before);
    m.querySelector('.tile').focus({ preventScroll: false });
    moving = false;
    GT.announce(`${drag.title}: moving to ${describe()}`);
  }

  root.addEventListener('keydown', (e) => {
    if (!GT.edit.on) return;
    const tile = e.target.closest('.tw[data-id] > .tile');
    if (!tile) return;

    if (!drag) {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const tw = tile.closest('.tw');
        drag = {
          mode: 'keyboard', kind: 'tile', id: tw.dataset.id, tw, title: displayTitle(itemById(tw.dataset.id)),
          originGroup: tw.closest('.group')
        };
        tw.classList.add('is-lifted');
        root.classList.add('is-dragging');
        flip(TILE_ELS, () => {});
        GT.announce(`${drag.title}: picked up, ${describe()}. Arrow keys move, Space drops, Esc cancels.`);
      }
      return;
    }
    if (drag.mode !== 'keyboard') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === ' ' || e.key === 'Enter') commit();
    else if (e.key === 'Escape') cancel();
    else if (e.key.startsWith('Arrow')) keyboardMove(e.key);
  });

  /* Leaving the tile (Tab, a click elsewhere) cancels a keyboard move. */
  root.addEventListener('focusout', (e) => {
    if (drag?.mode === 'keyboard' && !moving && e.target.closest('.tw') === drag.tw) cancel();
  });

  /* Esc cancels a pointer drag (and doesn't leave edit mode). */
  document.addEventListener('keydown', (e) => {
    if (drag?.mode === 'pointer' && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      drag.kind === 'group' ? cancelGroup() : cancel();
    }
  }, true);

  /* ---------- Groups: pointer, by the handle ---------- */

  function startGroup(p) {
    const section = p.handle.closest('.group');
    const g = GT.store.get().groups.find((x) => x.id === section.dataset.groupId);
    if (!g) return;
    drag = { mode: 'pointer', kind: 'group', id: g.id, title: g.name, section };
    section.classList.add('is-lifted');
    root.classList.add('is-dragging');
    flip(GROUP_ELS, () => {});
    GT.announce(`${g.name}: ${groupPosition()}`);
  }

  function groupPosition() {
    const real = [...root.querySelectorAll('.stage .group')].filter((el) => el.dataset.groupId);
    return `position ${real.indexOf(drag.section) + 1} of ${real.length}`;
  }

  function moveGroupPointer(e) {
    const x = e.clientX;
    const y = e.clientY;
    const list = [...root.querySelectorAll('.stage .group')].filter((el) => el !== drag.section);
    /* Others always stays last. */
    let before = list.find((el) => !el.dataset.groupId) || null;
    for (const el of list) {
      if (!el.dataset.groupId) break;
      const r = boxOf(el);
      if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) {
        before = el;
        break;
      }
    }
    if (drag.section.nextElementSibling === before) return;
    /* Groups sit in rows (.grow); the target may be in another row, or at the end of the last. */
    const rows = root.querySelectorAll('.stage .grow');
    flip(GROUP_ELS, () => (before ? before.parentElement : rows[rows.length - 1]).insertBefore(drag.section, before));
    GT.announce(`${drag.title}: ${groupPosition()}`);
  }

  function commitGroup() {
    const { id, section } = drag;
    const index = [...root.querySelectorAll('.stage .group')].filter((el) => el.dataset.groupId).indexOf(section);
    finish();
    landed(() => GT.ops.moveGroup(id, index));
    root.querySelector(`.group[data-group-id="${CSS.escape(id)}"] .handle`)?.focus({ preventScroll: true });
    GT.announce('Dropped', { clearAfter: 2000 });
  }

  function cancelGroup() {
    finish();
    GT.app.repaint();
    GT.announce('Cancelled', { clearAfter: 2000 });
  }

  GT.drag = {
    active: () => !!drag,
    /* A repaint replaced the page under an active drag: drop the drag state silently. */
    abort() {
      pending = null;
      finish();
    }
  };
})(window.GT = window.GT || {});
