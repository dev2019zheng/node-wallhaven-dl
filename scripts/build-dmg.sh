#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROFILE="release"
TARGET_TRIPLE=""
ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --debug)
      PROFILE="debug"
      ARGS+=("$1")
      shift
      ;;
    --target)
      TARGET_TRIPLE="$2"
      ARGS+=("$1" "$2")
      shift 2
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

PRODUCT_NAME="$(node -p "require('./src-tauri/tauri.conf.json').productName")"
VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version")"

ARCH_NAME="$(
  case "$TARGET_TRIPLE" in
    aarch64-apple-darwin) echo "aarch64" ;;
    x86_64-apple-darwin) echo "x64" ;;
    *)
      case "$(uname -m)" in
        arm64|aarch64) echo "aarch64" ;;
        x86_64) echo "x64" ;;
        *) uname -m ;;
      esac
      ;;
  esac
)"

LOG_FILE="$(mktemp -t wallhaven-dmg-build.XXXXXX.log)"
cleanup() {
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

set +e
npx tauri build --bundles dmg "${ARGS[@]}" 2>&1 | tee "$LOG_FILE"
BUILD_STATUS=${PIPESTATUS[0]}
set -e

if [[ $BUILD_STATUS -eq 0 ]]; then
  exit 0
fi

BUNDLE_ROOT="src-tauri/target"
if [[ -n "$TARGET_TRIPLE" ]]; then
  BUNDLE_ROOT+="/$TARGET_TRIPLE"
fi
BUNDLE_ROOT+="/$PROFILE/bundle"
MACOS_DIR="$BUNDLE_ROOT/macos"
DMG_DIR="$BUNDLE_ROOT/dmg"
DMG_SCRIPT="$DMG_DIR/bundle_dmg.sh"
DMG_NAME="${PRODUCT_NAME}_${VERSION}_${ARCH_NAME}.dmg"
APP_NAME="${PRODUCT_NAME}.app"

if [[ ! -x "$DMG_SCRIPT" ]] || [[ ! -d "$MACOS_DIR/$APP_NAME" ]]; then
  exit "$BUILD_STATUS"
fi

echo "Default DMG bundling failed, retrying with --skip-jenkins workaround..."
mkdir -p "$DMG_DIR"

(
  cd "$MACOS_DIR"
  rm -f "$DMG_NAME"
  ../dmg/bundle_dmg.sh \
    --skip-jenkins \
    --volname "$PRODUCT_NAME" \
    --icon "$APP_NAME" 180 170 \
    --app-drop-link 480 170 \
    --window-size 660 400 \
    --hide-extension "$APP_NAME" \
    "$DMG_NAME" \
    "$APP_NAME"
)

cp -f "$MACOS_DIR/$DMG_NAME" "$DMG_DIR/$DMG_NAME"
printf 'DMG artifact ready: %s\n' "$DMG_DIR/$DMG_NAME"
