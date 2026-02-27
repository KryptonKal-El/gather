/**
 * Authentication context using Supabase Auth.
 * Supports Apple sign-in, Google sign-in, and email/password.
 * Provides user state, loading state, and auth actions to the component tree.
 */
import { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../services/supabase.js';

export const AuthContext = createContext(null);

/**
 * Fetches the user's profile from the profiles table.
 * @param {string} userId - The user's ID
 * @returns {Promise<Object|null>}
 */
const fetchProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, avatar_url, created_at')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to fetch profile:', error);
    return null;
  }
  return data;
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
    profile,
  };
};

/** Provides auth state and actions to the app. */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount to avoid flash of login screen
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setUser(mergeUserWithProfile(session.user, profile));
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setUser(mergeUserWithProfile(session.user, profile));
        } else {
          setUser(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Signs in with Google OAuth.
   * @returns {Promise<void>}
   */
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  };

  /**
   * Signs in with Apple OAuth.
   * @returns {Promise<void>}
   */
  const signInWithApple = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'apple' });
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
    <AuthContext.Provider value={{ user, isLoading, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access auth state and actions.
 * Must be used within an AuthProvider.
 * @returns {{ user: Object|null, isLoading: boolean, signInWithGoogle: Function, signInWithApple: Function, signInWithEmail: Function, signUpWithEmail: Function, signOut: Function, refreshUser: Function }}
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
