# Database Service Conventions

Applies to `src/services/database.js` and any future service files in `src/services/`.

## Structure

- Single `database.js` service file for all CRUD operations and subscriptions.
- Group related functions with section divider comments:

```js
// --- Lists ---
// --- Items ---
// --- Stores ---
```

## JSDoc

Every exported function must have JSDoc with `@param` and `@returns`.

```js
/**
 * Creates a new shopping list for the given user.
 * @param {string} userId - The authenticated user's ID.
 * @param {string} name - The name for the new list.
 * @returns {Promise<Object>} The created list record.
 */
export async function createList(userId, name) { … }
```

## Error Handling

- Wrap all Supabase errors. Never throw raw Supabase errors.
- Include context in the message — always include the relevant identifier.
- Use `{ cause: error }` when wrapping.

```js
if (error) throw new Error(`Failed to create list: name=${name}`, { cause: error });
```

## Query Modifiers

- `.maybeSingle()` — when zero results is a valid outcome (returns `null`).
- `.single()` — when exactly one result is required; throws if zero or many rows match.

```js
// Zero rows is acceptable (e.g. finding the max sort_order when the table may be empty):
const { data } = await supabase
  .from('lists')
  .select('sort_order')
  .eq('owner_id', userId)
  .order('sort_order', { ascending: false })
  .limit(1)
  .maybeSingle();

// Exactly one row required (e.g. fetching a list by its primary key):
const { data, error } = await supabase
  .from('lists')
  .select('*')
  .eq('id', listId)
  .single();
```

## RPC Calls

Use `.rpc('function_name', { params })` for business logic operations that belong in the database (e.g. sort-order computation, atomic operations).

## Sort Order

Compute insert sort order client-side as `max(existingOrders) + 1` before the insert call.

## snake_case → camelCase

Map database snake_case column names to camelCase in subscription callbacks and anywhere else response data is surfaced to the UI.

## Subscription Pattern

1. Perform initial fetch.
2. Set up a realtime channel: `supabase.channel(name).on('postgres_changes', filter, handler).subscribe()`.
3. Return an unsubscribe function: `() => supabase.removeChannel(channel)`.

```js
const channel = supabase
  .channel(`items-${listId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `list_id=eq.${listId}` }, handleChange)
  .subscribe();

return () => supabase.removeChannel(channel);
```

### Channel naming

- `{table}-{userId}` for user-scoped subscriptions.
- `{table}-{listId}` for list-scoped subscriptions.

## RLS

Row Level Security is relied on implicitly. Update and delete queries do not add a `userId` filter — RLS enforces ownership at the database level.
