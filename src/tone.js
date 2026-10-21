/* Auto tone (SPEC §2): pick the ink with the higher WCAG contrast against the background's average colour. */
(function (GT) {
  'use strict';

  const DARK_INK = [0x15, 0x17, 0x1c];
  const WHITE = [255, 255, 255];
  /* The default slate gradient is dark; its average sits near #232B40. */
  const DEFAULT_AVERAGE = [0x23, 0x2b, 0x40];

  const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const rgbToHex = (rgb) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');

  function luminance([r, g, b]) {
    const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* Average of the gradient as drawn: flat ends, then each segment's midpoint weighted by its span. */
  function gradientAverage(stops) {
    const s = [...stops].sort((a, b) => a[1] - b[1]).map(([c, p]) => [hexToRgb(c), p]);
    const acc = [0, 0, 0];
    const add = (rgb, w) => rgb.forEach((v, i) => (acc[i] += v * w));
    add(s[0][0], s[0][1]);
    for (let i = 0; i < s.length - 1; i++) {
      const [c0, p0] = s[i];
      const [c1, p1] = s[i + 1];
      add(c0.map((v, k) => (v + c1[k]) / 2), p1 - p0);
    }
    add(s[s.length - 1][0], 100 - s[s.length - 1][1]);
    return acc.map((v) => v / 100);
  }

  function averageColor(bg) {
    if (!bg) return DEFAULT_AVERAGE;
    if (bg.type === 'solid') return hexToRgb(bg.color);
    if (bg.type === 'gradient') return gradientAverage(bg.stops);
    /* Image: the average is computed once when the image is set and cached with it. */
    if (bg.type === 'image' && bg.image && /^#[0-9a-f]{6}$/i.test(bg.image.average)) return hexToRgb(bg.image.average);
    return DEFAULT_AVERAGE;
  }

  /* Draw into an 8×8 canvas and average the pixels. Call once when an image is chosen. */
  function imageAverage(img) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 8, 8);
    const { data } = ctx.getImageData(0, 0, 8, 8);
    const acc = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) acc[k] += data[i + k];
    return rgbToHex(acc.map((v) => v / 64));
  }

  GT.tone = {
    contrast,
    averageColor,
    imageAverage,
    of(bg) {
      const avg = averageColor(bg);
      return contrast(WHITE, avg) >= contrast(DARK_INK, avg) ? 'dark' : 'light';
    }
  };
})(window.GT = window.GT || {});
