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
    "defaultMode": "read",      // "read" | "edit" — mode for notes with no remembered mode
    "launchAtLogin": false      // register Blink as a login item (SMAppService)
  },
  "hotkeys": {
    // Chord strings: modifiers joined by "+", ending in one key.
    // Modifiers: hyper (⌃⌥⇧⌘), cmd, ctrl, alt, shift.
    // Keys: a–z, 0–9, punctuation (. , / ; ' [ ] \ - = `), space, return,
    // tab, escape, delete. An invalid chord is logged and the previous
    // binding kept — a bad edit never leaves the app unreachable.
    "newNote": "hyper+n",       // global — create a note from anywhere
    "blink": "hyper+b",         // global — show all notes / hide all
    "grid": "hyper+c",          // global — grid/constellation overlay ("c" — hyper+g collides with Lattices)
    "toggleMode": "cmd+shift+p",// per-panel — flip read/edit
    "focus": "cmd+."            // per-panel — quiet everything else
  },
  "panel": {
    "sheet": "glass",           // sheet template: "glass" | "card" | "dotted" | "bracket" | "marginalia"
                                // per-note override: a `sheet:` frontmatter key in the note file
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
  "drape": {                    // a backdrop parked BEHIND every note — a calm stage under the set
    "enabled": false,           // off by default; true parks a full-screen blur+dim behind the notes
    "dim": 0.45,                // 0–1 black tint over the blurred backdrop
    "opacity": 1.0,             // 0–1 overall presence; lower = a lighter veil the desktop shows through
    "material": "hud"           // blur material: "hud" | "underWindow" | "popover" | "sidebar" | "menu"
  },
  "motion": {                   // Arrival: every show/hide is choreographed
    "entrance": "shimmer",      // "shimmer" | "drop" | "draw" | "none" — how a note lands
    "durationMs": 260,          // base duration for one panel's entrance
    "staggerMs": 40,            // per-panel delay in group reveals (session restore, the blink)
    "enabled": true             // master switch — false = instant show/hide (today's behavior)
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
- `hotkeys.*` hot-apply too: global chords re-register with Carbon on change;
  panel chords are read live on each keypress.
- `behavior.launchAtLogin` syncs the macOS login item on change.
- `motion.*` choreographs every show/hide (see **Motion (Arrival)** below);
  applied live, so the next note you open — or the next Hyper+B — uses the new
  feel. `enabled: false` restores the instant behavior exactly.
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

## Motion (Arrival)

Notes don't appear — they land. Every show/hide is choreographed, with the
character set by `motion.*` so a theme ships a matching feel. All of it no-ops
cleanly when `motion.enabled` is `false`, and macOS **Reduce Motion**
(System Settings → Accessibility → Display) is always honored as `"none"`.

Entrances (`motion.entrance`):

- **shimmer** — content fades up from nothing while a soft highlight sweep
  crosses the sheet left→right.
- **drop** — the panel drifts down ~8pt into place with a slight overshoot
  settle as the content fades in.
- **draw** — on flat sheets (`dotted`/`bracket`/`marginalia`) the frame draws
  itself on, then the text fades in behind it. On `glass`/`card` (no frame to
  draw) it falls back to **shimmer**.
- **none** — instant (today's behavior).

Where the choreography shows up:

- **Opening a note** (new note, popover, focusing) plays one entrance.
- **Session restore** staggers the reopened panels `staggerMs` apart,
  left-to-right by on-screen position, so the desk assembles.
- **The blink** (Hyper+B): the reveal staggers panels in from their screen-edge
  direction; the hide is one synchronized exhale (all panels fade + drift
  outward together, then vanish). The state flips instantly regardless — the
  motion is garnish, and rapid toggles never leave a panel half-faded. Pending
  saves and the open-notes list are untouched.
- **Focus mode** recedes the non-key panels a hair (a subtle depth cue), so the
  note you're writing stands proud. Transform-only — window positions never
  move.

## What does NOT live here

- Notes themselves: `~/Library/Application Support/Blink/Notes/*.md` (frontmattered
  markdown). Agents may write their own frontmatter keys into a note — Blink preserves
  unknown keys verbatim through every save, and merges on-disk metadata (tags, pinned,
  foreign keys) before each content save, so editing a note's frontmatter while it's
  open in a panel is safe.
- Per-machine workspace state (open panels, per-note modes, window frames):
  UserDefaults today, with a planned migration to `.blink/workspace.json`.
