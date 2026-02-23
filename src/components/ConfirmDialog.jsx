import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import styles from './ConfirmDialog.module.css';

/**
 * Reusable modal confirmation dialog.
 * Renders via a portal to document.body so it is never affected by
 * ancestor opacity or overflow. Shows a backdrop overlay with a message
 * and confirm/cancel buttons. Closes on Escape key or backdrop click.
 */
export const ConfirmDialog = ({ message, confirmLabel, onConfirm, onCancel }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Focus the confirm button on mount for keyboard accessibility
  useEffect(() => {
    dialogRef.current?.querySelector('button')?.focus();
  }, []);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick} ref={dialogRef}>
      <div className={styles.dialog}>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={styles.confirmBtn} onClick={onConfirm}>
            {confirmLabel ?? 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

ConfirmDialog.propTypes = {
  message: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
