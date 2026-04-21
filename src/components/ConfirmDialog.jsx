import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import styles from './ConfirmDialog.module.css';

/**
 * Reusable modal confirmation dialog.
 * Renders via a portal to document.body so it is never affected by
 * ancestor opacity or overflow. Shows a backdrop overlay with a message
 * and confirm/cancel buttons. Closes on Escape key or backdrop click.
 */
export const ConfirmDialog = ({ title, message, confirmLabel, cancelLabel, destructive, onConfirm, onCancel }) => {
  const dialogRef = useRef(null);
  const titleId = useId();
  const messageId = useId();

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
      <div
        className={styles.dialog}
        role={destructive ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={messageId}
      >
        {title && <h2 id={titleId} className={styles.title}>{title}</h2>}
        <p id={messageId} className={styles.message}>{message}</p>
        <div className={styles.actions}>
          {cancelLabel && (
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={destructive ? styles.confirmBtn : styles.confirmBtnNeutral}
            onClick={onConfirm}
          >
            {confirmLabel ?? 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

ConfirmDialog.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  destructive: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

ConfirmDialog.defaultProps = {
  title: null,
  confirmLabel: 'Delete',
  cancelLabel: 'Cancel',
  destructive: true,
};
