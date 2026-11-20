/**
 * Account deletion service.
 */
import { supabase } from './supabase.js';

/**
 * Permanently deletes the signed-in user's account and everything they own.
 * @returns {Promise<void>}
 * @throws {Error} When nobody is signed in or the server refuses the deletion
 */
export const deleteAccount = async () => {
  const baseUrl = import.meta.env.VITE_SUPABASE_EDGE_FUNCTION_URL;
  if (!baseUrl) {
    throw new Error('Account deletion is not configured: missing Supabase edge function URL');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error('Failed to read the Supabase session before deleting the account', { cause: error });
  }
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Cannot delete the account: nobody is signed in');
  }

  let res;
  try {
    res = await fetch(`${baseUrl}/delete-account`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
  } catch (err) {
    throw new Error('Account deletion request failed', { cause: err });
  }

  if (!res.ok) {
    throw new Error(`Account deletion was refused with status ${res.status}`);
  }
};
