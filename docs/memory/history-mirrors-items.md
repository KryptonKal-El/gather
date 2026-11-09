# Rule: `history` mirrors the reusable fields of `items`

The `history` table backs item **suggestions / reuse**. It stores a per-list,
collaborator-shared "template" of each item so that re-adding an item from a
suggestion restores its latest state. It must stay a faithful mirror of the
**reusable** columns of `items`.

## The rule (do this whenever you add a reusable column to `items`)

If a new `items` column is something a re-added item should carry (a real
attribute of the item — e.g. `brand`, `barcode`, a new default), you MUST also:

1. **Add the column to `history`** (in a migration).
2. **Add it to the sync trigger** `sync_item_to_history()` — both the `UPDATE ... SET`
   field lists **and** the `AFTER UPDATE OF (...)` column list. See
   `supabase/migrations/20260803120000_mirror_items_to_history.sql`.
3. **Write it on insert:**
   - Web: `historyRow()` in `src/services/database.js`.
   - iOS: `NewHistoryEntry` + `addHistoryEntry` in `Services/HistoryService.swift`.
4. **Read it on reuse:**
   - Web: the template in `getSuggestions` (`src/services/suggestions.js`) +
     `addItemAction` (`src/context/ShoppingListContext.jsx`).
   - iOS: `addItemFromSuggestion` (`ViewModels/ListDetailViewModel.swift`).

## Currently mirrored

`name`, `image_url`, `category`, `store_id`, `quantity`, `price`, `unit`, `note`,
`url`, `priority` (the last two added with the Wish List type,
`20261109120000_add_wish_list_type.sql`, which now holds the latest trigger).

## Deliberately NOT mirrored (transient / structural / identity)

`is_checked`, `checked_at`, `reminder_sent_at`, `parent_item_id`, `created_by`,
`id`, `list_id`, `added_at`, `due_date`, `recurrence_rule`,
`reminder_days_before`, `rsvp_status`. These are occurrence-specific or
per-instance — copying them would break reuse (e.g. a reused item must start
unchecked, not inherit the original's checked state or timestamps).

## How sync works

- **Inserts** are written app-side (the client writes the history row when an
  item is added). The trigger deliberately does **not** insert, so older iOS App
  Store builds — which still call the client-side insert — can't create
  duplicate rows.
- **Edits** are mirrored by a DB trigger (`trg_sync_item_to_history`, UPDATE-only)
  that copies changed fields from `items` onto the matching `(list_id, name)`
  history rows and handles rename via `OLD.name -> NEW.name`. It's server-side,
  so edits from every client (old or new) stay in sync.
