import { useState, useEffect, useRef, useCallback } from 'react';
import { useIsMobile } from './useIsMobile.js';

const DISMISS_KEY = 'pwa-install-dismissed';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Checks if the dismissal is still active (within 7-day window).
 * @returns {boolean} True if dismissal is active.
 */
const isDismissalActive = () => {
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (!dismissedAt) return false;
  const timestamp = parseInt(dismissedAt, 10);
  return timestamp + DISMISS_DURATION > Date.now();
};

/**
 * Detects if running in standalone (installed PWA) mode.
 * @returns {boolean} True if app is installed.
 */
const isStandalone = () => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true
  );
};

/**
 * Detects if the browser is Safari on iOS (not Chrome, Firefox, or Edge on iOS).
 * @returns {boolean} True if iOS Safari.
 */
const isIOSSafari = () => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua);
  const isChrome = /CriOS/.test(ua);
  const isFirefox = /FxiOS/.test(ua);
  const isEdge = /EdgiOS/.test(ua);
  return isIOS && isSafari && !isChrome && !isFirefox && !isEdge;
};

/**
 * Hook that manages PWA install banner visibility and installation prompts.
 * Handles Android's beforeinstallprompt, iOS Safari detection, dismissal persistence,
 * and standalone mode detection.
 *
 * @returns {{
 *   showBanner: boolean,
 *   platform: 'android' | 'ios' | null,
 *   promptInstall: () => Promise<void>,
 *   dismissBanner: () => void
 * }}
 */
export const usePWAInstall = () => {
  const isMobile = useIsMobile();
  const deferredPromptRef = useRef(null);
  const [hasInstalled, setHasInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(isDismissalActive);

  const [platform, setPlatform] = useState(() => {
    if (isIOSSafari()) return 'ios';
    return null;
  });

  const [hasPromptEvent, setHasPromptEvent] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setPlatform('android');
      setHasPromptEvent(true);
    };

    const handleAppInstalled = () => {
      setHasInstalled(true);
      deferredPromptRef.current = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (platform !== 'android' || !deferredPromptRef.current) return;

    const prompt = deferredPromptRef.current;
    prompt.prompt();
    await prompt.userChoice;
    deferredPromptRef.current = null;
  }, [platform]);

  const dismissBanner = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsDismissed(true);
  }, []);

  const showBanner =
    isMobile &&
    !isStandalone() &&
    !isDismissed &&
    !hasInstalled &&
    (platform === 'ios' || hasPromptEvent);

  return {
    showBanner,
    platform,
    promptInstall,
    dismissBanner,
  };
};
