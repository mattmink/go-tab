# go-tab — design spec

A browser extension that replaces the new tab page with a speed dial: a grid of link tiles, optionally in groups. Plain HTML, CSS and JavaScript; no frameworks, no WebGL, no heavy effects.

- **Stylesheet:** `design/speeddial.css` holds every token and component in this spec. Start from it.
- **Reference screens:** `design/reference/*.html`, static pages that open in a browser. They show each state at fixed viewports and are layout references, not the app. State classes such as `.is-hover`, `.is-focus` and `.is-drop` exist only to freeze a state for the picture; in the app use the real `:hover` / `:focus-visible` and runtime classes.

| Screen | Reference file |
| --- | --- |
| Main view, grouping on (1440×900, 1920×1080, 1024×720) | `Main.html`, `Main-1920.html`, `Main-1024.html` |
| Main view, grouping off | `Main-Ungrouped.html` |
| Tile size steps / many items / few items | `Sizes-Scale.html`, `Sizes-Small.html`, `Sizes-Large.html` |
| Tile states | `States.html` |
| Edit mode with drag in progress | `EditMode.html` |
| Edit item dialog: default, custom icon, errors | `EditItem.html`, `EditItem-Icon.html`, `EditItem-Errors.html` |
| Group management | `Groups.html` |
| Delete group / delete item | `DeleteGroup.html`, `DeleteItem.html` |
| Settings: gradient, solid + manual size, image | `Settings-Gradient.html`, `Settings-Solid.html`, `Settings-Image.html` |
| First run | `Empty.html` |

---

## 1. Foundations

### Typography

System font stack only. Nothing is downloaded, so the page paints instantly.

`--font: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

| Use | Size / line height | Weight |
| --- | --- | --- |
| Empty-state title | 22px / 28px | 650 |
| Dialog title | 18px / 24px | 650 |
| Settings panel title | 16px / 22px | 650 |
| Body, inputs, dialog text | 14px / 20px | 400 |
| Group heading, buttons, labels | 13px / 16–18px | 600 |
| Tile title | 12–14px / 16px (per size step) | 500 |
| Help text, domains, tooltips | 12px / 16px | 400–500 |
| Settings section heading | 12px / 16px, uppercase, letter-spacing .06em | 650 |

Use `font-weight: 650` where supported; it falls back to 600/700.

### Spacing scale

4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 px. Page side gutter 64px (48px at ≤1024 wide). Group gaps vary by size step (§3).

### Radii

| Token | Value | Use |
| --- | --- | --- |
| `--tr` | 14–20px (per size step) | Tiles, ghost tiles, drop slot |
| `--ir` | 9–14px (per size step) | Site icon inside a tile |
| `--r-ctl` | 10px | Buttons, inputs, selects |
| `--r-pop` | 12px | Menus, toasts |
| `--r-dialog` | 18px | Dialogs |
| `--r-panel` | 20px | Settings panel |
| `--r-pill` | 999px | Group headings, toolbar buttons, edit bar, switches |

### Colour: tone

The UI has two tones, chosen automatically from the background (§2). Tokens are defined on `.nt` (dark tone, default) and overridden by `.nt.tone-light`.

**Glass (everything drawn directly on the background)**

| Token | Dark tone | Light tone |
| --- | --- | --- |
| `--glass` | `rgba(16,18,24,.62)` | `rgba(255,255,255,.62)` |
| `--glass-hover` | `rgba(16,18,24,.70)` | `rgba(255,255,255,.74)` |
| `--glass-strong` | `rgba(16,18,24,.82)` | `rgba(255,255,255,.86)` |
| `--glass-edge` (1px border) | `rgba(255,255,255,.14)` | `rgba(255,255,255,.70)` |
| `--glass-blur` | `blur(20px) saturate(1.4)` | same |
| `--ink` (text on glass) | `#FFFFFF` | `#15171C` |
| `--ink-2` (secondary on glass) | `rgba(255,255,255,.74)` | `#4A4F59` |
| `--ghost-line` (dashed borders) | `rgba(255,255,255,.42)` | `rgba(21,23,28,.38)` |

The 62% tint is deliberate. It keeps tile text above WCAG AA (4.5:1) even if the background behind a tile is pure white (dark tone, about 5.3:1) or pure black (light tone, about 6.7:1). Do not lower it to get a "more glassy" look; that is what breaks legibility on busy photos.

**Solid surfaces (dialogs, menus, settings panel)**

| Token | Dark tone | Light tone |
| --- | --- | --- |
| `--surface` | `#1D2028` | `#FFFFFF` |
| `--surface-2` (inputs, cards) | `#262A33` | `#F3F4F6` |
| `--surface-3` (hover, pressed) | `#323743` | `#E6E8EC` |
| `--seg-on` (selected segment) | `#3A3F4B` | `#FFFFFF` |
| `--line` | `rgba(255,255,255,.10)` | `rgba(15,17,22,.10)` |
| `--line-strong` (input borders) | `rgba(255,255,255,.24)` | `rgba(15,17,22,.24)` |
| `--text` | `#F3F4F6` | `#15171C` |
| `--text-2` | `#A6ACB8` (7.2:1) | `#5B616B` (6.4:1) |
| `--accent-text` (links) | `#8AB4FF` | `#1D4ED8` |
| `--danger-text` | `#F87171` | `#B91C1C` |
| `--scrim` | `rgba(8,10,14,.50)` + `blur(3px)` | `rgba(20,22,28,.32)` |

**Fixed across tones**

| Token | Value |
| --- | --- |
| `--accent` / hover | `#2563EB` / `#1D4ED8` (white text 5.2:1) |
| `--danger` / hover | `#DC2626` / `#B91C1C` (white text 4.8:1) |
| `--focus` | `#2563EB` |
| `--ring` | `0 0 0 2px #FFFFFF, 0 0 0 4px #2563EB` |

**Default background (first run):** `radial-gradient(1200px 760px at 18% 0%, #34436A 0%, rgba(52,67,106,0) 62%), linear-gradient(165deg, #1C2233 0%, #232B40 100%)`, dark tone.

### Shadows and blur

| Token | Dark tone | Light tone |
| --- | --- | --- |
| `--shadow-tile` | `inset 0 1px 0 rgba(255,255,255,.08), 0 8px 24px rgba(0,0,0,.16)` | `inset 0 1px 0 rgba(255,255,255,.5), 0 8px 24px rgba(20,30,60,.12)` |
| `--shadow-pop` | `0 12px 32px rgba(0,0,0,.32)` | `0 12px 32px rgba(20,24,40,.18)` |
| `--shadow-dialog` | `0 24px 64px rgba(0,0,0,.45)` | `0 24px 64px rgba(20,24,40,.28)` |
| Dragged tile | `0 24px 48px rgba(0,0,0,.42), 0 0 0 2px #2563EB` | same |

Blur: glass `blur(20px) saturate(1.4)`; scrim `blur(3px)`. Always include the `-webkit-backdrop-filter` twin. Where `backdrop-filter` is unsupported, the 62% tint alone still passes contrast.

### Focus

Every interactive element uses `outline: 2px solid transparent; box-shadow: var(--ring)` on `:focus-visible`. The white-then-blue double ring is visible on any background. The transparent outline keeps a ring in Windows High Contrast. Inputs use `border-color: #2563EB; box-shadow: 0 0 0 3px rgba(37,99,235,.40)`.

---

## 2. Auto tone

Pick `tone-dark` or `tone-light` on `.nt` from the background's average colour. Choose whichever ink (white or `#15171C`) has the higher WCAG contrast against that average.

- **Solid:** the colour itself.
- **Gradient:** the average of the stops, weighted by the span each stop covers.
- **Image:** draw it into an 8×8 canvas (`drawImage`, then `getImageData`), average the pixels, and cache the result with the image. Compute once on change, never per frame.

Examples: `#E8E2D6` (sand) → light; `#F2541B` (saturated orange) → light (dark ink 6.1:1 vs white 3.5:1); the default slate → dark.

---

## 3. Tiles and grid

### Tile anatomy

A `.tw` wrapper (positioning context) holds an `<a class="tile">` containing:

- the site icon (`.ico`);
- the title (`.tt`);
- at XL only, the domain (`.dm`).

The tile is one link; its accessible name is the title. Edit-mode buttons are siblings of the link inside `.tw`, never nested in the `<a>`.

### Size steps

| Step | Tile (w × h) | Icon / radius | Title | Tile radius | Top padding | Tile gap | Group gap (row / col) | Max grid width |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| XS (min) | 72 × 72 | 36 / 9 | hidden → tooltip | 14 | (centred) | 8 | 24 / 48 | full width |
| S | 96 × 88 | 36 / 9 | 12px | 14 | 14 | 10 | 32 / 64 | full width |
| **M (default)** | 112 × 100 | 40 / 10 | 12.5px | 16 | 16 | 12 | 40 / 80 | 1104px (9 cols) |
| L | 136 × 124 | 48 / 12 | 13px | 18 | 20 | 14 | 40 / 80 | 1336px (9 cols) |
| XL (max) | 160 × 144 | 56 / 14 | 14px + domain 12px | 20 | 20 | 16 | 40 / 80 | 1568px (9 cols) |

Each step is a class (`.sz-xs` … `.sz-xl`) that sets the CSS variables `--tw --th --ico --ir --ts --tr --tp --tgap --gg-r --gg-c --grid-max`. Icon letter size is `calc(var(--ico) * .45)`. Horizontal tile padding is 8px; bottom padding 12px.

**Titles:**

- **S–XL:** one line, `text-overflow: ellipsis`. The full title is in the link's `title` attribute and accessible name.
- **XS:** the title is hidden. A tooltip (`.tip`, `--glass-strong`) appears 8px below the tile after 400ms of hover, or immediately on keyboard focus. Keep it as the link's `aria-label`.

### Auto size (default)

1. Content box = viewport minus side gutters (64px each), minus `max(64px, 12vh)` top and bottom.
2. Try steps XL → XS. For each step, lay out with that step's columns: `min(9, fit)` for M–XL, as many as fit for S/XS. Take the first step whose total height fits the content box.
3. If nothing fits at XS, stay at XS and let the page scroll vertically.
4. Recalculate on resize (debounced ~100ms), on item add/remove, and on grouping toggle. Switch steps with no animation, to avoid layout jank.

Expected results: 22 links in 4 groups → M at 1440×900, XL at 1920×1080, S at 1024×720; ungrouped → XL at 1440; 61 links → XS.

**Grouping off:** a single `.grid-flat` with balanced rows, so the last row isn't an orphan. `cols = ceil(n / ceil(n / maxCols))`, e.g. 22 at XL → 6 columns (6, 6, 6, 4).

**Manual size:** the slider picks a step directly. If content doesn't fit, the page scrolls. "Back to Auto" restores auto.

### Group layout

- `.groups` is a column of rows (`.grow`), centred on the page, `max-width: var(--grid-max)`. Each row is a wrapping flex row (`gap: var(--gg-r) var(--gg-c)`). The column gap between side-by-side groups is wider than the row gap so neighbouring groups read as separate.
- **Group layout** (Settings → Grouping): **Side by side** (default, `groupLayout: "flow"`) puts groups in one row that wraps; a group with **Start on a new row** (`newRow: true`, from its ⋯ menu) begins a new row. **One per row** (`"rows"`) starts every group on its own row, and the per-group setting has no effect.
- Each group sizes to its content and wraps its own tiles at the container width, so small groups sit side by side and large groups take full rows.
- Group heading: a glass pill (`padding: 4px 10px`, 13px/600) 10px above its tiles.
- Items with no group live in an **Others** group, shown last and only when it has items.

---

## 4. States and behaviour

### Page chrome

- Top-right toolbar, 20px from the edges, 8px gap: **Edit layout** (pencil) and **Settings** (gear).
- 44×44 glass circles at 80% opacity, 100% on hover or focus.
- The empty state shows only Settings.

### Tiles in normal mode

| State | Treatment |
| --- | --- |
| Rest | Glass tile, no controls. |
| Hover | `translateY(-2px)`, background `--glass-hover`, 120ms ease. **No edit or delete controls.** |
| Focus | `--ring`. Arrow keys move focus between tiles (roving tabindex: one Tab stop for the grid, then arrows; Home/End for first/last). |
| Activate | Click or Enter opens in the current tab. Middle-click or ⌘/Ctrl-click opens a new tab (native `<a>` behaviour). |
| Actions menu | Right-click, Shift+F10 or the Menu key on a tile opens: **Open in new tab**, **Edit… (E)**, **Move to group ▸**, separator, **Delete… (Del)**. Opens anchored below the tile, 208px min width, `role="menu"`, arrow-key navigation, Esc closes and returns focus. |
| Add item | No Add tile outside edit mode (it would hold empty space in the layout). Add items with **N**, the empty state, or edit mode. |

### Edit mode

Entered with the pencil button (or E when nothing is focused). Exited with **Done** or Esc when no drag is in progress.

- A glass pill bar is centred at the top: **"Editing layout"**, a hint, **Add group** and **Done** (primary). The pencil hides while editing.
- Every tile shows two 26px round buttons, overlapping its top-right corner by 8px: **Edit** (pencil) and **Delete** (trash; turns `#DC2626` on hover). Give each a 32px hit area via a pseudo-element. Tab order: tile → Edit → Delete.
- Group headings gain a drag handle (6-dot grip) before the name and a **⋯** button after it.
- Ghost "Add" tiles are always visible.

### Drag and drop (edit mode only)

| Part | Treatment |
| --- | --- |
| Dragged tile | Follows the pointer: `scale(1.06) rotate(-2deg)`, `--glass-strong`, lifted shadow + 2px blue ring. Its original slot collapses. |
| Drop slot | Dashed 2px white border, `rgba(37,99,235,.28)` fill, same size as a tile, shown at the insertion point. Neighbours shift with a 150ms transform transition. |
| Target group | When the pointer is over another group, outline it: `::before` inset −12px, 24px radius, 2px `rgba(255,255,255,.55)` border, `rgba(255,255,255,.06)` fill. |
| Empty group | Accepts drops anywhere in its box. |
| Announcements | A live region (`role="status"`, glass pill bottom-centre) reads e.g. "Figma: moving to Daily, position 3 of 6", and "Dropped" or "Cancelled". |
| Keyboard | Space or Enter on a focused tile picks it up. Arrows move the slot across tiles and groups. Space drops; Esc cancels and restores. |

Use Pointer Events and FLIP-style transforms for the shift animation; no library needed.

### Group management (edit mode)

- **Rename:** choose Rename from **⋯**, or double-click the name. The pill becomes a 150px white text input with a 2px blue ring and the hint "Enter to save · Esc to cancel". Blur saves. An empty name reverts.
- **Reorder:** drag by the handle, or choose **Move up / Move down** from **⋯**, or press Alt+↑/↓ on a focused handle.
- **⋯ menu:** Rename · Move up · Move down · **Start on a new row** (a `menuitemcheckbox`; disabled and shown on for the first group and in the One per row layout) · Add item here · separator · **Delete group…**
- **Add group:** the edit-bar button appends "New group" with its name input already active.

### Edit / Add item dialog

- Modal, 480px wide, centred over the scrim. Focus is trapped inside; Esc and the close button cancel; focus returns to the trigger.
- Title is "Edit item" or "Add item". Fields in order:
  - **Link (URL):** `type="url"`. Prefix `https://` if no scheme is typed. Help text: "https:// is added if you leave it out."
  - **Title:** required when editing. When adding it's optional, and an empty title is filled from the page title, or the hostname if that fails.
  - **Group:** native `<select>`: the groups, then Others, then "New group…", which opens an inline name field.
  - **Icon:**
    - The card shows a 56px preview, a status line ("Site icon · From figma.com. Updates on its own." / "Custom image · file · size") and actions.
    - Default actions: **Image URL**, **Upload**.
    - While using the site icon, a **Refresh icon** link under the status line re-checks the site for a larger icon and reports the result in the status line.
    - When custom, the card expands: a Image URL | Upload segmented control, the URL input + **Load**, or a dropzone. Plus **Use site icon** to revert.
- **Footer:** Delete (danger text, left; edit only) · Cancel · Save / Add item (primary).

**Validation**, on submit and on blur, never while typing:

| Case | Message |
| --- | --- |
| Invalid URL | "That isn't a web address. Try something like https://theverge.com" |
| Image URL fails to load | "Couldn't load that image. Check the address or upload a file." |
| Wrong type or too large | "{name} can't be used. Choose a PNG, JPG, SVG, WebP or ICO under 1 MB." |
| Duplicate URL | Warning only, not blocking: "This link is already in {group}." |

- The invalid field gets `.is-error` (danger border + 3px tinted halo), `aria-invalid="true"` and `aria-describedby` pointing at the message.
- Messages are 12.5px/500 danger text with an alert icon.
- On a failed submit, focus moves to the first invalid field.

### Delete confirmations

Both dialogs use `role="alertdialog"`. Initial focus is **Cancel**, so Enter is safe.

- **Item:** 420px dialog, "Delete this link?". Shows a card with the icon, title and domain · group. Buttons: Cancel · **Delete** (danger).
- **Group with items:** "Delete the "{name}" group?" plus the item count and names. Two radio cards: **Move them to Others** (default) or **Delete them too**. Buttons: Cancel · **Delete group** (danger).
- **Empty group:** the same dialog without the radio cards.

### Settings panel

- **Placement:** a side panel, not a modal. 400px wide, inset 12px from the top, right and bottom, 20px radius, solid `--surface`.
- **Live preview:** the grid re-centres in the remaining width (`.stage.beside-sheet { right: 424px }`), so every change previews live on the fully visible page.
- **Behaviour:**
  - No scrim; the page behind stays visible but not interactive while the panel has focus.
  - Esc and the close button close it. Opening moves focus to its heading.
  - Changes apply immediately and save debounced (~300ms). There is no Save button.
  - A glass pill bottom-left says "Changes apply as you edit" the first time it opens.
- **Background:**
  - **Type:** Solid | Gradient | Image (segmented control).
  - **Solid:** 6 presets (36px swatches, selected = 2px gap + 2px blue ring), then a native `<input type="color">` (36px) + hex text field.
  - **Gradient:**
    - Presets, then a 32px preview bar with draggable 20px stop handles.
    - One row per stop: colour, hex, position %, and remove (disabled at 2 stops).
    - "Add colour stop" (max 5).
    - **Angle:** range 0–360 with a numeric field (°). Output is `linear-gradient(<angle>deg, …)`.
  - **Image:**
    - A 140px preview with filename and dimensions, plus **Replace…** and **Remove**.
    - An Image URL field + **Load**, and a dropzone/file picker.
    - JPG/PNG/WebP up to 8 MB, stored on the device.
    - Display with `background-size: cover; background-position: center`.
  - Tone (§2) recomputes on every change.
- **Grouping:** a "Show groups" switch (42×24, `role="switch"`). Off flattens to one grid (§3); groups are kept, not deleted. Below it, while groups are shown, **Group layout**: Side by side | One per row (segmented control, §3).
- **Item size:**
  - Auto | Manual segmented control.
  - A range slider, 5 steps XS–XL, showing the current step name. Moving the slider switches to Manual.
  - Help text reports Auto's current choice. **Back to Auto** link.
- **Backup:**
  - **Export:** downloads `go-tab-backup-YYYY-MM-DD.json`.
  - **Import…:** file picker → validate → confirm dialog ("Replace your current N links and M groups?") → apply.
  - Invalid file: inline error under the buttons.

### Empty state (first run)

- A centred glass card, 460px wide, 24px radius, `--glass-strong`.
- Title "Add your first link", plus one sentence of body text.
- A large ghost tile, **Add link** (focused on load).
- Below: **Import a backup** (glass button) and "or press **N**".
- N opens Add item anywhere on the page when no field is focused.

### Motion

All transitions are 120–150ms ease. Respect `prefers-reduced-motion: reduce`: drop the hover lift, drag tilt and shift animations (keep opacity changes).

---

## 5. Data and platform notes

**Assumption:** a Chromium MV3 extension (`chrome_url_overrides.newtab`). Adjust if you target Firefox too.

**Favicons:**

- Chromium: use `chrome-extension://<id>/_favicon/?pageUrl=<url>&size=64` with the `favicon` permission.
- Fallback when that's unavailable or fails: a letter monogram on a colour hashed from the hostname.
- **Large site icons:** the browser's favicon store only holds 16/32px icons, which look grainy on tiles. With the optional site access, Go Tab fetches the site's own larger icon (apple-touch-icon, sized `<link rel="icon">`, web app manifest icons; the smallest that is at least 128px) and caches it at 128px in `localStorage`, one per origin. It is preferred over `_favicon` when present.
  - **Fetched only** when a link is added or moves to a site not yet checked, when the browser's own favicon for that site changes (compared locally against a pixel sample; no network), from **Refresh icon** in Edit item, and once per site for links that predate this. A plain tab open sends no requests.
  - **Refreshes are cheap:** the known icon URL is re-checked with `If-None-Match` / `If-Modified-Since`; the page is only re-read if that URL fails. Sites with no large icon are remembered and not retried until their favicon changes. A failed refresh keeps the cached icon.
  - Without site access nothing is fetched and tiles keep the `_favicon`.
- Custom icons are stored as data URLs (≤1 MB source, downscaled to 128px).

**Storage:**

- Config: `chrome.storage.local`.
- Background image blobs: IndexedDB (too large for storage quotas).
- Render from a cached copy in `localStorage` first, so the page paints before the async storage read resolves. The new tab opens many times a day; first paint should take well under 100ms.

**Config shape** (also the export format):

```json
{
  "version": 1,
  "grouping": true,
  "groupLayout": "flow",
  "size": { "mode": "auto", "step": "m" },
  "background": { "type": "gradient", "color": "#232B40", "stops": [["#1F3B57", 0], ["#5B4B8A", 100]], "angle": 135, "image": null },
  "groups": [{ "id": "g1", "name": "Work", "newRow": false }],
  "items": [{ "id": "i1", "url": "https://mail.google.com", "title": "Gmail", "groupId": "g1", "icon": null }]
}
```

Order is array order. `groupId: null` means Others (no group). On export, an image background is embedded as a data URL.
