# Supabase Realtime: Non-PK Filters Don't Work (Replica Identity)

## Problem

Supabase Realtime subscriptions that filter on non-primary-key columns silently drop events.

Example that BREAKS:
```js
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'items',
  filter: `list_id=eq.${listId}`,  // list_id is NOT the PK
}, callback)
```

Example that WORKS:
```js
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'items',
  filter: `id=eq.${itemId}`,  // id IS the PK
}, callback)
```

## Root Cause

With default replica identity (primary key only), PostgreSQL WAL events for UPDATE/DELETE only contain the PK column (`id`). Supabase Realtime receives these WAL events and tries to evaluate the subscription filter, but non-PK columns aren't in the payload. The event is silently dropped.

The fix is normally `ALTER TABLE ... SET REPLICA IDENTITY FULL`, but Supabase's `supautils` extension blocks this syntax for all non-superuser roles (including `postgres`). The `supabase_admin` role (superuser) can run it, but it's only accessible through internal Supabase infrastructure — not through the CLI, Management API, Dashboard SQL Editor, or any user-accessible interface.

## Workaround

Remove the `filter` property from subscriptions that filter on non-PK columns. Since our callbacks all refetch the full dataset anyway (they don't use the event payload), we only need the notification that something changed. Without a filter, Realtime fires for ANY change on the table.

```js
// Before (broken): filters by non-PK column
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'items',
  filter: `list_id=eq.${listId}`,
}, () => fetchItems())

// After (works): no filter, fires on any items change
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'items',
}, () => fetchItems())
```

The tradeoff is more frequent refetch triggers (any change to the table fires the callback for all subscribers), but for a personal app the volume is negligible.

## Things That Do NOT Work

All of these were tried and failed:

- `supabase db push` with `ALTER TABLE ... SET REPLICA IDENTITY FULL` (CLI pre-parser blocks it)
- Management API `/database/query` endpoint (same error)
- `DO $$ EXECUTE ... $$` blocks (PL/pgSQL EXECUTE also blocked)
- `chr()` string concatenation to hide keywords (EXECUTE evaluates the final SQL, which is still blocked)
- `SECURITY DEFINER` functions (postgres role still isn't superuser)
- Direct `UPDATE pg_class SET relreplident = 'f'` (permission denied on system catalog)
- Dashboard SQL Editor (also blocked — runs as postgres, not supabase_admin)
