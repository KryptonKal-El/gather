/**
 * PWA update prompt and offline-ready notification.
 * Uses the virtual module from vite-plugin-pwa to detect
 * service worker updates and offline readiness.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './PWAPrompt.module.css';

export const PWAPrompt = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  const handleUpdate = () => {
    updateServiceWorker(true);
    // Force reload after a short delay — updateServiceWorker's promise
    // may never resolve if the controllerchange event doesn't fire
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  if (!needRefresh && !offlineReady) return null;

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
