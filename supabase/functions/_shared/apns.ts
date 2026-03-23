/**
 * Shared APNs (Apple Push Notification Service) utilities.
 * Used by send-notification and check-reminders edge functions.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// Types
// ============================================================================

export interface NotificationContent {
  title: string
  body: string
  listId: string
}

export interface DeviceToken {
  id: string
  user_id: string
  token: string
}

// ============================================================================
// APNs JWT Token Management
// ============================================================================

let cachedJwt: string | null = null
let cachedJwtExpiry = 0

function base64UrlEncode(data: Uint8Array): string {
  const binary = String.fromCharCode(...data)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToRaw(pem: string): Uint8Array {
  const lines = pem.split('\n')
  const base64 = lines.filter(line => !line.startsWith('-----')).join('')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function getApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // Return cached JWT if still valid (50 min buffer on 60 min expiry)
  if (cachedJwt && cachedJwtExpiry > now) {
    return cachedJwt
  }

  const keyId = Deno.env.get('APNS_KEY_ID')!
  const teamId = Deno.env.get('APNS_TEAM_ID')!
  const privateKeyBase64 = Deno.env.get('APNS_PRIVATE_KEY')!

  // Decode base64-encoded .p8 key
  const privateKeyPem = atob(privateKeyBase64)
  const privateKeyDer = pemToRaw(privateKeyPem)

  // Import the key for ES256 signing
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyDer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  // Build JWT header and claims
  const header = { alg: 'ES256', kid: keyId }
  const claims = { iss: teamId, iat: now }

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const encodedClaims = base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)))
  const signingInput = `${encodedHeader}.${encodedClaims}`

  // Sign with ES256
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const encodedSignature = base64UrlEncode(new Uint8Array(signature))
  cachedJwt = `${signingInput}.${encodedSignature}`
  cachedJwtExpiry = now + 3000 // Cache for ~50 minutes

  return cachedJwt
}

export function invalidateJwtCache(): void {
  cachedJwt = null
  cachedJwtExpiry = 0
}

// ============================================================================
// APNs Push Notification
// ============================================================================

async function deleteDeviceToken(
  supabase: SupabaseClient,
  token: string
): Promise<void> {
  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('token', token)

  if (error) {
    console.error('Failed to delete device token:', error)
  }
}

export async function sendPushNotification(
  token: string,
  content: NotificationContent,
  supabase: SupabaseClient
): Promise<boolean> {
  const bundleId = Deno.env.get('APNS_BUNDLE_ID')!
  const useProduction = Deno.env.get('APNS_ENVIRONMENT') !== 'development'
  const apnsHost = useProduction
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com'

  const payload = {
    aps: {
      alert: { title: content.title, body: content.body },
      badge: 1,
      sound: 'default',
    },
    listId: content.listId,
  }

  const sendRequest = async (jwt: string): Promise<Response> => {
    return fetch(`${apnsHost}/3/device/${token}`, {
      method: 'POST',
      headers: {
        'authorization': `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        'apns-expiration': '0',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  }

  try {
    let jwt = await getApnsJwt()
    let response = await sendRequest(jwt)

    // Retry once if JWT was rejected
    if (response.status === 403) {
      console.log('APNs JWT rejected, regenerating...')
      invalidateJwtCache()
      jwt = await getApnsJwt()
      response = await sendRequest(jwt)
    }

    if (response.status === 200) {
      return true
    }

    const responseBody = await response.text()

    // Handle token invalidation (410 Gone or Unregistered)
    if (response.status === 410) {
      console.log(`Token invalidated (410), deleting: ${token.substring(0, 8)}...`)
      await deleteDeviceToken(supabase, token)
      return false
    }

    // Check for Unregistered reason in response body
    try {
      const errorResponse = JSON.parse(responseBody)
      if (errorResponse.reason === 'Unregistered' || errorResponse.reason === 'BadDeviceToken') {
        console.log(`Token ${errorResponse.reason}, deleting: ${token.substring(0, 8)}...`)
        await deleteDeviceToken(supabase, token)
        return false
      }
    } catch {
      // Not JSON, ignore
    }

    console.error(`APNs error ${response.status}: ${responseBody}`)
    return false
  } catch (err) {
    console.error('Failed to send push notification:', err)
    return false
  }
}

// ============================================================================
// Database Queries
// ============================================================================

export async function getDeviceTokensForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<DeviceToken[]> {
  const { data, error } = await supabase
    .from('device_tokens')
    .select('id, user_id, token')
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to fetch device tokens:', error)
    return []
  }

  return data ?? []
}

export async function getListOwnerId(
  supabase: SupabaseClient,
  listId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('lists')
    .select('owner_id')
    .eq('id', listId)
    .single()

  if (error) {
    console.error('Failed to fetch list owner:', error)
    return null
  }

  return data?.owner_id ?? null
}
