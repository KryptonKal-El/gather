import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { isPasskeyCancelled, isPasskeySupported, passkeyErrorMessage } from '../utils/passkeyErrors.js';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import styles from './PasskeysSection.module.css';

const MAX_NAME_LENGTH = 120;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const passkeyName = (passkey) => passkey.friendly_name || 'Passkey';

/**
 * Settings section listing the user's passkeys, with add, rename, and a
 * confirmed remove for each.
 */
export const PasskeysSection = () => {
  const { listPasskeys, registerPasskey, renamePasskey, deletePasskey } = useAuth();
  const [passkeys, setPasskeys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draftName, setDraftName] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [isDisabledOnServer, setIsDisabledOnServer] = useState(false);
  const hasPasskeySupport = isPasskeySupported();

  const loadPasskeys = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setPasskeys(await listPasskeys());
    } catch (error) {
      if (error?.code === 'passkey_disabled') {
        setIsDisabledOnServer(true);
        return;
      }
      console.error('[PasskeysSection] load failed', error);
      setLoadError('Couldn’t load passkeys.');
    } finally {
      setIsLoading(false);
    }
    // listPasskeys is recreated on every AuthProvider render; load once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  const handleAdd = async () => {
    setActionError(null);
    setIsAdding(true);
    try {
      await registerPasskey();
      setPasskeys(await listPasskeys());
    } catch (error) {
      if (!isPasskeyCancelled(error)) {
        setActionError(passkeyErrorMessage(error));
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartRename = (passkey) => {
    setActionError(null);
    setEditingId(passkey.id);
    setDraftName(passkey.friendly_name ?? '');
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setDraftName('');
  };

  const handleSaveRename = async (event) => {
    event.preventDefault();
    const id = editingId;
    const name = draftName.trim();
    if (!name) return;
    setBusyId(id);
    try {
      await renamePasskey(id, name);
      setPasskeys((current) => current.map((p) => (p.id === id ? { ...p, friendly_name: name } : p)));
      handleCancelRename();
    } catch (error) {
      console.error('[PasskeysSection] rename failed', error);
      setActionError('Couldn’t rename the passkey. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmRemove = async () => {
    const passkey = pendingRemoval;
    setPendingRemoval(null);
    setActionError(null);
    setBusyId(passkey.id);
    try {
      await deletePasskey(passkey.id);
      setPasskeys((current) => current.filter((p) => p.id !== passkey.id));
    } catch (error) {
      console.error('[PasskeysSection] remove failed', error);
      setActionError(`Couldn’t remove ${passkeyName(passkey)}. Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  const renderPasskey = (passkey) => {
    if (editingId === passkey.id) {
      return (
        <form className={styles.row} key={passkey.id} onSubmit={handleSaveRename}>
          <input
            className={styles.nameInput}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            aria-label="Passkey name"
            autoFocus
          />
          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={handleCancelRename}>
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={!draftName.trim() || busyId === passkey.id}
            >
              Save
            </button>
          </div>
        </form>
      );
    }

    const lastUsed = passkey.last_used_at ? ` · Last used ${formatDate(passkey.last_used_at)}` : '';
    return (
      <div className={styles.row} key={passkey.id}>
        <div className={styles.info}>
          <span className={styles.name}>{passkeyName(passkey)}</span>
          <span className={styles.meta}>Added {formatDate(passkey.created_at)}{lastUsed}</span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => handleStartRename(passkey)}
            disabled={busyId === passkey.id}
          >
            Rename
          </button>
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => setPendingRemoval(passkey)}
            disabled={busyId === passkey.id}
          >
            {busyId === passkey.id ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return <div className={styles.message}>Loading…</div>;
    }
    if (loadError) {
      return (
        <div className={styles.row}>
          <span className={styles.errorText}>{loadError}</span>
          <button type="button" className={styles.linkButton} onClick={loadPasskeys}>
            Retry
          </button>
        </div>
      );
    }
    if (passkeys.length === 0) {
      return (
        <div className={styles.message}>
          Sign in with Face ID, Touch ID, or your device passcode instead of waiting for an email code.
        </div>
      );
    }
    return passkeys.map(renderPasskey);
  };

  if (isDisabledOnServer) return null;

  return (
    <>
      <h3 className={styles.sectionHeader}>Passkeys</h3>
      <div className={styles.section}>
        {renderBody()}
        {actionError && <div className={styles.errorRow}>{actionError}</div>}
        {hasPasskeySupport ? (
          <div className={styles.row}>
            <button
              type="button"
              className={styles.linkButton}
              onClick={handleAdd}
              disabled={isAdding || isLoading}
            >
              {isAdding ? 'Adding…' : 'Add a passkey'}
            </button>
          </div>
        ) : (
          <div className={styles.message}>This browser doesn’t support passkeys.</div>
        )}
      </div>
      {pendingRemoval && (
        <ConfirmDialog
          title={`Remove ${passkeyName(pendingRemoval)}?`}
          message="You won’t be able to sign in with this passkey anymore. The passkey may still appear in your password manager until you delete it there."
          confirmLabel="Remove"
          onConfirm={handleConfirmRemove}
          onCancel={() => setPendingRemoval(null)}
        />
      )}
    </>
  );
};
