#!/bin/bash
#
# Bumps the iOS build number (CFBundleVersion) by incrementing
# CURRENT_PROJECT_VERSION in Version.xcconfig — the single source of truth.
#
# Info.plist's CFBundleVersion is $(CURRENT_PROJECT_VERSION), so bumping here
# updates the app and the widget extension together (they must match for App
# Store Connect).
#
# The number lives in an .xcconfig (not the .pbxproj) so it can be bumped while
# Xcode is open without conflicts. This is run by the scheme's Archive
# pre-action and by `make bump` — never as a build phase during the archive.
#
set -euo pipefail

cd "$(dirname "$0")/.."
XCCONFIG="Version.xcconfig"

current=$(grep -m1 -oE 'CURRENT_PROJECT_VERSION = [0-9]+' "$XCCONFIG" | grep -oE '[0-9]+' || true)
if [ -z "${current:-}" ]; then
  echo "error: could not read CURRENT_PROJECT_VERSION from $XCCONFIG" >&2
  exit 1
fi

next=$((current + 1))
/usr/bin/sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9][0-9]*/CURRENT_PROJECT_VERSION = ${next}/" "$XCCONFIG"

echo "Build number bumped: ${current} -> ${next}"
echo "Remember to commit ${XCCONFIG} so the new build number is saved."
