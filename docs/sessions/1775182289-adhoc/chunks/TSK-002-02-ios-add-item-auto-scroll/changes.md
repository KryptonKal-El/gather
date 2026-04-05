# Changes: Auto-scroll newly added iOS list items into view (TSK-002)

## Files Modified
- `ios-native/GatherLists/GatherLists/ViewModels/ListDetailViewModel.swift` — tracked the identifier of the last inserted item from both add-item paths.
- `ios-native/GatherLists/GatherLists/Views/Lists/ListDetailView.swift` — updated scrolling to target the actual new row and added stable row identifiers for ScrollViewReader.

## Verification
- `xcodebuild` simulator build passed.
- `swift-critic` review found no issues.
- Manual simulator check still required to confirm the newly added item scrolls into view for direct add and suggestion add flows.
