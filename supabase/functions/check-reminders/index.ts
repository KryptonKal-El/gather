/**
 * Supabase Edge Function for checking due item reminders.
 *
 * This function queries items with reminders that are due and sends push
 * notifications to the list owners. It marks reminders as sent to prevent
 * duplicate notifications.
 *
 * SCHEDULING:
 * This function should be triggered via cron. Options:
 *
 * 1. Supabase pg_cron extension (preferred):
 *    SELECT cron.schedule(
 *      'check-reminders-daily',
 *      '0 9 * * *',  -- Every day at 9 AM UTC
 *      $$
 *      SELECT net.http_post(
 *        url := '<SUPABASE_URL>/functions/v1/check-reminders',
 *        headers := jsonb_build_object(
 *          'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
 *          'Content-Type', 'application/json'
 *        ),
 *        body := '{}'
 *      );
 *      $$
 *    );
 *
 * 2. External cron service (e.g., cron-job.org, GitHub Actions):
 *    POST https://<project>.supabase.co/functions/v1/check-reminders
 *    Headers:
 *      Authorization: Bearer <SERVICE_ROLE_KEY>
 *      Content-Type: application/json
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  sendPushNotification,
  getDeviceTokensForUser,
  getListOwnerId,
  NotificationContent,
} from '../_shared/apns.ts'

// ============================================================================
// Types
// ============================================================================

interface ReminderItem {
  id: string
  name: string
  due_date: string
  reminder_days_before: number
  list_id: string
  list_name: string
}

// ============================================================================
// Notification Message Building
// ============================================================================

function buildReminderMessage(
  itemName: string,
  dueDate: Date,
  listName: string
): NotificationContent {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dueDateNormalized = new Date(dueDate)
  dueDateNormalized.setHours(0, 0, 0, 0)

  const diffMs = dueDateNormalized.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  let body: string
  if (diffDays === 0) {
    body = `Reminder: ${itemName} is due today on ${listName}`
  } else if (diffDays === 1) {
    body = `Reminder: ${itemName} is due tomorrow on ${listName}`
  } else {
    body = `Reminder: ${itemName} is due in ${diffDays} days on ${listName}`
  }

  return {
    title: listName,
    body,
    listId: '',
  }
}

// ============================================================================
// Date Utilities
// ============================================================================

function isReminderDue(dueDate: string, reminderDaysBefore: number): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  // Calculate the reminder trigger date: due_date - reminder_days_before
  const reminderTriggerDate = new Date(due)
  reminderTriggerDate.setDate(reminderTriggerDate.getDate() - reminderDaysBefore)

  // Reminder is due if today >= trigger date
  return today >= reminderTriggerDate
}

// ============================================================================
// Main Handler
// ============================================================================

Deno.serve(async (req) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Initialize Supabase client with service role for bypassing RLS
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Query candidate items (those with reminders configured but not yet sent)
  const { data: items, error: queryError } = await supabase
    .from('items')
    .select(`
      id,
      name,
      due_date,
      reminder_days_before,
      list_id,
      lists!inner (
        name
      )
    `)
    .not('reminder_days_before', 'is', null)
    .not('due_date', 'is', null)
    .eq('is_checked', false)
    .is('reminder_sent_at', null)

  if (queryError) {
    console.error('Failed to query reminder items:', queryError)
    return new Response(
      JSON.stringify({ error: 'Failed to query reminders' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Filter items where reminder is due (date check in code)
  const reminderItems: ReminderItem[] = (items ?? [])
    .filter((item) => isReminderDue(item.due_date, item.reminder_days_before))
    .map((item) => ({
      id: item.id,
      name: item.name,
      due_date: item.due_date,
      reminder_days_before: item.reminder_days_before,
      list_id: item.list_id,
      list_name: (item.lists as { name: string }).name,
    }))

  return await processReminders(supabase, reminderItems)
})

async function processReminders(
  supabase: ReturnType<typeof createClient>,
  items: ReminderItem[]
): Promise<Response> {
  console.log(`Found ${items.length} items with due reminders`)

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const item of items) {
    // Get list owner
    const ownerId = await getListOwnerId(supabase, item.list_id)
    if (!ownerId) {
      console.log(`Skipping item ${item.id}: no list owner found`)
      skipped++
      continue
    }

    // Get owner's device tokens
    const tokens = await getDeviceTokensForUser(supabase, ownerId)
    if (tokens.length === 0) {
      console.log(`Skipping item ${item.id}: owner has no device tokens`)

      // Still mark as sent to avoid re-checking
      await markReminderSent(supabase, item.id)
      skipped++
      continue
    }

    // Build notification content
    const dueDate = new Date(item.due_date)
    const content = buildReminderMessage(item.name, dueDate, item.list_name)
    content.listId = item.list_id

    // Send to all owner's devices
    let itemSent = false
    for (const tokenRecord of tokens) {
      const success = await sendPushNotification(
        tokenRecord.token,
        content,
        supabase
      )
      if (success) {
        itemSent = true
        sent++
      } else {
        failed++
      }
    }

    // Mark reminder as sent (even if some devices failed)
    if (itemSent || tokens.length > 0) {
      await markReminderSent(supabase, item.id)
      console.log(
        `Sent reminder for item "${item.name}" (${item.id}) - due ${item.due_date}`
      )
    }
  }

  const result = { processed: items.length, sent, failed, skipped }
  console.log(`Reminder check complete:`, result)

  return new Response(JSON.stringify({ success: true, ...result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function markReminderSent(
  supabase: ReturnType<typeof createClient>,
  itemId: string
): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq('id', itemId)

  if (error) {
    console.error(`Failed to mark reminder sent for item ${itemId}:`, error)
  }
}
