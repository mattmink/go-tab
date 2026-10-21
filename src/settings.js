/* Settings panel (SPEC §4): a side panel, not a modal. Changes apply immediately and save
   debounced; the page re-centres beside the panel so every change previews live. */
(function (GT) {
  'use strict';

  const { h, gradientCss } = GT.ui;
  const root = document.getElementById('app');
  const NOTE_KEY = 'go-tab:livenote-seen';

  const STEPS = ['xs', 's', 'm', 'l', 'xl'];
  const STEP_PX = { xs: 72, s: 96, m: 112, l: 136, xl: 160 };
  const MAX_STOPS = 5;
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const IMAGE_MAX = 8 * 1024 * 1024;

  const SOLID_PRESETS = [
    ['Slate', '#232B40'], ['Pine', '#1F3A33'], ['Plum', '#3B2A4A'],
    ['Sand', '#E8E2D6'], ['Fog', '#E3E7EC'], ['Clay', '#C96F4A']
  ];
  /* Slate is the default first-run background (background: null). */
  const GRADIENT_PRESETS = [
    ['Slate', null, 'linear-gradient(165deg, #1C2233, #34436A)'],
    ['Dusk', ['#1F3B57', '#5B4B8A']], ['Forest', ['#12312B', '#3F6B4E']], ['Ember', ['#3A1C1C', '#A0522D']],
    ['Mist', ['#EEF1F5', '#D9E2EE']], ['Peach', ['#FBE3D3', '#F3C6C6']]
  ];
  /* What the editor shows (and starts from) while the default background is in use. */
  const DEFAULT_EDITABLE = { type: 'gradient', color: '#232B40', stops: [['#1C2233', 0], ['#34436A', 100]], angle: 165, image: null };

  const MSG = {
    imageType: (name) => `${name} can’t be used. Choose a JPG, PNG or WebP up to 8 MB.`,
    imageLoad: 'Couldn’t load that image. Check the address or upload a file.'
  };

  let sheet = null;
  let note = null;
  let opener = null;
  let selStop = 0;

  const config = () => GT.store.get();
  const bg = () => config().background || DEFAULT_EDITABLE;
  const isDefaultBg = () => !config().background;
  const $ = (k) => sheet?.querySelector(`[data-k="${k}"]`) || null;

  /* Apply a background change. `defer` while a slider or colour picker is moving. */
  function setBg(patch, opts) {
    GT.store.update((c) => {
      c.background = { ...(c.background || structuredClone(DEFAULT_EDITABLE)), ...patch };
    }, opts);
  }

  /* Rebuild a section, keeping focus on the control with the same data-k. */
  function rebuild(fn) {
    const key = sheet.contains(document.activeElement) ? document.activeElement.dataset.k : null;
    fn();
    if (key) $(key)?.focus();
  }

  function normalizeHex(text) {
    let t = text.trim().replace(/^#?/, '#');
    if (/^#[0-9a-f]{3}$/i.test(t)) t = '#' + [...t.slice(1)].map((c) => c + c).join('');
    return /^#[0-9a-f]{6}$/i.test(t) ? t.toUpperCase() : null;
  }

  const seg = (label, options, value, key) =>
    h('div', { class: 'seg full', role: 'group', 'aria-label': label },
      ...options.map(([v, text]) => h('button', { type: 'button', 'aria-pressed': String(v === value), 'data-k': `${key}-${v}`, 'data-v': v, text })));

  /* ---------- Background ---------- */

  function renderBackground() {
    const sec = sheet.querySelector('[data-sec="bg"]');
    const b = bg();
    const type = b.type;
    const kids = [
      h('h3', { id: 's-bg', text: 'Background' }),
      seg('Background type', [['solid', 'Solid'], ['gradient', 'Gradient'], ['image', 'Image']], type, 'bgtype')
    ];
    if (type === 'solid') kids.push(...solidControls(b));
    else if (type === 'gradient') kids.push(...gradientControls(b));
    else kids.push(...imageControls(b));
    sec.replaceChildren(...kids);

    sec.querySelector('.seg').addEventListener('click', (e) => {
      const v = e.target.closest('button')?.dataset.v;
      if (!v || v === type) return;
      setBg({ type: v });
      rebuild(renderBackground);
    });
  }

  function toneHelp(color) {
    return GT.tone.of({ type: 'solid', color }) === 'light'
      ? 'Light colour detected, so tiles switch to light glass with dark text.'
      : 'Dark colour detected, so tiles use dark glass with white text.';
  }

  function solidControls(b) {
    const presets = h('div', { class: 'presets', role: 'group', 'aria-label': 'Colour presets' },
      ...SOLID_PRESETS.map(([name, hex]) => h('button', {
        class: 'preset', type: 'button', 'aria-label': `${name} ${hex}`, 'data-k': `solid-${name}`,
        'aria-pressed': String(b.color.toUpperCase() === hex), style: `background:${hex}`
      })));
    const picker = h('input', { class: 'colorin', type: 'color', 'aria-label': 'Pick colour', 'data-k': 'solid-color' });
    picker.value = b.color.toLowerCase();
    const hex = h('input', { class: 'input', id: 'solid-hex', type: 'text', spellcheck: 'false', autocomplete: 'off', 'data-k': 'solid-hex', 'aria-describedby': 'solid-help' });
    hex.value = b.color.toUpperCase();
    const help = h('span', { class: 'help', id: 'solid-help', text: toneHelp(b.color) });

    const sync = (color) => {
      hex.value = color.toUpperCase();
      help.textContent = toneHelp(color);
      for (const p of presets.children) p.setAttribute('aria-pressed', String(p.getAttribute('aria-label').endsWith(color.toUpperCase())));
    };
    presets.addEventListener('click', (e) => {
      const p = e.target.closest('.preset');
      if (!p) return;
      const color = p.getAttribute('aria-label').split(' ')[1];
      setBg({ type: 'solid', color });
      picker.value = color.toLowerCase();
      sync(color);
    });
    picker.addEventListener('input', () => {
      setBg({ type: 'solid', color: picker.value.toUpperCase() }, { defer: true });
      sync(picker.value);
    });
    hex.addEventListener('change', () => {
      const color = normalizeHex(hex.value);
      if (!color) return void (hex.value = bg().color.toUpperCase());
      setBg({ type: 'solid', color });
      picker.value = color.toLowerCase();
      sync(color);
    });

    return [presets, h('div', { class: 'field' },
      h('label', { class: 'flabel', for: 'solid-hex', text: 'Colour' }),
      h('div', { class: 'stop' }, picker, hex), help)];
  }

  function gradientControls(b) {
    const stops = b.stops;
    selStop = Math.min(selStop, stops.length - 1);
    const presetMatch = (cols) => !isDefaultBg() && stops.length === 2 && b.angle === 135 &&
      stops[0][1] === 0 && stops[1][1] === 100 && stops[0][0].toUpperCase() === cols[0] && stops[1][0].toUpperCase() === cols[1];

    const presets = h('div', { class: 'presets', role: 'group', 'aria-label': 'Gradient presets' },
      ...GRADIENT_PRESETS.map(([name, cols, css]) => h('button', {
        class: 'preset', type: 'button', 'aria-label': name, 'data-k': `grad-${name}`, 'data-name': name,
        'aria-pressed': String(cols ? presetMatch(cols) : isDefaultBg()),
        style: `background:${css || `linear-gradient(135deg, ${cols[0]}, ${cols[1]})`}`
      })));
    presets.addEventListener('click', (e) => {
      const p = e.target.closest('.preset');
      if (!p) return;
      const preset = GRADIENT_PRESETS.find(([n]) => n === p.dataset.name);
      if (preset[1]) setBg({ type: 'gradient', stops: [[preset[1][0], 0], [preset[1][1], 100]], angle: 135 });
      else GT.store.update((c) => { c.background = null; });
      selStop = 0;
      rebuild(renderBackground);
    });

    /* Preview bar with draggable stop handles. */
    const bar = h('div', { class: 'gbar', style: `background:${gradientCss(stops, 90)}` });
    const handles = stops.map(([c, p], i) => h('button', {
      class: i === selStop ? 'gstop is-sel' : 'gstop', type: 'button', 'data-k': `gstop-${i}`, 'data-i': i,
      'aria-label': `Stop ${i + 1}, ${c.toUpperCase()} at ${p}%`, style: `left:${p}%;background:${c}`
    }));
    bar.append(...handles);

    const rows = stops.map(([c, p], i) => {
      const picker = h('input', { class: 'colorin', type: 'color', 'aria-label': `Stop ${i + 1} colour`, 'data-k': `scol-${i}` });
      picker.value = c.toLowerCase();
      const hex = h('input', { class: 'input', type: 'text', spellcheck: 'false', autocomplete: 'off', 'aria-label': `Stop ${i + 1} hex`, 'data-k': `shex-${i}` });
      hex.value = c.toUpperCase();
      const pos = h('input', { class: 'input pos', type: 'text', inputmode: 'numeric', 'aria-label': `Stop ${i + 1} position`, 'data-k': `spos-${i}` });
      pos.value = `${p}%`;
      const remove = h('button', {
        class: 'iconsq', type: 'button', 'aria-label': `Remove stop ${i + 1}`, 'data-k': `srm-${i}`,
        disabled: stops.length <= 2, style: stops.length <= 2 ? 'opacity:.4' : null, html: GT.icon.minus()
      });

      picker.addEventListener('input', () => {
        const next = structuredClone(bg().stops);
        next[i][0] = picker.value.toUpperCase();
        setBg({ type: 'gradient', stops: next }, { defer: true });
        hex.value = picker.value.toUpperCase();
        handles[i].style.background = picker.value;
        bar.style.background = gradientCss(next, 90);
      });
      hex.addEventListener('change', () => {
        const color = normalizeHex(hex.value);
        if (!color) return void (hex.value = bg().stops[i][0].toUpperCase());
        const next = structuredClone(bg().stops);
        next[i][0] = color;
        setBg({ type: 'gradient', stops: next });
        rebuild(renderBackground);
      });
      pos.addEventListener('change', () => {
        const n = parseInt(pos.value, 10);
        if (!Number.isFinite(n)) return void (pos.value = `${bg().stops[i][1]}%`);
        const next = structuredClone(bg().stops);
        next[i][1] = Math.max(0, Math.min(100, n));
        commitStops(next, next[i]);
      });
      remove.addEventListener('click', () => {
        const next = structuredClone(bg().stops);
        next.splice(i, 1);
        selStop = Math.max(0, Math.min(selStop, next.length - 1));
        setBg({ type: 'gradient', stops: next });
        rebuild(renderBackground);
        $(`srm-${Math.min(i, next.length - 1)}`)?.focus();
      });
      return h('div', { class: 'stop' }, picker, hex, pos, remove);
    });

    /* Drag or arrow-key a handle to move its stop; the list is re-sorted when it settles. */
    const moveStop = (i, p, { defer }) => {
      const next = structuredClone(bg().stops);
      next[i][1] = Math.max(0, Math.min(100, Math.round(p)));
      setBg({ type: 'gradient', stops: next }, { defer });
      handles[i].style.left = `${next[i][1]}%`;
      handles[i].setAttribute('aria-label', `Stop ${i + 1}, ${next[i][0].toUpperCase()} at ${next[i][1]}%`);
      rows[i].querySelector('.pos').value = `${next[i][1]}%`;
      bar.style.background = gradientCss(next, 90);
      return next;
    };
    bar.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.gstop');
      if (!handle) return;
      const i = +handle.dataset.i;
      selStop = i;
      for (const el of handles) el.classList.toggle('is-sel', el === handle);
      handle.setPointerCapture(e.pointerId);
      const box = bar.getBoundingClientRect();
      const onMove = (ev) => moveStop(i, ((ev.clientX - box.left) / box.width) * 100, { defer: true });
      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        const next = bg().stops;
        commitStops(structuredClone(next), structuredClone(next)[i], next[i]);
      };
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp, { once: true });
    });
    bar.addEventListener('keydown', (e) => {
      const handle = e.target.closest('.gstop');
      if (!handle || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      const i = +handle.dataset.i;
      const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowLeft' ? -1 : 1);
      const next = moveStop(i, bg().stops[i][1] + step, { defer: true });
      commitStops(next, next[i]);
    });
    bar.addEventListener('focusin', (e) => {
      const handle = e.target.closest('.gstop');
      if (!handle) return;
      selStop = +handle.dataset.i;
      for (const el of handles) el.classList.toggle('is-sel', el === handle);
    });

    const add = h('button', {
      class: 'linkbtn', type: 'button', 'data-k': 'stop-add', style: 'align-self:flex-start',
      disabled: stops.length >= MAX_STOPS, html: `${GT.icon.plus(14)}Add colour stop`
    });
    add.addEventListener('click', () => {
      const sorted = [...bg().stops].sort((x, y) => x[1] - y[1]);
      /* New stop in the middle of the widest gap, coloured to match the gradient there. */
      let gap = 0;
      for (let k = 1; k < sorted.length; k++) if (sorted[k][1] - sorted[k - 1][1] > sorted[gap + 1][1] - sorted[gap][1]) gap = k - 1;
      const [a, z] = [sorted[gap], sorted[gap + 1]];
      const mix = (x, y) => Math.round((parseInt(x, 16) + parseInt(y, 16)) / 2).toString(16).padStart(2, '0');
      const color = '#' + [1, 3, 5].map((o) => mix(a[0].slice(o, o + 2), z[0].slice(o, o + 2))).join('').toUpperCase();
      const stop = [color, Math.round((a[1] + z[1]) / 2)];
      commitStops([...sorted, stop], stop);
    });

    const angle = h('input', { class: 'range', id: 'angle', type: 'range', min: '0', max: '360', 'data-k': 'angle' });
    angle.value = String(b.angle);
    const angleText = h('input', { class: 'input', type: 'text', inputmode: 'numeric', 'aria-label': 'Angle in degrees', 'data-k': 'angle-text', style: 'width:72px;height:36px' });
    angleText.value = `${b.angle}°`;
    angle.addEventListener('input', () => {
      setBg({ type: 'gradient', angle: +angle.value }, { defer: true });
      angleText.value = `${angle.value}°`;
    });
    angleText.addEventListener('change', () => {
      const n = parseInt(angleText.value, 10);
      const v = Number.isFinite(n) ? Math.max(0, Math.min(360, n)) : bg().angle;
      setBg({ type: 'gradient', angle: v });
      angle.value = String(v);
      angleText.value = `${v}°`;
    });

    return [presets, bar, h('div', { class: 'stops' }, ...rows), add,
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'angle', text: 'Angle' }),
        h('div', { class: 'rangewrap' }, angle, angleText))];
  }

  /* Save stops sorted by position, keep `stop` selected, and rebuild. */
  function commitStops(next, stop, original) {
    next.sort((x, y) => x[1] - y[1]);
    const find = original || stop;
    selStop = Math.max(0, next.findIndex((s) => s[0] === find[0] && s[1] === find[1]));
    const focusedHandle = document.activeElement?.classList.contains('gstop');
    setBg({ type: 'gradient', stops: next.slice(0, MAX_STOPS) });
    rebuild(renderBackground);
    if (focusedHandle) $(`gstop-${selStop}`)?.focus();
  }

  function imageControls(b) {
    const img = b.image;
    const prev = h('div', { class: 'imgprev', style: 'background:#2B3240;align-items:stretch;flex-direction:column;justify-content:space-between' });
    if (img) {
      const setPreview = (url) => {
        prev.style.backgroundImage = `url("${url}")`;
        prev.style.backgroundSize = 'cover';
        prev.style.backgroundPosition = 'center';
      };
      const url = GT.bgImage.cachedUrl(img.id);
      if (url) setPreview(url);
      else GT.bgImage.url(img.id).then((u) => u && setPreview(u));
      prev.append(h('span'), h('span', { class: 'cap', style: 'align-self:flex-start', text: [img.name, img.w && `${img.w} × ${img.h}`].filter(Boolean).join(' · ') }));
    } else {
      prev.append(h('div', {
        style: 'flex:1;display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;color:rgba(255,255,255,.55);font-size:13px',
        html: `${GT.icon.image()}<span>No image yet</span>`
      }));
    }

    const file = h('input', { type: 'file', accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', hidden: '' });
    const err = h('span', { class: 'err', id: 'img-err', hidden: '' });
    const urlIn = h('input', { class: 'input', id: 'img-url', type: 'url', placeholder: 'https://…/photo.jpg', 'data-k': 'img-url', autocomplete: 'off', spellcheck: 'false' });
    const load = h('button', { class: 'btn btn-secondary', type: 'button', 'data-k': 'img-load', style: 'height:40px', text: 'Load' });
    const drop = h('button', { class: 'dropzone', type: 'button', 'data-k': 'img-drop', html: `${GT.icon.upload(16)}<span>Drop an image or <b>choose a file</b></span>` });

    const showError = (control, msg) => {
      for (const el of [urlIn, drop]) {
        el.classList.toggle('is-error', el === control && !!msg);
        if (el === control && msg) {
          el.setAttribute('aria-invalid', 'true');
          el.setAttribute('aria-describedby', 'img-err');
        } else {
          el.removeAttribute('aria-invalid');
          el.removeAttribute('aria-describedby');
        }
      }
      err.hidden = !msg;
      err.innerHTML = msg ? GT.icon.alert() : '';
      if (msg) err.append(msg);
    };

    async function useBlob(blob, name, control) {
      if (!IMAGE_TYPES.includes(blob.type) || blob.size > IMAGE_MAX) return showError(control, MSG.imageType(name));
      let info;
      try {
        info = await GT.bgImage.describe(blob);
      } catch {
        return showError(control, MSG.imageLoad);
      }
      const id = await GT.bgImage.put(blob);
      const old = bg().image?.id;
      setBg({ type: 'image', image: { id, name, ...info } });
      if (old) GT.bgImage.remove(old);
      rebuild(renderBackground);
    }

    file.addEventListener('change', () => {
      const f = file.files[0];
      file.value = '';
      if (f) useBlob(f, f.name, drop);
    });
    drop.addEventListener('click', () => file.click());
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('is-over');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-over');
      const f = e.dataTransfer.files[0];
      if (f) useBlob(f, f.name, drop);
    });

    const loadUrl = async () => {
      const url = GT.itemDialog.normalizeUrl(urlIn.value);
      if (!url) return showError(urlIn, MSG.imageLoad);
      /* Ask for site access during the click; without it only CORS-enabled servers work. */
      const access = GT.access.ensure();
      load.disabled = true;
      try {
        await access;
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const name = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || new URL(url).hostname);
        await useBlob(blob, name, urlIn);
      } catch {
        showError(urlIn, MSG.imageLoad);
      } finally {
        load.disabled = false;
      }
    };
    load.addEventListener('click', loadUrl);
    urlIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadUrl();
      }
    });

    const out = [prev];
    if (img) {
      const replace = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', 'data-k': 'img-replace', html: `${GT.icon.upload()}Replace…` });
      const remove = h('button', { class: 'btn btn-quiet btn-sm', type: 'button', 'data-k': 'img-remove', style: 'color:var(--danger-text)', text: 'Remove' });
      replace.addEventListener('click', () => file.click());
      remove.addEventListener('click', () => {
        const old = bg().image?.id;
        setBg({ type: 'image', image: null });
        GT.bgImage.remove(old);
        rebuild(renderBackground);
        $('img-drop')?.focus();
      });
      out.push(h('div', { style: 'display:flex;gap:8px' }, replace, remove));
    }
    out.push(
      h('div', { class: 'field' }, h('label', { class: 'flabel', for: 'img-url', text: 'Image URL' }), h('div', { class: 'inline' }, urlIn, load)),
      drop, file, err,
      h('span', { class: 'help', text: 'JPG, PNG or WebP up to 8 MB. Uploads are stored on this device. Tile tone is picked from the image’s brightness.' }));
    return out;
  }

  /* ---------- Grouping ---------- */

  function renderGrouping() {
    const sec = sheet.querySelector('[data-sec="grp"]');
    const sw = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-labelledby': 'grp-l', 'data-k': 'grouping', 'aria-checked': String(config().grouping) },
      h('span', { class: 'knob' }));
    sw.addEventListener('click', () => {
      const on = !config().grouping;
      GT.store.update((c) => { c.grouping = on; });
      sw.setAttribute('aria-checked', String(on));
    });
    /* Side by side lets groups share a row (a group can still start a new row from its ⋯ menu);
       One per row starts every group on its own row. Only shown while groups are. */
    const layout = seg('Group layout', [['flow', 'Side by side'], ['rows', 'One per row']], config().groupLayout, 'glayout');
    const layoutField = h('div', { class: 'field', 'data-r': 'glayout' },
      h('span', { class: 'flabel', text: 'Group layout' }), layout,
      h('span', { class: 'help', text: 'Side by side lets small groups share a row. To break a row before a particular group, use Start on a new row in its ⋯ menu.' }));
    layoutField.hidden = !config().grouping;
    layout.addEventListener('click', (e) => {
      const v = e.target.closest('button')?.dataset.v;
      if (!v || v === config().groupLayout) return;
      GT.store.update((c) => { c.groupLayout = v; });
      for (const b of layout.children) b.setAttribute('aria-pressed', String(b.dataset.v === v));
    });
    sw.addEventListener('click', () => { layoutField.hidden = !config().grouping; });

    sec.replaceChildren(
      h('h3', { id: 's-grp', text: 'Grouping' }),
      h('div', { class: 'srow' },
        h('span', {}, h('span', { class: 'slabel', id: 'grp-l', text: 'Show groups' }), h('span', { class: 'ssub', text: 'Off shows every link in one grid.' })),
        sw),
      layoutField);
  }

  /* ---------- Item size ---------- */

  /* Built once; updateSize() keeps it in step without replacing the slider mid-drag. */
  function renderSize() {
    const sec = sheet.querySelector('[data-sec="size"]');
    const modes = seg('Item size mode', [['auto', 'Auto'], ['manual', 'Manual']], config().size.mode, 'size');
    const range = h('input', { class: 'range', type: 'range', min: '0', max: '4', step: '1', 'aria-label': 'Item size', 'data-k': 'size-range' });
    const val = h('span', { class: 'rangeval' });
    const ticks = h('div', { class: 'ticks', 'aria-hidden': 'true' }, ...STEPS.map((s) => h('span', { text: s.toUpperCase() })));
    const autoHelp = h('span', { class: 'help' });
    const back = h('button', { class: 'linkbtn', type: 'button', 'data-k': 'size-back', html: `${GT.icon.revert()}Back to Auto` });
    const manualRow = h('div', { class: 'srow' }, h('span', { class: 'help', text: 'Manual size. If links don’t fit, the page scrolls.' }), back);

    modes.addEventListener('click', (e) => {
      const v = e.target.closest('button')?.dataset.v;
      if (!v || v === config().size.mode) return;
      GT.store.update((c) => {
        c.size = { mode: v, step: v === 'manual' ? GT.size.autoStep : c.size.step };
      });
    });
    /* Moving the slider switches to Manual. */
    range.addEventListener('input', () => {
      const step = STEPS[+range.value];
      GT.store.update((c) => { c.size = { mode: 'manual', step }; }, { defer: true });
    });
    back.addEventListener('click', () => {
      GT.store.update((c) => { c.size = { mode: 'auto', step: c.size.step }; });
      $('size-auto')?.focus();
    });

    sec.replaceChildren(h('h3', { id: 's-size', text: 'Item size' }), modes, h('div', { class: 'rangewrap' }, range, val), ticks, autoHelp, manualRow);
    updateSize();
  }

  function updateSize() {
    if (!sheet) return;
    const { mode, step: manualStep } = config().size;
    const auto = mode === 'auto';
    const step = auto ? GT.size.autoStep : manualStep;
    for (const b of sheet.querySelectorAll('[data-sec="size"] .seg button')) b.setAttribute('aria-pressed', String(b.dataset.v === mode));
    const range = $('size-range');
    if (document.activeElement !== range || auto) range.value = String(STEPS.indexOf(step));
    range.setAttribute('aria-valuetext', auto ? `Auto, currently ${step.toUpperCase()}` : `${step.toUpperCase()}, ${STEP_PX[step]} pixels`);
    const val = sheet.querySelector('[data-sec="size"] .rangeval');
    val.textContent = step.toUpperCase();
    val.style.color = auto ? 'var(--text-2)' : '';
    sheet.querySelector('[data-sec="size"] .ticks').hidden = auto;
    sheet.querySelector('[data-sec="size"] .srow').hidden = auto;
    const help = sheet.querySelector('[data-sec="size"] > .help');
    help.hidden = !auto;
    const n = config().items.length;
    const links = `${n} ${n === 1 ? 'link' : 'links'}`;
    const fits = root.querySelector('.stage').scrollHeight <= root.querySelector('.stage').clientHeight;
    help.textContent = fits
      ? `Auto is using ${step.toUpperCase()} (${STEP_PX[step]} px) so all ${links} fit. Drag the slider to switch to Manual.`
      : `Auto is using ${step.toUpperCase()} (${STEP_PX[step]} px), the smallest size; the page scrolls to show all ${links}.`;
  }

  /* ---------- Backup ---------- */

  function renderBackup() {
    const sec = sheet.querySelector('[data-sec="bak"]');
    const exp = h('button', { class: 'btn btn-secondary', type: 'button', 'data-k': 'export', style: 'flex:1', html: `${GT.icon.download()}Export` });
    const imp = h('button', { class: 'btn btn-secondary', type: 'button', 'data-k': 'import', style: 'flex:1', html: `${GT.icon.upload(15)}Import…` });
    const err = h('span', { class: 'err', id: 'bak-err', hidden: '' });
    exp.addEventListener('click', () => GT.backup.export());
    imp.addEventListener('click', async () => {
      err.hidden = true;
      const msg = await GT.backup.import({ returnFocus: () => $('import') });
      if (msg) {
        err.innerHTML = GT.icon.alert();
        err.append(msg);
        err.hidden = false;
      }
    });
    sec.replaceChildren(
      h('h3', { id: 's-bak', text: 'Backup' }),
      h('div', { style: 'display:flex;gap:8px' }, exp, imp),
      err,
      h('span', { class: 'help', text: 'A .json file with your links, groups, icons and background. Importing replaces the current setup after you confirm.' }));
  }

  /* ---------- Open / close ---------- */

  function build() {
    sheet = h('aside', {
      class: 'sheet', role: 'dialog', 'aria-labelledby': 'set-t',
      html: `<div class="sheet-h"><h2 id="set-t" tabindex="-1">Settings</h2><button class="xbtn" type="button" data-k="close" aria-label="Close settings" style="margin:0">${GT.icon.close()}</button></div>
        <div class="sheet-b">
          <section class="sec" aria-labelledby="s-bg" data-sec="bg"></section>
          <section class="sec" aria-labelledby="s-grp" data-sec="grp"></section>
          <section class="sec" aria-labelledby="s-size" data-sec="size"></section>
          <section class="sec" aria-labelledby="s-bak" data-sec="bak"></section>
        </div>`
    });
    sheet.querySelector('[data-k="close"]').addEventListener('click', () => GT.settings.close());
    sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !GT.dialog.isOpen()) {
        e.preventDefault();
        GT.settings.close();
      }
      /* Page shortcuts (N, E…) don't apply while the panel has focus. */
      e.stopPropagation();
    });
    renderBackground();
    renderGrouping();
    renderSize();
    renderBackup();
  }

  /* Changes from elsewhere (another tab, an import) re-sync the panel. */
  let lastSeen = null;
  GT.store.subscribe((c) => {
    if (!sheet) return;
    const prev = lastSeen;
    lastSeen = c;
    if (!prev || prev === c) return;
    if (prev.grouping !== c.grouping) {
      $('grouping')?.setAttribute('aria-checked', String(c.grouping));
      const field = sheet.querySelector('[data-r="glayout"]');
      if (field) field.hidden = !c.grouping;
    }
    if (prev.groupLayout !== c.groupLayout) {
      for (const b of sheet.querySelectorAll('[data-r="glayout"] .seg button')) b.setAttribute('aria-pressed', String(b.dataset.v === c.groupLayout));
    }
    /* Rebuild the background controls only for changes the panel didn't make itself. */
    if (!sheet.contains(document.activeElement) && JSON.stringify(prev.background) !== JSON.stringify(c.background)) {
      rebuild(renderBackground);
    }
  });

  GT.settings = {
    isOpen: () => !!sheet,

    open(trigger) {
      if (sheet) return;
      GT.menu.close({ restore: false });
      if (GT.edit.on) GT.edit.on = false;
      opener = trigger ? GT.focus.locator(trigger) : null;
      lastSeen = config();
      build();
      root.append(sheet);
      try {
        if (!localStorage.getItem(NOTE_KEY)) {
          note = h('div', { class: 'livenote', role: 'status', text: 'Changes apply as you edit' });
          root.append(note);
          localStorage.setItem(NOTE_KEY, '1');
        }
      } catch {
        /* The note is a nicety. */
      }
      GT.app.repaint();
      sheet.querySelector('#set-t').focus();
    },

    close() {
      if (!sheet) return;
      sheet.remove();
      note?.remove();
      sheet = note = null;
      GT.app.repaint();
      (GT.focus.resolve(opener) || root.querySelector('[data-action="settings"]'))?.focus();
    },

    /* After every paint: Auto's choice may have changed. */
    afterPaint: updateSize
  };
})(window.GT = window.GT || {});
