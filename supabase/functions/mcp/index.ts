/**
 * Gather Lists — MCP server (Supabase Edge Function).
 *
 * Exposes Gather Lists operations to MCP clients (e.g. Claude) over the
 * Streamable HTTP transport. Supabase Auth is the OAuth 2.1 authorization
 * server; this function is the resource server. The auth middleware validates
 * the bearer token and hands each request an RLS-scoped Supabase client, so
 * every tool is automatically constrained to what the signed-in user may
 * see and change — the app's existing Row Level Security IS the authorization
 * model here. Tools must never bypass it (no service-role client).
 *
 * Tools live in per-area modules: readTools (Phase 1 reads), listTools /
 * recipeTools / sharingTools (Phase 2 writes), planningTools (Phase 3 meal
 * planning, shopping, cook log), historyTools (item history).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0';
import { pipeline } from 'npm:@supabase/middleware@1';
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@^1.9.2';
import { registerHistoryTools } from './historyTools.ts';
import { registerListTools } from './listTools.ts';
import { registerPlanningTools } from './planningTools.ts';
import { registerReadTools } from './readTools.ts';
import { registerRecipeTools } from './recipeTools.ts';
import { registerSharingTools } from './sharingTools.ts';
import type { Database } from './database.types.ts';
import type { ToolContext } from './shared.ts';

Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase<Database>({ auth: 'user' })],
    // Keep the handler inline and its ctx un-annotated so the pipeline can
    // infer the context; an explicit type collapses it to `object`.
    async (req, { supabase, userClaims }) => {
      if (!userClaims) return new Response('Unauthorized', { status: 401 });
      const ctx: ToolContext = { supabase, userId: userClaims.id, email: userClaims.email ?? null };
      const handler = createMcpHandler(() => {
        const server = new McpServer({ name: 'gather-lists', version: '1.0.0' });
        registerReadTools(server, ctx);
        registerListTools(server, ctx);
        registerRecipeTools(server, ctx);
        registerSharingTools(server, ctx);
        registerPlanningTools(server, ctx);
        registerHistoryTools(server, ctx);
        return server;
      }, { onerror: (error) => console.error('[mcp] request failed', error) });
      return handler.fetch(req);
    },
  ),
);
