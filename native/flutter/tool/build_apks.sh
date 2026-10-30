#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/../../public/apps}"
export PATH="${HOME}/flutter/bin:${PATH}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
cd "$ROOT"
mkdir -p "$OUT"
for flavor in customer admin staff support; do
  echo "Building $flavor"
  flutter build apk --release --flavor "$flavor" --dart-define="FLAVOR=$flavor" --target-platform android-arm64
  src="$ROOT/build/app/outputs/flutter-apk/app-$flavor-release.apk"
  cp -f "$src" "$OUT/vgmf-$flavor.apk"
  ls -lh "$OUT/vgmf-$flavor.apk"
done
