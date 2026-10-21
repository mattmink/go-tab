/* Renders the page from a config. Pure DOM building; behaviour is wired in main.js. */
(function (GT) {
  'use strict';

  const DEFAULT_BG_CLASS = 'bg-default';
  /* Label for items with no group (groupId: null). */
  const OTHERS = 'Others';
  const TILE_HINT = 'Drag to reorder · Space to pick up, arrows to move · Esc to cancel';
  const GROUP_HINT = 'Drag a group by its handle · Alt + arrows to move a focused group';

  const OVERLAYS = '.scrim, .menu, .sr-live, .sheet, .livenote, .toast';

  /* Set for the duration of a render() call. */
  let editing = false;

  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v);
    }
    el.append(...children);
    return el;
  }

  const stopsCss = (stops) => [...stops].sort((a, b) => a[1] - b[1]).map(([c, p]) => `${c} ${p}%`).join(', ');
  const gradientCss = (stops, angle) => `linear-gradient(${angle}deg, ${stopsCss(stops)})`;

  function setImage(root, url) {
    root.style.backgroundImage = `url("${url}")`;
    root.style.backgroundSize = 'cover';
    root.style.backgroundPosition = 'center';
  }

  /* `null`, or an image type with no image yet, is the default slate background. */
  function applyBackground(root, bg) {
    const img = bg?.type === 'image' ? bg.image : null;
    const isDefault = !bg || (bg.type === 'image' && !img);
    root.classList.toggle(DEFAULT_BG_CLASS, isDefault);
    if (isDefault) {
      root.style.background = '';
    } else if (bg.type === 'solid') {
      root.style.background = bg.color;
    } else if (bg.type === 'gradient') {
      root.style.background = gradientCss(bg.stops, bg.angle);
    } else {
      /* The blob comes from IndexedDB; paint its average colour until it's ready. */
      root.style.background = img.average || '#232B40';
      const url = GT.bgImage.cachedUrl(img.id);
      if (url) setImage(root, url);
      else {
        GT.bgImage.url(img.id).then((u) => {
          if (u && GT.store.get().background?.image?.id === img.id) setImage(root, u);
        });
      }
    }
  }

  function applyTone(root, bg) {
    const tone = GT.tone.of(bg);
    root.classList.toggle('tone-light', tone === 'light');
    root.classList.toggle('tone-dark', tone === 'dark');
  }

  /* ---------- URLs ---------- */

  function parseUrl(url) {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  }

  /* Never render script or data URLs as links. */
  function safeHref(url) {
    const u = parseUrl(url);
    return u && !/^(javascript|data|vbscript):$/i.test(u.protocol) ? u.href : null;
  }

  const hostOf = (url) => (parseUrl(url)?.hostname || '').replace(/^www\./, '');

  /* "atlassian.net/wiki": host plus path, no scheme, www or trailing slash. */
  function domainLabel(url) {
    const u = parseUrl(url);
    if (!u) return url;
    return (hostOf(url) + u.pathname).replace(/\/+$/, '');
  }

  const displayTitle = (item) => item.title.trim() || hostOf(item.url) || item.url;

  /* ---------- Icons ---------- */

  /* Mid-tone colours that all keep white letters above 4.5:1. */
  const MONO = ['#C5443A', '#2F6FD6', '#1C8C58', '#4A1D5E', '#1F5FC9', '#7B3FE0', '#2E2E2E',
    '#1E66D0', '#4E59C4', '#0E78AD', '#B80F5C', '#B45309', '#C2410C', '#0F766E', '#6D28D9', '#374151'];

  function hash(s) {
    let n = 0;
    for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(n);
  }

  function monogramLetter(item) {
    const source = item.title.trim().replace(/^the\s+/i, '') || hostOf(item.url);
    const ch = source.match(/[\p{L}\p{N}]/u);
    return ch ? ch[0].toUpperCase() : '?';
  }

  /* `cls` is 'ico' on tiles and chips, 'iconprev' in the item dialog. */
  function siteIcon(item, cls = 'ico') {
    const host = hostOf(item.url) || item.url;
    const ico = h('span', { class: cls, 'aria-hidden': 'true', style: `--mono:${MONO[hash(host) % MONO.length]}` },
      h('span', { class: 'mono', text: monogramLetter(item) }));

    /* A cached large site icon (site-icon.js) beats the 32px favicon. */
    const large = !item.icon && GT.siteIcon.get(item.url);
    if (large) {
      ico.classList.add('has-img');
      ico.append(h('img', { alt: '', decoding: 'async', draggable: 'false', src: large }));
      return ico;
    }

    const src = item.icon || GT.favicon.src(item.url);
    if (!src) return ico;
    const known = item.icon ? 1 : GT.favicon.known(item.url);
    if (known === 0) return ico; /* Checked before: the site has no icon of its own. */

    const img = h('img', { alt: '', decoding: 'async', draggable: 'false' });
    /* Known-good icons replace the monogram up front, so nothing flashes on repaint. */
    if (known === 1) ico.classList.add('has-img');
    img.addEventListener('load', () => {
      if (item.icon) return;
      GT.favicon.check(img, item.url).then((ok) => {
        if (ok) ico.classList.add('has-img');
        else {
          ico.classList.remove('has-img');
          img.remove();
        }
      });
    }, { once: true });
    img.addEventListener('error', () => {
      ico.classList.remove('has-img');
      img.remove();
      if (!item.icon) GT.favicon.forget(item.url);
    }, { once: true });
    img.src = src;
    ico.append(img);
    return ico;
  }

  /* ---------- Tiles and groups ---------- */

  function tile(item) {
    const title = displayTitle(item);
    const link = h('a', { class: 'tile', href: safeHref(item.url), 'aria-label': title, 'data-title': title },
      siteIcon(item),
      h('span', { class: 'tl' },
        h('span', { class: 'tt', text: title }),
        h('span', { class: 'dm', text: domainLabel(item.url) })));
    const tw = h('div', { class: 'tw', 'data-id': item.id }, link);
    /* Edit and Delete exist only in edit mode, never on hover; tab order is tile → Edit → Delete. */
    if (editing) {
      tw.append(h('div', { class: 'tctl' },
        h('button', { class: 'mbtn', type: 'button', 'data-action': 'tile-edit', 'aria-label': `Edit ${title}`, html: GT.icon.pencil(13, 2.2) }),
        h('button', { class: 'mbtn del', type: 'button', 'data-action': 'tile-delete', 'aria-label': `Delete ${title}`, html: GT.icon.trash(13, 2.2) })));
    }
    return tw;
  }

  /* The Add tile exists only in edit mode, so it never holds space in the normal layout. */
  function ghost(group) {
    if (!editing) return '';
    const label = group ? `Add item to ${group.name}` : 'Add item';
    return h('div', { class: 'tw' },
      h('button', {
        class: 'ghost', type: 'button', 'data-action': 'add-item',
        'data-group-id': group?.id ?? '', 'aria-label': label,
        html: `${GT.icon.plus(22)}<span>Add</span>`
      }));
  }

  /* In edit mode a real group's heading gains a drag handle and a ⋯ menu; Others has neither. */
  function heading(group) {
    if (!editing || !group.id) return h('h2', { class: 'gh', text: group.name });
    return h('h2', { class: 'gh gh-edit' },
      h('button', { class: 'handle', type: 'button', 'data-action': 'group-handle', 'aria-label': `Reorder group ${group.name}`, html: GT.icon.grip() }),
      h('span', { class: 'gname', text: group.name }),
      h('button', {
        class: 'gmore', type: 'button', 'data-action': 'group-menu', 'aria-label': `Group options for ${group.name}`,
        'aria-haspopup': 'menu', 'aria-expanded': 'false', html: GT.icon.more()
      }));
  }

  function groupSection(group, items) {
    return h('section', { class: 'group', 'aria-label': group.name, 'data-group-id': group.id ?? '' },
      heading(group),
      h('div', { class: 'tiles' }, ...items.map(tile), ghost(group)));
  }

  /* Groups in order, then Others (items with no group; only when there are some). Empty named groups stay. */
  function bucket(config) {
    const byGroup = new Map(config.groups.map((g) => [g.id, []]));
    const ungrouped = [];
    for (const item of config.items) (byGroup.get(item.groupId) || ungrouped).push(item);
    const out = config.groups.map((g) => ({ group: g, items: byGroup.get(g.id) }));
    if (ungrouped.length) out.push({ group: { id: null, name: OTHERS }, items: ungrouped });
    return out;
  }

  function content(config) {
    const buckets = bucket(config);
    if (config.grouping) {
      /* Groups are laid out in rows (.grow), each wrapping on its own. A new row starts for
         every group in the 'rows' layout, or before a group marked newRow in 'flow'. */
      const rows = [];
      buckets.forEach((b, i) => {
        if (i === 0 || config.groupLayout === 'rows' || b.group.newRow) rows.push([]);
        rows[rows.length - 1].push(groupSection(b.group, b.items));
      });
      return h('div', { class: 'groups' }, ...rows.map((r) => h('div', { class: 'grow' }, ...r)));
    }
    /* Grouping off: one flat grid in group order; groups are kept, just not shown. */
    const items = buckets.flatMap((b) => b.items);
    return h('div', { class: 'grid-flat', role: 'group', 'aria-label': 'Links' }, ...items.map(tile), ghost(null));
  }

  /* ---------- Chrome ---------- */

  function editbar(config) {
    return h('div', { class: 'editbar', role: 'toolbar', 'aria-label': 'Edit layout' },
      h('b', { text: 'Editing layout' }),
      h('span', { class: 'hint', text: TILE_HINT }),
      config.grouping
        ? h('button', { class: 'btn btn-glass btn-sm', type: 'button', 'data-action': 'add-group', html: `${GT.icon.folderPlus()}Add group` })
        : '',
      h('button', { class: 'btn btn-primary btn-sm', type: 'button', 'data-action': 'edit-done', style: 'border-radius:999px;padding:0 16px', text: 'Done' }));
  }

  function toolbar({ showEdit }) {
    return h('div', { class: 'toolbar' },
      showEdit ? h('button', { class: 'iconbtn', type: 'button', 'data-action': 'edit', 'aria-label': 'Edit layout', html: GT.icon.pencil() }) : '',
      h('button', { class: 'iconbtn', type: 'button', 'data-action': 'settings', 'aria-label': 'Settings', html: GT.icon.gear() }));
  }

  function emptyState() {
    return h('section', {
      class: 'empty', 'aria-labelledby': 'empty-t',
      html: `
      <h1 id="empty-t">Add your first link</h1>
      <p>Keep the sites you open every day one click away. You can group them, reorder them and change the background whenever you like.</p>
      <div class="big"><button class="ghost" type="button" data-action="add-item">${GT.icon.plus()}<span>Add link</span></button></div>
      <div class="sub">
        <button class="btn btn-glass btn-sm" type="button" data-action="import">${GT.icon.upload()}Import a backup</button>
        <span>or press <span class="kbdk">N</span></span>
      </div>`
    });
  }

  /* `opts.editing` renders edit mode (SPEC §4): edit bar, tile controls, group handles. */
  GT.render = function render(root, config, opts = {}) {
    applyBackground(root, config.background);
    applyTone(root, config.background);

    /* First run: nothing at all yet. The empty state shows only Settings (SPEC §4). */
    const empty = config.items.length === 0 && config.groups.length === 0;
    editing = !!opts.editing && !empty;
    root.classList.toggle('editing', editing);
    /* The empty state has its own visible h1; the main view gets a hidden one. */
    const stage = h('div', { class: 'stage' }, empty ? emptyState() : h('h1', { class: 'sr-only', text: 'Speed dial' }), empty ? '' : content(config));
    /* The pencil hides while editing. */
    const bar = toolbar({ showEdit: !empty && !editing });
    /* With the settings panel open the toolbar hides and the page re-centres beside it,
       visible but not interactive (SPEC §4). */
    const sheetOpen = !!opts.settings;
    const chrome = sheetOpen ? [] : editing ? [editbar(config), bar] : [bar];
    if (sheetOpen) stage.classList.add('beside-sheet');
    /* Dialogs, menus, the settings panel and the live region survive a repaint. They're left
       in place, not re-appended: moving a node would drop the focus inside it. */
    for (const el of [...root.children]) if (!el.matches(OVERLAYS)) el.remove();
    root.prepend(...chrome, stage);
    /* The new elements take their inert state from whatever dialog or panel is open. */
    GT.dialog.syncInert();
  };

  GT.ui = { h, siteIcon, parseUrl, hostOf, domainLabel, displayTitle, bucket, gradientCss, OTHERS, TILE_HINT, GROUP_HINT };
  /* Swap in fresh icons for one site's tiles without repainting the page. */
  GT.render.refreshIcons = (origin) => {
    const root = document.getElementById('app');
    for (const tw of root.querySelectorAll('.stage .tw[data-id]')) {
      const item = GT.store.get().items.find((it) => it.id === tw.dataset.id);
      if (!item || item.icon || GT.siteIcon.originOf(item.url) !== origin) continue;
      tw.querySelector('.tile > .ico')?.replaceWith(siteIcon(item));
    }
  };

  GT.render.background = (root, config) => {
    applyBackground(root, config.background);
    applyTone(root, config.background);
  };
})(window.GT = window.GT || {});
