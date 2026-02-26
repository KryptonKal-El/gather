# PRD: User Profile Image

## Introduction

Add the ability for authenticated users to set a profile photo. Currently, the app shows a colored circle with the user's first initial as an avatar. This PRD adds a tap-to-change-photo flow on the avatar in Mobile Settings, uploads the image to Firebase Storage, and updates the Firebase Auth `photoURL` field so it persists across sessions and devices. The profile photo will also be displayed in the desktop header alongside the username.

Guest users cannot set a profile photo — they continue to see the letter avatar with no tap action.

## Goals

- Allow authenticated users to set and change their profile photo by tapping the avatar in Settings
- Upload profile images to Firebase Storage under a user-specific path
- Update Firebase Auth `photoURL` so the photo persists across devices and sessions
- Display the profile photo in both the mobile Settings avatar and the desktop header
- Keep the letter-initial fallback when no photo is set
- Exclude guest users from the profile photo feature

## User Stories

### US-001: Upload Profile Image to Firebase Storage

**Description:** As a developer, I need a service function to upload a profile image to Firebase Storage and return the download URL, so the UI components can use it.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] A new function (e.g., `uploadProfileImage`) is added to a service file (e.g., `src/services/imageStorage.js` or a new `src/services/profileStorage.js`)
- [ ] The function accepts `userId` and a `File` object, uploads to `users/{userId}/profile.{ext}` in Firebase Storage
- [ ] The function returns the public download URL after upload
- [ ] The image is resized/compressed client-side before upload — max dimension 256px, quality ~0.8 (use canvas or OffscreenCanvas to avoid uploading multi-MB photos)
- [ ] If a previous profile image exists at the same path, it is overwritten (Firebase Storage overwrites by default for same path)
- [ ] The function calls Firebase Auth `updateProfile(user, { photoURL })` to persist the URL on the user object
- [ ] Errors during upload or profile update are propagated to the caller (not swallowed)
- [ ] Lint passes

### US-002: Tap Avatar to Change Photo on Mobile

**Description:** As a mobile user, I want to tap my avatar in Settings to pick a new profile photo from my camera or photo library.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Tapping the avatar circle in MobileSettings opens the native file picker with `accept="image/*"` (shows camera + photo library on mobile devices)
- [ ] The file input is hidden — the avatar itself acts as the tap target (use a hidden `<input type="file">` triggered by clicking the avatar)
- [ ] The avatar shows a subtle camera/edit overlay icon on hover/focus to indicate it's tappable (only for authenticated users, not guests)
- [ ] After selecting a photo, a loading spinner or indicator shows on the avatar while uploading
- [ ] On successful upload, the avatar immediately updates to show the new photo (uses the download URL from US-001)
- [ ] On upload error, a brief error message is shown (e.g., toast or inline text) and the avatar reverts to its previous state
- [ ] The file picker only accepts image files (`accept="image/*"`)
- [ ] Guest users see the letter avatar with no tap action, no overlay icon, and no file picker
- [ ] The avatar continues to show the letter initial as fallback when no `photoURL` is set
- [ ] Works in both light and dark mode
- [ ] Lint passes
- [ ] Verify in browser

### US-003: Display Profile Photo in Desktop Header

**Description:** As a desktop user, I want to see my profile photo in the header so the app feels more personalized.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] The desktop header (≥701px) shows a small avatar circle (e.g., 32px) next to or replacing the username text
- [ ] If the user has a `photoURL`, the avatar shows the profile image
- [ ] If the user has no `photoURL`, the avatar shows the first letter initial (same pattern as MobileSettings)
- [ ] Guest users see the letter "G" avatar
- [ ] The avatar is styled consistently with the MobileSettings avatar (same border-radius, object-fit: cover) but smaller to fit the header
- [ ] The username text remains visible next to the avatar (not replaced entirely)
- [ ] The avatar does not act as a tap target on desktop — no file picker or edit action from the header (profile photo is changed in Settings only)
- [ ] No layout shift or visual regression to the existing desktop header elements (logo, theme toggle, sign out button)
- [ ] Works in both light and dark mode
- [ ] Lint passes
- [ ] Verify in browser

## Functional Requirements

- FR-1: Profile images must be uploaded to Firebase Storage at path `users/{userId}/profile.{ext}`
- FR-2: Images must be resized client-side to max 256px dimension before upload to minimize storage and bandwidth
- FR-3: After upload, Firebase Auth `updateProfile` must be called to set `photoURL` on the user object
- FR-4: The avatar in MobileSettings must be tappable for authenticated users, triggering a hidden file input
- FR-5: The avatar must show a loading state during upload
- FR-6: Guest users must not be able to set a profile photo — avatar is display-only
- FR-7: The desktop header must show a small avatar circle alongside the username
- FR-8: The letter-initial fallback must be used whenever `photoURL` is not set
- FR-9: The file picker must accept only image files (`accept="image/*"`)
- FR-10: Upload errors must be surfaced to the user, not swallowed silently

## Non-Goals

- No display name editing (separate future PRD)
- No profile photo cropping UI — the client-side resize handles aspect ratio by scaling to fit within 256px
- No profile photo removal — once set, it can be changed but not cleared back to the letter avatar
- No Firestore document for profile data — using Firebase Auth `photoURL` only
- No server-side image processing (Cloud Functions) — client-side resize is sufficient
- No avatar editing from the desktop header — changes happen in Settings only

## Design Considerations

- **Mobile avatar tap target:** The existing 48px avatar circle in MobileSettings is the tap target. Add a subtle semi-transparent overlay with a small camera icon (CSS pseudo-element or small SVG) that appears on the avatar to indicate editability. Only show for non-guest users.
- **Loading state:** While uploading, show a spinner or pulsing opacity animation on the avatar circle. Keep it subtle — the upload should be fast after client-side resize.
- **Desktop header avatar:** Small circle (~32px) positioned to the left of the username text. Use the same color/letter-initial pattern as mobile. Keep the header layout tight — avatar should not push other elements out of alignment.
- **Image sizing:** The 256px max dimension is chosen because the largest the avatar ever displays is 48px on mobile — 256px is plenty for retina displays while keeping file sizes under ~50KB.

## Technical Considerations

- **Firebase Storage** is already initialized (`src/services/firebase.js` exports `storage`). The existing `imageStorage.js` has `uploadBytes` and `getDownloadURL` patterns to follow.
- **Firebase Auth `updateProfile`:** Import from `firebase/auth`. Call `updateProfile(auth.currentUser, { photoURL: downloadUrl })` after upload. The `onAuthStateChanged` listener in `AuthContext` should pick up the new `photoURL` on the user object, but may need a manual state update since `updateProfile` doesn't trigger `onAuthStateChanged`. Consider calling `setUser({...auth.currentUser})` or `auth.currentUser.reload()` after the update.
- **Client-side image resize:** Use a `<canvas>` element to draw the image at max 256px and export as JPEG (quality 0.8) or PNG. This is a pure browser API — no library needed. Create a utility function (e.g., `resizeImage(file, maxDimension)`) that returns a `Blob`.
- **Hidden file input pattern:** Standard React pattern — render a hidden `<input type="file">` and call `.click()` on it when the avatar is tapped. Use a `useRef` to reference the input.
- **Auth state refresh:** After `updateProfile`, the `user` object in memory is stale. Either manually trigger a re-render by spreading the current user into state, or call `auth.currentUser.reload()` then update state. Test this carefully — if the avatar doesn't update after upload, this is why.

## Definition of Done

Implementation is complete when:

1. Authenticated users can tap their avatar in MobileSettings and select a photo from camera or photo library
2. The selected image is resized client-side (max 256px) and uploaded to Firebase Storage
3. Firebase Auth `photoURL` is updated so the photo persists across sessions and devices
4. The MobileSettings avatar immediately shows the new photo after upload
5. The desktop header shows a small avatar circle with the profile photo (or letter fallback)
6. Guest users see the letter avatar with no edit capability
7. Upload errors are shown to the user
8. Works in both light and dark mode
9. Lint passes with no new warnings

## Credential & Service Access Plan

No external credentials required for this PRD. Firebase Storage and Auth are already configured and in use.

## Success Metrics

- Authenticated users can set a profile photo in under 3 taps (tap avatar → pick photo → done)
- Profile photo displays correctly in both mobile settings and desktop header
- Upload completes quickly (~1-2s) due to client-side resize
- Photo persists across sessions and devices via Firebase Auth `photoURL`

## Open Questions

- None — all decisions resolved during planning.
