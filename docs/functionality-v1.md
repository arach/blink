# Blink v1 — Functionality Overview

**Blink** is a macOS-first desktop note-taking app (Tauri v2 + React + TypeScript) built around *spatial* notes: notes live as first-class floating windows you can arrange on screen, not only as rows in a list. This document inventories everything implemented in the original (Phase 1) product. AI features are roadmap only; nothing below is aspirational.

---

## 1. Core product concept

| Principle | How it shows up |
|-----------|-----------------|
| Spatial context | Detach any note into a frameless floating window; positions/sizes persist across restarts |
| Local-first | Notes stored as markdown files on disk; config and window state in app data |
| Markdown-native | Edit as plain markdown; optional live preview with GFM + syntax highlighting |
| Keyboard-first | In-app chords, Hyperkey global shortcuts, command palette (⌘K) |

**Stack:** React 18, TypeScript, TailwindCSS, Zustand, CodeMirror 6, react-markdown · Rust/Tauri v2, file storage (+ SQLite migration path present) · Vite builds.

---

## 2. Notes: CRUD, editing, and persistence

### Note model
Each note has: `id`, `title`, `content`, `created_at`, `updated_at`, `tags[]`, optional `position` (manual list ordering).

### Create / read / update / delete
- **Create** — sidebar button, ⌘N, Hyperkey+N (global), command palette, or chord Hyper+O → N.
- **Select** — click in notes list; Hyper+1–9 for first nine notes; command palette search.
- **Edit** — CodeMirror markdown editor; content updates locally immediately.
- **Title** — auto-extracted from the first non-empty line (strips `#`, bold/italic, list markers); capped at 50 chars; falls back to “Untitled”.
- **Delete** — context menu on a note in the sidebar.
- **Ordering** — backend-assigned `position`; list sorted by position.

### Auto-save & dirty tracking
- Debounced save every **30 seconds** after edits (main and detached windows).
- Immediate save available; save status UI (saving / success / error).
- Content-hash modified-state tracking (frontend + Rust) so unsaved changes can be detected.
- Cross-window sync: `note-updated` / `note-created` / `note-deleted` events keep main app and detached editors consistent.

### Storage (file-based)
- Notes as **individual `.md` files** with YAML frontmatter (`id`, `title`, timestamps, tags, position).
- Notes directory: default app data path, or a **user-configured directory**.
- Hidden `.blink/` folder for workspace/window index metadata.
- Migration helpers from older JSON stores; SQLite module exists as a parallel path.
- Footer can open the current notes folder in Finder.
- Settings: set/reload notes directory, browse path; import/export UI stubs exist (backend file ops implemented; some UI still “coming soon”).

---

## 3. Editor & reading experience

| Feature | Behavior |
|---------|----------|
| **CodeMirror editor** | Minimal chrome (no gutters), themed to match app; markdown language support |
| **Edit ↔ preview** | Toggle with ⌘⇧P or command palette; double-click preview to return to edit |
| **Markdown preview** | GFM (tables, lists, blockquotes, etc.) via `remark-gfm`; optional `rehype-highlight` syntax coloring |
| **Vim mode** | Optional (`@replit/codemirror-vim`); mode/status reflected in UI |
| **Typewriter mode** | Vertical padding keeps caret near vertical center while typing |
| **Focus mode** | Distraction-free writing (toggle ⌘. or palette/settings) |
| **Word wrap** | On by default; toggle in editor settings |
| **Word count** | Shown in title bar / chrome |
| **Typography** | Font size (12–24px), editor font family (System UI, Mono, Serif, Inter, SF Mono, JetBrains Mono), line height |
| **Paper / patterns** | Note paper styles (none, dotted-grid, lines, ruled); background patterns (none, paper, canvas, grid, dots) |

---

## 4. Multi-window spatial system

### Window types
| Label pattern | Role |
|---------------|------|
| `main` | Primary shell: sidebar, editor, settings, status bar |
| `note-*` | Detached note window (full edit/preview) |
| `drag-ghost-*` | Lightweight drag preview while detaching |
| `hybrid-drag-*` | Intermediate real window during hybrid drag-to-detach |

### Detach flows
1. **Drag-to-detach** — drag a note from the sidebar past a threshold; hybrid drag creates a real floating window at drop position; cancel shows a short visual effect.
2. **Context menu** — “Open in Window”.
3. **Command palette** — “Detach Note” for the selected note.
4. **Keyboard deploy** — Ctrl+⌥+⇧+1–9 (main row and keypad) places notes 1–9 on a **3×3 screen grid**.
5. **Chord bring/focus** — Hyper+B then QWERTY row (Q–P) focuses or creates a window for notes 1–10.

### Window behavior
- **Frameless custom chrome** — traffic lights, drag region, double-click maximize/restore.
- **Window shade** — middle-click title bar collapses to title-bar height (~48px); works for main and detached notes.
- **Position & size persistence** — debounced save of geometry; restored on launch (`restore_detached_windows`).
- **Always on top** — per config; applied via native Tauri command.
- **Opacity / transparency** — global and window opacity controls; glass-morphism UI.
- **Hover mode** — Hyper+H toggles visibility/hover behavior across all detached windows (quick hide/show for desk clutter).
- **Focus** — focus existing detached window instead of duplicating; force-close/recreate if needed.
- **Gather / cleanup** — backend commands to gather windows to main screen, cleanup stale hybrid/drag windows, debug window state.

---

## 5. Navigation & keyboard surface

### In-app shortcuts
| Shortcut | Action |
|----------|--------|
| ⌘N | New note |
| ⌘K | Command palette |
| ⌘, | Open settings |
| ⌘. | Toggle focus mode |
| ⌘⇧P | Toggle markdown preview |
| Escape | Cancel chords / close overlays |

### Chord shortcuts (Hyper = ⌘⌃⌥⇧)
| Chord | Action |
|-------|--------|
| Hyper+O then **1–9** | Select note N |
| Hyper+O then **N** | New note |
| Hyper+O then **S** | Open search/palette |
| Hyper+B then **Q–P** | Focus/open window for notes 1–10 |
| Escape | Cancel chord (5s timeout; on-screen chord hint) |

### Global shortcuts (require Accessibility permissions on macOS)
| Shortcut | Action |
|----------|--------|
| Hyper+N | Create new note (system-wide) |
| Hyper+H | Toggle hover mode on all detached windows |
| Hyper+B | Enter window chord mode |
| Ctrl+⌥+⇧+1–9 | Deploy note N to grid slot N |
| ⌘⇧N | Alternate/test new-note shortcut |

Settings include **re-register shortcuts**, test event emit, test hover, and force-main-window-visible debug actions. A permission prompt can open System Settings for Accessibility.

### Command palette (⌘K)
Fuzzy filter over:
- Actions: New Note, Toggle Sidebar, Toggle Preview, Open Settings, Toggle Focus Mode, Detach Note
- All notes by title

Arrow keys + Enter to run; categories: note / action / navigation.

---

## 6. UI chrome & layout

- **Custom title bar** — app/note title, optional word count and last-saved stats.
- **Navigation sidebar** — switch Notes ↔ Settings; narrow icon rail aligned to 4px grid system.
- **Notes panel** — list with search, optional content previews (plain-text from markdown), create button, context menu.
- **Editor area** — empty state when no note; unified editor path for main + detached.
- **Status / footer bar** — theme swatch/name, focus/typewriter/always-on-top indicators, notes directory path (opens in Finder).
- **Resizable panels** — sidebar/editor split.
- **Glass-morphism** — translucent cards, borders, backdrop blur consistent across windows.

---

## 7. Appearance & settings

Settings sections: **General · Appearance · Shortcuts · Editor · Advanced**.

| Area | Options |
|------|---------|
| **Themes** | 15 presets: Midnight Ink, Dark Forest, Cosmic Dusk, Morning Mist, Warm Parchment, Pure Mono, Inverse Void, Terminal Green, Cyberpunk Neon, Executive Suite, Pastel Dream, Zen Garden, High Contrast Dark, Autumn Harvest, Arctic Frost — fonts, colors, optional background texture, code theme |
| **Custom theme hooks** | Font overrides (editor/preview/ui), color map, background texture type/opacity/scale |
| **Theme mode** | dark / light / system |
| **General** | About (app name, version 1.0.0), note previews toggle, window opacity slider, notes directory controls |
| **Editor** | Focus mode, typewriter mode, vim mode, word wrap, paper style |
| **Window** | Opacity, always on top |
| **Advanced** | Developer mode, auto-update flag |
| **Persistence** | Config JSON on disk; deep-merge updates; `config-updated` broadcast to all windows |

---

## 8. Sync, events, and multi-instance consistency

- Tauri events: `note-updated`, `note-created`, `note-deleted`, `config-updated`, `menu-new-note`, `chord-window-mode`, `deploy-note-window`, `window-shade-toggled`.
- Frontend `NoteSyncService` singleton fans out note changes to subscribed editors.
- Detached window store tracks open windows, create/close/focus/refresh, position/size updates.
- Config changes from one window apply appearance/behavior everywhere.

---

## 9. Platform & ops

- **macOS-oriented**: Cocoa-friendly windowing, global shortcuts, Accessibility prompt, open in Finder, open System Settings.
- **Browser fallback**: demo notes when not in Tauri (UI preview without native windows).
- **Logging**: file logging; `[BLINK]` console prefix; get recent logs / log path commands.
- **Dev tooling**: DevToolbar (notes/window inspect, test create, cleanup); many debug Tauri commands (webview state, force opaque, recreate missing windows, etc.).
- **Landing site**: separate marketing/landing package under `landing/` and `docs/`.

---

## 10. Explicitly *not* in v1 (roadmap)

Per product README: AI providers, per-note AI context, conversational notes, cross-note awareness, self-updating notes, multimodal input, collaborative multi-user sync. Phase 1 is the **spatial multi-window foundation + editor + customization** described above.

---

## 11. Quick reference — “what can a user do?”

1. Write markdown notes with live preview, optional Vim, typewriter, and focus modes.  
2. Auto-save to disk as real `.md` files in a chosen folder.  
3. Pull notes out of the list into floating windows and arrange them spatially.  
4. Shade, pin, fade, hover-hide, and restore those windows.  
5. Drive almost everything from keyboard: palette, chords, global Hyperkeys, grid deploy.  
6. Theme the entire app with presets and fine-grained typography/paper options.  
7. Keep main and floating editors in sync while editing the same note.

*Document reflects the original implemented codebase (Phase 1). For layout tokens see `docs/GRID_SYSTEM.md`; for vision/roadmap see root `README.md`.*
