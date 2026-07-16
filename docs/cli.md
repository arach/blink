# The `blink` CLI — agent surface, layer 2

A command-line face over the exact same files and codec the app uses. Writes
are atomic and slug-safe via BlinkCore. The running app picks every change up
**live**: it watches the Notes directory, reconciles disk against memory, and
routes the diff through
the same notifications in-app edits use. Create a note from a script and it's
in the popover a second later; edit an open note's file and the panel updates
in place (unless the user has unsaved edits in flight — then the user wins).

## Where it operates

```
$BLINK_HOME/Notes                                  # when BLINK_HOME is set
~/Library/Application Support/Blink/Notes          # default
```

`BLINK_HOME` is honored by the app and the CLI alike — set it to sandbox a
complete Blink (notes + config) for tests or experiments.

## Build / install

```sh
swift build -c release --product blink
cp .build/release/blink ~/bin/    # or anywhere on PATH
```

## Commands

Every command takes `--json` for structured output. Errors go to stderr with
exit code 1.

```sh
blink ls [--limit N] [--json]     # list notes, most recently updated first
blink cat <id> [--json]           # print content (exact bytes); --json adds all metadata
blink new [text ...] [--json]     # create from args or stdin; prints the assigned id
blink present <id> [text ...] [--style … --slot … …] [--json]  # create/update content + presentation
blink append <id> [text ...] [--json]  # append a line from args or stdin; prints the id
blink type <id> [text ...] [--json]    # append text the open panel types on (the visible hand)
blink write <id> [text ...] [--json]   # replace content wholesale, silently (no typed reveal)
blink search <query> [--json]     # case-insensitive substring over title + content
blink rm <id> [--json]            # delete a note
blink path [<id>]                 # the notes directory, or a note's file path
```

`present` is the compound arrival verb: it sets a note's markdown **and** its
`blink:` presentation (see `notes-representation.md`) in one write, get-or-create
by id. Only the fields you pass change; the rest are preserved. Its options mirror
the `blink:` keys: `--style --sheet --accent --font --font-size --line-height
--tint --tint-read --tint-edit --radius --slot`. `--slot 1–9` is placement intent
for the grid. Omit the text to change presentation alone.

`type` and `write` are the two ways to change a note's body, and they differ only
in *how the open panel reacts*: `type` appends an anchored suffix, so the running
app reveals it character by character (the visible hand); `write` replaces the
whole body, so the panel updates in place with no animation. `append` is the
established sibling of `type` (identical behavior). All three preserve presentation
and foreign frontmatter.

Examples:

```sh
blink new "grocery run"                    # → grocery-run
printf '# Standup\n\n- ship CLI\n' | blink new --json
blink present q3-planning "# Q3 Planning" --style focus --slot 6   # content + look + place
blink present q3-planning --accent "#9ece6a"   # presentation-only; body untouched
blink append grocery-run "- oat milk"      # types on live if the panel is open
blink type standup "shipped the CLI verbs"     # same visible-hand reveal, phrasebook name
printf '%s\n' '- ship docs' | blink append standup --json
blink write standup < revised-standup.md       # replace the body, no animation
blink cat grocery-run
blink search standup --json | jq '.[0].id'
open "$(blink path grocery-run)"           # hand the file to anything
```

## JSON shape

```jsonc
{
  "id": "standup",
  "title": "Standup",
  "tags": [],
  "pinned": false,
  "created": "2026-07-14T19:51:41.934Z",
  "updated": "2026-07-14T19:51:41.934Z",
  "path": "/Users/you/Library/Application Support/Blink/Notes/standup.md",
  "content": "…",             // cat/append --json only
  "extraFrontmatter": []        // cat/append --json only — foreign keys, preserved verbatim
}
```

## Or skip the CLI entirely

The filesystem is the API (layer 1): notes are frontmattered markdown, one
file per note. You may edit them with anything — Blink preserves frontmatter
keys it doesn't own and merges on-disk metadata before every save, so foreign
keys survive. The CLI just adds atomic writes, correct slug assignment, and
structured output for free. Prefer it for *creating* notes (slug uniqueness),
`append` when an agent should add a visible update without replacing the note,
and any scripted workflow. `append` always writes exactly one separating
newline before the supplied text; stdin bytes after that separator are kept as
provided.

Not here yet, by design: `blink link` waits for the `.blink/index.json`
backlink index; MCP waits until conversational, typed interaction is earned.
