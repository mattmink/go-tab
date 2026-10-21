# Go Tab

Go Tab is a Chromium extension that replaces the new tab page with a customizable speed dial. It is built with plain HTML, CSS, and JavaScript, with no framework or build step.

## Features

- Organize links into groups, or keep them together in an ungrouped view.
- Add, edit, delete, and rearrange links and groups.
- Choose solid, gradient, or image backgrounds and adjust tile sizing.
- Import and export backups, including image backgrounds.
- Use keyboard-accessible controls throughout the interface.

## Install for development

Go Tab requires Chromium 115 or later.

1. Open `chrome://extensions` in Chromium and enable **Developer mode**.
2. Select **Load unpacked** and choose this repository's directory.
3. Open a new tab to use Go Tab.

Changes to the extension files are picked up after reloading Go Tab from `chrome://extensions`.

## Package

Run the packaging script from the repository root:

```sh
bash scripts/package.sh
```

The script creates `dist/go-tab-<version>.zip`, using the version in `manifest.json`. The archive contains runtime files only; design references and development fixtures are excluded.

## Data and permissions

Go Tab stores its configuration in Chromium's local extension storage, background image data in IndexedDB, and a synchronous configuration cache in local storage. Backups can be exported from Settings and imported later.

The extension uses Chromium's favicon support for link icons. Optional access to websites may be requested when needed to look up a page title or retrieve a larger site icon. Without that access, Go Tab uses Chromium's favicon or a generated monogram instead.

## Repository layout

- `src/` — extension JavaScript and application styles
- `design/SPEC.md` — design and behavior specification
- `design/speeddial.css` — shared base styles and design tokens
- `design/reference/` — static reference screens
- `dev/` — sample configurations for testing layouts
- `icons/` — extension icons
- `scripts/package.sh` — Chrome Web Store package script

To try the sample layouts, import `dev/sample-22.json` or `dev/sample-61.json` through **Settings → Backup → Import**. See [`dev/README.md`](dev/README.md) for another option using the DevTools console.
