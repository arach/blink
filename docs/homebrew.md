# Homebrew distribution

Blink uses a dedicated `arach/homebrew-tap` repository so the CLI and macOS app
share one conventional tap without coupling tap history to the application
source repository.

| Package | Tap path | Release asset | Install command |
|---|---|---|---|
| CLI | `Formula/blink.rb` | `blink-macos-arm64` | `brew install arach/tap/blink` |
| App | `Casks/blink.rb` | `Blink.dmg` | `brew install --cask arach/tap/blink` |

Both packages are Apple Silicon-only and require macOS Sonoma or newer, matching
the binaries currently produced by Blink's release tooling.

## First-time tap setup

Do not publish a formula or cask until the matching Blink 2 GitHub release is
published with both exact asset names. The existing v1 release artifacts have
different names and are not compatible with these definitions.

After the first Blink 2 release exists:

```sh
brew tap-new arach/tap
gh repo create arach/homebrew-tap \
  --public \
  --push \
  --source "$(brew --repository arach/tap)"

./tools/homebrew/update-tap.sh 2.0.0 "$(brew --repository arach/tap)"
```

The updater queries the exact GitHub release, refuses draft releases or missing
assets, downloads both assets to calculate their SHA-256 checksums, and only
then writes the formula and cask. It never commits or pushes the tap.

Review the generated files in the tap checkout, then validate them:

```sh
brew style --formula arach/tap/blink
brew style --cask arach/tap/blink
brew audit --strict --formula arach/tap/blink
brew audit --strict --cask arach/tap/blink
brew install --build-from-source arach/tap/blink
brew test arach/tap/blink
brew install --cask arach/tap/blink
```

Commit and push from `arach/homebrew-tap` only after these checks pass.

## Subsequent releases

For each published Blink release, run the updater with the release version:

```sh
./tools/homebrew/update-tap.sh <version> "$(brew --repository arach/tap)"
```

Set `BLINK_RELEASE_REPO` only when testing against a fork. Generated definitions
point to that repository, so fork output is for validation, not publication.
