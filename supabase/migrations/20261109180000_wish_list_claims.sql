-- Wish List Phase 2: gift claiming + a read-only "viewer" share role.
--
-- * list_shares.role: 'editor' (existing behaviour, default for every current
--   share) or 'viewer' (can read a list and claim wish-list items, but cannot
--   change the list or its items).
-- * item_claims: who is getting what. Visible to the people a list is shared
--   with; hidden from the list owner unless lists.reveal_claims is on. Claims
--   live in their own table so they never touch item rows, item realtime or the
--   item notification triggers (which would otherwise tell the owner).

-- ---------------------------------------------------------------------------
-- Share roles
-- ---------------------------------------------------------------------------
ALTER TABLE list_shares ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'editor';
ALTER TABLE list_shares DROP CONSTRAINT IF EXISTS list_shares_role_check;
ALTER TABLE list_shares ADD CONSTRAINT list_shares_role_check CHECK (role IN ('editor', 'viewer'));

-- Collaborators may update their own share row (sort_config), so stop a viewer
-- from promoting themselves: only the list owner can change a role.
CREATE OR REPLACE FUNCTION guard_list_share_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT is_list_owner(NEW.list_id) THEN
    RAISE EXCEPTION 'Only the list owner can change a share role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_list_share_role ON list_shares;
CREATE TRIGGER trg_guard_list_share_role
BEFORE UPDATE OF role ON list_shares
FOR EACH ROW
EXECUTE FUNCTION guard_list_share_role();

-- True when the current user may change a list and its items: the owner, or
-- someone it is shared with as an editor.
CREATE OR REPLACE FUNCTION can_edit_list(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT is_list_owner(p_list_id) OR EXISTS (
    SELECT 1 FROM list_shares
    WHERE list_id = p_list_id
      AND shared_with_email = auth.jwt() ->> 'email'
      AND role = 'editor'
  );
$$;

-- Reads stay open to every collaborator; writes now need edit rights.
DROP POLICY IF EXISTS "items_insert" ON items;
CREATE POLICY "items_insert" ON items
  FOR INSERT WITH CHECK (can_edit_list(list_id));

DROP POLICY IF EXISTS "items_update" ON items;
CREATE POLICY "items_update" ON items
  FOR UPDATE USING (can_edit_list(list_id));

DROP POLICY IF EXISTS "items_delete" ON items;
CREATE POLICY "items_delete" ON items
  FOR DELETE USING (can_edit_list(list_id));

DROP POLICY IF EXISTS "lists_update_own_or_shared" ON lists;
CREATE POLICY "lists_update_own_or_shared" ON lists
  FOR UPDATE USING (can_edit_list(id));

-- ---------------------------------------------------------------------------
-- Claims
-- ---------------------------------------------------------------------------
ALTER TABLE lists ADD COLUMN IF NOT EXISTS reveal_claims boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS item_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  claimed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, claimed_by)
);

CREATE INDEX IF NOT EXISTS idx_item_claims_list_id ON item_claims(list_id);
CREATE INDEX IF NOT EXISTS idx_item_claims_item_id ON item_claims(item_id);

ALTER TABLE item_claims ENABLE ROW LEVEL SECURITY;

-- Collaborators see every claim on the list (to avoid duplicate gifts). The
-- owner sees nothing unless they turned on reveal_claims for that list.
CREATE POLICY "item_claims_select" ON item_claims
  FOR SELECT USING (
    is_list_shared_with_me(list_id)
    OR (
      is_list_owner(list_id)
      AND EXISTS (SELECT 1 FROM lists WHERE id = item_claims.list_id AND reveal_claims)
    )
  );

-- Only collaborators (never the owner) claim, only for themselves, only on wish lists.
CREATE POLICY "item_claims_insert" ON item_claims
  FOR INSERT WITH CHECK (
    claimed_by = auth.uid()
    AND is_list_shared_with_me(list_id)
    AND NOT is_list_owner(list_id)
    AND EXISTS (SELECT 1 FROM lists WHERE id = item_claims.list_id AND type = 'wish_list')
  );

CREATE POLICY "item_claims_update" ON item_claims
  FOR UPDATE USING (claimed_by = auth.uid() AND is_list_shared_with_me(list_id))
  WITH CHECK (claimed_by = auth.uid());

CREATE POLICY "item_claims_delete" ON item_claims
  FOR DELETE USING (claimed_by = auth.uid() AND is_list_shared_with_me(list_id));

-- Keep list_id consistent with the item, and never let claims exceed the
-- item's quantity.
CREATE OR REPLACE FUNCTION check_item_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item_list uuid;
  v_item_qty integer;
  v_others integer;
BEGIN
  SELECT list_id, COALESCE(quantity, 1) INTO v_item_list, v_item_qty
  FROM items WHERE id = NEW.item_id;

  IF v_item_list IS NULL OR v_item_list <> NEW.list_id THEN
    RAISE EXCEPTION 'Claim list does not match the item';
  END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_others
  FROM item_claims
  WHERE item_id = NEW.item_id AND id <> NEW.id;

  IF v_others + NEW.quantity > v_item_qty THEN
    RAISE EXCEPTION 'Only % left to claim', GREATEST(v_item_qty - v_others, 0);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_item_claim ON item_claims;
CREATE TRIGGER trg_check_item_claim
BEFORE INSERT OR UPDATE ON item_claims
FOR EACH ROW
EXECUTE FUNCTION check_item_claim();

-- Realtime: clients refetch on any change (no non-PK filters; see
-- docs/memory/supabase-realtime-replica-identity.md).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'item_claims'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE item_claims;
  END IF;
END;
$$;
