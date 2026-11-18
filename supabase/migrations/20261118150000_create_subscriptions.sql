-- Gather Pro subscriptions, one row per store subscription.
--
-- This lives in its own table rather than on profiles because profiles_update_own
-- lets a user update their whole profile row, which would let them grant
-- themselves Pro. Here users can only read their own rows; every write comes
-- from an edge function using the service role, after checking with the store.

CREATE TABLE subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- NULL until the purchase is tied to an account, e.g. a subscription bought
  -- from the App Store page before the buyer ever signed in to Gather.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('apple', 'stripe')),
  -- Apple: originalTransactionId. Stripe: subscription id.
  external_id text NOT NULL,
  product_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'grace_period', 'billing_retry', 'expired', 'revoked')),
  expires_at timestamptz,
  revoked_at timestamptz,
  auto_renew boolean,
  ownership_type text,
  environment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, external_id)
);

CREATE INDEX subscriptions_user_id_idx ON subscriptions (user_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- The single definition of "has Gather Pro". Access runs until expires_at
-- (which already includes any billing grace period) unless Apple revoked it.
CREATE FUNCTION is_pro(target_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = target_user
      AND revoked_at IS NULL
      AND expires_at > now()
  );
$$;

-- Server-side only for now, so one user can't probe another's status.
REVOKE EXECUTE ON FUNCTION is_pro(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION is_pro(uuid) TO service_role;
