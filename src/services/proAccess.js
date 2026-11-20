/**
 * Gather Lists Pro status for the signed-in user.
 * The server enforces every limit; this only decides which notices to show.
 */
import { supabase } from './supabase.js';

/**
 * Reports whether the user may use Pro-only features: true when limits don't
 * apply to their account yet, or when they hold a current subscription.
 * @param {string} userId
 * @returns {Promise<boolean>}
 * @throws {Error} When either lookup fails
 */
export const fetchHasProAccess = async (userId) => {
  const { data: isEnforced, error: enforcementError } = await supabase.rpc('pro_enforced');
  if (enforcementError) {
    throw new Error(`Failed to load the Pro limits switch: ${enforcementError.message}`, { cause: enforcementError });
  }
  if (!isEnforced) return true;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('expires_at')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1);
  if (error) {
    throw new Error(`Failed to load Pro status: ${error.message}`, { cause: error });
  }
  return data.length > 0;
};
