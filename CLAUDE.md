# CLAUDE.md

Blink v2 — native macOS spatial note-taking. Menubar-only app (LSUIElement):
floating NSPanel notes + menubar popover + command palette. No main window.
The v1 Tauri app is archived under `archive/v1/` (tag `v1-final`) — do not
edit it; port lessons, not code.

## Canonical references

- Build plan (M0–M5): `docs/v2-plan.md`
- Feature spec / scope contract: `docs/functionality-v1.md`
- UI studies (visual spec): `design/studio` (`bun dev` → localhost:3060/studio)

## Commands

```sh
swift build                  # needs ../hudson checkout (BLINK_HUDSON_SOURCE=git for GitHub)
swift test                   # BlinkCore tests
(cd web/editor && bun install && bun run build)   # editor bundle
./scripts/run-app.sh --debug --restart            # bundle dist/Blink.app + launch
```

## Architecture

- `Sources/BlinkApp` — AppDelegate (NSStatusItem + NSPopover, Scout pattern),
  HotkeyManager (Carbon, no accessibility permission needed), AppModel (the
  single observable source of truth over NoteStore — every surface reads it),
  PanelManager (one panel per note, save policy), NotePanel (glass NSPanel),
  WebBridge (WKScriptMessageHandler ↔ editor bundle).
- `Sources/BlinkCore` — pure Swift, no AppKit: Note model, slug + UUIDv5
  identity (v1-compatible), minimal YAML frontmatter codec, atomic file store,
  NoteStore actor posting NotificationCenter events (created/updated/deleted).
- `web/editor` — vanilla CodeMirror 6 (no React), single-file dist/editor.html,
  four-message bridge: ready · contentChanged (user events ONLY) ·
  saveRequested → native; setContent/getContent/focus ← native.
- PanelKit and WebBridge are designed to be upstreamed to HudsonKit once proven.

## Hard requirements (inherited from v1's bugs — do not regress)

- Flush pending saves on note-switch, panel-close, and quit. Never trust a debounce alone.
- All note writes are atomic: temp file + fsync + rename.
- Note metadata lives in the markdown file's frontmatter, never only in a side index.
- One panel per note — opening an open note focuses it.
- Panel geometry persists per note and restores exactly; never scramble a layout.
- Cross-surface sync is bidirectional: all mutations flow through NoteStore →
  notifications → AppModel; never mutate UI state directly.
- `contentChanged` fires on user edits only — programmatic setContent must never
  echo (v1's cross-note corruption bug).

## Conventions

- Log prefix `[BLINK]` via HudLogger (HudsonObservability).
- Hyper = ⌃⌥⇧⌘. Global hotkeys via Carbon RegisterEventHotKey.
- User-visible name is "Blink".
- GUI verification: LSUIElement apps are invisible to System Events' "visible
  processes"; synthesized keystrokes go to the frontmost app — `tell
  application "Blink" to activate` first, and use AXRaise for restored panels.
