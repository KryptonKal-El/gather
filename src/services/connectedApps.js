/**
 * Apps the user has connected to their account through Gather's OAuth server
 * (e.g. Claude via the MCP server). Backed by Supabase Auth's OAuth grants.
 */
import { supabase } from './supabase.js';

/**
 * Looks up when each connected app was last active. Best-effort: the list is
 * still useful without it, so a failure is logged and yields no times.
 * @returns {Promise<Map<string, string>>} Client id to ISO timestamp
 */
const fetchLastUsedByClient = async () => {
  const { data, error } = await supabase.rpc('connected_app_last_used');
  if (error) {
    console.error('Failed to load connected app activity:', error);
    return new Map();
  }
  return new Map(data.map((row) => [row.client_id, row.last_used_at]));
};

/**
 * Lists the apps the signed-in user has approved, newest first.
 * @returns {Promise<Array<{clientId: string, name: string, uri: string|null, logoUri: string|null, scopes: string[], grantedAt: string, lastUsedAt: string|null}>>}
 */
export const fetchConnectedApps = async () => {
  const [{ data, error }, lastUsedByClient] = await Promise.all([
    supabase.auth.oauth.listGrants(),
    fetchLastUsedByClient(),
  ]);
  if (error) throw new Error('Failed to load connected apps', { cause: error });
  return data
    .map((grant) => ({
      clientId: grant.client.id,
      name: grant.client.name || 'Unnamed app',
      uri: grant.client.uri || null,
      logoUri: grant.client.logo_uri || null,
      scopes: grant.scopes ?? [],
      grantedAt: grant.granted_at,
      lastUsedAt: lastUsedByClient.get(grant.client.id) ?? null,
    }))
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
};

/**
 * Revokes an app's access: Supabase ends its sessions and invalidates its
 * refresh tokens, so it must ask for consent again to reconnect.
 * @param {string} clientId - The OAuth client id
 */
export const disconnectApp = async (clientId) => {
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  if (error) throw new Error(`Failed to disconnect app: clientId=${clientId}`, { cause: error });
};
