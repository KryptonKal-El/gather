#!/bin/bash
#
# Bumps the iOS build number (CFBundleVersion) by incrementing
# CURRENT_PROJECT_VERSION across every target in project.pbxproj.
#
# This is the single source of truth: Info.plist's CFBundleVersion is
# $(CURRENT_PROJECT_VERSION), so bumping here updates the app and the
# widget extension together (they must match for App Store Connect).
#
# Run this BEFORE archiving — never as an Xcode build phase. Modifying the
# project during an archive is what caused archives to not register in the
# Organizer and the build number to jump.
#
set -euo pipefail

cd "$(dirname "$0")/.."
PBX="GatherLists.xcodeproj/project.pbxproj"

current=$(grep -m1 -oE 'CURRENT_PROJECT_VERSION = [0-9]+;' "$PBX" | grep -oE '[0-9]+' || true)
if [ -z "${current:-}" ]; then
  echo "error: could not read CURRENT_PROJECT_VERSION from $PBX" >&2
  exit 1
fi

next=$((current + 1))
/usr/bin/sed -i '' "s/CURRENT_PROJECT_VERSION = [0-9][0-9]*;/CURRENT_PROJECT_VERSION = ${next};/g" "$PBX"

echo "Build number bumped: ${current} -> ${next}"
echo "Remember to commit ${PBX} so the new build number is saved."
