/**
 * Supabase Edge Function for sending push notifications via APNs.
 * Receives webhook payloads from database triggers and delivers notifications
 * to iOS devices based on user preferences.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// Types
// ============================================================================

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE'
  table: 'items' | 'list_shares'
  record: Record<string, unknown>
  old_record?: Record<string, unknown>
  schema: string
  actor_id?: string
}

interface ItemRecord {
  id: string
  list_id: string
  name: string
  is_checked: boolean
  rsvp_status: string | null
}

interface ListShareRecord {
  id: string
  list_id: string
  shared_with_email: string
}

interface NotificationPreference {
  user_id: string
  item_added: boolean
  item_checked: boolean
  rsvp_changed: boolean
  collaborator_joined: boolean
}

interface DeviceToken {
  id: string
  user_id: string
  token: string
}

interface NotificationContent {
  title: string
  body: string
  listId: string
}

type EventType = 'item_added' | 'item_checked' | 'rsvp_changed' | 'collaborator_joined'

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

async function getApnsJwt(): Promise<string> {
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

function invalidateJwtCache() {
  cachedJwt = null
  cachedJwtExpiry = 0
}

// ============================================================================
// APNs Push Notification
// ============================================================================

async function sendPushNotification(
  token: string,
  content: NotificationContent,
  supabase: ReturnType<typeof createClient>
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

async function deleteDeviceToken(
  supabase: ReturnType<typeof createClient>,
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

// ============================================================================
// Event Detection
// ============================================================================

function detectEventType(payload: WebhookPayload): EventType | null {
  const { type, table, record, old_record } = payload

  if (table === 'items') {
    if (type === 'INSERT') {
      return 'item_added'
    }

    if (type === 'UPDATE' && old_record) {
      const oldItem = old_record as ItemRecord
      const newItem = record as ItemRecord

      // Check if is_checked changed to true
      if (!oldItem.is_checked && newItem.is_checked) {
        return 'item_checked'
      }

      // Check if rsvp_status changed
      if (oldItem.rsvp_status !== newItem.rsvp_status && newItem.rsvp_status !== null) {
        return 'rsvp_changed'
      }
    }
  }

  if (table === 'list_shares' && type === 'INSERT') {
    return 'collaborator_joined'
  }

  return null
}

// ============================================================================
// Notification Content Building
// ============================================================================

function buildNotificationContent(
  eventType: EventType,
  listName: string,
  actorName: string | null,
  itemName?: string,
  rsvpStatus?: string
): NotificationContent {
  let body: string

  switch (eventType) {
    case 'item_added':
      body = actorName
        ? `${actorName} added ${itemName}`
        : `New item added: ${itemName}`
      break
    case 'item_checked':
      body = actorName
        ? `${actorName} checked off ${itemName}`
        : `${itemName} was checked off`
      break
    case 'rsvp_changed':
      body = actorName
        ? `${actorName} RSVP'd ${rsvpStatus} for ${itemName}`
        : `${itemName} RSVP updated to ${rsvpStatus}`
      break
    case 'collaborator_joined':
      body = `${actorName} joined the list`
      break
  }

  return {
    title: listName,
    body,
    listId: '',
  }
}

// ============================================================================
// Database Queries
// ============================================================================

async function getListName(
  supabase: ReturnType<typeof createClient>,
  listId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('lists')
    .select('name')
    .eq('id', listId)
    .single()

  if (error) {
    console.error('Failed to fetch list name:', error)
    return null
  }

  return data?.name ?? null
}

async function getListOwnerId(
  supabase: ReturnType<typeof createClient>,
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

async function getUserDisplayName(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Failed to fetch user profile:', error)
    return null
  }

  return data?.display_name ?? null
}

async function getUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string
): Promise<{ id: string; display_name: string | null } | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('email', email)
    .single()

  if (error) {
    console.error('Failed to fetch user by email:', error)
    return null
  }

  return data
}

async function getNotificationRecipients(
  supabase: ReturnType<typeof createClient>,
  listId: string,
  eventType: EventType,
  excludeUserId?: string
): Promise<NotificationPreference[]> {
  const { data, error } = await supabase
    .from('list_notification_preferences')
    .select('user_id, item_added, item_checked, rsvp_changed, collaborator_joined')
    .eq('list_id', listId)
    .eq(eventType, true)

  if (error) {
    console.error('Failed to fetch notification preferences:', error)
    return []
  }

  // Filter out the actor
  return (data ?? []).filter(pref => pref.user_id !== excludeUserId)
}

async function getDeviceTokensForUser(
  supabase: ReturnType<typeof createClient>,
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

// ============================================================================
// Main Handler
// ============================================================================

async function handleItemEvent(
  supabase: ReturnType<typeof createClient>,
  eventType: EventType,
  record: ItemRecord,
  actorId?: string
): Promise<{ sent: number; failed: number }> {
  const listId = record.list_id
  const itemName = record.name

  // Get list name
  const listName = await getListName(supabase, listId)
  if (!listName) {
    console.error('Could not find list for item event')
    return { sent: 0, failed: 0 }
  }

  // Get actor name if actor_id provided
  let actorName: string | null = null
  if (actorId) {
    actorName = await getUserDisplayName(supabase, actorId)
  }

  // Get recipients who have this event type enabled
  const recipients = await getNotificationRecipients(supabase, listId, eventType, actorId)
  if (recipients.length === 0) {
    console.log('No recipients with notifications enabled for this event')
    return { sent: 0, failed: 0 }
  }

  // Build notification content
  const content = buildNotificationContent(
    eventType,
    listName,
    actorName,
    itemName,
    record.rsvp_status ?? undefined
  )
  content.listId = listId

  // Send to all recipients
  let sent = 0
  let failed = 0

  for (const recipient of recipients) {
    const tokens = await getDeviceTokensForUser(supabase, recipient.user_id)

    for (const tokenRecord of tokens) {
      const success = await sendPushNotification(tokenRecord.token, content, supabase)
      if (success) {
        sent++
      } else {
        failed++
      }
    }
  }

  return { sent, failed }
}

async function handleCollaboratorJoined(
  supabase: ReturnType<typeof createClient>,
  record: ListShareRecord
): Promise<{ sent: number; failed: number }> {
  const listId = record.list_id
  const sharedWithEmail = record.shared_with_email

  // Get list name and owner
  const [listName, ownerId] = await Promise.all([
    getListName(supabase, listId),
    getListOwnerId(supabase, listId),
  ])

  if (!listName || !ownerId) {
    console.error('Could not find list or owner for collaborator_joined event')
    return { sent: 0, failed: 0 }
  }

  // Get the new collaborator's name
  const newCollaborator = await getUserByEmail(supabase, sharedWithEmail)
  const collaboratorName = newCollaborator?.display_name ?? sharedWithEmail

  // Check owner's notification preference for this list
  const { data: ownerPref } = await supabase
    .from('list_notification_preferences')
    .select('collaborator_joined')
    .eq('user_id', ownerId)
    .eq('list_id', listId)
    .single()

  if (!ownerPref?.collaborator_joined) {
    console.log('List owner does not have collaborator_joined notifications enabled')
    return { sent: 0, failed: 0 }
  }

  // Build notification content
  const content = buildNotificationContent(
    'collaborator_joined',
    listName,
    collaboratorName
  )
  content.listId = listId

  // Get owner's device tokens
  const tokens = await getDeviceTokensForUser(supabase, ownerId)

  let sent = 0
  let failed = 0

  for (const tokenRecord of tokens) {
    const success = await sendPushNotification(tokenRecord.token, content, supabase)
    if (success) {
      sent++
    } else {
      failed++
    }
  }

  return { sent, failed }
}

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Authenticate webhook
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  const providedSecret = req.headers.get('x-webhook-secret')

  if (!webhookSecret || providedSecret !== webhookSecret) {
    console.error('Webhook authentication failed')
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Parse payload
  let payload: WebhookPayload
  try {
    payload = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON payload' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Detect event type
  const eventType = detectEventType(payload)
  if (!eventType) {
    return new Response(
      JSON.stringify({ skipped: true, reason: 'no matching event type' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  console.log(`Processing event: ${eventType} on ${payload.table}`)

  // Initialize Supabase client with service role for bypassing RLS
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let result: { sent: number; failed: number }

  try {
    if (eventType === 'collaborator_joined') {
      result = await handleCollaboratorJoined(
        supabase,
        payload.record as unknown as ListShareRecord
      )
    } else {
      result = await handleItemEvent(
        supabase,
        eventType,
        payload.record as unknown as ItemRecord,
        payload.actor_id
      )
    }

    console.log(`Notification result: ${result.sent} sent, ${result.failed} failed`)

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error processing notification:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
