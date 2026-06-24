-- List-scoped, shared item-suggestion history.
--
-- Previously `history` was keyed only by user_id with the `history_all_own`
-- policy, so item suggestions showed only the current user's items and spanned
-- ALL lists. This:
--   1. Adds `list_id` (scope suggestions to one list) and `image_url` (so a
--      picked suggestion can carry the item's image).
--   2. Backfills list-scoped rows from existing items so suggestions aren't
--      empty right after migrating.
--   3. Replaces the per-user policy with list-access-based policies (mirroring
--      the `items` table) so suggestions include items added by ANY
--      collaborator on a shared list.

ALTER TABLE history ADD COLUMN IF NOT EXISTS list_id uuid REFERENCES lists(id) ON DELETE CASCADE;
ALTER TABLE history ADD COLUMN IF NOT EXISTS image_url text;

CREATE INDEX IF NOT EXISTS idx_history_list_id ON history(list_id);

-- Backfill from items that still exist. One history row per top-level item,
-- carrying its current image and attributing it to its creator (falling back
-- to the list owner for historical rows without created_by). Sub-items
-- (parent_item_id IS NOT NULL) are excluded so they don't become suggestions.
INSERT INTO history (user_id, list_id, name, image_url, added_at)
SELECT COALESCE(i.created_by, l.owner_id), i.list_id, i.name, i.image_url, i.added_at
FROM items i
JOIN lists l ON l.id = i.list_id
WHERE i.parent_item_id IS NULL;

-- Swap the per-user policy for list-access-based ones. The existing
-- is_list_owner / is_list_shared_with_me SECURITY DEFINER helpers avoid the
-- RLS recursion that nested list/list_shares subqueries would cause.
DROP POLICY IF EXISTS "history_all_own" ON history;

-- Read: legacy rows (no list_id) stay private to their author; list-scoped
-- rows are visible to anyone who owns or is shared the list.
CREATE POLICY "history_select" ON history
  FOR SELECT USING (
    (list_id IS NULL AND user_id = auth.uid())
    OR is_list_owner(list_id)
    OR is_list_shared_with_me(list_id)
  );

-- Insert: the author records their own entry; list-scoped rows require access
-- to the list.
CREATE POLICY "history_insert" ON history
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (
      list_id IS NULL
      OR is_list_owner(list_id)
      OR is_list_shared_with_me(list_id)
    )
  );

-- Update: any collaborator on the list may refresh metadata (e.g. image_url
-- when an item's image is set); legacy rows remain editable only by their author.
CREATE POLICY "history_update" ON history
  FOR UPDATE USING (
    (list_id IS NULL AND user_id = auth.uid())
    OR is_list_owner(list_id)
    OR is_list_shared_with_me(list_id)
  );

-- Delete: the author or the list owner.
CREATE POLICY "history_delete" ON history
  FOR DELETE USING (
    user_id = auth.uid()
    OR is_list_owner(list_id)
  );
