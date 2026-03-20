# PRD: iOS Push Notifications for Shared Lists

## Introduction

Add opt-in push notifications to the native iOS app for shared lists. Users can enable notifications per shared list and choose which event types they want to be notified about. When a collaborator makes a change (adds an item, checks off an item, changes an RSVP status, or is added as a collaborator), a push notification is sent to all other list members who have opted in for that event type.

This is iOS-only (APNs) for v1. Web push can be added in a future PRD.

## Goals

- Let users opt in to push notifications on a per-list, per-event-type basis
- Notify users in real-time when collaborators make changes to shared lists
- Keep notifications relevant and non-noisy by defaulting to off
- Build the full pipeline: APNs registration → device token storage → event detection → notification dispatch
- Support four notifiable events: item added, item checked off, RSVP changed, collaborator joined

## User Stories

### US-001: Database tables for device tokens and notification preferences

**Description:** As a developer, I need database tables to store APNs device tokens and per-list notification preferences so the notification pipeline has the data it needs.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `device_tokens` table with columns: `id` (uuid PK), `user_id` (uuid FK → auth.users), `token` (text, unique), `platform` (text, default 'ios'), `created_at` (timestamptz), `updated_at` (timestamptz)
- [ ] Create `list_notification_preferences` table with columns: `id` (uuid PK), `user_id` (uuid FK → auth.users), `list_id` (uuid FK → lists ON DELETE CASCADE), `item_added` (boolean default false), `item_checked` (boolean default false), `rsvp_changed` (boolean default false), `collaborator_joined` (boolean default false), `created_at` (timestamptz), `updated_at` (timestamptz)
- [ ] Add UNIQUE constraint on `(user_id, list_id)` for notification preferences
- [ ] Add UNIQUE constraint on `(user_id, token)` for device tokens
- [ ] RLS: users can only read/write their own device tokens
- [ ] RLS: users can only read/write notification preferences for lists they own or are shared on
- [ ] Migration runs successfully

### US-002: iOS — APNs registration and device token storage

**Description:** As a user, I want the app to request notification permission and register my device so I can receive push notifications.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add `aps-environment` entitlement to `GatherLists.entitlements`
- [ ] Add Push Notifications capability to the Xcode project
- [ ] Create `AppDelegate` adaptor in `GatherListsApp.swift` for APNs delegate methods
- [ ] Implement `didRegisterForRemoteNotificationsWithDeviceToken` to send token to Supabase `device_tokens` table
- [ ] Implement `didFailToRegisterForRemoteNotificationsWithError` with graceful error handling
- [ ] Create `NotificationService` that handles permission request via `UNUserNotificationCenter`, token upsert to database, and token cleanup on sign-out
- [ ] Notification permission is requested only when the user first enables notifications on a list (not on app launch)
- [ ] Device token is refreshed on each app launch if permission was previously granted
- [ ] Build succeeds

### US-003: iOS — Per-list notification preferences UI

**Description:** As a user, I want to configure which notifications I receive for each shared list, so I only get alerts I care about.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add a bell icon button to the list detail view navigation bar (only visible for shared lists)
- [ ] Tapping the bell opens a `ListNotificationSheet` with toggles for each event type
- [ ] Toggle labels: "Item Added", "Item Checked Off", "RSVP Changed" (only shown for Guest List type), "Collaborator Joined"
- [ ] Toggles read from and write to the `list_notification_preferences` table
- [ ] If notification permission has not been granted, enabling the first toggle triggers the system permission prompt
- [ ] If the user denies permission, show an inline message explaining how to enable in iOS Settings
- [ ] Bell icon shows a filled state when any notification is enabled for that list
- [ ] Preferences are persisted per user per list
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-004: Supabase Edge Function for sending push notifications via APNs

**Description:** As a developer, I need an edge function that receives webhook payloads, determines who to notify, and sends push notifications via APNs.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Apple`, `APNs auth key (.p8)`, `timing: upfront`)

**Acceptance Criteria:**

- [ ] Create `supabase/functions/send-notification/index.ts` edge function
- [ ] Function accepts POST requests with the Supabase webhook payload format (`{ type, table, record, old_record, schema }`)
- [ ] Authenticates incoming requests via a shared webhook secret header
- [ ] Determines the event type from the payload (item inserted → "item_added", item checked → "item_checked", RSVP updated → "rsvp_changed", list_shares inserted → "collaborator_joined")
- [ ] Queries `list_notification_preferences` to find users who have opted in for this event type on this list
- [ ] Excludes the user who made the change (no self-notifications)
- [ ] Queries `device_tokens` for each recipient user
- [ ] Sends push notification via APNs HTTP/2 API using a `.p8` auth key
- [ ] Notification payload includes: alert title (list name), alert body (e.g. "Sarah added Milk"), badge count, list ID for deep link
- [ ] Handles APNs error responses (invalid token → delete from `device_tokens`, etc.)
- [ ] Returns 200 on success, appropriate error codes on failure
- [ ] Secrets required: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (base64-encoded .p8), `APNS_BUNDLE_ID`, `WEBHOOK_SECRET`

### US-005: Database webhooks for notifiable events

**Description:** As a developer, I need database webhooks that fire when notifiable events occur on shared lists and call the send-notification edge function.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Enable `pg_net` extension via migration (`CREATE EXTENSION IF NOT EXISTS pg_net`)
- [ ] Create a trigger function `notify_on_item_insert()` on the `items` table (AFTER INSERT) that calls the send-notification edge function via `net.http_request()` for items belonging to shared lists
- [ ] Create a trigger function `notify_on_item_check()` on the `items` table (AFTER UPDATE OF `is_checked`) that calls the send-notification edge function when an item is checked off on a shared list
- [ ] Create a trigger function `notify_on_rsvp_change()` on the `items` table (AFTER UPDATE OF `rsvp_status`) that calls the send-notification edge function for guest list items
- [ ] Create a trigger function `notify_on_collaborator_join()` on the `list_shares` table (AFTER INSERT) that calls the send-notification edge function
- [ ] Each trigger includes the list_id, event type, acting user_id, and relevant record data in the HTTP payload
- [ ] Triggers only fire for lists that have at least one notification preference row (early exit to avoid unnecessary HTTP calls)
- [ ] Migration runs successfully

### US-006: iOS — Handle incoming notifications and deep linking

**Description:** As a user, I want to tap a notification and be taken directly to the relevant list in the app.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Implement `UNUserNotificationCenterDelegate` to handle foreground and background notification taps
- [ ] Tapping a notification navigates to the relevant list detail view using the list ID from the notification payload
- [ ] Foreground notifications display as a banner (not silently suppressed)
- [ ] App badge count is updated based on unread notification count
- [ ] If the app is not running, cold launch from notification opens directly to the correct list
- [ ] Works in both light and dark mode
- [ ] Build succeeds

### US-007: Notification preference cleanup on unshare

**Description:** As a developer, I need notification preferences to be cleaned up automatically when a list is unshared or deleted, so we don't have orphaned preference rows.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] When a `list_shares` row is deleted, the corresponding `list_notification_preferences` row for that user+list is also deleted (via ON DELETE CASCADE or trigger)
- [ ] When a list is deleted, all associated `list_notification_preferences` rows are deleted (ON DELETE CASCADE from FK)
- [ ] No orphaned notification preference rows remain after unsharing
- [ ] Migration runs successfully

## Functional Requirements

- FR-1: Device tokens are stored in a `device_tokens` table and associated with the authenticated user
- FR-2: Notification preferences are stored per user per list in `list_notification_preferences` with boolean columns for each event type
- FR-3: The iOS app registers for APNs and stores the device token in Supabase on permission grant
- FR-4: Notification permission is requested lazily — only when the user first enables notifications on a list, not on app launch
- FR-5: Database triggers detect notifiable events (item insert, item check, RSVP change, collaborator join) and POST to the send-notification edge function
- FR-6: The edge function resolves which users should be notified based on their preferences, excludes the acting user, and sends via APNs
- FR-7: Push notifications include the list name, a human-readable description of the event, and the list ID for deep linking
- FR-8: Tapping a notification navigates to the relevant list
- FR-9: Notification preferences are cleaned up when sharing is revoked or a list is deleted
- FR-10: The "RSVP Changed" toggle only appears for Guest List type lists

## Non-Goals

- No web push notifications (future PRD)
- No in-app notification center or notification history/feed
- No notification batching or digest (each event sends immediately)
- No notification for item deletion, item edits (name/qty/price), list metadata changes, or checked items cleared
- No notification sounds customization
- No per-item or per-category notification granularity
- No Android support

## Design Considerations

- **Bell icon placement:** In the list detail navigation bar, trailing position. Use `bell` / `bell.fill` SF Symbols — outlined when no notifications enabled, filled when any are enabled
- **Notification sheet:** Simple list of toggles, one per event type. Compact, no frills. "RSVP Changed" row conditionally shown only for Guest List type
- **Permission prompt:** If the user hasn't granted notification permission yet and enables a toggle, trigger the system permission dialog. If denied, show a small inline message with instructions to enable in iOS Settings
- **Notification content format:**
  - Item added: `"[Display Name] added [Item Name] to [List Name]"`
  - Item checked: `"[Display Name] checked off [Item Name]"`
  - RSVP changed: `"[Guest Name] changed RSVP to [Status] on [List Name]"`
  - Collaborator joined: `"[Display Name] joined [List Name]"`

## Technical Considerations

- **APNs HTTP/2 API:** The edge function must use the token-based (`.p8` key) authentication method, not certificate-based. This requires generating a JWT signed with the private key for each APNs request
- **APNs environments:** Use `api.sandbox.push.apple.com` for development and `api.push.apple.com` for production. The edge function should select based on an environment variable
- **pg_net extension:** Must be enabled for database-level HTTP requests. Available by default on hosted Supabase but needs explicit `CREATE EXTENSION` in migration
- **Webhook secret:** The send-notification function must validate a shared secret header to prevent unauthorized calls
- **Self-notification prevention:** The trigger payload must include the acting user's ID so the edge function can exclude them from recipients
- **Token invalidation:** When APNs returns a 410 (gone) or invalid token error, the edge function should delete that token from `device_tokens`
- **Trigger efficiency:** Each trigger should check if `list_notification_preferences` has any rows for the affected list before making the HTTP call, to avoid unnecessary edge function invocations on lists where nobody has notifications enabled
- **Existing trigger coexistence:** The `items` table already has `items_insert_count`, `items_delete_count`, and `items_check_count` triggers. New notification triggers must coexist without conflicting
- **No Supabase client in edge function currently:** The existing edge functions are pure API proxies. This function will need to import `@supabase/supabase-js` and use the service role key to query preferences and device tokens

## Success Metrics

- Users can enable/disable notifications per shared list in under 3 taps
- Notifications arrive within a few seconds of the triggering event
- No self-notifications — users never receive notifications about their own actions
- Zero orphaned preference rows after unsharing

## Open Questions

- Should there be a rate limit or cooldown to prevent notification spam when someone bulk-adds many items? (Could address in a fast-follow)
- Should the app badge count be managed server-side or client-side? (Recommend client-side for v1 simplicity)

## Credential & Service Access Plan

| Service | Credential Type | Needed For | Request Timing | Fallback if Not Available |
|---------|-----------------|------------|----------------|---------------------------|
| Apple APNs | Auth key (.p8 file) + Key ID + Team ID | US-004 (edge function) | upfront | Can build everything else (DB, UI, triggers) but cannot test actual push delivery without the key |

**How to obtain:**
1. Go to Apple Developer → Certificates, Identifiers & Profiles → Keys
2. Create a new key with "Apple Push Notifications service (APNs)" enabled
3. Download the `.p8` file (only downloadable once)
4. Note the Key ID and your Team ID
5. Base64-encode the `.p8` file contents and set as `APNS_PRIVATE_KEY` Supabase secret

## Definition of Done

Implementation is complete when:

- `device_tokens` and `list_notification_preferences` tables exist with proper RLS
- The iOS app requests notification permission lazily and stores the device token in Supabase
- A bell icon on shared list detail views opens a per-list notification preferences sheet
- Database triggers fire on item insert, item check, RSVP change, and collaborator join
- The `send-notification` edge function receives webhook payloads, resolves recipients, and sends via APNs
- Push notifications arrive on the user's iOS device with the correct content
- Tapping a notification deep links to the relevant list
- The acting user does not receive notifications about their own changes
- Notification preferences are cleaned up on unshare/list deletion
- The "RSVP Changed" toggle only appears for Guest List type lists
- Build succeeds
