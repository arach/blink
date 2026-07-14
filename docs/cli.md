# The `blink` CLI — agent surface, layer 2

A command-line face over the exact same files and codec the app uses
(`docs/notes-representation.md` §3.4). Writes are atomic and slug-safe via
BlinkCore, and the running app picks every change up **live**: it watches the
Notes directory, reconciles disk against memory, and routes the diff through
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
blink search <query> [--json]     # case-insensitive substring over title + content
blink rm <id> [--json]            # delete a note
blink path [<id>]                 # the notes directory, or a note's file path
```

Examples:

```sh
blink new "grocery run"                    # → grocery-run
printf '# Standup\n\n- ship CLI\n' | blink new --json
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
  "content": "…",             // cat --json only
  "extraFrontmatter": []       // cat --json only — foreign keys, preserved verbatim
}
```

## Or skip the CLI entirely

The filesystem is the API (layer 1): notes are frontmattered markdown, one
file per note. You may edit them with anything — Blink preserves frontmatter
keys it doesn't own and merges on-disk metadata before every save, so foreign
keys survive. The CLI just adds atomic writes, correct slug assignment, and
structured output for free. Prefer it for *creating* notes (slug uniqueness)
and any scripted workflow.

Not here yet, by design: `blink link` waits for the `.blink/index.json`
backlink index; MCP waits until conversational, typed interaction is earned
(same doc, §3.4).
