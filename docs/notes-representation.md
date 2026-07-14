# Blink v2 — The Representation of Notes

> Draft 2026-07-14. Opens the "what *is* a note, and where does everything about it
> live?" conversation. Companion to `v2-plan.md` (architecture, locked decisions) and
> `functionality-v1.md` (scope contract). This doc is opinionated on purpose — it's here
> to be argued with and annotated, not to be rubber-stamped.

The one-line thesis, stated up front so the rest can be judged against it:

> **The `.md` files are the notes. Everything else — index, backlinks, workspace layout,
> embeddings — is disposable derived data that can be `rm -rf`'d and rebuilt from the
> files without losing anything you'd cry over.**

v1 violated this and it killed the product's data model: a SQLite index quietly became
the real store, metadata got stranded inside it, and the files on disk drifted into
lies. We do not do that again.

---

## 1. Where we are

The current representation, honestly, in one screen. Three tiers, by durability.

### Tier 1 — Files are truth (`BlinkCore`)

One `.md` file per note at `~/Library/Application Support/Blink/Notes/<id>.md`. The `id`
is a slug (`grocery-list`, `grocery-list-2` on collision), and it's *both* the filename
and the frontmatter `id`. Writes are atomic: temp file in the same dir → `fsync` →
`replaceItemAt` rename (`NoteFileStore.save`). This is the v1 bare-`fs::write` data-loss
lesson, closed.

The `Note` model (`Note.swift`) is deliberately thin:

```swift
struct Note {
    var id: String          // slug, == filename stem
    var content: String     // raw markdown body, NO frontmatter
    var createdAt: Date
    var updatedAt: Date
    var tags: [String]
    var pinned: Bool
    var title: String { extractTitle(from: content) }  // DERIVED, never stored
}
```

`title` is not a field. It's computed from the first non-empty line every time (strip
`>`, `#`, list markers, emphasis, backticks; trim; cap 50 chars; else "Untitled"). This
is a good instinct and we should keep it: the title lives in the content, so the content
is the only thing that can lie about it, and it can't.

**Exact frontmatter schema** (`Frontmatter.swift` — a purpose-built codec, *not* a YAML
parser):

```markdown
---
id: grocery-list
created: 2026-07-14T09:12:03.418Z
updated: 2026-07-14T11:45:22.006Z
tags: [errands, home]
pinned: false
---
# Grocery list
- oat milk
- …
```

Codec contract worth knowing before we extend it:

| Field | On encode | On decode |
|---|---|---|
| `id` | always | required — throws `missingField` if absent |
| `created` / `updated` | always, ISO-8601 w/ fractional seconds | required; tolerates no-fraction form |
| `tags` | always (`[]` when empty) | defaults `[]` |
| `pinned` | always (`false` when unset) | defaults `false` |
| *unknown keys* | verbatim, after Blink's fields | preserved in order (`Note.extraFrontmatter`) |

> **Fixed** (was the headline finding of this doc's first draft): unknown keys used to be
> silently dropped on re-encode — an agent writing `source: web-clipper` into a note's
> frontmatter would have it erased by the next in-app edit. The codec now carries unknown
> header lines (including nested blocks and blank lines) verbatim through the round-trip,
> and `NoteStore.update` re-reads all metadata from disk before a content save, so an
> agent editing frontmatter while the note is open in a panel is never clobbered either.

### Tier 2 — Device state (UserDefaults, today)

Not in the files, not portable, currently in `UserDefaults`:

| Key | What | Owner |
|---|---|---|
| `blink.openNotes` | ids of panels open at last quit → session restore | `PanelManager` |
| `blink.noteMode.<id>` | per-note last mode (`read`/`edit`) | `PanelManager` |
| `blink.defaultMode`, `blink.restoreSession` | app prefs | `ConfigStore` |

Note what is *not* persisted yet: **panel geometry** (frame, screen, shade, z-order,
grid slot). That's M3 work. When it lands it should not go into `UserDefaults` — see §3.

Landing right now: a file-backed **`config.json`**, agent-first and hot-reloaded. This is
the seam where the representation question becomes urgent, because it's the first piece of
"everything else" that an agent is meant to read and write directly.

### Tier 3 — In memory only

The `NoteStore` actor is the single source of truth at runtime: an `[id: Note]` dictionary
loaded from disk on launch, mutated through `create`/`update`/`delete`, each mutation
`fsync`'d to disk and announced via `NotificationCenter` (`blinkNoteCreated/Updated/Deleted`,
`userInfo["id"]`). There is **no index, no search structure, no backlink map** — `all()`
sorts the dictionary by `updatedAt`, and that's the whole query engine. Fine for tens of
notes. Not fine for what §2 is about to ask of it.

---

## 2. Forces

What's going to pull on this representation, roughly in the order it'll hurt:

- **⌘K palette needs fast search over titles *and* content.** Right now the palette can
  scan the in-memory dictionary for titles. Content search means either grepping N files
  per keystroke or holding a searchable structure. At hundreds of notes, "grep on every
  keystroke" stops being invisible.
- **Spatial recall (M3) needs richer workspace state.** Frame, screen id, shade, pin,
  z-order, grid slot — per note, per device. `UserDefaults` is the wrong shape for this
  (opaque, unversionable, un-inspectable, un-git-able).
- **Agents want to read/write/query notes without driving the GUI.** This is a
  first-class product direction, not a nice-to-have (Scout broker, agent-to-agent
  messaging). Agents will want to: list notes, read one, create one, append to one, query
  "notes tagged X modified this week." They should do this against a *stable, documented
  surface*, not by reverse-engineering `UserDefaults` or racing the app for a SQLite lock.
- **`[[wiki-links]]` create a graph.** Once notes reference each other, "what links here"
  (backlinks) becomes a feature, and the representation has to answer graph questions it
  currently can't.
- **Scale: hundreds → thousands.** Load-all-into-a-dictionary-on-launch has a ceiling.
  Full-content search has a lower one.
- **Portability / sync — files should survive Blink.** The `.md` files must remain a
  clean, boring, greppable Markdown corpus that works in Obsidian, iCloud Drive, git, or a
  plain `grep` five years after Blink is uninstalled. Anything Blink-specific must not
  contaminate that corpus.
- **Privacy / local-first.** No field of this design phones home. Search, embeddings,
  everything derived — computed and stored locally.

The through-line: **more things want to know about notes, faster, and some of those
things are not the GUI.** The representation has to serve queries and serve non-human
callers, without letting either of them become the new source of truth.

---

## 3. Options per dimension

### 3.1 Search / index

| Option | Upside | Downside |
|---|---|---|
| **None — grep on demand** | Zero moving parts; truth is trivially the files | O(files) per query; content search stutters at hundreds; no ranking |
| **Derived JSON index** (`.blink/index.json`) | Fast in-memory queries; human-readable; **deletable** and rebuilt from files; easy for agents to read | Must be kept fresh; can go stale; not a "real" search engine |
| **SQLite** | Real indexes, FTS5, scales to thousands | **This is exactly how v1 died** |

**The v1 cautionary tale, in full, because it's the reason this doc exists:** v1 shipped a
SQLite module "as a migration path." Being the fastest thing to query, it became the thing
the app read from. Being a database, it accumulated fields the `.md` files didn't have.
The index stopped being derived and became **load-bearing** — and once metadata lived only
in SQLite, the files were no longer the source of truth, they were a lossy export. Deleting
the DB meant losing data. That is a side index holding metadata hostage, and it is banned.

The rule that keeps JSON honest and would have saved v1: **the index must be reconstructible
from the files alone, and deleting it must lose nothing.** If you ever want to put a field
in the index that isn't in a file, stop — that field belongs in the file's frontmatter.

### 3.2 Workspace / spatial state

| Option | Verdict |
|---|---|
| **UserDefaults** (today) | Opaque, unversionable, un-inspectable, can't diff, can't sync selectively. Fine for two booleans; wrong for a spatial layout that's a core product feature |
| **`.blink/workspace.json`** | Human-readable, git-diffable, inspectable, and **explicitly device-specific** — a machine's layout is not portable truth |

`v2-plan.md` already commits to `.blink/workspace.json` for panel geometry/shade/z-order/grid.
This doc agrees and pushes further: move `blink.openNotes` and `blink.noteMode.<id>` there
too, so *all* device-specific spatial state lives in one inspectable file and `UserDefaults`
holds only genuine app preferences. Keep it device-scoped (see Open Questions on whether it
ever syncs).

### 3.3 Links

Parse `[[wiki-link]]` (and `[[wiki-link|alias]]`) references at index time. **Backlinks are
pure derived data** — never stored in a file, always computed into `index.json` as a
reverse map. A note's outbound links live implicitly in its content (the `[[...]]` tokens
are the truth); the index just makes the reverse direction queryable. Same discipline as
`title`: the graph edges live in the content, the index only accelerates reading them.

### 3.4 Agent surface

These **layer** — each is a thinner or thicker wrapper over the same file truth. Proposed
order of arrival:

1. **The filesystem IS the API (now).** Documented conventions: notes are frontmattered
   `.md` in a known dir; `config.json` is the read/write control surface; `.blink/` is
   derived and safe to ignore or delete. An agent that can read files and speak Markdown is
   already a Blink client. Zero new code. **Ships with M-nothing — it already exists.**
   Now made real: the app watches the Notes directory and reconciles external writes live
   (`NoteStore.reconcile`), so file edits reach the popover and open panels within a second.
2. **A `blink` CLI — shipped.** `blink ls / cat / new / search / rm / path`, `--json`
   everywhere (see `docs/cli.md`). Wraps `BlinkCore` so agents get atomic writes and
   correct slug assignment **without reimplementing the codec** — and the app no longer
   races anyone: it watches the Notes directory and reconciles external changes live into
   the popover and open panels. `blink link <a> <b>` waits for the index (§3.2).
3. **An MCP server (later, only if earned).** Structured tools over the same `BlinkCore`
   the CLI uses. Justified when agents need conversational, typed, multi-step interaction —
   not before. The CLI is a hard dependency's worth of value on its own; MCP is a face on
   top of it.

The ordering is deliberate: each layer is strictly a nicer skin over the previous truth,
so we never build the fancy one before the boring one works, and an agent can always drop
down a layer to plain files when the abstraction is in the way.

### 3.5 Embeddings / semantic search

Explicitly **deferred**, but leave the slot open. When it arrives: sidecar vectors in
`.blink/embeddings/` (or a single `.blink/vectors.bin`), keyed by note id, **derived and
disposable** like everything else in `.blink/`. Local-only. Never in the `.md` files, never
load-bearing. Reserving the path now so nobody later "just adds an embeddings column" to
something that then becomes the source of truth (the v1 failure mode wearing a new hat).

---

## 4. Recommendation

A coherent stack, all following one rule: **files are the single source of truth;
everything in `.blink/` is a disposable cache; the agent surface is documented file
conventions first, a CLI next, MCP only if earned; the index is JSON until scale proves it
wrong.**

Concretely:

- **Notes:** unchanged. Frontmattered `.md`, one per note, atomic writes, title/graph edges
  derived from content. This part is already right.
- **Frontmatter:** ~~fix the unknown-key erasure (§1)~~ **done** — the codec preserves
  unknown keys through the round-trip, and content saves merge against on-disk metadata.
  The prerequisite for a safe agent surface is met.
- **Index:** `.blink/index.json`, derived, deletable. Holds per-note `{id, title, tags,
  pinned, created, updated, size, outboundLinks[]}` plus a reverse `backlinks` map and a
  content-search structure (start with a token/substring map; graduate to real FTS only when
  measured). Rebuilt from files; never the source of anything.
- **Workspace:** `.blink/workspace.json`, device-specific. Absorbs panel geometry (M3) *and*
  today's `blink.openNotes` / `blink.noteMode.<id>`. `UserDefaults` keeps only true prefs.
- **Config:** `config.json` at the Blink home root — the agent-first, hot-reloaded control
  surface already landing. Root-level (not in `.blink/`) because it's a *user/agent* surface,
  not a derived cache.
- **Agent surface:** documented conventions ✓ → `blink` CLI ✓ (`docs/cli.md`) → MCP later.
- **Embeddings:** slot reserved at `.blink/embeddings/`, not built.

### File layout — the Blink home directory

```
~/Library/Application Support/Blink/
├─ config.json                 # agent-first, hot-reloaded. USER/AGENT SURFACE.
│                              #   root-level on purpose: not a derived cache.
├─ Notes/                       # ── THE SOURCE OF TRUTH ──────────────────────
│  ├─ grocery-list.md           #   frontmattered markdown, one file per note.
│  ├─ grocery-list-2.md         #   filename stem == frontmatter id == slug.
│  ├─ q3-planning.md            #   plain, greppable, Obsidian/git/iCloud-safe.
│  └─ …                         #   survives Blink. Delete .blink/ and lose nothing.
│
└─ .blink/                      # ── DERIVED · DISPOSABLE · rm -rf-safe ────────
   ├─ index.json                #   titles, tags, mtimes, links, backlinks, search
   ├─ workspace.json            #   DEVICE-SPECIFIC: panel geometry, open list,
   │                            #     per-note mode, shade, z-order, grid slots
   └─ embeddings/               #   RESERVED, not built. local vectors, disposable.
```

The test for whether a byte is in the right place: **could you `rm -rf ~/…/Blink/.blink`
and relaunch with zero data loss?** If yes for everything under `.blink/`, and no for
anything under `Notes/`, the representation is correct. That single invariant is the whole
design.

---

## 5. Open questions

Real decisions for the owner, not rhetorical:

1. ~~**Frontmatter unknown-key preservation — do we fix it now?**~~ **Resolved: fixed,
   preserve-everything.** The codec carries unknown header lines verbatim through the
   round-trip, and content saves merge against on-disk metadata (`NoteStore.update`),
   covered by tests. No reserved namespace needed — agents may write any key.

2. **Do tags stay in frontmatter, or become derived from `#hashtags` in content?** Right now
   tags are an explicit frontmatter array. Obsidian-style inline `#tags` would make the
   content the sole truth (consistent with `title` and links) and let the index derive them —
   but changes the writing model. Frontmatter tags, inline tags, or both?

3. **Is workspace state ever portable across machines?** `.blink/workspace.json` is
   device-specific by default (pixel frames don't transfer). But "open the same 5 notes on
   my laptop" is a reasonable want. Do we split *logical* session (which notes are open) from
   *physical* geometry (where), and sync only the former?

4. **What triggers an index rebuild?** FSEvents watcher (already planned for external edits)
   for incremental updates, on-launch full rebuild for safety, on-write in-process update for
   immediacy — probably all three, but what's the authority when they disagree, and how do we
   detect a stale index (mtime check per file? a corpus hash)?

5. **Does the CLI share the running app's `NoteStore`, or open the files independently?**
   Two processes writing the same `.md` dir need a concurrency story. Atomic rename gets us
   far, but not for "app and CLI edit the same note in the same second." File locks, a
   broker, last-write-wins with FSEvents reconciliation, or CLI-defers-to-running-app?

6. **Should `.blink/` live inside the notes folder or beside it?** If a user points Blink at
   an existing Obsidian vault, does our `.blink/` cache belong *in* their vault (travels with
   it, but pollutes it) or in a separate app-owned location keyed by vault path (clean vault,
   but cache can orphan)? Affects portability directly.
