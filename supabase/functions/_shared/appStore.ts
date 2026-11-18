/**
 * App Store Server API client for Gather Pro subscriptions.
 *
 * Subscription state is always read from Apple over TLS with our own API key,
 * so nothing a caller sends (a notification body, a transaction id from the
 * app) is trusted beyond "go look this transaction up".
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUNDLE_ID = 'com.gatherlists'

const API_HOSTS = {
  Production: 'https://api.storekit.itunes.apple.com',
  Sandbox: 'https://api.storekit-sandbox.itunes.apple.com',
} as const

/** App Store environment a transaction belongs to. */
export type AppStoreEnvironment = keyof typeof API_HOSTS

/** Decoded payload of a signedTransactionInfo JWS (fields we use). */
export interface TransactionInfo {
  originalTransactionId: string
  bundleId: string
  productId: string
  expiresDate?: number
  revocationDate?: number
  appAccountToken?: string
  inAppOwnershipType?: string
  environment?: string
}

/** Decoded payload of a signedRenewalInfo JWS (fields we use). */
export interface RenewalInfo {
  autoRenewStatus?: number
  gracePeriodExpiresDate?: number
}

/** A subscriptions row as written by this module. */
export interface SubscriptionRow {
  source: 'apple'
  external_id: string
  product_id: string
  status: 'active' | 'grace_period' | 'billing_retry' | 'expired' | 'revoked'
  expires_at: string | null
  revoked_at: string | null
  auto_renew: boolean | null
  ownership_type: string | null
  environment: string | null
  updated_at: string
}

interface LastTransaction {
  originalTransactionId: string
  status: number
  signedTransactionInfo: string
  signedRenewalInfo?: string
}

const STATUS_BY_CODE: Record<number, SubscriptionRow['status']> = {
  1: 'active',
  2: 'expired',
  3: 'billing_retry',
  4: 'grace_period',
  5: 'revoked',
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function base64UrlEncode(data: Uint8Array): string {
  const binary = String.fromCharCode(...data)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string) {
  const base64 = pem.split('\n').filter(line => !line.startsWith('-----')).join('')
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}

/**
 * Decodes the payload of a JWS without verifying its signature. Only use the
 * result as a hint for what to fetch from Apple, or on JWS strings that came
 * straight from an App Store Server API response.
 * @param jws - Compact JWS (header.payload.signature)
 * @returns The parsed payload
 * @throws {Error} When the string is not a decodable JWS
 */
export function decodeJwsPayload<T>(jws: string): T {
  const payload = jws.split('.')[1]
  if (!payload) throw new Error('Malformed JWS: missing payload segment')
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch (err) {
    throw new Error('Malformed JWS: payload is not base64url JSON', { cause: err })
  }
}

/**
 * Maps Apple's view of one subscription onto a subscriptions row.
 * @param statusCode - Apple's subscription status (1 active … 5 revoked)
 * @param transaction - Decoded signedTransactionInfo
 * @param renewal - Decoded signedRenewalInfo, when Apple sent one
 * @returns The row to upsert (without user_id, which the caller resolves)
 * @throws {Error} When Apple returns a status code this code doesn't know
 */
export function buildSubscriptionRow(
  statusCode: number,
  transaction: TransactionInfo,
  renewal: RenewalInfo | null
): SubscriptionRow {
  const status = STATUS_BY_CODE[statusCode]
  if (!status) throw new Error(`Unknown App Store subscription status ${statusCode}`)

  // During a billing grace period the paid-through date has already passed;
  // access continues until the grace period ends.
  const expiresMs = status === 'grace_period'
    ? renewal?.gracePeriodExpiresDate ?? transaction.expiresDate
    : transaction.expiresDate
  const toIso = (ms: number | undefined) => (ms == null ? null : new Date(ms).toISOString())

  return {
    source: 'apple',
    external_id: transaction.originalTransactionId,
    product_id: transaction.productId,
    status,
    expires_at: toIso(expiresMs),
    revoked_at: toIso(transaction.revocationDate),
    auto_renew: renewal?.autoRenewStatus == null ? null : renewal.autoRenewStatus === 1,
    ownership_type: transaction.inAppOwnershipType ?? null,
    environment: transaction.environment ?? null,
    updated_at: new Date().toISOString(),
  }
}

async function createApiToken(): Promise<string> {
  const keyId = Deno.env.get('APPLE_IAP_KEY_ID')
  const issuerId = Deno.env.get('APPLE_IAP_ISSUER_ID')
  const privateKeyBase64 = Deno.env.get('APPLE_IAP_PRIVATE_KEY')
  if (!keyId || !issuerId || !privateKeyBase64) {
    throw new Error('App Store Server API is not configured: set APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID and APPLE_IAP_PRIVATE_KEY')
  }

  // Same convention as APNS_PRIVATE_KEY: the .p8 file, base64-encoded.
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(atob(privateKeyBase64)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const now = Math.floor(Date.now() / 1000)
  const encode = (value: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)))
  const signingInput = `${encode({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${encode({
    iss: issuerId,
    iat: now,
    exp: now + 300,
    aud: 'appstoreconnect-v1',
    bid: BUNDLE_ID,
  })}`
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  )
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`
}

async function fetchLastTransactions(
  transactionId: string,
  environmentHint?: AppStoreEnvironment
): Promise<LastTransaction[]> {
  const token = await createApiToken()
  // A transaction only exists in the environment it was made in, and the caller
  // may not know which, so fall through to the other one on "not found".
  const environments: AppStoreEnvironment[] = environmentHint === 'Sandbox'
    ? ['Sandbox', 'Production']
    : ['Production', 'Sandbox']

  // Until the app is live on the App Store, Apple answers 401 in Production for
  // a key that Sandbox accepts. So a 401 only means bad credentials when no
  // environment accepts the key.
  let unauthorized: string | undefined
  let wasAuthorized = false

  for (const environment of environments) {
    const response = await fetch(
      `${API_HOSTS[environment]}/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (response.status === 401) {
      unauthorized = environment
      continue
    }
    wasAuthorized = true
    if (response.status === 404) continue
    if (!response.ok) {
      throw new Error(`App Store Server API ${environment} returned ${response.status}: ${await response.text()}`)
    }
    const body = await response.json() as { data?: { lastTransactions?: LastTransaction[] }[] }
    return (body.data ?? []).flatMap(group => group.lastTransactions ?? [])
  }
  if (unauthorized && !wasAuthorized) {
    throw new Error(`App Store Server API rejected the In-App Purchase key (401 in ${unauthorized})`)
  }
  return []
}

async function resolveUserId(
  supabase: SupabaseClient,
  transaction: TransactionInfo,
  claimUserId: string | null
): Promise<string | null> {
  // The app sets appAccountToken to the buyer's Supabase user id at purchase,
  // so when present it is the authoritative owner.
  const tokenUser = transaction.appAccountToken?.toLowerCase()
  if (tokenUser && UUID_PATTERN.test(tokenUser)) {
    const { data, error } = await supabase.from('profiles').select('id').eq('id', tokenUser).maybeSingle()
    if (error) throw new Error(`Failed to look up profile ${tokenUser}`, { cause: error })
    if (data) return tokenUser
  }

  const { data: existing, error } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('source', 'apple')
    .eq('external_id', transaction.originalTransactionId)
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to load subscription ${transaction.originalTransactionId}`, { cause: error })
  }

  // A purchase made outside the app has no token; the first signed-in device
  // that presents it claims it, and later claims by other accounts are ignored.
  return (existing?.user_id as string | null | undefined) ?? claimUserId
}

/**
 * Re-reads a customer's subscriptions from Apple and stores their current state.
 * @param supabase - Service-role client
 * @param transactionId - Any transaction id belonging to the customer
 * @param options.environment - Where the transaction was made, if known
 * @param options.claimUserId - Signed-in user to attach an unowned purchase to
 * @returns The rows written, each with the user it now belongs to
 * @throws {Error} When Apple or the database can't be reached
 */
export async function refreshAppleSubscription(
  supabase: SupabaseClient,
  transactionId: string,
  options: { environment?: AppStoreEnvironment; claimUserId?: string | null } = {}
): Promise<(SubscriptionRow & { user_id: string | null })[]> {
  const lastTransactions = await fetchLastTransactions(transactionId, options.environment)
  const rows: (SubscriptionRow & { user_id: string | null })[] = []

  for (const last of lastTransactions) {
    const transaction = decodeJwsPayload<TransactionInfo>(last.signedTransactionInfo)
    if (transaction.bundleId !== BUNDLE_ID) continue
    const renewal = last.signedRenewalInfo ? decodeJwsPayload<RenewalInfo>(last.signedRenewalInfo) : null

    const row = {
      ...buildSubscriptionRow(last.status, transaction, renewal),
      user_id: await resolveUserId(supabase, transaction, options.claimUserId ?? null),
    }
    const { error } = await supabase.from('subscriptions').upsert(row, { onConflict: 'source,external_id' })
    if (error) throw new Error(`Failed to save subscription ${row.external_id}`, { cause: error })
    rows.push(row)
  }
  return rows
}
