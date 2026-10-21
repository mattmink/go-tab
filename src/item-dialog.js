/* Add item / Edit item dialog (SPEC §4). Validates on blur and submit, never while typing. */
(function (GT) {
  'use strict';

  const { h, siteIcon, hostOf } = GT.ui;
  const NEW_GROUP = '__new';

  const MSG = {
    urlEmpty: 'Enter a web address, like https://theverge.com',
    urlInvalid: 'That isn’t a web address. Try something like https://theverge.com',
    titleEmpty: 'Enter a title.',
    groupEmpty: 'Name the new group.',
    iconLoad: 'Couldn’t load that image. Check the address or upload a file.',
    iconType: (name) => `${name} can’t be used. Choose a PNG, JPG, SVG, WebP or ICO under 1 MB.`,
    duplicate: (group) => `This link is already in ${group}.`
  };

  /* "theverge.com" → "https://theverge.com". Returns null unless it's an http(s) address with a real host. */
  function normalizeUrl(raw) {
    const text = raw.trim();
    if (!text) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
    let u;
    try {
      u = new URL(withScheme);
    } catch {
      return null;
    }
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname;
    const realHost = host === 'localhost' || host.includes('.') || host.startsWith('[');
    return realHost ? u.href : null;
  }

  /* Comparable form for duplicate detection: no scheme, www or trailing slash. */
  const comparable = (url) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '').toLowerCase();

  /* The page's <title>, if the user has granted site access (see access.js); otherwise null
     and the hostname stays. */
  async function pageTitle(url, access) {
    if (!(await access)) return null;
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(url, { credentials: 'omit', signal: ctl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok || !(res.headers.get('content-type') || '').includes('html')) return null;
      const doc = new DOMParser().parseFromString((await res.text()).slice(0, 300000), 'text/html');
      return doc.title.trim() || null;
    } catch {
      return null;
    }
  }

  function template({ mode, item }) {
    const editing = mode === 'edit';
    const form = h('form', {
      class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t', novalidate: '',
      html: `
      <div class="dh"><div><h2 id="dlg-t">${editing ? 'Edit item' : 'Add item'}</h2><p id="dlg-sub" hidden>Fix the highlighted fields to ${editing ? 'save' : 'add'} this link.</p></div><button class="xbtn" type="button" data-r="close" aria-label="Close">${GT.icon.close()}</button></div>
      <div class="fields">
        <div class="field"><label class="flabel" for="f-url">Link</label><input class="input" id="f-url" type="url" inputmode="url" autocomplete="off" spellcheck="false" aria-describedby="h-url"><span class="help" id="h-url">https:// is added if you leave it out.</span><span class="err" id="e-url" hidden></span><span class="help warn" id="w-url" hidden></span></div>
        <div class="field"><label class="flabel" for="f-title">Title${editing ? '' : ' <span class="opt">(optional)</span>'}</label><input class="input" id="f-title" type="text" autocomplete="off"${editing ? '' : ' placeholder="Taken from the page if left empty"'}><span class="err" id="e-title" hidden></span></div>
        <div class="field"><label class="flabel" for="f-group">Group</label><div class="selectwrap"><select class="input" id="f-group"></select>${GT.icon.chevronDown()}</div><input class="input" id="f-newgroup" type="text" autocomplete="off" placeholder="New group name" aria-label="New group name" hidden><span class="err" id="e-newgroup" hidden></span></div>
        <div class="field"><span class="flabel" id="f-icon">Icon</span>
          <div class="iconfield" role="group" aria-labelledby="f-icon">
            <div class="icontop">
              <span class="iconprev" data-r="prev"></span>
              <div class="iconmeta"><b data-r="metaTitle"></b><span data-r="metaSub" aria-live="polite"></span><button class="linkbtn" type="button" data-r="refreshIcon" style="font-size:12px;align-self:flex-start;margin-top:2px" hidden>Refresh icon</button></div>
              <div class="iconacts" data-r="acts"><button class="btn btn-secondary btn-sm" type="button" data-r="pickUrl">${GT.icon.link()}Image URL</button><button class="btn btn-secondary btn-sm" type="button" data-r="pickFile">${GT.icon.upload()}Upload</button></div>
              <button class="linkbtn" type="button" data-r="revert" hidden>${GT.icon.revert()}Use site icon</button>
            </div>
            <div class="seg full" role="group" aria-label="Icon source" data-r="seg" hidden><button type="button" data-src="url" aria-pressed="true">Image URL</button><button type="button" data-src="file" aria-pressed="false">Upload</button></div>
            <div class="inline" data-r="urlRow" hidden><input class="input" id="f-iconurl" type="url" autocomplete="off" spellcheck="false" aria-label="Image URL" placeholder="https://" aria-describedby="h-icon"><button class="btn btn-secondary" type="button" data-r="load" style="height:40px">Load</button></div>
            <button class="dropzone" type="button" data-r="drop" aria-describedby="h-icon" hidden>${GT.icon.upload(16)}<span>Drop an image here or <b>choose a file</b></span></button>
            <input type="file" data-r="file" accept=".png,.jpg,.jpeg,.svg,.webp,.ico,image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon" hidden>
            <span class="help" id="h-icon" data-r="iconHelp" hidden>Square images of 64 × 64 or larger look best. PNG, JPG, SVG, WebP or ICO, up to 1 MB.</span>
            <span class="err" id="e-icon" hidden></span>
          </div>
        </div>
      </div>
      <div class="df">
        ${editing ? `<button class="btn btn-quiet" type="button" data-r="delete" style="color:var(--danger-text);margin-left:-8px">${GT.icon.trash()}Delete</button>` : ''}
        <span class="spacer"></span>
        <button class="btn btn-secondary" type="button" data-r="cancel">Cancel</button>
        <button class="btn btn-primary" type="submit">${editing ? 'Save' : 'Add item'}</button>
      </div>`
    });
    return form;
  }

  /**
   * @param {object} o
   * @param {'add'|'edit'} o.mode
   * @param {string} [o.id] item id when editing
   * @param {string|null} [o.groupId] preselected group when adding
   * @param {HTMLElement|Function} [o.returnFocus]
   */
  function open({ mode, id, groupId = null, returnFocus }) {
    const config = GT.store.get();
    const item = mode === 'edit' ? config.items.find((it) => it.id === id) : null;
    if (mode === 'edit' && !item) return;

    const form = template({ mode, item });
    const $ = (sel) => form.querySelector(sel);
    const r = (name) => form.querySelector(`[data-r="${name}"]`);
    const urlIn = $('#f-url');
    const titleIn = $('#f-title');
    const groupSel = $('#f-group');
    const newGroupIn = $('#f-newgroup');
    const iconUrlIn = $('#f-iconurl');
    const fileIn = r('file');

    const state = {
      icon: item?.icon || null,
      iconInfo: null, /* { name, w, h } for the status line */
      picker: false,
      source: 'url',
      loadedFrom: null, /* the Image URL the current custom icon came from */
      busy: false
    };
    let focusAfter = null; /* item id to focus once the dialog closes */

    /* ---------- Fields ---------- */

    urlIn.value = item?.url || '';
    titleIn.value = item?.title || '';

    for (const g of config.groups) groupSel.append(h('option', { value: g.id, text: g.name }));
    groupSel.append(h('option', { value: '', text: GT.ui.OTHERS }), h('option', { value: NEW_GROUP, text: 'New group…' }));
    groupSel.value = (item ? item.groupId : groupId) ?? '';

    groupSel.addEventListener('change', () => {
      const isNew = groupSel.value === NEW_GROUP;
      newGroupIn.hidden = !isNew;
      if (isNew) newGroupIn.focus();
      else setError('newgroup', newGroupIn, null);
    });

    /* ---------- Errors ---------- */

    /* Swap the help text for the error, mark the control, point aria-describedby at the message. */
    function setError(key, control, msg) {
      const err = $(`#e-${key}`);
      const help = key === 'icon' ? $('#h-icon') : $(`#h-${key}`);
      control.classList.toggle('is-error', !!msg);
      if (msg) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
      err.hidden = !msg;
      err.innerHTML = msg ? GT.icon.alert() : '';
      if (msg) err.append(msg);
      if (help && key !== 'icon') help.hidden = !!msg;
      const described = [msg ? err.id : help && !help.hidden ? help.id : null];
      if (key === 'url' && !$('#w-url').hidden) described.push('w-url');
      const ids = described.filter(Boolean).join(' ');
      if (ids) control.setAttribute('aria-describedby', ids);
      else control.removeAttribute('aria-describedby');
      return !msg;
    }

    function checkUrl() {
      const raw = urlIn.value;
      const url = normalizeUrl(raw);
      const msg = !raw.trim() ? MSG.urlEmpty : url ? null : MSG.urlInvalid;
      /* Duplicate: a warning, not an error. */
      const warn = $('#w-url');
      const dup = url && GT.store.get().items.find((it) => it.id !== item?.id && comparable(it.url) === comparable(url));
      warn.hidden = !dup;
      if (dup) {
        const g = GT.store.get().groups.find((x) => x.id === dup.groupId);
        warn.innerHTML = GT.icon.alert(14);
        warn.append(MSG.duplicate(g ? g.name : GT.ui.OTHERS));
      }
      setError('url', urlIn, msg);
      return url;
    }

    function checkTitle() {
      return setError('title', titleIn, mode === 'edit' && !titleIn.value.trim() ? MSG.titleEmpty : null);
    }

    function checkNewGroup() {
      if (groupSel.value !== NEW_GROUP) return true;
      return setError('newgroup', newGroupIn, newGroupIn.value.trim() ? null : MSG.groupEmpty);
    }

    const iconControl = () => (state.source === 'url' ? iconUrlIn : r('drop'));
    function setIconError(msg) {
      setError('icon', state.source === 'url' ? iconUrlIn : r('drop'), msg);
      (state.source === 'url' ? r('drop') : iconUrlIn).classList.remove('is-error');
      r('iconHelp').hidden = !!msg || !state.picker;
    }

    urlIn.addEventListener('blur', () => {
      /* Show the normalised address so "https://" being added is visible. */
      const url = checkUrl();
      if (url && url !== urlIn.value) urlIn.value = url;
      renderIcon();
    });
    titleIn.addEventListener('blur', () => {
      checkTitle();
      renderIcon();
    });
    newGroupIn.addEventListener('blur', checkNewGroup);

    /* ---------- Icon card ---------- */

    function renderIcon() {
      const url = normalizeUrl(urlIn.value);
      const title = titleIn.value.trim();
      let prev;
      if (state.icon) {
        prev = siteIcon({ url: url || '', title, icon: state.icon }, 'iconprev');
        r('metaTitle').textContent = 'Custom image';
        const info = state.iconInfo;
        r('metaSub').textContent = info ? [info.name, `${info.w} × ${info.h}`].filter(Boolean).join(' · ') : 'Stored on this device';
      } else if (url) {
        prev = siteIcon({ url, title, icon: null }, 'iconprev');
        r('metaTitle').textContent = 'Site icon';
        const large = GT.siteIcon.info(url);
        const size = large?.data ? ` · ${large.w} × ${large.h}` : '';
        r('metaSub').textContent = state.iconNote || `From ${hostOf(url)}${size}. Updates on its own.`;
      } else {
        prev = h('span', { class: 'iconprev is-empty', 'aria-hidden': 'true', html: GT.icon.globe() });
        r('metaTitle').textContent = 'Site icon';
        r('metaSub').textContent = 'Appears once the link is valid.';
      }
      prev.dataset.r = 'prev';
      r('prev').replaceWith(prev);

      form.querySelector('.iconfield').classList.toggle('is-open', state.picker);
      r('acts').hidden = state.picker;
      r('revert').hidden = !(state.icon || state.picker);
      r('refreshIcon').hidden = !!state.icon || state.picker || !url;
      r('seg').hidden = !state.picker;
      for (const b of r('seg').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.src === state.source));
      r('urlRow').hidden = !state.picker || state.source !== 'url';
      r('drop').hidden = !state.picker || state.source !== 'file';
      r('iconHelp').hidden = !state.picker || !$('#e-icon').hidden;
    }

    function openPicker(source) {
      state.picker = true;
      state.source = source;
      setIconError(null);
      renderIcon();
      iconControl().focus();
    }

    function useCustom(result) {
      state.icon = result.dataUrl;
      state.iconInfo = { name: result.name, w: result.w, h: result.h };
      setIconError(null);
      renderIcon();
    }

    /* Called from a click, Enter or submit, so a first-time access prompt can show. */
    async function loadIconUrl() {
      const url = normalizeUrl(iconUrlIn.value);
      if (!url) {
        setIconError(MSG.iconLoad);
        return false;
      }
      const access = GT.access.ensure();
      r('load').disabled = true;
      try {
        useCustom(await GT.images.fromUrl(url, await access));
        state.loadedFrom = iconUrlIn.value;
        return true;
      } catch {
        setIconError(MSG.iconLoad);
        return false;
      } finally {
        r('load').disabled = false;
      }
    }

    async function loadFile(file) {
      if (!file) return;
      try {
        useCustom(await GT.images.fromFile(file));
      } catch (e) {
        setIconError(e.code === 'type' ? MSG.iconType(file.name) : MSG.iconLoad);
      }
    }

    r('pickUrl').addEventListener('click', () => openPicker('url'));
    r('pickFile').addEventListener('click', () => openPicker('file'));
    r('seg').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-src]');
      if (!b || b.dataset.src === state.source) return;
      state.source = b.dataset.src;
      setIconError(null);
      renderIcon();
    });
    r('revert').addEventListener('click', () => {
      state.icon = null;
      state.iconInfo = null;
      state.loadedFrom = null;
      state.picker = false;
      iconUrlIn.value = '';
      setIconError(null);
      renderIcon();
      r('pickUrl').focus();
    });
    /* Re-read the site for a larger icon now (asks for site access the first time). */
    r('refreshIcon').addEventListener('click', async () => {
      const url = normalizeUrl(urlIn.value);
      if (!url) return;
      const access = GT.access.ensure();
      const btn = r('refreshIcon');
      btn.disabled = true;
      state.iconNote = 'Checking for a larger icon…';
      renderIcon();
      const result = await GT.siteIcon.fetchFor(url, { access, force: true }).catch(() => 'none');
      state.iconNote = {
        updated: `Updated from ${hostOf(url)}.`,
        unchanged: 'Already up to date.',
        none: 'This site doesn’t offer a larger icon, so the browser’s favicon is used.',
        'no-access': 'Go Tab needs site access to fetch larger icons.'
      }[result];
      btn.disabled = false;
      renderIcon();
      state.iconNote = '';
    });
    r('load').addEventListener('click', loadIconUrl);
    iconUrlIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadIconUrl();
      }
    });
    r('drop').addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', () => {
      loadFile(fileIn.files[0]);
      fileIn.value = '';
    });
    const drop = r('drop');
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('is-over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-over');
      loadFile(e.dataTransfer.files[0]);
    });

    if (state.icon) {
      GT.images.sizeOf(state.icon).then((size) => {
        if (size && !state.iconInfo) {
          state.iconInfo = { name: '', ...size };
          renderIcon();
        }
      });
    }
    renderIcon();

    /* ---------- Submit ---------- */

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (state.busy) return;
      state.busy = true;
      /* Ask for site access now, while the submit still counts as a user gesture. It's used for
         the page title and the large site icon: fetched when a link is added, when its URL
         moves to another site, or when that site has never been checked. */
      const typed = normalizeUrl(urlIn.value);
      const wantsTitle = mode === 'add' && !titleIn.value.trim() && typed;
      /* Sites already checked (another link on the same site) need no request at all. */
      const wantsIcon = typed && !state.icon && !GT.siteIcon.info(typed);
      const access = wantsTitle || wantsIcon ? GT.access.ensure() : null;
      try {
        const url = checkUrl();
        const titleOk = checkTitle();
        const groupOk = checkNewGroup();
        /* An Image URL that was typed but never loaded: load it now rather than drop it. */
        let iconOk = $('#e-icon').hidden;
        if (iconOk && state.picker && state.source === 'url' && iconUrlIn.value.trim() && iconUrlIn.value !== state.loadedFrom) {
          iconOk = await loadIconUrl();
        }

        const invalid = [!url && urlIn, !titleOk && titleIn, !groupOk && newGroupIn, !iconOk && iconControl()].filter(Boolean);
        $('#dlg-sub').hidden = invalid.length === 0;
        if (invalid.length) {
          invalid[0].focus();
          return;
        }

        const newGroupName = groupSel.value === NEW_GROUP ? newGroupIn.value.trim() : null;
        const fields = {
          url,
          title: titleIn.value.trim(),
          groupId: groupSel.value && groupSel.value !== NEW_GROUP ? groupSel.value : null,
          icon: state.icon
        };

        if (wantsIcon && !fields.icon) GT.siteIcon.fetchFor(url, { access }).catch(() => {});

        if (mode === 'edit') {
          GT.ops.updateItem(item.id, fields, newGroupName);
          focusAfter = item.id;
        } else {
          /* An empty title becomes the hostname now, then the page title if we can read it. */
          const autoTitle = !fields.title;
          if (autoTitle) fields.title = hostOf(url);
          const newId = GT.ops.addItem(fields, newGroupName);
          focusAfter = newId;
          if (autoTitle) {
            pageTitle(url, access).then((t) => {
              const now = GT.store.get().items.find((it) => it.id === newId);
              if (t && now && now.title === fields.title) GT.ops.updateItem(newId, { title: t });
            });
          }
        }
        handle.close();
      } finally {
        state.busy = false;
      }
    });

    r('cancel').addEventListener('click', () => handle.close(true));
    r('close').addEventListener('click', () => handle.close(true));
    r('delete')?.addEventListener('click', () => {
      GT.confirm.deleteItem(item.id, {
        returnFocus: r('delete'),
        onDeleted: (neighbour) => {
          focusAfter = neighbour;
          handle.close();
        }
      });
    });

    const handle = GT.dialog.open({
      form,
      initialFocus: urlIn,
      returnFocus: () => (focusAfter && GT.focus.resolve(focusAfter)) || GT.focus.resolve(returnFocus)
    });
    return handle;
  }

  GT.itemDialog = {
    normalizeUrl,
    add: (opts = {}) => open({ ...opts, mode: 'add' }),
    edit: (id, opts = {}) => open({ ...opts, id, mode: 'edit' })
  };
})(window.GT = window.GT || {});
