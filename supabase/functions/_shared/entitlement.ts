/**
 * Gather Lists Pro access checks for edge functions that call paid upstreams.
 *
 * Free users get a monthly allowance counted from api_usage_events; Pro users
 * (subscriptions table, via is_pro) are never limited. Nothing is blocked
 * until limits are switched on, globally or for the caller as a tester (see
 * pro_enforced_for() and app_settings).
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveUserId } from './usageLog.ts'

/** A metered capability. */
export type PaidFeature = 'image_lookup' | 'recipe_import' | 'recipe_search'

/** Why a request was refused. */
export type DenialReason = 'sign_in_required' | 'pro_required' | 'limit_reached'

/** The outcome of an access check. */
export interface AccessDecision {
  allowed: boolean
  feature: PaidFeature
  reason?: DenialReason
  /** Monthly free allowance, when the feature has one. */
  limit?: number
  /** Uses counted so far this month. */
  used?: number
  /** ISO timestamp at which the allowance resets. */
  resetsAt?: string
}

/** Free uses per calendar month (UTC). A feature absent here is Pro only. */
export const FREE_MONTHLY_LIMITS: Partial<Record<PaidFeature, number>> = {
  image_lookup: 25,
  recipe_import: 5,
}

/** Image sources that cost money per call; the others are never limited. */
export const PAID_IMAGE_SOURCES = ['serpapi', 'spoonacular']

const USAGE_FILTERS: Partial<Record<PaidFeature, { operations: string[]; sources: string[] }>> = {
  image_lookup: { operations: ['product_search', 'image_search'], sources: PAID_IMAGE_SOURCES },
  recipe_import: { operations: ['recipe_import'], sources: ['web'] },
}

/**
 * Decides access from already-known facts. Pure, so the rules can be tested
 * without a database.
 * @param feature - The capability being used
 * @param caller - Whether the caller is signed in and Pro, and their use this month
 * @param now - The current time, used for the reset date
 */
export function decideAccess(
  feature: PaidFeature,
  caller: { isSignedIn: boolean; isPro: boolean; used: number },
  now: Date = new Date()
): AccessDecision {
  if (!caller.isSignedIn) return { allowed: false, feature, reason: 'sign_in_required' }
  if (caller.isPro) return { allowed: true, feature }

  const limit = FREE_MONTHLY_LIMITS[feature]
  if (limit === undefined) return { allowed: false, feature, reason: 'pro_required' }

  const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
  if (caller.used >= limit) {
    return { allowed: false, feature, reason: 'limit_reached', limit, used: caller.used, resetsAt }
  }
  return { allowed: true, feature, limit, used: caller.used, resetsAt }
}

async function countUsageThisMonth(
  supabase: SupabaseClient,
  userId: string,
  feature: PaidFeature,
  now: Date
): Promise<number> {
  const filter = USAGE_FILTERS[feature]
  if (!filter) return 0

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const { count, error } = await supabase
    .from('api_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('ok', true)
    .in('operation', filter.operations)
    .in('source', filter.sources)
    .gte('created_at', monthStart)
  if (error) throw new Error(`Counting ${feature} usage failed for ${userId}`, { cause: error })
  return count ?? 0
}

async function isEnforcedFor(supabase: SupabaseClient, userId: string | null): Promise<boolean> {
  const { data, error } = await supabase.rpc('pro_enforced_for', { target_user: userId })
  if (error) throw new Error('Reading pro_enforced_for failed', { cause: error })
  return data === true
}

/**
 * Checks whether the caller may use a paid feature right now. Allows everything
 * while limits are off for the caller, and fails open if the check itself errors so a
 * database hiccup never takes search down.
 * @param req - The incoming request, whose bearer token identifies the caller
 * @param feature - The capability being used
 */
export async function checkAccess(req: Request, feature: PaidFeature): Promise<AccessDecision> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const userId = await resolveUserId(req, supabase)
    if (!(await isEnforcedFor(supabase, userId))) return { allowed: true, feature }
    if (!userId) return decideAccess(feature, { isSignedIn: false, isPro: false, used: 0 })

    const { data: isPro, error } = await supabase.rpc('is_pro', { target_user: userId })
    if (error) throw new Error(`is_pro failed for ${userId}`, { cause: error })
    if (isPro) return decideAccess(feature, { isSignedIn: true, isPro: true, used: 0 })

    const now = new Date()
    const used = await countUsageThisMonth(supabase, userId, feature, now)
    return decideAccess(feature, { isSignedIn: true, isPro: false, used }, now)
  } catch (err) {
    console.error(`Access check for ${feature} failed, allowing the request:`, err)
    return { allowed: true, feature }
  }
}

/**
 * Builds the 402 response sent when a paid feature is refused.
 * @param decision - A decision with `allowed: false`
 * @param corsHeaders - The function's CORS headers
 */
export function accessDeniedResponse(decision: AccessDecision, corsHeaders: Record<string, string>): Response {
  const { reason, feature, limit, used, resetsAt } = decision
  return new Response(JSON.stringify({ error: reason, feature, limit, used, resetsAt }), {
    status: 402,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
