/**
 * Apps the user has connected to their account through Gather's OAuth server
 * (e.g. Claude via the MCP server). Backed by Supabase Auth's OAuth grants.
 */
import { supabase } from './supabase.js';

/**
 * Lists the apps the signed-in user has approved, newest first.
 * @returns {Promise<Array<{clientId: string, name: string, uri: string|null, logoUri: string|null, scopes: string[], grantedAt: string}>>}
 */
export const fetchConnectedApps = async () => {
  const { data, error } = await supabase.auth.oauth.listGrants();
  if (error) throw new Error('Failed to load connected apps', { cause: error });
  return data
    .map((grant) => ({
      clientId: grant.client.id,
      name: grant.client.name || 'Unnamed app',
      uri: grant.client.uri || null,
      logoUri: grant.client.logo_uri || null,
      scopes: grant.scopes ?? [],
      grantedAt: grant.granted_at,
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
