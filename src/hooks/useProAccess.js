import { useState, useEffect } from 'react';
import { fetchHasProAccess } from '../services/proAccess.js';

/**
 * Whether the signed-in user may use Pro-only features. Stays true while
 * loading and when the lookup fails, so a subscriber is never locked out by a
 * failed request; the server still enforces the real limits.
 * @param {string|null} userId
 * @returns {boolean}
 */
export const useProAccess = (userId) => {
  const [access, setAccess] = useState({ userId: null, hasProAccess: true });

  useEffect(() => {
    if (!userId) return undefined;
    let isCurrent = true;
    const load = async () => {
      try {
        const hasProAccess = await fetchHasProAccess(userId);
        if (isCurrent) setAccess({ userId, hasProAccess });
      } catch (err) {
        console.error('[useProAccess] Failed to load Pro access:', err);
      }
    };
    load();
    return () => { isCurrent = false; };
  }, [userId]);

  return access.userId === userId ? access.hasProAccess : true;
};
