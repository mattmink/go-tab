Paste this as your first message to Claude Code, from the go-tab folder:

---

Build go-tab, a browser extension (Chromium, Manifest V3) that replaces the new tab page with a customizable speed dial: a grid of link tiles, optionally organized into groups. Use plain HTML, CSS and JavaScript with no framework, no build step and no external network requests for the UI.

The design is final and fully specified:

- `design/SPEC.md` is the source of truth for tokens, tile sizes, auto-sizing, auto tone, every state and behaviour, and the data shape.
- `design/speeddial.css` is the production stylesheet the designs were built with. Use its classes and CSS variables rather than restyling. Classes named `.is-hover`, `.is-focus` and `.is-drop` exist only to freeze states in the mockups; drive them from real interaction instead.
- `design/reference/*.html` are static renders of every screen. Open them to check layout. Match them, but don't copy their sample data.

Work in this order, and stop after each step so I can try it:

1. Scaffold: manifest, `newtab.html`, storage layer (`chrome.storage.local` plus a `localStorage` cache for instant first paint), seed with the empty state.
2. Main view: groups and tiles, grouping on/off, auto size steps, auto tone, favicons via `_favicon` with a monogram fallback.
3. Edit item / Add item dialog with validation and icon options, plus the delete confirmations.
4. Edit mode: tile controls, drag and drop (pointer and keyboard) within and across groups, group rename, reorder and delete.
5. Settings panel: background (solid, gradient, image), grouping, item size, export/import.
6. Accessibility pass against SPEC §4 (focus rings, roving tabindex, actions menu, live region, reduced motion) and a performance check on first paint.

Edit and delete controls must appear only in edit mode, never on hover.
