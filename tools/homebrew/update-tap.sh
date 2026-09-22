#!/usr/bin/env bash
# Render Blink's formula and cask into a separate Homebrew tap, but only after
# the matching GitHub release contains the exact Blink 2 assets they install.
#
#   ./tools/homebrew/update-tap.sh <version> <tap-directory>
#
# Example (after publishing v2.0.0):
#   ./tools/homebrew/update-tap.sh 2.0.0 "$(brew --repository arach/tap)"
#
# Env:
#   BLINK_RELEASE_REPO  GitHub repository containing the release
#                       (default: arach/blink)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATES="$SCRIPT_DIR/templates"
REPO="${BLINK_RELEASE_REPO:-arach/blink}"

usage() {
    sed -n '2,13s/^# \{0,1\}//p' "$0"
}

if [ "$#" -eq 1 ] && { [ "$1" = "-h" ] || [ "$1" = "--help" ]; }; then
    usage
    exit 0
fi
if [ "$#" -ne 2 ]; then
    usage
    exit 1
fi

VERSION="$1"
TAP_DIR="$2"
TAG="v$VERSION"
RELEASE_API="repos/$REPO/releases/tags/$TAG"

if ! printf '%s' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z]+)*$'; then
    echo "Error: invalid release version '$VERSION'." >&2
    exit 1
fi
if ! printf '%s' "$REPO" | grep -Eq '^[0-9A-Za-z_.-]+/[0-9A-Za-z_.-]+$'; then
    echo "Error: invalid GitHub repository '$REPO'." >&2
    exit 1
fi

for command in gh curl shasum ruby sed; do
    command -v "$command" >/dev/null || {
        echo "Error: required command '$command' was not found." >&2
        exit 1
    }
done

mkdir -p "$TAP_DIR"
TAP_DIR="$(cd "$TAP_DIR" && pwd)"
if [ "$TAP_DIR" = "$ROOT" ]; then
    echo "Error: the Homebrew tap must be a separate directory/repository." >&2
    exit 1
fi

if git -C "$TAP_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    DIRTY_TARGETS="$(git -C "$TAP_DIR" status --short -- Formula/blink.rb Casks/blink.rb)"
    if [ -n "$DIRTY_TARGETS" ]; then
        echo "Error: refusing to overwrite uncommitted tap definitions:" >&2
        printf '%s\n' "$DIRTY_TARGETS" >&2
        exit 1
    fi
fi

echo "==> Verifying published release $REPO@$TAG"
TAG_NAME="$(gh api "$RELEASE_API" --jq '.tag_name')"
DRAFT="$(gh api "$RELEASE_API" --jq '.draft')"
if [ "$TAG_NAME" != "$TAG" ] || [ "$DRAFT" != "false" ]; then
    echo "Error: $TAG is not a published release in $REPO." >&2
    exit 1
fi

asset_url() {
    local name="$1"
    gh api "$RELEASE_API" --jq ".assets[] | select(.name == \"$name\") | .browser_download_url"
}

CLI_URL="$(asset_url blink-macos-arm64)"
DMG_URL="$(asset_url Blink.dmg)"
if [ -z "$CLI_URL" ] || [ -z "$DMG_URL" ]; then
    echo "Error: $TAG must contain both Blink 2 Homebrew assets:" >&2
    echo "  - blink-macos-arm64" >&2
    echo "  - Blink.dmg" >&2
    echo "No tap files were written." >&2
    exit 1
fi

EXPECTED_CLI_URL="https://github.com/$REPO/releases/download/$TAG/blink-macos-arm64"
EXPECTED_DMG_URL="https://github.com/$REPO/releases/download/$TAG/Blink.dmg"
if [ "$CLI_URL" != "$EXPECTED_CLI_URL" ] || [ "$DMG_URL" != "$EXPECTED_DMG_URL" ]; then
    echo "Error: release asset URLs do not match the expected repository and tag." >&2
    exit 1
fi

TMP="$(mktemp -d "${TMPDIR:-/tmp}/blink-homebrew.XXXXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

echo "==> Downloading release assets for checksums"
curl --fail --location --silent --show-error --output "$TMP/blink-macos-arm64" "$CLI_URL"
curl --fail --location --silent --show-error --output "$TMP/Blink.dmg" "$DMG_URL"
CLI_SHA256="$(shasum -a 256 "$TMP/blink-macos-arm64" | awk '{print $1}')"
DMG_SHA256="$(shasum -a 256 "$TMP/Blink.dmg" | awk '{print $1}')"

render() {
    local source="$1"
    local destination="$2"
    sed \
        -e "s|@@REPO@@|$REPO|g" \
        -e "s/@@VERSION@@/$VERSION/g" \
        -e "s/@@CLI_SHA256@@/$CLI_SHA256/g" \
        -e "s/@@DMG_SHA256@@/$DMG_SHA256/g" \
        "$source" > "$destination"
}

render "$TEMPLATES/Formula/blink.rb" "$TMP/formula.rb"
render "$TEMPLATES/Casks/blink.rb" "$TMP/cask.rb"
ruby -c "$TMP/formula.rb" >/dev/null
ruby -c "$TMP/cask.rb" >/dev/null

mkdir -p "$TAP_DIR/Formula" "$TAP_DIR/Casks"
install -m 0644 "$TMP/formula.rb" "$TAP_DIR/Formula/blink.rb"
install -m 0644 "$TMP/cask.rb" "$TAP_DIR/Casks/blink.rb"
if [ ! -e "$TAP_DIR/README.md" ]; then
    install -m 0644 "$TEMPLATES/README.md" "$TAP_DIR/README.md"
fi

echo "==> Updated Homebrew tap definitions"
echo "    $TAP_DIR/Formula/blink.rb"
echo "    $TAP_DIR/Casks/blink.rb"
echo "    CLI sha256: $CLI_SHA256"
echo "    DMG sha256: $DMG_SHA256"
echo "Review, run Homebrew's style/audit checks, then commit in the tap repository."
