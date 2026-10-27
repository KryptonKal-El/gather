import { useCallback, useEffect, useState } from 'react';
import { disconnectApp, fetchConnectedApps } from '../services/connectedApps.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { ConnectAiAppSheet } from './ConnectAiAppSheet.jsx';
import styles from './ConnectedApps.module.css';

const formatConnectedDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Settings section listing apps connected to the account (such as Claude via
 * the Gather MCP server), with a confirmed Disconnect for each.
 */
export const ConnectedApps = () => {
  const [apps, setApps] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [pendingApp, setPendingApp] = useState(null);
  const [disconnectingId, setDisconnectingId] = useState(null);
  const [isConnectOpen, setIsConnectOpen] = useState(false);

  const loadApps = useCallback(async ({ isSilent = false } = {}) => {
    if (!isSilent) {
      setIsLoading(true);
      setLoadError(null);
    }
    try {
      setApps(await fetchConnectedApps());
      setLoadError(null);
    } catch (error) {
      console.error('[ConnectedApps] load failed', error);
      if (!isSilent) setLoadError('Couldn’t load connected apps.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  // Pick up an app approved in another tab (e.g. after adding it on claude.ai).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadApps({ isSilent: true });
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadApps]);

  const handleCloseConnect = useCallback(() => {
    setIsConnectOpen(false);
    loadApps({ isSilent: true });
  }, [loadApps]);

  const handleConfirmDisconnect = async () => {
    const app = pendingApp;
    setPendingApp(null);
    setActionError(null);
    setDisconnectingId(app.clientId);
    try {
      await disconnectApp(app.clientId);
      setApps((current) => current.filter((a) => a.clientId !== app.clientId));
    } catch (error) {
      console.error('[ConnectedApps] disconnect failed', error);
      setActionError(`Couldn’t disconnect ${app.name}. Please try again.`);
    } finally {
      setDisconnectingId(null);
    }
  };

  const renderBody = () => {
    if (isLoading) {
      return <div className={styles.message}>Loading…</div>;
    }
    if (loadError) {
      return (
        <div className={styles.row}>
          <span className={styles.errorText}>{loadError}</span>
          <button type="button" className={styles.linkButton} onClick={() => loadApps()}>
            Retry
          </button>
        </div>
      );
    }
    if (apps.length === 0) {
      return (
        <div className={styles.message}>
          No apps connected. Apps like Claude appear here after you approve them.
        </div>
      );
    }
    return apps.map((app) => (
      <div className={styles.row} key={app.clientId}>
        <div className={styles.appInfo}>
          <span className={styles.appName}>{app.name}</span>
          <span className={styles.appMeta}>Connected {formatConnectedDate(app.grantedAt)}</span>
        </div>
        <button
          type="button"
          className={styles.disconnectButton}
          onClick={() => setPendingApp(app)}
          disabled={disconnectingId === app.clientId}
        >
          {disconnectingId === app.clientId ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>
    ));
  };

  return (
    <>
      <h3 className={styles.sectionHeader}>Connected Apps</h3>
      <div className={styles.section}>
        {renderBody()}
        {actionError && <div className={styles.errorRow}>{actionError}</div>}
        <div className={styles.row}>
          <button type="button" className={styles.linkButton} onClick={() => setIsConnectOpen(true)}>
            Connect an AI app
          </button>
        </div>
      </div>
      {isConnectOpen && <ConnectAiAppSheet onClose={handleCloseConnect} />}
      {pendingApp && (
        <ConfirmDialog
          title={`Disconnect ${pendingApp.name}?`}
          message={`${pendingApp.name} will no longer be able to see or change your lists, recipes, and meal plans. You can reconnect it later.`}
          confirmLabel="Disconnect"
          onConfirm={handleConfirmDisconnect}
          onCancel={() => setPendingApp(null)}
        />
      )}
    </>
  );
};
