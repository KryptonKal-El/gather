/**
 * Auth for direct calls to Supabase Edge Functions.
 */
import { supabase } from './supabase.js';

/**
 * Returns the bearer token to send to an edge function: the signed-in user's
 * access token, so the function can attribute the call to them, or the anon key
 * when nobody is signed in or the session can't be read.
 * @param {string} anonKey - The Supabase anon key to fall back to
 * @returns {Promise<string>}
 */
export const getEdgeAuthToken = async (anonKey) => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error('Failed to read the Supabase session', { cause: error });
    }
    return data.session?.access_token ?? anonKey;
  } catch (err) {
    console.error('Falling back to the anon key for edge function auth:', err);
    return anonKey;
  }
};
