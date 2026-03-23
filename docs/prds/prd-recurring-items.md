# PRD: Recurring Items & Reminders

## Introduction

Add recurrence rules, due dates, and reminder notifications to items on task-like list types (Project, To-Do, Basic). Users can set an item to repeat on a schedule (daily, weekly, every 2nd Tuesday, etc.), assign a due date, and opt into a "remind me N days before" notification. When a recurring item is checked off, a new unchecked copy is automatically created with the next due date, and the completed instance stays in a visible completion history.

This builds on the existing multi-type list system and the iOS push notification infrastructure (prd-ios-notifications).

## Goals

- Let users assign due dates to items on Project, To-Do, and Basic lists
- Support full calendar-style recurrence rules (daily, weekly, biweekly, monthly, custom day-of-week patterns, etc.)
- Automatically generate the next occurrence when a recurring item is checked off
- Maintain a completion history for recurring items so users can see past instances
- Show a subtle overdue indicator (date text turns red/orange) for past-due items
- Add "Due Date" as an optional sort level in the sort pipeline
- Support a per-item "remind me N days before" setting that sends an iOS push notification
- Introduce a scheduled/cron mechanism for time-based reminder delivery

## User Stories

### US-001: Database migration — add recurrence and due date columns to items

**Description:** As a developer, I need new columns on the `items` table to store due dates, recurrence rules, reminder preferences, completion timestamps, and lineage tracking so the recurrence feature has the data it needs.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add `due_date` column (date, nullable) to `items` table
- [ ] Add `recurrence_rule` column (jsonb, nullable) to `items` table — stores a structured recurrence object (see Technical Considerations for schema)
- [ ] Add `reminder_days_before` column (integer, nullable) to `items` table — number of days before due date to send a reminder
- [ ] Add `checked_at` column (timestamptz, nullable) to `items` table — populated when `is_checked` is set to true
- [ ] Add `parent_item_id` column (uuid, nullable, FK → items ON DELETE SET NULL) to `items` table — links a new recurrence instance to its predecessor
- [ ] Add index on `due_date` for efficient sorting and querying
- [ ] Add index on `(parent_item_id)` for completion history lookups
- [ ] Existing items remain unaffected (all new columns nullable with no defaults except null)
- [ ] RLS policies continue to work correctly (new columns inherit existing row-level access)
- [ ] Migration runs successfully

### US-002: Recurrence rule engine — next occurrence calculation

**Description:** As a developer, I need a shared utility that computes the next due date from a recurrence rule so both platforms can display upcoming dates and the backend can generate new instances.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Create `src/utils/recurrence.js` with a `getNextOccurrence(rule, fromDate)` function
- [ ] Create `ios-native/.../Utils/RecurrenceEngine.swift` with equivalent logic
- [ ] Support recurrence types: `daily`, `weekly`, `biweekly`, `monthly`, `yearly`, `custom`
- [ ] `custom` type supports: interval (every N), frequency (day/week/month/year), and optional `daysOfWeek` array (e.g. every 2nd Tuesday = `{ type: "custom", frequency: "week", interval: 2, daysOfWeek: [2] }`)
- [ ] Handle edge cases: month-end dates (Jan 31 → Feb 28), leap years
- [ ] Return null if the rule is null or invalid
- [ ] Both implementations produce identical results for the same inputs

### US-003: Auto-generate next occurrence on check-off

**Description:** As a user, I want checking off a recurring item to automatically create a new unchecked copy with the next due date, so I don't have to manually re-create repeating tasks.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] When an item with a `recurrence_rule` is checked off (`is_checked` → true), create a new item in the same list with:
  - Same `name`, `category`, `recurrence_rule`, `reminder_days_before`
  - `due_date` set to the next occurrence (computed from the checked item's `due_date`)
  - `is_checked` = false
  - `parent_item_id` = the checked item's `id`
  - `checked_at` = null
- [ ] The checked item gets `checked_at` set to the current timestamp
- [ ] Implement this as a Postgres trigger function (`AFTER UPDATE OF is_checked ON items`) that fires when `is_checked` changes from false to true AND `recurrence_rule` is not null
- [ ] The new item appears in the list immediately via existing realtime subscriptions
- [ ] If a recurring item is unchecked (undo), do NOT delete the already-created next occurrence (both coexist)
- [ ] Non-recurring items are unaffected (trigger checks for `recurrence_rule IS NOT NULL`)
- [ ] Migration with trigger runs successfully

### US-004: Completion history view

**Description:** As a user, I want to see the history of completed instances for a recurring item, so I can track how consistently I've been completing it.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] React: Add a "History" button or link on items that have a `parent_item_id` or have children with `parent_item_id` pointing to them
- [ ] Swift: Same affordance in the item context menu or edit sheet
- [ ] Tapping "History" shows a compact list of completed instances: item name, `due_date`, `checked_at`
- [ ] History is fetched by traversing the `parent_item_id` chain (query all items in the same list with matching name and linked via `parent_item_id`)
- [ ] Most recent completions shown first
- [ ] React: Render as a small expandable section or bottom sheet
- [ ] Swift: Render as a sheet or inline disclosure
- [ ] Works in both light and dark mode
- [ ] Build succeeds (both platforms)

### US-005: Due date field in edit item forms

**Description:** As a user, I want to set a due date on an item so I can track when it needs to be done.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add `dueDate` to `ListTypeFields` for `project`, `todo`, and `basic` list types (both React and Swift)
- [ ] React (`ShoppingItem.jsx` edit panel): Add a date picker field for due date, shown only for list types that support it
- [ ] Swift (`EditItemSheet.swift`): Add a `DatePicker` for due date, shown only for list types that support it
- [ ] Due date is nullable — users can set it or leave it blank
- [ ] Due date is saved to the `due_date` column on the `items` table
- [ ] Clearing the date picker removes the due date (sets to null)
- [ ] Works in both light and dark mode
- [ ] Build succeeds (both platforms)

### US-006: Recurrence rule field in edit item forms

**Description:** As a user, I want to set a repeat schedule on an item so it automatically recurs on my chosen cadence.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add `recurrence` to `ListTypeFields` for `project`, `todo`, and `basic` list types (both React and Swift)
- [ ] React: Add a recurrence picker below the due date field in the edit panel — shown only when a due date is set
- [ ] Swift: Add a recurrence picker below the date picker in `EditItemSheet` — shown only when a due date is set
- [ ] Recurrence picker offers preset options: None, Daily, Weekly, Biweekly, Monthly, Yearly, Custom
- [ ] Selecting "Custom" reveals additional inputs: interval number, frequency (day/week/month/year), and day-of-week checkboxes (for weekly/biweekly frequency)
- [ ] Recurrence rule is stored as JSONB in the `recurrence_rule` column
- [ ] Setting recurrence to "None" or clearing it sets `recurrence_rule` to null
- [ ] Recurrence picker is disabled/hidden when no due date is set
- [ ] Works in both light and dark mode
- [ ] Build succeeds (both platforms)

### US-007: Reminder setting field in edit item forms

**Description:** As a user, I want to set a "remind me N days before" preference on an item so I get notified before it's due.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add `reminder` to `ListTypeFields` for `project`, `todo`, and `basic` list types (both React and Swift)
- [ ] React: Add a reminder picker below recurrence in the edit panel — shown only when a due date is set
- [ ] Swift: Add a reminder picker below recurrence in `EditItemSheet` — shown only when a due date is set
- [ ] Reminder options: None, Same day, 1 day before, 2 days before, 3 days before, 1 week before
- [ ] Selected value is stored as an integer in `reminder_days_before` (0 = same day, 1 = 1 day before, etc., null = no reminder)
- [ ] Reminder picker is disabled/hidden when no due date is set
- [ ] Works in both light and dark mode
- [ ] Build succeeds (both platforms)

### US-008: Due date display on item rows

**Description:** As a user, I want to see the due date on items that have one, so I can quickly assess what's coming up without opening the edit form.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] React (`ShoppingItem.jsx`): Display due date as a small label below or beside the item name (e.g. "Due Mar 25") — only on items with a non-null `due_date`
- [ ] Swift (item row view): Display due date as a compact label — only on items with a non-null `due_date`
- [ ] If the item has a recurrence rule, show a small repeat icon (↻) next to the due date
- [ ] Date format: abbreviated month + day (e.g. "Mar 25"), omit year if same as current year
- [ ] Due date label does not appear on list types that don't support `dueDate`
- [ ] Works in both light and dark mode
- [ ] Build succeeds (both platforms)

### US-009: Overdue visual indicator

**Description:** As a user, I want items that are past due to stand out subtly so I notice them without the UI feeling alarming.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] React: When an unchecked item's `due_date` is in the past, the due date label text turns red/orange (use existing error/warning color from the design system)
- [ ] Swift: Same treatment — overdue date label text turns `.red` or `.orange`
- [ ] Overdue styling applies ONLY to unchecked items (checked items are completed, not overdue)
- [ ] Items due today are NOT styled as overdue — only strictly past dates
- [ ] The treatment is subtle — text color change only, no background color, no badges, no pulsing
- [ ] Works in both light and dark mode
- [ ] Build succeeds (both platforms)

### US-010: Due Date sort level in the sort pipeline

**Description:** As a user, I want to sort my list by due date so I can see what's most urgent at the top.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] Add `dueDate` as a new sort level in `SORT_LEVELS` (React `sortPipeline.js`) and `SortLevel` enum (Swift `SortPipeline.swift`)
- [ ] `dueDate` is a sort-only level (not a grouping level) — items are sorted ascending (soonest first), with null due dates sorted to the bottom
- [ ] `dueDate` sort level is available only for list types that support the `dueDate` field (project, todo, basic)
- [ ] Add `dueDate` to the `sortLevels` array for project, todo, and basic in `listTypes.js` (React) and `ListTypeConfig.swift` (Swift)
- [ ] React `SortLevelEditor.jsx`: Show "Due Date" as a selectable option for eligible list types
- [ ] Swift `SortConfigSheet.swift`: Show "Due Date" as a selectable option for eligible list types
- [ ] Existing sort preferences are not affected — `dueDate` is an opt-in addition
- [ ] Build succeeds (both platforms)

### US-011: Reminder notification cron job

**Description:** As a developer, I need a scheduled function that checks for items with upcoming due dates and sends reminder push notifications to the item owner.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** required (`Apple`, `APNs auth key (.p8)`, `timing: upfront` — same key as prd-ios-notifications)

**Acceptance Criteria:**

- [ ] Create a Supabase Edge Function `check-reminders/index.ts` that:
  - Queries `items` where `reminder_days_before IS NOT NULL` and `due_date - reminder_days_before <= today` and `is_checked = false` and no reminder has been sent yet for this item
  - For each matching item, sends a push notification to the item's list owner(s) via APNs (reuse the APNs sending logic from `send-notification`)
  - Notification content: "Reminder: [Item Name] is due [in N days / today / tomorrow] on [List Name]"
- [ ] Add a `reminder_sent_at` column (timestamptz, nullable) to `items` to track that the reminder was sent (prevents duplicate reminders)
- [ ] The cron job only sends one reminder per item per due-date cycle (reset when a new recurrence instance is created)
- [ ] Schedule the function to run daily (e.g. via Supabase pg_cron or an external cron trigger)
- [ ] Include migration for `reminder_sent_at` column
- [ ] Handle edge cases: item checked off before reminder fires (skip), item deleted (skip), list no longer shared (still send to owner)
- [ ] Log reminder sends for debugging
- [ ] Migration runs successfully

### US-012: Reset reminder on new recurrence instance

**Description:** As a developer, I need the reminder state to reset when a new recurrence instance is created, so the user gets a fresh reminder for each occurrence.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] When US-003's trigger creates a new recurrence instance, the new item has `reminder_sent_at = NULL`
- [ ] The checked-off parent item retains its `reminder_sent_at` value (historical record)
- [ ] The cron job (US-011) correctly picks up the new instance for future reminders
- [ ] Migration runs successfully (if any additional changes needed beyond US-011)

### US-013: Item model updates (React and Swift)

**Description:** As a developer, I need the Item data models on both platforms to include the new fields so the UI can read and write them.

**Documentation:** No

**Tools:** No

**Considerations:** none

**Credentials:** none

**Acceptance Criteria:**

- [ ] React: Update item-related service/context code to include `due_date`, `recurrence_rule`, `reminder_days_before`, `checked_at`, `parent_item_id`, `reminder_sent_at` in queries, inserts, and updates
- [ ] Swift (`Item.swift`): Add `dueDate` (Date?), `recurrenceRule` (RecurrenceRule?), `reminderDaysBefore` (Int?), `checkedAt` (Date?), `parentItemId` (UUID?), `reminderSentAt` (Date?) with Codable conformance
- [ ] JSONB `recurrence_rule` is decoded to a `RecurrenceRule` struct (Swift) or parsed as an object (React)
- [ ] Null handling: all new fields are optional and default to nil/null
- [ ] Build succeeds (both platforms)

## Functional Requirements

- FR-1: Items on Project, To-Do, and Basic lists can have a due date, recurrence rule, and reminder preference
- FR-2: Grocery, Guest List, and Packing list types do NOT support recurrence fields
- FR-3: The recurrence rule supports: daily, weekly, biweekly, monthly, yearly, and custom (every N days/weeks/months/years with optional day-of-week selection)
- FR-4: Checking off a recurring item immediately creates a new unchecked copy with the next due date, linked via `parent_item_id`
- FR-5: The checked item's `checked_at` is set to the current timestamp
- FR-6: Unchecking a recurring item does NOT delete the already-created next instance
- FR-7: Users can view completion history for recurring items by traversing the parent-child chain
- FR-8: Due dates are displayed on item rows with abbreviated date format
- FR-9: Overdue unchecked items show the due date in red/orange text
- FR-10: "Due Date" is available as an optional sort level for project, todo, and basic lists
- FR-11: A daily cron job checks for items with reminders due and sends iOS push notifications
- FR-12: Each item receives at most one reminder per due-date cycle
- FR-13: Recurrence, reminder, and due date fields are only shown in edit forms when the list type supports them
- FR-14: The recurrence picker requires a due date to be set first

## Non-Goals

- No web push reminders (iOS only for v1, consistent with prd-ios-notifications scope)
- No recurring lists (only individual items recur)
- No recurrence on Grocery, Guest List, or Packing list types
- No "snooze" functionality for reminders
- No batch editing of recurrence rules across multiple items
- No calendar view or calendar integration
- No sub-task or dependent-task relationships
- No notification for the recurrence itself (only the reminder before due date)
- No Android support

## Design Considerations

- **Due date picker:** Use native date pickers on each platform — HTML `<input type="date">` on React, SwiftUI `DatePicker` on iOS. Keep it simple, no custom calendar widget
- **Recurrence picker layout:** A segmented control or dropdown for presets (None / Daily / Weekly / Biweekly / Monthly / Yearly / Custom). "Custom" expands to reveal interval + frequency + day-of-week inputs
- **Reminder picker:** Simple dropdown or segmented control with fixed options (None / Same day / 1 day / 2 days / 3 days / 1 week)
- **Due date display on rows:** Small, muted text below or beside the item name. Format: "Mar 25" (or "Mar 25, 2027" if not current year). Repeat icon (↻) inline if recurring
- **Overdue treatment:** Date label text turns the app's existing warning/error color. No background change, no borders, no animation
- **Completion history:** A compact list showing date checked and date it was due. No charts or graphs for v1
- **Field visibility:** Due date, recurrence, and reminder fields only appear in edit forms for project/todo/basic. They are controlled by the existing `ListTypeFields` / `ListTypeConfig.fields` system

## Technical Considerations

- **Recurrence rule schema (JSONB):**
  ```json
  {
    "type": "daily" | "weekly" | "biweekly" | "monthly" | "yearly" | "custom",
    "interval": 1,           // every N (used with custom)
    "frequency": "week",     // day | week | month | year (used with custom)
    "daysOfWeek": [1, 3, 5]  // 0=Sun, 1=Mon, ... 6=Sat (optional, used with weekly/custom)
  }
  ```
  For presets: `daily` = `{ type: "daily" }`, `weekly` = `{ type: "weekly" }`, etc. The `interval`, `frequency`, and `daysOfWeek` fields are only used when `type` is `custom`.

- **Trigger for auto-generation (US-003):** Postgres `AFTER UPDATE OF is_checked ON items` trigger. Must check `NEW.is_checked = true AND OLD.is_checked = false AND NEW.recurrence_rule IS NOT NULL`. The trigger inserts the new row directly — no edge function needed since it's a same-table operation.

- **Cron mechanism for reminders (US-011):** Supabase supports `pg_cron` for scheduled SQL execution, or the edge function can be invoked by an external cron (e.g., Vercel cron, GitHub Actions, or Supabase's built-in cron). Recommend using `pg_cron` to invoke the edge function daily at a fixed UTC time (e.g. 08:00 UTC). If `pg_cron` is not available, use Supabase's cron integration via the dashboard.

- **Reminder deduplication:** The `reminder_sent_at` column prevents sending the same reminder twice. The cron query includes `WHERE reminder_sent_at IS NULL` to skip already-reminded items. When US-003's trigger creates a new instance, `reminder_sent_at` is null on the new row.

- **Sort pipeline integration (US-010):** `dueDate` is sort-only (like `name`, `date`, `price`), not a grouping level. Items without a due date sort to the bottom. The existing sort pipeline already handles nullable values gracefully — follow the same pattern.

- **Existing notification infrastructure:** US-011 reuses the APNs sending logic from `send-notification`. Either extract a shared utility or call the existing edge function from the cron job. The same `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, and `APNS_BUNDLE_ID` secrets are used.

- **Existing trigger coexistence:** The `items` table already has `items_insert_count`, `items_delete_count`, and `items_check_count` triggers plus the notification triggers from prd-ios-notifications. The new recurrence trigger must coexist. Use a distinct function name (e.g. `create_next_recurrence()`) and trigger name (e.g. `items_recurrence_on_check`).

- **parent_item_id foreign key:** References `items(id)` with `ON DELETE SET NULL` so deleting a completed instance doesn't cascade-delete the active one. The history chain remains navigable even with gaps.

- **Completion history query:** To get the full history for a recurring item, query:
  ```sql
  SELECT * FROM items
  WHERE list_id = $1
    AND name = $2
    AND is_checked = true
    AND (parent_item_id = $itemId OR id IN (
      SELECT parent_item_id FROM items WHERE id = $itemId
    ))
  ORDER BY checked_at DESC
  ```
  Or traverse the `parent_item_id` chain recursively. The simpler approach is to find all checked items with the same name in the same list.

## Success Metrics

- Users can set a due date and recurrence rule in under 4 taps (mobile) or clicks (web)
- Checking off a recurring item generates the next instance within 1 second (realtime update)
- Reminder notifications arrive on the correct day
- No duplicate reminders for the same item occurrence
- Due date sort correctly orders items soonest-first with nulls at the bottom

## Open Questions

- Should the daily cron run at a specific time per user's timezone, or a single fixed UTC time? (Recommend fixed UTC for v1 simplicity — most users will be in similar timezones)
- Should "Clear checked items" remove completed recurrence history? (Recommend yes for consistency — history is a convenience, not a permanent log)
- If a user changes a recurrence rule on an active item, should already-created future instances be updated? (Recommend no — the change applies from the next check-off)

## Credential & Service Access Plan

| Service | Credential Type | Needed For | Request Timing | Fallback if Not Available |
|---------|-----------------|------------|----------------|---------------------------|
| Apple APNs | Auth key (.p8 file) + Key ID + Team ID | US-011 (reminder cron) | upfront | Same key as prd-ios-notifications. All stories except US-011 can proceed without it. Build/test the cron logic locally without actual APNs delivery. |

No new credentials are required beyond what prd-ios-notifications already uses.

## Definition of Done

Implementation is complete when:

- `items` table has all new columns (`due_date`, `recurrence_rule`, `reminder_days_before`, `checked_at`, `parent_item_id`, `reminder_sent_at`) with proper indexes
- Due date, recurrence, and reminder fields appear in edit forms only for Project, To-Do, and Basic list types (both React and Swift)
- The recurrence picker supports all preset and custom patterns
- Checking off a recurring item creates a new unchecked copy with the next due date via Postgres trigger
- Completion history is viewable for recurring items on both platforms
- Due dates display on item rows with abbreviated date format
- Overdue items show subtle red/orange date text (unchecked only)
- "Due Date" is available as an opt-in sort level for eligible list types
- A daily cron function sends iOS push reminders for items with `reminder_days_before` set
- Each item receives at most one reminder per due-date cycle
- Reminder state resets when a new recurrence instance is created
- Both platforms build successfully
