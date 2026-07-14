# Blink v2 — UI Map (design-studio pass)

> Produced 2026-07-14 by a design pass over `functionality-v1.md`, for the v2 rewrite
> (native Swift/AppKit + WKWebView on HudsonKit, Scout as donor).

The single biggest v2 opportunity: **v1 had one heavy main window doing everything (sidebar + editor + 1600-line settings) plus floating notes bolted on.** v2 should invert that — the spatial canvas of floating panels *is* the product, and the main window becomes optional.

---

## 1. Surface inventory

Priority key: **v2.0** = ships in first cut · **later** = fast-follow.

| # | Surface | One-line purpose | HudsonKit vs custom | Priority |
|---|---------|------------------|---------------------|----------|
| 1 | **Floating Note Panel** | A single note as a native NSPanel hosting a CodeMirror webview — the atomic unit of the app | Kit: NSPanel chrome, HudVisualEffectView glass, window shade, traffic-light region. Custom: CodeMirror bridge, title auto-extract, save-state pip, paper/pattern styling | **v2.0** |
| 2 | **Menubar Popover** | Always-available home base: quick capture, recent notes, dictation, search entry — the Scout-style anchor | Kit: NSStatusItem + popover, HudVisualEffectView, dictation via HudAudioTranscriber. Custom: recent-notes list, capture field, per-row actions | **v2.0** |
| 3 | **Command Palette** | Keyboard-first fuzzy launcher over notes + actions (⌘K) | Kit: command palette component (input, list, key-nav, fuzzy match, categories). Custom: action registry, note index, "deploy to grid" verbs | **v2.0** |
| 4 | **Main Window (Library)** | Optional browse/manage surface: all-notes list + one editor pane. Home for people who want a "list" mental model | Kit: window chrome, glass, split behavior. Custom: notes list, search, editor pane (reuses the panel's CodeMirror), empty state | **v2.0** — but *slimmed* (see Open Q1) |
| 5 | **Settings** | Preferences — deliberately small. Learn from the 1600-line failure | Kit: window chrome, glass, form controls. Custom: 4 sections max, live-preview theme picker | **v2.0** (tiny) / advanced pane **later** |
| 6 | **Permissions / Onboarding** | First-run: request Accessibility (global hotkeys) + Microphone (dictation), pick notes folder, teach the 3 core gestures | Kit: window/sheet chrome, glass. Custom: 3-step flow, permission-state polling, folder picker | **v2.0** |
| 7 | **Spatial Grid Overlay (HUD)** | Transient full-screen overlay showing the 3×3 deploy grid + chord hints when you enter window-chord/deploy mode | Kit: transparent HUD panel, glass, key-hint styling. Custom: grid render, slot occupancy, live chord state | **v2.0** — this is what makes spatial legible |
| 8 | **Chord / Hotkey Hint Toast** | Small transient "Hyper+B → …" affordance so chords are discoverable, not memorized | Kit: toast/HUD, glass. Custom: chord state machine display | **v2.0** |
| 9 | **Dictation Indicator** | Live in-panel state for recording → transcribing → inserted (waveform + partial text) | Kit: HudAudioTranscriber, waveform/level UI. Custom: insertion target, per-panel placement | **v2.0** |
| 10 | Theme/Appearance quick-switcher | Palette-invokable theme cycle without opening Settings | Kit: palette. Custom: theme registry | **later** |
| 11 | Note context menu | Right-click on a note (list or panel title): detach, deploy, shade, pin, delete | Kit: native NSMenu. Custom: verb set | **v2.0** |

**Cut / defer from v1:** the resizable sidebar↔editor split as a *primary* metaphor (the panels are the split now); 15 themes (ship 4–5, the rest are noise); paper/pattern zoo (keep 2: none + subtle grid); vim mode (later, behind a flag); the DevToolbar/debug-command sprawl (dev-only build). The `drag-ghost`/`hybrid-drag` intermediate window *types* go away — AppKit lets you drag a real NSPanel directly, so that whole class of ghost windows is designed out.

---

## 2. Wireframes

### 2a. Floating Note Panel (the atomic unit)
Minimal chrome. Title bar is a thin drag region; everything else is text. Chrome fades when not hovered.

```
 ╭───────────────────────────────────────────╮  ← NSPanel, glass (HudVisualEffectView)
 │ ●              Meeting notes            ⌁  │  ← 28px title bar: traffic lights (L),
 │───────────────────────────────────────────│    auto-title (center, dim), save-pip ⌁ (R)
 │                                           │
 │   ## Standup                              │
 │                                           │  ← CodeMirror webview.
 │   - shipped panel drag                    │    No gutter. Content = the whole surface.
 │   - dictation next│                       │    Caret shown; typewriter pads vertically.
 │                                           │
 │                                           │
 │                                           │
 │───────────────────────────────────────────│  ← footer appears ONLY on hover:
 │  142 words · saved         ✎ edit   🎙   │    word count · save state · edit/preview · dictate
 ╰───────────────────────────────────────────╯
       resize from any edge (native)
```
Design intent: **the note is the window**. No sidebar, no toolbar. Chrome is earned by hover; at rest it's just glass + text on your desktop. Middle-click title = shade to the 28px bar.

### 2b. Menubar Popover (home base — Scout-style)
Anchored under the status item. This is where you live when no panels are open.

```
        ▲                               ← anchored to menubar icon
 ╭─────────────────────────────────╮
 │  ⌕  Search or capture…       🎙 │  ← single field: type = search, ⌘↵ = new note,
 │─────────────────────────────────│    mic = dictate straight into a new note
 │  RECENT                         │
 │  ▸ Meeting notes        2m   ⤢ │  ← row: title · relative time · detach-to-panel (⤢)
 │  ▸ Roadmap Q3          1h   ⤢ │    click = open as panel · hover reveals ⤢
 │  ▸ Grocery              3h   ⤢ │
 │  ▸ Ideas parking lot   1d   ⤢ │
 │─────────────────────────────────│
 │  ⌘K palette   ·   ⛶ Library   ⚙ │  ← footer: palette, open main/library, settings
 ╰─────────────────────────────────╯
```
Design intent: **capture in under a second from anywhere.** The field does search AND create AND dictate. No note management here — just get in, get out, or fling a note onto the canvas with ⤢.

### 2c. Command Palette (⌘K, centered overlay)
```
        ╭───────────────────────────────────────────╮
        │  ⌘K   type a note or a command…           │  ← input (kit)
        │───────────────────────────────────────────│
        │  NOTES                                     │
        │   📄  Meeting notes                        │  ← ↑↓ to move, ↵ to open
        │   📄  Roadmap Q3                           │
        │  ACTIONS                                   │
        │   ✦  New note                       ⌘N    │
        │   ⤢  Deploy note → grid slot…              │  ← chains into grid overlay
        │   ◧  Toggle preview                 ⌘⇧P   │
        │   🎙  Dictate into current note            │
        │  ─────────────────────────────────────────│
        │   ↑↓ navigate   ↵ open   ⌘↵ open as panel │  ← key legend (kit)
        ╰───────────────────────────────────────────╯
```
Design intent: **one input to reach any note or verb.** Note the `⌘↵ = open as panel` modifier — the palette can spawn spatial panels, not just switch the editor.

### 2d. Spatial Grid Overlay (transient, on Hyper+B / deploy mode)
```
 ┌───────────────────────────────────────────────────────┐  ← dims desktop slightly
 │   ┌────────┐   ┌────────┐   ┌────────┐                │
 │   │  1  Q  │   │  2  W  │   │  3  E  │   slot label +   │  ← 3×3 grid mapped to
 │   │ ●used  │   │  empty │   │  empty │   chord key      │    QWERTY row (Q W E …)
 │   └────────┘   └────────┘   └────────┘                │
 │   ┌────────┐   ┌────────┐   ┌────────┐                │
 │   │  4  A  │   │  5  S  │   │  6  D  │                 │
 │   └────────┘   └────────┘   └────────┘                │
 │   ┌────────┐   ┌────────┐   ┌────────┐                │
 │   │  7  Z  │   │  8  X  │   │  9  C  │                 │
 │   └────────┘   └────────┘   └────────┘                │
 │            Hyper+B → key   ·   Esc to cancel           │
 └───────────────────────────────────────────────────────┘
```
Design intent: **make "spatial" visible and teachable.** v1's grid deploy was invisible muscle memory; showing the grid turns a power-user chord into something a new user can see and learn.

---

## 3. Key interactions (the product feel)

1. **Drag-to-detach** — *Trigger:* drag a note row out of the menubar popover or Library list past a threshold. *Behavior:* a real native NSPanel is created immediately under the cursor and follows it to the drop point (no ghost/hybrid intermediary — AppKit drags the actual panel). Release = panel stays; drag back onto a target = re-dock. *Intent:* the note physically becomes an object you place — this is the killer gesture, so it must feel like grabbing a card, not opening a dialog.

2. **Spatial arrangement & recall** — *Trigger:* move/resize/shade panels freely; or Ctrl+⌥+⇧+1–9 to snap to grid slots. *Behavior:* every panel's geometry, shade state, and pin persist per-note and restore exactly on relaunch; Hyper+B → key re-focuses or re-summons a note to its remembered spot. *Intent:* your desk arrangement is durable memory — where a note *is* carries meaning, and the app never forgets it.

3. **Quick capture from menubar / hotkey** — *Trigger:* click menubar icon, or Hyper+N from anywhere. *Behavior:* popover opens with cursor in the field (or a fresh panel appears at center); first keystroke or spoken word starts a note with zero ceremony; auto-titled from line one. *Intent:* thought-to-note latency near zero — if capture is slow, the whole spatial idea never gets fed.

4. **Dictation flow** — *Trigger:* mic button (popover, palette, or panel footer) or a hotkey. *Behavior:* HudAudioTranscriber records with a live waveform + partial transcript; text streams into the target note at the caret; a clear recording→transcribing→done state prevents "did it hear me?" doubt. *Intent:* voice is a first-class input, not a gimmick — dictate a panel full of thoughts hands-free, then arrange them.

5. **Edit ↔ preview** — *Trigger:* ⌘⇧P, footer toggle, or double-click preview. *Behavior:* in-place swap within the same panel (no new window, no layout jump); scroll position preserved. *Intent:* reading and writing are two faces of one surface — switching should feel like flipping a card, instantly and in place.

---

## 4. Design principles

1. **The note is the window.** The atomic unit is a floating panel, not a row. Every design choice defaults to "can this live as a self-contained panel on the desktop?"

2. **Chrome is earned, not given.** At rest a panel is glass + text. Controls (footer, word count, save pip) appear on hover or focus and recede otherwise. The desktop stays calm.

3. **Spatial memory is sacred.** Position, size, shade, and pin persist per-note and restore precisely. The app must never scramble a layout the user built — that's the trust that makes "spatial" real.

4. **Keyboard-first, mouse-welcome.** Every action has a key path (palette, chord, hotkey) AND a visible affordance. Chords get on-screen hints so they're discoverable, not folklore.

5. **Settings restraint.** Hard cap: ~4 sections, one screen each, no duplicated controls. If a setting has a good default, it isn't a setting. (Direct antidote to the 1600-line panel.) Ship 4–5 curated themes, not 15.

6. **Sync is invisible and instant.** Same note open in a panel and the Library edits in lockstep with no flicker or "saving…" anxiety. Cross-surface consistency is a feature you feel by *not* noticing it.

---

## 5. Open questions (decide before build)

1. **Does the Main Window even exist?** Strong case for **menubar popover + palette + panels only** — panels are the workspace, the popover is home, the palette is navigation. A Library window may be redundant weight (it's what made v1 heavy). *Lean:* ship a **minimal** Library as an optional "see everything" view for folder-brain users, but design the app so it's fully usable without ever opening it.

2. **Where do dictation transcripts land by default — and is there a raw-audio safety net?** Straight into the focused panel's caret? A scratch capture note? If nothing's focused, does Hyper-dictate spawn a new panel? And do we keep the audio/partials if transcription fails? This defines whether voice feels trustworthy or lossy.

3. **How opinionated is spatial snapping?** Pure free-placement (v1) vs. magnetic edges / grid-snap / auto-tile-remaining-space. Free-form is more "spatial" and honest; snapping is tidier and more legible on small screens. Could be a single toggle, but it changes the whole feel — pick a default.

4. **Menubar popover vs. detached panels — who owns "recent"?** If the popover shows recent notes AND panels are floating, there's overlap. Does opening a note from the popover *reuse* an existing panel (focus it) or spawn a new one? Define the identity rule now or we get duplicate-window chaos like v1's force-close/recreate hacks.

5. **How many notes before spatial breaks down?** Spatial is magic at 5–15 panels, chaos at 200. Do we need a "gather all," an off-screen "shelf/tray," or a cap on live panels with the rest living in the Library/palette only? Decide the graceful-degradation story before users hit it.

---

**The one thing worth fighting for:** build the menubar popover + panel + palette triad first and validate the app is complete without a main window. If it is, v2 has escaped v1's central mistake. If it isn't, you'll know exactly what the Library must do — and only that.
