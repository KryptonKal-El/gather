/**
 * Supabase Edge Function: App Store Server Notifications V2 receiver.
 *
 * Apple calls this whenever a Gather Pro subscription changes (renewal, expiry,
 * refund, grace period, Family Sharing change). The notification's signature is
 * not verified here; instead it is only used to learn which transaction changed,
 * and the actual state is then fetched from Apple with our own API key. A forged
 * notification can therefore do no more than trigger a harmless re-sync.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  type AppStoreEnvironment,
  decodeJwsPayload,
  refreshAppleSubscription,
  type TransactionInfo,
} from '../_shared/appStore.ts'

interface NotificationPayload {
  notificationType?: string
  data?: { environment?: string; signedTransactionInfo?: string }
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let transactionId: string
  let environment: AppStoreEnvironment | undefined
  try {
    const { signedPayload } = await req.json()
    const payload = decodeJwsPayload<NotificationPayload>(String(signedPayload ?? ''))
    // TEST and other notifications that carry no transaction need no action.
    if (!payload.data?.signedTransactionInfo) return json({ ok: true, skipped: true }, 200)

    transactionId = decodeJwsPayload<TransactionInfo>(payload.data.signedTransactionInfo).originalTransactionId
    environment = payload.data.environment === 'Sandbox' ? 'Sandbox' : 'Production'
  } catch (err) {
    console.error('Unreadable App Store notification:', err)
    return json({ error: 'Invalid notification' }, 400)
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const rows = await refreshAppleSubscription(supabase, transactionId, { environment })
    return json({ ok: true, updated: rows.length }, 200)
  } catch (err) {
    // A non-2xx makes Apple retry the notification later.
    console.error(`Failed to refresh subscription ${transactionId}:`, err)
    return json({ error: 'Refresh failed' }, 500)
  }
})
