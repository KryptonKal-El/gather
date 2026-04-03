# Changes: Fix iOS list edit toolbar, category text, and add-category title bugs (TSK-001)

## Files Modified
- `ios-native/GatherLists/GatherLists/Views/Lists/EditListSheet.swift` — applied readable branded styling to toolbar actions and passed add/edit mode into category editor flows.
- `ios-native/GatherLists/GatherLists/Views/Lists/CategoryEditorSheet.swift` — added explicit add/edit mode title handling and improved readable toolbar/action styling.
- `ios-native/GatherLists/GatherLists/Views/Lists/CreateListSheet.swift` — updated category editor call sites for add/edit mode.
- `ios-native/GatherLists/GatherLists/Views/Settings/DefaultCategoryEditorView.swift` — updated category editor call sites for add/edit mode.

## Verification
- `xcodebuild` simulator build passed.
- `swift-critic` review found no issues.
- Native UI still needs manual simulator confirmation for toolbar color/readability and add-vs-edit title behavior.

## Follow-up
- Styled the `Customize Categories` disclosure label directly in both Edit List and Create List so it uses a readable primary text color instead of the tinted low-contrast appearance.
- Applied the correct plain button styling to the inline category rows so category names remain visible/readable inside the disclosure group on iOS 26 glass sheets.
- Styled the shared `EmojiPickerView` toolbar controls with the branded green treatment so the Choose Emoji sheet is readable from Edit List and other entry points.
- Expanded the category row hit area in Edit List and Create List so tapping anywhere on a category row opens the editor, not just the text or chevron.
