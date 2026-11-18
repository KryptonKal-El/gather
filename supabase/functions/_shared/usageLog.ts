/**
 * Usage logging for edge functions that call metered third-party APIs.
 * Writes one api_usage_events row per upstream call, off the response path.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** One upstream call made while serving a request. */
export interface UsageEvent {
  /** Upstream provider, e.g. 'serpapi', 'spoonacular', 'walmart'. */
  source: string
  /** What was asked of it, e.g. 'product_search', 'recipe_detail'. */
  operation: string
  /** Whether the upstream call succeeded. */
  ok: boolean
}

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

async function resolveUserId(req: Request, supabase: SupabaseClient): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || token === Deno.env.get('SUPABASE_ANON_KEY')) return null

  const { data, error } = await supabase.auth.getUser(token)
  if (error) return null
  return data.user?.id ?? null
}

async function writeUsage(req: Request, functionName: string, events: UsageEvent[]): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const userId = await resolveUserId(req, supabase)
    // Browsers always send Origin; the native app's URLSession never does.
    const platform = req.headers.get('origin') ? 'web' : 'native'

    const { error } = await supabase.from('api_usage_events').insert(
      events.map(({ source, operation, ok }) => ({
        user_id: userId,
        function_name: functionName,
        source,
        operation,
        ok,
        platform,
      }))
    )
    if (error) {
      throw new Error(`Insert into api_usage_events failed for ${functionName}`, { cause: error })
    }
  } catch (err) {
    console.error('Usage logging failed:', err)
  }
}

/**
 * Records the upstream calls a request made. Never throws and never delays the
 * response: the write runs in the background and failures are only logged.
 * @param req - The incoming request, used to identify the caller and platform
 * @param functionName - The edge function's name
 * @param events - One entry per upstream call
 */
export function logUsage(req: Request, functionName: string, events: UsageEvent[]): void {
  if (events.length === 0) return
  const task = writeUsage(req, functionName, events)
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(task)
  }
}
