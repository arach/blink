# Blink Studio

Design studio for **Blink v2** — the from-scratch rewrite (native Swift/AppKit +
WKWebView on HudsonKit). Studies for the v2.0 triad surfaces live here alongside
the plan and the v1 spec, rendered from `blink/docs/` as the source of truth.

Built on the shared [`studio`](https://github.com/arach/studio) primitives,
consumed via the studio repo's bun workspace (same setup as
`lattices/design/studio`).

## Run

```sh
# install once, from the studio workspace root
cd ~/dev/studio && bun install

# then
cd ~/dev/blink/design/studio
bun dev        # → http://localhost:3060/studio
```

## Layout

- `src/studio/studioRegistry.ts` — taxonomy (foundations / plans / studies) + pages
- `src/studio/studies/` — live UI studies: note panel, menubar popover, command palette, grid overlay
- `app/api/docs/` — serves `blink/docs/*.md` so plan pages render the real files
- `.studio/annotations/` — sidecars written by in-browser annotations (pins, dictation); terminal agents read these back
