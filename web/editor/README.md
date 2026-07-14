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
| `setTheme` | `(vars: Record<string, string>) => void` | Apply theme overrides. For each entry, `document.documentElement.style.setProperty(key, value)` — keys arrive as **full** var names (e.g. `"--blink-font-size": "14px"`). Unknown keys are set anyway (harmless). Calling with `{}` is a no-op. No echo message. |
| `resetTheme` | `() => void` | Remove all inline `--blink-*` properties from `:root`, restoring the stylesheet defaults. No echo message. |

### JS -> native: `postMessage`

| Message | Shape | Posted when |
| --- | --- | --- |
| `ready` | `{ type: "ready" }` | Editor mounted and focused. |
| `contentChanged` | `{ type: "contentChanged"; text }` | **User** edits only (never programmatic `setContent`). |
| `saveRequested` | `{ type: "saveRequested" }` | User presses ⌘S / Ctrl-S. |
| `modeChanged` | `{ type: "modeChanged"; mode }` | **User-initiated** flip only: double-click on the reader, or ⌘⇧P (Mod-Shift-p) in either mode. Programmatic `setMode` is silent. |

## Theming

Every visual value in **both** the CM6 editor theme (`src/theme.ts`) and the
reader typography (`build.mjs` `PAGE_CSS`) resolves to a CSS custom property
declared on `:root` in the bundled stylesheet. Defaults equal the original
hard-coded values. Native code overrides them at runtime via
`window.blink.setTheme({...})` (full var names as keys) and clears overrides via
`window.blink.resetTheme()`.

| Variable | Default | Controls |
| --- | --- | --- |
| `--blink-font-family` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif` | Body/UI font (editor + reader). |
| `--blink-mono-family` | `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Monaco, "Cascadia Code", monospace` | Monospace font (inline + block code). |
| `--blink-font-size` | `13px` | Base text size (editor, reader, marker reset, empty placeholder). |
| `--blink-line-height` | `1.75` | Base line height (editor scroller + reader). |
| `--blink-pad-x` | `20px` | Horizontal content padding (editor + reader + placeholder). |
| `--blink-pad-y` | `16px` | Vertical content padding (editor + reader + placeholder). |
| `--blink-text` | `rgba(255,255,255,0.85)` | Body text; also editor emphasis (`em`). |
| `--blink-text-strong` | `rgba(255,255,255,0.96)` | Headings, `strong`, table headers. |
| `--blink-text-muted` | `rgba(255,255,255,0.45)` | List content + markers, `del`/strikethrough, gutter. |
| `--blink-marker` | `rgba(255,255,255,0.35)` | Markdown formatting markers (`#`, `*`, `` ` ``, `>`, brackets); empty placeholder. |
| `--blink-accent` | `rgba(158,203,255,0.9)` | Link text. |
| `--blink-accent-dim` | `rgba(158,203,255,0.55)` | Link URL/target (editor source view). |
| `--blink-code-bg` | `rgba(255,255,255,0.07)` | Code chip / block background. |
| `--blink-code-text` | `rgba(255,255,255,0.8)` | Code text (inline + block). |
| `--blink-caret` | `#ffffff` | Text caret / cursor. |
| `--blink-selection` | `rgba(255,255,255,0.18)` | Selection highlight (+ selection match). |
| `--blink-h1-size` | `20px` | H1 size (reader). Editor derives `calc(… - 3px)` → 17px. |
| `--blink-h2-size` | `17px` | H2 size (reader). Editor derives `calc(… - 3px)` → 14px. |
| `--blink-h3-size` | `15px` | H3–H6 size (reader). Editor derives `calc(… - 3px)` → 12px. |
| `--blink-quote-text` | `rgba(255,255,255,0.65)` | Blockquote text. |
| `--blink-quote-border` | `rgba(255,255,255,0.2)` | Blockquote left border. |
| `--blink-rule` | `rgba(255,255,255,0.15)` | Horizontal rule + table cell borders. |

Heading sizes use **one** set of variables: `--blink-hN-size` are the **reader**
sizes; the editor (which renders markdown *source*) derives its heading sizes as
`calc(var(--blink-hN-size) - 3px)`. Font weights are hard-coded (not themable
this pass).

The build guardrails statically verify the `:root` block declares all of these
variables, that no raw accent literal (`rgba(158,203,255,…)`) survives outside
those defaults, and that `setTheme`/`resetTheme` exist in the bundle.

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
