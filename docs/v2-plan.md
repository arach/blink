# Blink v2 — Build Plan

> Decided 2026-07-14. Companion docs: `functionality-v1.md` (feature spec, scope contract),
> `v2-ui-map.md` (surfaces, wireframes, principles).

## Decisions (locked)

| Decision | Call |
|---|---|
| Codebase | **New app, new repo** — v1 is a donor of lessons and spec, not code |
| Stack | Native Swift/AppKit shell + WKWebView editor surfaces, built on HudsonKit |
| Surface set | **Triad only at v2.0**: menubar popover + command palette + floating note panels. No Library window; add later only if genuinely missed |
| Repo strategy | Fresh standalone repo depending on `hudsonkit-xcframework`; transplant Scout's HotkeyManager + AppDelegate/status-item patterns |
| Spatial feel | Free placement (panels go exactly where you put them) + opt-in 3×3 grid chords via Hyper+B overlay. No magnetism |
| Overflow | The palette is the overflow: only opened notes are panels; everything else lives in popover recents + palette search. "Gather panels" command in polish milestone |

## Defaults chosen (veto anytime)

- **One panel per note.** Opening an already-open note focuses its panel; duplicates are impossible by construction (kills v1's force-close/recreate class of bugs).
- **Dictation target:** focused panel's caret; if no panel is focused, spawn a new capture panel. Audio + partials retained until the transcript is committed to disk.
- **Menubar-only app** (`LSUIElement`) — no dock icon, consistent with triad-only. Revisit if a Library window ever ships.
- **Editor bundle is vanilla CodeMirror 6, no React.** v1 needed React for app chrome; in v2 the chrome is native, so each panel loads a small static CM6 bundle. Faster per-panel startup, tiny bridge surface.
- **Working repo name:** `blink-native` (product name stays "Blink"; rename is cheap).

## Architecture

```
blink-native/
├─ apps/Blink/            # macOS app target (SwiftUI lifecycle + AppKit)
│  ├─ AppDelegate.swift   #   status item, hotkey wiring (Scout transplant)
│  ├─ Popover/            #   menubar popover (capture field, recents, ⤢)
│  ├─ Palette/            #   ⌘K host (HudsonShell palette + Blink action registry)
│  └─ GridOverlay/        #   Hyper+B HUD, chord state machine
├─ packages/BlinkCore/    # pure Swift: model + storage + index + events
├─ packages/PanelKit/     # floating-panel lifecycle manager  → upstream to HudsonKit
├─ packages/WebBridge/    # WKWebView JS↔native RPC           → upstream to HudsonKit
└─ web/editor/            # vanilla CodeMirror 6 bundle (TS, esbuild, static)
```

**BlinkCore** — `Note` model; markdown + YAML frontmatter codec; atomic file store
(write temp → `fsync` → rename — v1's bare-`fs::write` data-loss lesson); in-memory note
index; a single store actor as the one source of truth; NotificationCenter-based event bus
all surfaces subscribe to; FSEvents watcher for external edits to the notes folder.

**PanelKit** — the gap nothing in the ecosystem fills: NSPanel factory (glass via
HudVisualEffectView, 28px title region, hover-revealed footer), geometry/shade/pin
persistence per note, restore-on-launch, z-order, screen-change handling. Designed with
HudsonKit-shaped boundaries so it can be upstreamed once proven. Port v1's
position-conflict test cases (`position_bug_tests.rs`) as PanelKit's test suite.

**WebBridge** — `WKScriptMessageHandler` + `evaluateJavaScript`, Codable message types,
shared `WKProcessPool` across panels. Check the existing `HudsonBridge` module first;
extend it rather than duplicating if it's close. Bridge surface stays tiny:
`contentChanged`, `saveRequested`, `setContent`, `setMode(edit|preview)`, caret/scroll state.

**Storage layout** — one `.md` file per note. Note-intrinsic metadata (id/slug, timestamps,
tags, pinned) lives in frontmatter *in the file* (v1 lesson: never split metadata into a side
DB). Device-specific workspace state (panel geometry, shade, z-order, grid slots) lives in
`.blink/workspace.json`. Save policy: ~1s debounce + **flush on blur, panel close, and quit**
(v1's 30s-debounce-dropped-on-close data loss is a hard requirement to never repeat).

## Milestones

**M0 — Bones** *(exit: menubar icon up, Hyper+N logs from anywhere)*
Repo scaffold, Xcode/SwiftPM project, `hudsonkit-xcframework` pinned exact, `LSUIElement`
app boots. Transplant Scout's `HotkeyManager` (Carbon, Hyper-key) and status-item +
NSPopover pattern. Verify which HudsonKit products the binary package exposes (HudsonUI,
HudsonShell — confirm dictation/audio is reachable; if not, add a local path dep on the
hudson repo's Swift package for dev).

**M1 — One panel** *(exit: type in a panel, quit, relaunch — content and position restored exactly)*
The two hard unknowns, validated immediately: one NSPanel with glass chrome hosting the
CM6 bundle through WebBridge, round-trip typing → `contentChanged` → BlinkCore atomic
save → reload. Title auto-extraction from first line. Save-state pip.

**M2 — The triad** *(exit: capture a thought in under a second without touching the mouse)*
Menubar popover: single field (type = search, ⌘↵ = new note), recents list, ⤢ fling-to-panel.
Command palette on HudsonShell: note index + verbs, `⌘↵ = open as panel`. Hotkeys wired:
Hyper+N capture, ⌘K palette. One-panel-per-note identity rule enforced in PanelKit.

**M3 — Spatial** *(exit: arrange 8 panels, relaunch, layout restores pixel-perfect; drag a recent out of the popover into a panel)*
Full PanelKit lifecycle: multi-panel, z-order, shade (middle-click title), pin.
Workspace persistence + restore. Grid overlay (Hyper+B → QWERTY slot keys) and
Ctrl⌥⇧1–9 direct deploy. Drag-to-detach from popover rows — a *real* NSPanel created
under the cursor mid-drag (no ghost windows; that v1 window class is designed out).

**M4 — Feel** *(exit: same note in two panels edits in lockstep; dictate a full note hands-free)*
Instant cross-surface sync through the store actor (bidirectional from day one — v1's
one-way sync lesson). Dictation via HudAudioTranscriber with live waveform + partial
transcript streaming to the caret. Edit↔preview in-place swap (⌘⇧P), scroll preserved.
Tiny Settings (hard cap 4 sections). Onboarding: Accessibility + Microphone permission
flow, notes-folder picker, teach the 3 core gestures.

**M5 — Ship** *(exit: notarized build a stranger can install)*
4–5 curated themes, hover-chrome polish, chord-hint toasts, "Gather panels" palette
command, app icon, notarization + Sparkle (or manual) distribution. Upstream PanelKit
and WebBridge to HudsonKit once stable in Blink.

## Ported from v1 (lessons and logic, not code)

- `functionality-v1.md` as the scope contract against rewrite creep.
- Slug/deterministic-UUID logic and title-extraction rules (rewritten in Swift).
- Position-conflict test scenarios → PanelKit tests.
- CodeMirror configuration choices (minimal chrome, no gutters, word wrap, typewriter padding).
- Hard requirements from v1 bugs: flush-on-close saves, atomic writes, metadata in the
  file, bidirectional sync, no duplicate windows.

## Risks

| Risk | Mitigation |
|---|---|
| Rewrite abandonment (how v1 died) | M1 is demoable in days; every milestone has a usable exit state; spec contract caps scope |
| HudsonKit is 0.x, APIs move | Pin exact xcframework version; upgrade deliberately per milestone |
| Per-panel WKWebView memory | Shared process pool; measure at 15 panels in M3; shaded panels may unload their webview |
| Binary package missing audio/voice products | Detected in M0; fallback is a source dep on the hudson monorepo package |
| Carbon hotkey API deprecation | It still works and Scout ships on it; isolate behind HotkeyManager so a future swap is one file |
