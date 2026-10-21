/* Tile size steps (SPEC §3). Auto tries XL → XS and keeps the first that fits the content box. */
(function (GT) {
  'use strict';

  /* Tile width, tile gap and column cap per step; mirrors the .sz-* classes in speeddial.css. */
  const STEPS = {
    xl: { tw: 160, gap: 16, cap: 9 },
    l: { tw: 136, gap: 14, cap: 9 },
    m: { tw: 112, gap: 12, cap: 9 },
    s: { tw: 96, gap: 10, cap: Infinity },
    xs: { tw: 72, gap: 8, cap: Infinity }
  };
  const AUTO_ORDER = ['xl', 'l', 'm', 's', 'xs'];
  const SIZE_CLASSES = AUTO_ORDER.map((s) => `sz-${s}`);

  /* The stage's content box: viewport minus gutters and top/bottom space (app.css), or the
     space left beside the settings panel. */
  function contentBox(root) {
    const stage = root.querySelector('.stage');
    if (!stage) return { w: innerWidth - 128, h: innerHeight - 2 * Math.max(64, innerHeight * 0.12) };
    const cs = getComputedStyle(stage);
    return {
      w: stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      h: stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    };
  }

  function maxCols(step, width) {
    const { tw, gap, cap } = STEPS[step];
    return Math.max(1, Math.min(cap, Math.floor((width + gap) / (tw + gap))));
  }

  /* Balanced rows so the last row isn't an orphan: 22 at 7 max → 6 columns (6, 6, 6, 4). */
  function flatCols(step, n, width) {
    const max = maxCols(step, width);
    return Math.ceil(n / Math.ceil(n / max));
  }

  function setStep(root, step, box) {
    root.classList.remove(...SIZE_CLASSES);
    root.classList.add(`sz-${step}`);

    const flat = root.querySelector('.grid-flat');
    if (flat) {
      const { tw, gap } = STEPS[step];
      const cols = flatCols(step, flat.children.length, box.w);
      flat.style.maxWidth = `${cols * tw + (cols - 1) * gap}px`;
    }

    /* S–XL show the full title as a native tooltip; XS uses the custom .tip instead. */
    for (const link of root.querySelectorAll('.tile[data-title]')) {
      if (step === 'xs') link.removeAttribute('title');
      else link.title = link.dataset.title;
    }
  }

  GT.size = {
    /* The step Auto chose last; the settings panel reports it. */
    autoStep: 'm',

    /* Pick and apply a step for the rendered content. Manual mode applies its step as is. */
    fit(root, config) {
      const content = root.querySelector('.groups, .grid-flat');
      const box = contentBox(root);
      if (!content) {
        setStep(root, 'm', box);
        return 'm';
      }
      if (config.size.mode === 'manual') {
        setStep(root, config.size.step, box);
        return config.size.step;
      }
      /* Each try forces one synchronous layout; it all happens before the first paint. */
      for (const step of AUTO_ORDER) {
        setStep(root, step, box);
        if (content.offsetHeight <= box.h || step === 'xs') {
          this.autoStep = step;
          return step;
        }
      }
    }
  };
})(window.GT = window.GT || {});
