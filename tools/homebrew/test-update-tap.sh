#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/blink-homebrew-test.XXXXXXXX")"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

MOCK_BIN="$TMP/bin"
mkdir -p "$MOCK_BIN"

cat > "$MOCK_BIN/gh" <<'MOCK_GH'
#!/usr/bin/env bash
set -euo pipefail

case "$*" in
    *".tag_name"*)
        echo "v2.0.0-alpha.3"
        ;;
    *".draft"*)
        echo "false"
        ;;
    *"blink-macos-arm64"*)
        echo "https://github.com/arach/blink/releases/download/v2.0.0-alpha.3/blink-macos-arm64"
        ;;
    *"Blink.dmg"*)
        if [ "${BLINK_TEST_MISSING_DMG:-0}" != "1" ]; then
            echo "https://github.com/arach/blink/releases/download/v2.0.0-alpha.3/Blink.dmg"
        fi
        ;;
    *)
        echo "Unexpected gh invocation: $*" >&2
        exit 1
        ;;
esac
MOCK_GH

cat > "$MOCK_BIN/curl" <<'MOCK_CURL'
#!/usr/bin/env bash
set -euo pipefail

OUTPUT=""
URL=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        --fail|--location|--silent|--show-error)
            shift
            ;;
        *)
            URL="$1"
            shift
            ;;
    esac
done
printf 'fixture for %s\n' "$URL" > "$OUTPUT"
MOCK_CURL

chmod +x "$MOCK_BIN/gh" "$MOCK_BIN/curl"

TAP_DIR="$TMP/homebrew-tap"
PATH="$MOCK_BIN:$PATH" "$SCRIPT_DIR/update-tap.sh" 2.0.0-alpha.3 "$TAP_DIR"

FORMULA="$TAP_DIR/Formula/blink.rb"
CASK="$TAP_DIR/Casks/blink.rb"
test -f "$FORMULA"
test -f "$CASK"
test -f "$TAP_DIR/README.md"
grep -Fq 'version "2.0.0-alpha.3"' "$FORMULA"
grep -Fq '/v2.0.0-alpha.3/blink-macos-arm64"' "$FORMULA"
grep -Fq '/v#{version}/Blink.dmg"' "$CASK"
if grep -Rq '@@[A-Z_]*@@' "$TAP_DIR"; then
    echo "Rendered tap still contains template placeholders." >&2
    exit 1
fi
ruby -c "$FORMULA" >/dev/null
ruby -c "$CASK" >/dev/null
if command -v brew >/dev/null; then
    brew style "$FORMULA"
    brew style "$CASK"
fi

MISSING_DIR="$TMP/missing-assets"
if BLINK_TEST_MISSING_DMG=1 PATH="$MOCK_BIN:$PATH" \
    "$SCRIPT_DIR/update-tap.sh" 2.0.0-alpha.3 "$MISSING_DIR" >/dev/null 2>&1; then
    echo "Updater accepted a release without Blink.dmg." >&2
    exit 1
fi
test ! -e "$MISSING_DIR/Formula/blink.rb"
test ! -e "$MISSING_DIR/Casks/blink.rb"

echo "Homebrew tap updater tests passed."
