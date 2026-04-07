# Changes: Use highest-resolution grocery item images after selection (TSK-006)

## Files Modified
- `supabase/functions/search-products/index.ts` — upgraded full image URLs to the highest available provider size while keeping smaller browsing thumbnails.
- `ios-native/GatherLists/GatherLists/Views/Components/ItemImagePickerSheet.swift` — now saves the full image URL instead of the low-resolution thumbnail URL.

## Verification
- `npm run build` passed.
- iOS simulator build passed.
- Security review found no real concerns.
- Manual follow-up still required on web and iOS to confirm sharper selected item thumbnails and expanded views.
