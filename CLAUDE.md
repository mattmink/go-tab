# go-tab

A Chromium MV3 extension that replaces the new tab page with a speed dial. Plain HTML, CSS and JS: no framework, no build step.

- The design spec lives in `design/SPEC.md`. Follow it for every visual and behavioural decision; ask before deviating.
- `design/speeddial.css` is the base stylesheet. Reuse its tokens (CSS variables) and classes.
- `design/reference/*.html` are static renders of each screen to compare against.
- Edit and delete controls on tiles appear only in edit mode, never on hover.
- App icon: `icons/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png` (masters: `icon.svg`, plus a pixel-tuned `icon-16.svg`). Reference them from `manifest.json` under both `icons` and `action.default_icon`.
- Keep first paint fast: no web fonts, no network requests for the UI, and render from the cached config before async storage resolves.
