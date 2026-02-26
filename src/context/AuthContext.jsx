/**
 * Authentication context using Firebase Auth.
 * Supports Apple sign-in, Google sign-in, email/password, and anonymous sign-in.
 * Provides user state, loading state, and auth actions to the component tree.
 */
import { createContext, useState, useEffect, useContext } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
} from 'firebase/auth';
import { auth } from '../services/firebase.js';

export const AuthContext = createContext(null);

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

/** Provides auth state and actions to the app. */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Google sign-in failed:', err);
      throw err;
    }
  };

  const signInWithApple = async () => {
    try {
      await signInWithPopup(auth, appleProvider);
    } catch (err) {
      console.error('Apple sign-in failed:', err);
      throw err;
    }
  };

  const signInAsGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.error('Anonymous sign-in failed:', err);
      throw err;
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('Email sign-in failed:', err);
      throw err;
    }
  };

  const signUpWithEmail = async (email, password) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error('Email sign-up failed:', err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Sign-out failed:', err);
      throw err;
    }
  };

  const refreshUser = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, signInAsGuest, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access auth state and actions.
 * Must be used within an AuthProvider.
 * @returns {{ user: Object|null, isLoading: boolean, signInWithGoogle: Function, signInWithApple: Function, signInWithEmail: Function, signUpWithEmail: Function, signInAsGuest: Function, signOut: Function, refreshUser: Function }}
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
