/**
 * Supabase Edge Function: permanently deletes the signed-in user's account.
 *
 * Removes the user's stored photos, the shares and activity that point at them
 * from other people's content, then the auth user. Everything the user owns
 * (lists, recipes, collections, meal plans) goes with the auth user through
 * ON DELETE CASCADE. Subscription rows are kept, unlinked, so later App Store
 * notifications still resolve.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PHOTO_BUCKETS = ['recipe-images', 'item-images', 'profile-images']
const SHARE_TABLES = ['list_shares', 'collection_shares', 'meal_plan_shares']
const ALLOWED_ORIGINS = [
  'https://gatherlists.com',
  'https://gatherapp.vercel.app',
  'http://localhost:5173',
  'http://localhost:4000',
]
const PAGE_SIZE = 100

const corsHeaders = (req: Request) => {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

/** Removes every file under the user's folder in one bucket. */
const removeUserFiles = async (supabase: SupabaseClient, bucket: string, userId: string) => {
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(userId, { limit: PAGE_SIZE })
    if (error) throw new Error(`Listing ${bucket}/${userId} failed`, { cause: error })
    if (!data?.length) return

    const paths = data.map(file => `${userId}/${file.name}`)
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths)
    if (removeError) throw new Error(`Removing files from ${bucket}/${userId} failed`, { cause: removeError })
  }
}

/** Removes rows in other people's content that reference the user and would block or outlive the account. */
const removeReferences = async (supabase: SupabaseClient, userId: string, email: string | undefined) => {
  const { error: auditError } = await supabase.from('list_audit_events').delete().eq('actor_id', userId)
  if (auditError) throw new Error('Removing list activity failed', { cause: auditError })

  for (const table of ['collection_shares', 'meal_plan_shares']) {
    const { error } = await supabase.from(table).delete().eq('shared_by', userId)
    if (error) throw new Error(`Removing ${table} created by the user failed`, { cause: error })
  }

  if (!email) return
  // ilike without wildcards is a case-insensitive equality check; escape the pattern characters.
  const pattern = email.replace(/[\\%_]/g, '\\$&')
  for (const table of SHARE_TABLES) {
    const { error } = await supabase.from(table).delete().ilike('shared_with_email', pattern)
    if (error) throw new Error(`Removing ${table} addressed to the user failed`, { cause: error })
  }
}

Deno.serve(async (req) => {
  const headers = { ...corsHeaders(req), 'Content-Type': 'application/json' }
  const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers })

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth, error: authError } = await supabase.auth.getUser(token)
  if (authError || !auth.user) return json({ error: 'Not signed in' }, 401)
  const { id: userId, email } = auth.user

  let confirmed = false
  try {
    confirmed = (await req.json())?.confirm === true
  } catch {
    confirmed = false
  }
  if (!confirmed) return json({ error: 'Confirmation required' }, 400)

  try {
    for (const bucket of PHOTO_BUCKETS) {
      await removeUserFiles(supabase, bucket, userId)
    }
    await removeReferences(supabase, userId, email)

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteError) throw new Error('Deleting the auth user failed', { cause: deleteError })

    return json({ deleted: true }, 200)
  } catch (err) {
    console.error(`Account deletion failed for ${userId}:`, err)
    return json({ error: 'Deletion failed' }, 500)
  }
})
