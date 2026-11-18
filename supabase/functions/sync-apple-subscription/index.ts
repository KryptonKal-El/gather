/**
 * Supabase Edge Function: ties an App Store purchase to the signed-in user.
 *
 * The iOS app calls this after a purchase and on sign-in with a transaction id
 * from StoreKit. The state is re-read from Apple, so the id is only a pointer;
 * a subscription already owned by another account is never reassigned.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { refreshAppleSubscription } from '../_shared/appStore.ts'

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth, error: authError } = await supabase.auth.getUser(token)
  if (authError || !auth.user) return json({ error: 'Not signed in' }, 401)
  const userId = auth.user.id

  let transactionId = ''
  try {
    const body = await req.json()
    transactionId = String(body?.transactionId ?? '')
  } catch {
    transactionId = ''
  }
  if (!/^\d{1,32}$/.test(transactionId)) return json({ error: 'Invalid transactionId' }, 400)

  try {
    const rows = await refreshAppleSubscription(supabase, transactionId, { claimUserId: userId })
    const proUntil = rows
      .filter(row => row.user_id === userId && !row.revoked_at && row.expires_at && new Date(row.expires_at) > new Date())
      .map(row => row.expires_at as string)
      .sort()
      .at(-1) ?? null
    return json({ isPro: proUntil !== null, proUntil }, 200)
  } catch (err) {
    console.error(`Failed to sync subscription ${transactionId} for ${userId}:`, err)
    return json({ error: 'Sync failed' }, 502)
  }
})
