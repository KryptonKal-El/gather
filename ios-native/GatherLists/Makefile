# GatherLists iOS — release helpers
#
# Usage:
#   make bump      Increment the build number (CURRENT_PROJECT_VERSION) by 1.
#   make archive   Bump the build number, then archive for distribution.
#                  The archive lands in Xcode's Organizer (Window > Organizer),
#                  where you can run "Distribute App" as usual.
#
# Why this exists: the build number is bumped HERE, before the build, instead
# of in an Xcode build phase. A build phase that rewrote the project mid-archive
# caused archives to not appear in the Organizer and the version to jump.

PROJECT      = GatherLists.xcodeproj
SCHEME       = GatherLists
ARCHIVE_DIR  = $(HOME)/Library/Developer/Xcode/Archives/$(shell date +%Y-%m-%d)
ARCHIVE_PATH = $(ARCHIVE_DIR)/GatherLists-$(shell date +%H.%M.%S).xcarchive

.PHONY: bump archive

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
