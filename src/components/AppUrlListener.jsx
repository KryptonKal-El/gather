import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '../services/supabase.js';

/**
 * Listens for deep link (appUrlOpen) events on native platforms
 * and handles Supabase auth callback URLs.
 */
export const AppUrlListener = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleAppUrlOpen = async ({ url }) => {
      if (url.includes('auth/callback') || url.includes('#access_token')) {
        const hashIndex = url.indexOf('#');
        if (hashIndex !== -1) {
          const params = new URLSearchParams(url.substring(hashIndex + 1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          }
        }
      }
    };

    const listener = CapApp.addListener('appUrlOpen', handleAppUrlOpen);
    return () => { listener.then(l => l.remove()); };
  }, []);

  return null;
};
