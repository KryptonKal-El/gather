/**
 * Authentication context using Supabase Auth.
 * Supports Apple sign-in and email/password.
 * Provides user state, loading state, and auth actions to the component tree.
 * Exposes sessionVersion to signal downstream contexts when auth/token refreshes.
 */
import { createContext, useState, useEffect, useContext, useRef } from 'react';
import { supabase } from '../services/supabase.js';

export const AuthContext = createContext(null);

/**
 * Fetches the user's profile from the profiles table.
 * @param {string} userId - The user's ID
 * @returns {Promise<Object|null>}
 */
const fetchProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url, created_at, timezone, image_search_settings')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Failed to fetch profile (network):', err);
    return null;
  }
};

/**
 * Merges profile data into the Supabase user object.
 * @param {Object} supabaseUser - The Supabase auth user
 * @param {Object|null} profile - The profile from the profiles table
 * @returns {Object}
 */
const mergeUserWithProfile = (supabaseUser, profile) => {
  return {
    ...supabaseUser,
    profile: {
      ...profile,
      imageSearchSettings: profile?.image_search_settings ?? { walmart: true, spoonacular: false, openfoodfacts: false, serpapi: false },
    },
  };
};

/** Provides auth state and actions to the app. */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  // Incremented when session/token refreshes; downstream contexts use this to resubscribe
  const [sessionVersion, setSessionVersion] = useState(0);
  const lastAccessTokenRef = useRef(null);

  // Auth state subscription. The callback MUST stay synchronous and MUST NOT
  // call other Supabase methods (e.g. a profiles query): supabase-js invokes
  // this callback while holding the auth lock during INITIAL_SESSION / token
  // refresh, and a re-entrant Supabase call deadlocks the (non-reentrant)
  // processLock — which left the app stuck on "Loading..." until a lucky
  // refresh won the race. The current session arrives via the INITIAL_SESSION
  // event, so no explicit getSession() is needed. Profile data is fetched in a
  // separate effect below, outside the lock.
  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        if (session?.user) {
          // Detect token refresh: same user but new access token
          const currentToken = session.access_token;
          const previousToken = lastAccessTokenRef.current;
          if (previousToken && currentToken !== previousToken && event === 'TOKEN_REFRESHED') {
            setSessionVersion((v) => v + 1);
          }
          lastAccessTokenRef.current = currentToken;
          setUser((prev) => (
            // Preserve an already-loaded profile across token refreshes; otherwise
            // set a base user now and let the profile effect below enrich it.
            prev?.id === session.user.id && prev.profile?.id
              ? { ...session.user, profile: prev.profile }
              : mergeUserWithProfile(session.user, null)
          ));
        } else {
          lastAccessTokenRef.current = null;
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Failsafe: never let the app hang on the loading screen indefinitely, even
  // if the auth subscription somehow fails to emit.
  useEffect(() => {
    if (!isLoading) return undefined;
    const timeout = setTimeout(() => setIsLoading(false), 5000);
    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Enrich the signed-in user with their profile. Runs outside the auth lock
  // (unlike the onAuthStateChange callback), so it cannot deadlock token refresh.
  const userId = user?.id ?? null;
  const hasProfile = !!user?.profile?.id;
  useEffect(() => {
    if (!userId || hasProfile) return undefined;
    let cancelled = false;
    fetchProfile(userId).then((profile) => {
      if (cancelled || !profile) return;
      setUser((prev) => (prev?.id === userId ? mergeUserWithProfile(prev, profile) : prev));
    });
    return () => {
      cancelled = true;
    };
  }, [userId, hasProfile]);

  /**
   * Signs in with Apple via OAuth redirect flow.
   * @returns {Promise<void>}
   */
   const signInWithApple = async () => {
     const { error } = await supabase.auth.signInWithOAuth({
       provider: 'apple',
       options: {
         redirectTo: `${window.location.origin}/app`,
       },
     });
     if (error) {
       console.error('Apple sign-in failed:', error);
       throw error;
     }
   };

  /**
   * Signs in with email and password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  const signInWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('Email sign-in failed:', error);
      throw error;
    }
  };

  /**
   * Signs up with email and password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<void>}
   */
  const signUpWithEmail = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error('Email sign-up failed:', error);
      throw error;
    }
  };

  /**
   * Signs out the current user.
   * @returns {Promise<void>}
   */
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign-out failed:', error);
      throw error;
    }
  };

  /**
   * Refreshes the current user data from Supabase and re-fetches the profile.
   * @returns {Promise<void>}
   */
  const refreshUser = async () => {
    const { data: { user: refreshedUser }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Failed to refresh user:', error);
      return;
    }
    if (refreshedUser) {
      const profile = await fetchProfile(refreshedUser.id);
      setUser(mergeUserWithProfile(refreshedUser, profile));
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, sessionVersion, signInWithApple, signInWithEmail, signUpWithEmail, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access auth state and actions.
 * Must be used within an AuthProvider.
 * @returns {{ user: Object|null, isLoading: boolean, sessionVersion: number, signInWithApple: Function, signInWithEmail: Function, signUpWithEmail: Function, signOut: Function, refreshUser: Function }}
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
