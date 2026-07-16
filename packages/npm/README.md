# @arach/blink

Native macOS spatial notes — the CLI agents use to author, style, and place
notes, plus a one-command installer for the Blink menubar app.

> macOS, Apple Silicon. Requires the Blink app running for live placement/typed
> reveals; file writes reconcile whenever it next opens.

## Install

```sh
npm install -g @arach/blink
```

This gives you two commands:

- **`blink`** — the notes CLI (over the same files the app uses):

  ```sh
  blink ls                                   # list notes
  blink new "grocery run"                    # create
  blink present q3-planning "# Q3" --slot 6  # content + look + grid cell, one call
  blink type standup "shipped the CLI"       # append the open panel types on
  blink write standup < revised.md           # replace silently
  ```

  Full reference: [docs/cli.md](https://github.com/arach/blink/blob/main/docs/cli.md).

- **`blink-app`** — install/launch the menubar app (downloads the signed DMG
  from the latest GitHub release if it isn't already in `/Applications`):

  ```sh
  blink-app          # install if needed, then launch
  blink-app update   # re-download the latest release
  ```

## What ships in the tarball

The `blink` command is a native Swift binary built and code-signed at publish
time (`prepack`), embedded as `dist/blink`; the `bin/` shims exec it. No
download at install time for the CLI.

The GUI app is distributed separately as a signed + notarized DMG on the
[GitHub releases](https://github.com/arach/blink/releases); `blink-app` fetches it.
