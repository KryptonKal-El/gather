# PRD: Collaborator Edit Access on Shared Lists

## Overview

Collaborators on shared lists currently have very limited edit access — they can manage items but cannot touch list-level settings like categories. The goal is to unlock Edit Categories for collaborators while keeping owner-only controls (Share Settings, Delete List, List Type change, Reset items) locked down. A pre-existing bug where Share Settings appears in the mobile detail-view for collaborators is also fixed here.

## Goals

- Collaborators can edit categories on a shared list.
- Share Settings, Delete List, List Type change, and Reset items remain owner-only.
- Share Settings button no longer appears in the mobile detail-view for collaborators (bug fix).

## Out of Scope

- Adding a role/permission column to `list_shares` (no tiered permissions — sharing is still binary).
- Unlocking List Type change, Reset items, or any other controls not listed above.
- Changes to item-level permissions (already unrestricted for collaborators).

## Locked Decisions

| Question | Decision |
|---|---|
| List Type change for collaborators | Owner-only — too destructive |
| Reset items for collaborators | Owner-only — bulk destructive admin action |
| Edit Categories for collaborators | Unlocked |

---

## User Stories

### S-1 — Unlock Edit Categories for Collaborators (React Web)

**As a** collaborator on a shared list,
**I want** to be able to edit the list's categories,
**so that** I can help keep the list organized without needing the owner to do it for me.

**Acceptance Criteria:**

1. The "Edit Categories" menu item in `ListSelector` is shown for both owners and collaborators (remove the `isOwned` gate on that item only).
2. The "Edit Categories" menu item in any other location that gates it behind `isOwned` is similarly unlocked.
3. The `updateListDetails` action (or equivalent) that persists category changes is already permitted by RLS (`lists_update_own_or_shared`); no backend change is needed.
4. Share Settings, Delete List, List Type change, and Reset items remain gated behind `isOwned` — no other `isOwned` checks are touched.
5. `npm run build` succeeds.

**Flow Chart:**

```
1. src/components/ListSelector.jsx
   ├─ Remove isOwned gate from "Edit Categories" menu item (desktop, line ~388)
   └─ Remove isOwned gate from "Edit Categories" menu item (mobile, line ~479)

2. Any other component gating Edit Categories behind isOwned
   └─ Remove gate (verify via grep)

3. VERIFY QUALITY
   ├─ Run lint
   └─ Run build
```

---

### S-2 — Fix: Share Settings Visible to Collaborators in Mobile Detail View (React Web)

**As a** collaborator,
**I want** the Share Settings button to not appear in my list detail menu,
**so that** the UI is consistent and I'm not shown controls I can't use.

**Acceptance Criteria:**

1. `MobileListDetail.jsx` currently gates Share Settings behind `!isGuest`. `isGuest` is a prop that `App.jsx` never passes, so it always defaults to `false` — making Share Settings always visible.
2. The fix: replace the `!isGuest` gate with `isOwned` (derived from `!list._isShared`, consistent with how `ListSelector.jsx` gates it).
3. Share Settings no longer appears in the `MobileListDetail` 3-dot menu for collaborators.
4. Share Settings continues to appear for owners.
5. `npm run build` succeeds.

**Flow Chart:**

```
1. src/components/MobileListDetail.jsx
   ├─ Derive isOwned: const isOwned = !list._isShared (line ~60)
   ├─ Replace !isGuest gate on Share Settings (desktop, line ~121) with isOwned
   └─ Replace !isGuest gate on Share Settings (mobile, line ~175) with isOwned

2. VERIFY QUALITY
   ├─ Run lint
   └─ Run build
```

---

### S-3 — iOS: Match Collaborator Edit Access

**As an** iOS collaborator,
**I want** the native iOS app to reflect the same permissions as the web app,
**so that** what I can do on iOS is consistent with what I can do on web.

**Acceptance Criteria:**

1. Edit Categories is accessible to collaborators on iOS.
2. Share Settings, Delete List, List Type change, and Reset items remain owner-only on iOS.
3. Share Settings is not shown to collaborators in any iOS list detail view.
4. App builds successfully (`npm run cap:ios` or Xcode build succeeds).

**Flow Chart:**

```
1. iOS list detail / settings view
   ├─ Remove isOwner gate from Edit Categories
   └─ Ensure Share Settings, Delete List, List Type, Reset items remain owner-only

2. iOS share settings visibility check
   └─ Confirm Share Settings is hidden for collaborators in all iOS views

3. VERIFY QUALITY
   └─ Xcode build succeeds
```

---

## Story Order

S-1 and S-2 are independent and can ship together. S-3 can follow after S-1 and S-2 are verified on web.
