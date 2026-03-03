/**
 * Supabase client initialization.
 * Exports the configured Supabase client for use throughout the app.
 */
import { createClient } from '@supabase/supabase-js';
import { processLock } from '@supabase/auth-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: processLock,
  },
});
