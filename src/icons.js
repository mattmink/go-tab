/* Inline SVG icons (same paths as the reference screens). Static markup only. */
performance.mark('go-tab:start'); /* first script on the page; see main.js */

(function (GT) {
  'use strict';

  const filled = (size, body) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;

  const svg = (size, body, width = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  GT.icon = {
    gear: (s = 18) => svg(s, '<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />'),
    pencil: (s = 18, w = 2) => svg(s, '<path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />', w),
    plus: (s = 24) => svg(s, '<path d="M12 5v14M5 12h14" />'),
    upload: (s = 14) => svg(s, '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />'),
    close: (s = 18) => svg(s, '<path d="M18 6L6 18M6 6l12 12" />'),
    chevronDown: (s = 16) => svg(s, '<path d="M6 9l6 6 6-6" />'),
    chevronRight: (s = 14) => svg(s, '<path d="M9 18l6-6-6-6" />'),
    link: (s = 14) => svg(s, '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />'),
    trash: (s = 15, w = 2) => svg(s, '<path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" />', w),
    folderPlus: (s = 14) => svg(s, '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><path d="M12 11v6M9 14h6" />'),
    arrowUp: (s = 16) => svg(s, '<path d="M12 19V5M5 12l7-7 7 7" />'),
    arrowDown: (s = 16) => svg(s, '<path d="M12 5v14M19 12l-7 7-7-7" />'),
    grip: (s = 14) => filled(s, '<circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />'),
    more: (s = 14) => filled(s, '<circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />'),
    alert: (s = 15) => svg(s, '<circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />'),
    revert: (s = 14) => svg(s, '<path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />'),
    globe: (s = 26) => svg(s, '<circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20z" />', 1.8),
    external: (s = 16) => svg(s, '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" />'),
    download: (s = 15) => svg(s, '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />'),
    image: (s = 28, w = 1.6) => svg(s, '<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />', w),
    minus: (s = 16) => svg(s, '<path d="M5 12h14" />'),
    check: (s = 14) => svg(s, '<path d="M20 6L9 17l-5-5" />'),
    newRow: (s = 16) => svg(s, '<path d="M9 10l-5 5 5 5" /><path d="M20 4v7a4 4 0 0 1-4 4H4" />'),
    folder: (s = 16) => svg(s, '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />')
  };
})(window.GT = window.GT || {});
