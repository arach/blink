# Blink v2 Editor Surface

A vanilla [CodeMirror 6](https://codemirror.net/) markdown editor **plus a
rendered read mode**, built to a single self-contained `dist/editor.html` and
hosted inside a native macOS NSPanel via `WKWebView`. The page paints no surface
of its own — the native glass panel behind the web view provides the background,
blur, and shadow, so html/body and every editor/reader layer are fully
transparent.

Two surfaces flip **in place** on the same glass:

- **edit** — the CM6 markdown editor (single `EditorView`, always alive).
- **read** — the current note rendered as markdown typography in `.blink-reader`
  via [`marked`](https://marked.js.org/) (GFM on).

Flipping hides one surface and shows the other; the `EditorView` is never
destroyed. Scroll position is preserved proportionally between surfaces (best
effort). Initial mode is **edit**.

## Build

```bash
bun install
bun run typecheck   # tsc --noEmit, must be clean
bun run build       # esbuild -> dist/editor.html (single file, guardrailed)
```

`bun run build` bundles `src/main.ts` (iife, minified) and inlines it into
`dist/editor.html` alongside the page/reader CSS. Guardrails reject any external
`<script src>` / `<link href>`, an oversized output (> 1.5 MB), and a missing
read-mode surface (`#reader` element, `.blink-reader` styles, empty-note
placeholder).

## Native bridge contract

Two directions. `JS -> native` posts to the WKWebView message handler; when that
handler is absent (plain browser during dev) posting is a harmless no-op that
logs to the console.

### native -> JS: `window.blink`

| Method | Signature | Behavior |
| --- | --- | --- |
| `setContent` | `(text: string) => void` | Replace the whole document. Dispatches with **no** user event, so it never echoes `contentChanged` (the v1 stale-feedback bug). Preserves scroll; places caret at end only on the first set. Re-renders the reader if currently in read mode. |
| `getContent` | `() => string` | Current document text. |
| `focus` | `() => void` | Focus the editor. |
| `setMode` | `(mode: "edit" \| "read") => void` | **Programmatic** flip. Does **not** post `modeChanged` (native is the source of truth — same no-echo discipline as `setContent`). |
| `getMode` | `() => "edit" \| "read"` | Current surface. |

### JS -> native: `postMessage`

| Message | Shape | Posted when |
| --- | --- | --- |
| `ready` | `{ type: "ready" }` | Editor mounted and focused. |
| `contentChanged` | `{ type: "contentChanged"; text }` | **User** edits only (never programmatic `setContent`). |
| `saveRequested` | `{ type: "saveRequested" }` | User presses ⌘S / Ctrl-S. |
| `modeChanged` | `{ type: "modeChanged"; mode }` | **User-initiated** flip only: double-click on the reader, or ⌘⇧P (Mod-Shift-p) in either mode. Programmatic `setMode` is silent. |

## Read mode interactions

- **Double-click** anywhere on the reader → switch to edit and focus the editor
  (posts `modeChanged`).
- **⌘⇧P** (Mod-Shift-p) → toggle mode in **both** directions. In edit mode this is
  a CM keymap entry; in read mode a window `keydown` listener (guarded to fire
  only when read is visible) handles it. Both `preventDefault`.

## Security note

`marked` does **not** sanitize raw HTML — any HTML embedded in the markdown is
rendered as-is. This is an accepted tradeoff: read mode only ever renders the
user's **own local notes** (no remote or third-party content reaches this
surface), so no sanitizer dependency is pulled in. If this surface is ever
repurposed to render untrusted content, add DOMPurify (or equivalent) first.
