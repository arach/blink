#!/usr/bin/env bash
# Build the release assets and publish them to a GitHub release on arach/blink.
# Uploads the signed+notarized Blink.dmg (human download) and the blink CLI
# binary (blink-macos-arm64). The npm package ships its own copy of the CLI.
#
#   ./tools/release/ship.sh [--dry-run] [--skip-dmg]
#
# Env:
#   BLINK_RELEASE_REPO    default: arach/blink
#   BLINK_RELEASE_TARGET  default: main
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$ROOT/dist"
REPO="${BLINK_RELEASE_REPO:-arach/blink}"
TARGET="${BLINK_RELEASE_TARGET:-main}"
VERSION="${BLINK_VERSION:-$(node -p "require(process.argv[1]).version" "$ROOT/packages/npm/package.json" 2>/dev/null || echo '2.0.0')}"
TAG="v${VERSION}"
DRY_RUN=0
SKIP_DMG=0
TMP=""

cleanup() { [ -n "$TMP" ] && [ -d "$TMP" ] && rm -rf "$TMP" || true; }
trap cleanup EXIT

run() {
    if [ "$DRY_RUN" -eq 1 ]; then printf 'DRY RUN:'; printf ' %q' "$@"; printf '\n'; return 0; fi
    "$@"
}

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run) DRY_RUN=1 ;;
        --skip-dmg) SKIP_DMG=1 ;;
        -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; exit 1 ;;
    esac
    shift
done

command -v gh >/dev/null || { echo "Error: gh not found" >&2; exit 1; }
cd "$ROOT"

ASSETS=()

# CLI binary (also what the npm package embeds).
echo "==> Building blink CLI asset..."
run bash "$SCRIPT_DIR/build-cli.sh"
CLI_ASSET="$DIST_DIR/blink-macos-arm64"
if [ "$DRY_RUN" -eq 0 ]; then
    mkdir -p "$DIST_DIR"
    cp "$ROOT/packages/npm/dist/blink" "$CLI_ASSET"
fi
ASSETS+=("$CLI_ASSET")

# Signed + notarized DMG (the human download).
if [ "$SKIP_DMG" -eq 0 ]; then
    echo "==> Building DMG asset..."
    run bash "$SCRIPT_DIR/build-dmg.sh" "$VERSION"
    ASSETS+=("$DIST_DIR/Blink.dmg")
    # A versioned copy so the release lists Blink-<version>.dmg too.
    TMP="$(mktemp -d)"
    VERSIONED="$TMP/Blink-$VERSION.dmg"
    if [ "$DRY_RUN" -eq 0 ]; then cp "$DIST_DIR/Blink.dmg" "$VERSIONED"; ASSETS+=("$VERSIONED"); fi
fi

NOTES="$(mktemp)"
cat > "$NOTES" <<EOF
Blink $VERSION

Download **Blink.dmg** for Mac (Apple Silicon), or install the CLI:

    npm install -g @arach/blink

Then \`blink ls\`, \`blink present\`, \`blink type\`. See docs/cli.md.
EOF

if [ "$DRY_RUN" -eq 1 ]; then
    echo "==> DRY RUN: would create/update release $TAG in $REPO with:"
    printf '   - %s\n' "${ASSETS[@]}"
elif gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    echo "==> Updating release $TAG in $REPO..."
    gh release edit "$TAG" --repo "$REPO" --title "Blink $VERSION" --notes-file "$NOTES"
    gh release upload "$TAG" "${ASSETS[@]}" --repo "$REPO" --clobber
else
    echo "==> Creating release $TAG in $REPO..."
    gh release create "$TAG" "${ASSETS[@]}" --repo "$REPO" --target "$TARGET" \
        --title "Blink $VERSION" --notes-file "$NOTES"
fi
rm -f "$NOTES"

echo ""
[ "$DRY_RUN" -eq 1 ] && echo "==> Dry run complete for $TAG" || echo "==> Shipped $TAG to $REPO"
