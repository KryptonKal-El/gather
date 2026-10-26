/**
 * Phase 2 sharing tools. Gather shares lists, recipe collections, and meal
 * plans by email address (RLS matches the signed-in user's JWT email claim),
 * so sharing works even before the invitee has an account.
 */
import { McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0';
import { z } from 'npm:zod@^4.3.6';
import {
  DESTRUCTIVE,
  IDEMPOTENT_WRITE,
  READ_ONLY,
  type ToolContext,
  errorResult,
  jsonResult,
  normalizeEmail,
  uuid,
} from './shared.ts';

const RESOURCES = {
  list: { table: 'list_shares', fk: 'list_id', parent: 'lists', hasSharedBy: false },
  collection: { table: 'collection_shares', fk: 'collection_id', parent: 'collections', hasSharedBy: true },
  meal_plan: { table: 'meal_plan_shares', fk: 'meal_plan_id', parent: 'meal_plans', hasSharedBy: true },
} as const;

const resourceInput = {
  resource_type: z.enum(['list', 'collection', 'meal_plan']).describe('What is being shared.'),
  resource_id: uuid('The list, collection, or meal plan id.'),
};

/** Registers sharing tools for lists, collections, and meal plans. */
export function registerSharingTools(server: McpServer, ctx: ToolContext) {
  const { userId, email: myEmail } = ctx;
  // The share table is picked at runtime, which the generated per-table types can't express.
  // deno-lint-ignore no-explicit-any
  const supabase: any = ctx.supabase;

  server.registerTool(
    'sharing_list',
    {
      title: 'List who something is shared with',
      description: 'List the email addresses a list, recipe collection, or meal plan is shared with.',
      annotations: READ_ONLY,
      inputSchema: z.object(resourceInput),
    },
    async ({ resource_type, resource_id }) => {
      const r = RESOURCES[resource_type];
      const { data, error } = await supabase
        .from(r.table)
        .select('shared_with_email, added_at')
        .eq(r.fk, resource_id)
        .order('added_at', { ascending: true });
      if (error) return errorResult(error.message);
      return jsonResult(data.map((row: { shared_with_email: string; added_at: string | null }) => ({
        email: row.shared_with_email,
        added_at: row.added_at,
      })));
    },
  );

  server.registerTool(
    'sharing_add',
    {
      title: 'Share with someone',
      description:
        'Share a list, recipe collection, or meal plan with someone by email (they get edit access). Only the owner can share. Confirm the email address with the user first.',
      annotations: IDEMPOTENT_WRITE,
      inputSchema: z.object({ ...resourceInput, email: z.string().email().describe('Email address to share with.') }),
    },
    async ({ resource_type, resource_id, email }) => {
      const r = RESOURCES[resource_type];
      const normalized = normalizeEmail(email);
      if (myEmail && normalized === normalizeEmail(myEmail)) return errorResult('You cannot share with yourself.');

      const { data: parent, error: parentError } = await supabase
        .from(r.parent).select('owner_id').eq('id', resource_id).maybeSingle();
      if (parentError) return errorResult(parentError.message);
      if (!parent) return errorResult(`The ${resource_type.replace('_', ' ')} was not found.`);
      if (parent.owner_id !== userId) return errorResult('Only the owner can share this.');

      const row: Record<string, unknown> = { [r.fk]: resource_id, shared_with_email: normalized };
      if (r.hasSharedBy) Object.assign(row, { shared_by: userId, permission: 'write' });
      const { error } = await supabase.from(r.table).insert(row);
      if (error?.code === '23505') return jsonResult({ shared_with: normalized, already_shared: true });
      if (error) return errorResult(error.message);
      return jsonResult({ shared_with: normalized, already_shared: false });
    },
  );

  server.registerTool(
    'sharing_remove',
    {
      title: 'Stop sharing',
      description:
        'Remove someone\'s access to a list, recipe collection, or meal plan. Owners can remove anyone; a member can pass their own email to leave.',
      annotations: DESTRUCTIVE,
      inputSchema: z.object({ ...resourceInput, email: z.string().email() }),
    },
    async ({ resource_type, resource_id, email }) => {
      const r = RESOURCES[resource_type];
      const normalized = normalizeEmail(email);
      const { data, error } = await supabase
        .from(r.table)
        .delete()
        .eq(r.fk, resource_id)
        .eq('shared_with_email', normalized)
        .select('id');
      if (error) return errorResult(error.message);
      if (!data?.length) return errorResult(`No share for ${normalized} that you can remove.`);
      return jsonResult({ removed: normalized });
    },
  );
}
