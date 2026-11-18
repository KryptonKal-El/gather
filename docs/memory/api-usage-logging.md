# API usage logging (`api_usage_events`)

The four edge functions that call metered or cappable upstreams (`search-products`,
`search-images`, `search-recipes`, `import-recipe-url`) write one row per upstream
call to `api_usage_events` through `supabase/functions/_shared/usageLog.ts`. The
data exists to price Gather Pro and, later, to enforce monthly free quotas.

## Non-obvious bits

- **`user_id` is NULL unless the client sends the user's session token.** Clients
  used to send the anon key as the bearer. Web (`src/services/edgeAuth.js`) and
  iOS (`SupabaseManager.edgeFunctionToken()`) now send the access token and fall
  back to the anon key when signed out. App builds from before that change keep
  logging NULL users, so per-user numbers only cover updated clients.
- **Any new direct edge-function call must use those helpers**, or its usage is
  anonymous and can't be quota'd.
- The table has RLS on and no policies: service role only. Query it from the
  Supabase SQL editor.
- Search text is deliberately not stored.
- `search-products` responses are browser-cacheable for an hour, and both clients
  cache for 5 minutes, so rows count real upstream calls, not user taps.
- Logging runs in `EdgeRuntime.waitUntil` and never fails the request; a broken
  insert only shows up in the function logs as `Usage logging failed`.

## Cost-per-user query

```sql
select source, operation,
       count(*)                                   as calls,
       count(distinct user_id)                    as users,
       round(count(*)::numeric / nullif(count(distinct user_id), 0), 1) as calls_per_user
from api_usage_events
where created_at > now() - interval '30 days' and user_id is not null
group by 1, 2
order by calls desc;
```
