# Blink

Spatial note-taking for macOS: notes are first-class floating glass panels you
arrange on screen. Native Swift/AppKit bones on
[HudsonKit](https://github.com/arach/hudson), web editor surfaces
(CodeMirror 6) in WKWebViews. Triad-only: menubar popover · command palette ·
floating panels — no main window; the desktop is the workspace.

This is **v2**, a from-scratch native rewrite. The original Tauri + React app
lives in [`archive/v1`](archive/v1/ARCHIVE.md) (tag `v1-final`).

## Build & run

```sh
swift build                 # requires a sibling ../hudson checkout
swift test                  # BlinkCore unit tests
(cd web/editor && bun install && bun run build)   # editor bundle (once)
./scripts/run-app.sh        # assemble dist/Blink.app and launch (menubar-only)
./scripts/run-app.sh --debug --restart
```

Set `BLINK_HUDSON_SOURCE=git` to resolve HudsonKit from GitHub instead of the
sibling checkout.

## Layout

- `Sources/BlinkApp` — menubar app: AppDelegate, status item + popover,
  Carbon hotkeys (Hyper+N), AppModel, PanelManager, WebBridge, NotePanel
- `Sources/BlinkCore` — pure Swift: Note model, slug/UUIDv5 identity,
  frontmatter codec, atomic file store, NoteStore actor
- `web/editor` — vanilla CodeMirror 6 bundle hosted by note panels
- `docs/` — [v2 plan (M0–M5)](docs/v2-plan.md) ·
  [UI map](docs/v2-ui-map.md) · [v1 spec / scope contract](docs/functionality-v1.md)
- `design/studio` — Blink Studio: live UI studies (`bun dev` → :3060/studio)
- `landing/` — marketing site (GitHub Pages deploys `landing/out`)
- `archive/v1` — the Tauri-era app

## Notes on disk

One markdown file per note in `~/Library/Application Support/Blink/Notes/`,
metadata in YAML frontmatter — local-first, human-readable, no side database.
All writes are atomic (temp + fsync + rename); saves flush on panel close and
app quit.
