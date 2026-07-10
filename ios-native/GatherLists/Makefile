# GatherLists iOS — release helpers
#
# Usage:
#   make bump        Increment the build number (CURRENT_PROJECT_VERSION) by 1.
#   make archive     Bump the build number, then archive for distribution.
#                    The archive lands in Xcode's Organizer (Window > Organizer),
#                    where you can run "Distribute App" as usual.
#   make testflight  Archive and upload straight to TestFlight — no Xcode UI.
#                    The build number is bumped by the archive itself (the
#                    "Bump Build Number (Archive Only)" build phase), so this
#                    target does NOT pre-bump. Requires the App Store Connect
#                    API key at $(ASC_KEY_PATH); commit Version.xcconfig after.
#
# Why this exists: the build number is bumped HERE, before the build, instead
# of in an Xcode build phase. A build phase that rewrote the project mid-archive
# caused archives to not appear in the Organizer and the version to jump.

PROJECT      = GatherLists.xcodeproj
SCHEME       = GatherLists
ARCHIVE_DIR  = $(HOME)/Library/Developer/Xcode/Archives/$(shell date +%Y-%m-%d)
ARCHIVE_PATH = $(ARCHIVE_DIR)/GatherLists-$(shell date +%H.%M.%S).xcarchive

# App Store Connect API auth. The .p8 private key lives outside the repo and
# must never be committed; the key/issuer IDs are not secret without it.
ASC_KEY_ID    = FF3D577Z7A
ASC_ISSUER_ID = 69a6de78-0662-47e3-e053-5b8c7c11a4d1
ASC_KEY_PATH  = $(HOME)/.appstoreconnect/private_keys/AuthKey_$(ASC_KEY_ID).p8

.PHONY: bump archive testflight

bump:
	@./scripts/bump-build.sh

archive: bump
	@mkdir -p "$(ARCHIVE_DIR)"
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) \
		-destination 'generic/platform=iOS' \
		-archivePath "$(ARCHIVE_PATH)" \
		-allowProvisioningUpdates \
		clean archive
	@echo ""
	@echo "Archive created: $(ARCHIVE_PATH)"
	@echo "Open Xcode > Window > Organizer to validate and distribute it."
	@echo "Then commit GatherLists.xcodeproj/project.pbxproj to save the build number."

testflight:
	@test -f "$(ASC_KEY_PATH)" || { echo "error: App Store Connect API key not found at $(ASC_KEY_PATH)" >&2; exit 1; }
	@mkdir -p "$(ARCHIVE_DIR)"
	@set -e; \
	ARCHIVE="$(ARCHIVE_DIR)/GatherLists-$$(date +%H.%M.%S).xcarchive"; \
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) \
		-destination 'generic/platform=iOS' \
		-archivePath "$$ARCHIVE" \
		-allowProvisioningUpdates \
		-authenticationKeyPath "$(ASC_KEY_PATH)" \
		-authenticationKeyID $(ASC_KEY_ID) \
		-authenticationKeyIssuerID $(ASC_ISSUER_ID) \
		clean archive; \
	xcodebuild -exportArchive \
		-archivePath "$$ARCHIVE" \
		-exportOptionsPlist ExportOptions.plist \
		-allowProvisioningUpdates \
		-authenticationKeyPath "$(ASC_KEY_PATH)" \
		-authenticationKeyID $(ASC_KEY_ID) \
		-authenticationKeyIssuerID $(ASC_ISSUER_ID); \
	BUILD=$$(grep -m1 -oE 'CURRENT_PROJECT_VERSION = [0-9]+' Version.xcconfig | grep -oE '[0-9]+'); \
	echo ""; \
	echo "Build $$BUILD uploaded to App Store Connect (TestFlight processing takes a few minutes)."; \
	echo "Commit Version.xcconfig to save the new build number."
