# Blink configuration — agent-first

Blink's behavior and theme live in one human/agent-editable JSON file:

```
~/Library/Application Support/Blink/config.json
```

**Any process may edit this file.** Blink watches it and hot-applies changes to
every open panel within a second — no restart, no IPC, no permission dance.
That's the agent surface: read the file, write the file, done.

Rules:
- Every field is optional. Missing fields use the defaults below. `{}` is a valid config.
- Invalid JSON never breaks the app: Blink keeps the last good config and logs
  `[BLINK] config invalid — keeping last good`.
- Write atomically (write temp + rename, or your editor's normal save) — Blink
  watches the directory, so atomic replaces are picked up fine.
- The settings window is a *view* over this file; edits there round-trip through it.

## Schema

```jsonc
{
  "behavior": {
    "restoreSession": true,     // reopen last session's panels at launch
    "defaultMode": "read"       // "read" | "edit" — mode for notes with no remembered mode
  },
  "panel": {
    "material": "hud",          // glass material: "hud" | "underWindow" | "popover" | "sidebar" | "menu"
    "cornerRadius": 12,
    "tintRead": 0.18,           // 0–1 black tint over the glass in read mode (contrast floor)
    "tintEdit": 0.28,           // 0–1 tint in edit mode (focused writing surface)
    "shadow": true,             // window drop shadow
    "defaultWidth": 420,        // size for panels opening for the first time
    "defaultHeight": 340
  },
  "focus": {
    "dim": 0.30                 // 0–1 strength of the focus-mode veil over everything else
  },
  "editor": {                   // typography & colors, applied to editor AND reader
    "fontFamily": null,         // null → system font stack; any CSS font-family string
    "monoFamily": null,         // null → ui-monospace stack
    "fontSize": 13,             // px
    "lineHeight": 1.75,
    "paddingX": 20,             // px
    "paddingY": 16,
    "textColor": null,          // any CSS color; null → rgba(255,255,255,0.85)
    "textStrongColor": null,    // headings/bold; default rgba(255,255,255,0.96)
    "textMutedColor": null,     // markers/list bullets; default rgba(255,255,255,0.45)
    "accentColor": null,        // links; default rgba(158,203,255,0.9)
    "codeBackground": null,     // default rgba(255,255,255,0.07)
    "caretColor": null,         // default white
    "selectionColor": null,     // default rgba(255,255,255,0.18)
    "h1Size": null,             // px, reader scale; default 20 (editor derives slightly smaller)
    "h2Size": null,             // default 17
    "h3Size": null              // default 15
  }
}
```

## How it applies

- `panel.*` and `focus.*` are native (NSVisualEffectView material, tint layers,
  window shadow, overlay dim) — applied immediately to all open panels.
- `editor.*` maps to the web bundle's CSS custom properties
  (`--blink-font-size`, `--blink-text`, …) and is pushed over the bridge via
  `window.blink.setTheme`. The full variable table lives in
  `web/editor/README.md`.

## Examples

Cozy serif reading, warmer accent, softer glass:

```json
{
  "editor": {
    "fontFamily": "Charter, Georgia, serif",
    "fontSize": 14,
    "lineHeight": 1.8,
    "accentColor": "rgba(255,196,150,0.9)"
  },
  "panel": { "tintRead": 0.12, "cornerRadius": 16 }
}
```

Maximum-contrast writing mode:

```json
{
  "panel": { "tintEdit": 0.6 },
  "focus": { "dim": 0.45 }
}
```

## What does NOT live here

- Notes themselves: `~/Library/Application Support/Blink/Notes/*.md` (frontmattered markdown).
- Per-machine workspace state (open panels, per-note modes, window frames):
  UserDefaults today, migrating to `.blink/workspace.json` — see
  `docs/notes-representation.md`.
