# Changes: Fix profile image upload refresh across web and iOS (TSK-007)

## Files Modified
- `src/services/imageStorage.js` — appended a cache-busting version query parameter to uploaded profile image URLs before saving them.
- `ios-native/GatherLists/GatherLists/Services/StorageService.swift` — appended a cache-busting version query parameter to uploaded profile image URLs before saving them.
- `ios-native/GatherLists/GatherLists/Utils/ImageCompressor.swift` — flattens transparent images onto white before JPEG export.
- `ios-native/GatherLists/GatherLists/Views/Settings/SettingsView.swift` — added explicit AsyncImage phase handling with fallback initials rendering.

## Verification
- `npm run build` passed.
- iOS simulator build passed.
- Swift review found no correctness issues.
- Manual follow-up still required to confirm avatar changes appear immediately after upload and persist after refresh/relaunch.
