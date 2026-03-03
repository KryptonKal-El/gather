import { Capacitor } from '@capacitor/core';
import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './PWAPrompt.module.css';

/**
 * PWA update prompt and offline-ready notification.
 * Uses the virtual module from vite-plugin-pwa to detect
 * service worker updates and offline readiness.
 */
export const PWAPrompt = () => {
  const isNative = Capacitor.isNativePlatform();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: !isNative,
  });

  const handleUpdate = () => {
    setNeedRefresh(false);

    const reloadOnce = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', reloadOnce);

    updateServiceWorker(true);

    // Fallback if controllerchange never fires
    setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', reloadOnce);
      window.location.reload();
    }, 2000);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  if (isNative || (!needRefresh && !offlineReady)) return null;

  return (
    <div className={styles.toast} role="alert">
      <p className={styles.message}>
        {needRefresh
          ? 'A new version is available.'
          : 'App is ready to work offline.'}
      </p>
      <div className={styles.actions}>
        {needRefresh && (
          <button className={styles.updateBtn} onClick={handleUpdate} type="button">
            Update
          </button>
        )}
        <button className={styles.dismissBtn} onClick={handleDismiss} type="button">
          Dismiss
        </button>
      </div>
    </div>
  );
};
