# PRD: Desktop Avatar Upload

**Status:** Ready  
**Created:** 2026-03-03  
**Author:** Planner  
**Related Bug:** BUG-007  

## Summary

Make the desktop header avatar clickable so users can upload a profile image from the desktop viewport. Currently, profile image upload only works on mobile (via MobileSettings). Desktop users have no path to change their photo.

## Motivation

The profile image upload feature (prd-user-profile-image) was implemented with mobile-only upload capability. The desktop header avatar is display-only, and there is no desktop settings page. This means desktop users cannot upload or change their profile photo at all.

## Scope

### In Scope
- Make the desktop header avatar in `App.jsx` clickable, triggering a hidden file input
- Reuse the existing `uploadProfileImage` from `imageStorage.js` (resize + upload + update profiles table)
- Show a loading spinner on the avatar during upload
- Show a camera overlay on hover to indicate the avatar is clickable
- Show upload errors inline near the avatar
- Refresh user state after upload so the avatar updates immediately

### Out of Scope
- Desktop settings page (not needed for this fix)
- Any changes to the mobile MobileSettings upload flow (already works)
- Profile photo removal/deletion
- Display name editing

---

## User Stories

### US-001: Clickable Desktop Header Avatar with Upload

**As a** desktop user  
**I want** to click my avatar in the header to upload a profile photo  
**So that** I can set my profile image without needing a mobile device  

#### Details

**App.jsx changes:**

State and refs to add:
- `const [isAvatarUploading, setIsAvatarUploading] = useState(false)`
- `const [avatarUploadError, setAvatarUploadError] = useState(null)`
- `const avatarFileInputRef = useRef(null)`

Import to add:
- `import { uploadProfileImage } from './services/imageStorage.js'`
- `refreshUser` is already available from `useAuth()` — add it to the destructured return: `const { user, isLoading, signOut, refreshUser } = useAuth()`

Handlers to add:
```
handleAvatarClick — calls avatarFileInputRef.current?.click() (skip if isAvatarUploading)
handleAvatarFileChange — same pattern as MobileSettings:
  1. Get file from e.target.files[0]
  2. setIsAvatarUploading(true), clear error
  3. await uploadProfileImage(user, file)
  4. await refreshUser()
  5. catch → setAvatarUploadError('Upload failed. Please try again.')
  6. finally → setIsAvatarUploading(false), reset input value
```

Desktop header JSX changes (lines 297-302):
- Wrap the existing avatar `<img>` or `<span>` in a clickable `<div>` with:
  - `className={styles.headerAvatarWrap}`
  - `onClick={handleAvatarClick}`
  - `role="button"`
  - `tabIndex={0}`
  - `onKeyDown` handler for Enter/Space
  - `aria-label="Change profile photo"`
- Inside the wrapper, keep the existing avatar element
- Add a camera overlay `<div>` that shows on hover (same SVG icon as MobileSettings but sized for 32px)
- Add a small spinner when `isAvatarUploading` is true (replace the avatar content with spinner)
- Add a hidden `<input type="file" accept="image/*">` with ref={avatarFileInputRef} and onChange={handleAvatarFileChange}

Error display:
- If `avatarUploadError` is set, show a small error tooltip or text near the avatar. Auto-dismiss after 3 seconds using a `useEffect` with `setTimeout`.

**App.module.css changes:**

New classes needed:
- `.headerAvatarWrap` — `position: relative; cursor: pointer; border-radius: 50%;` (wraps the existing `.headerAvatar`)
- `.headerAvatarOverlay` — absolute positioned overlay on the avatar with camera icon, initially `opacity: 0`, transitions to `opacity: 1` on `.headerAvatarWrap:hover`. Semi-transparent dark background (`rgba(0,0,0,0.4)`), centered camera SVG, matching the MobileSettings pattern but at 32px scale.
- `.headerUploadSpinner` — small 32px spinner (same approach as MobileSettings `.uploadSpinner` but sized for the header)
- `.headerUploadError` — small error text/tooltip positioned below or beside the avatar. Red text, small font size, absolute positioned.
- `.headerFileInput` — `display: none` (hidden file input)

#### Acceptance Criteria

- [ ] Clicking the desktop header avatar opens the native file picker
- [ ] After selecting an image, it uploads via `uploadProfileImage` and the avatar updates immediately (via `refreshUser`)
- [ ] A loading spinner shows on the avatar during upload (replaces avatar content)
- [ ] A camera overlay icon appears on hover to indicate the avatar is clickable
- [ ] Upload errors are shown near the avatar and auto-dismiss after 3 seconds
- [ ] Keyboard accessible — Enter/Space triggers file picker
- [ ] The hidden file input accepts only image files (`accept="image/*"`)
- [ ] The file input value is reset after each upload (allows re-uploading the same file)
- [ ] No layout shift in the header when uploading or showing error
- [ ] Works in both light and dark mode
- [ ] Lint passes

---

## Credential & Service Access Plan

No external credentials required. Uses existing Supabase Storage `profile-images` bucket and `profiles` table.

---

## Definition of Done

Implementation is complete when:

1. Desktop users can click the header avatar and select a photo from the file picker
2. The image is resized and uploaded using the existing `uploadProfileImage` service function
3. The avatar updates immediately after upload without a page refresh
4. A camera overlay on hover indicates the avatar is clickable
5. A spinner shows during upload
6. Errors are surfaced to the user and auto-dismiss
7. Works in both light and dark mode
8. Lint passes
9. Build succeeds (`npm run build` exits 0)
