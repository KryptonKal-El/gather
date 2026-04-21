/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { Toast } from '../components/Toast.jsx';
import styles from '../components/Toast.module.css';

const DEFAULT_DURATIONS = {
  success: 3000,
  error: 4000,
};

const MAX_VISIBLE_TOASTS = 3;

const ToastContext = createContext(null);

/**
 * Provides app-wide toast notifications.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = ({ message, variant = 'success', durationMs }) => {
    const resolvedVariant = variant === 'error' ? 'error' : 'success';
    const nextToast = {
      id: globalThis.crypto?.randomUUID?.() ?? `toast-${Date.now()}-${Math.random()}`,
      message,
      variant: resolvedVariant,
      durationMs: durationMs ?? DEFAULT_DURATIONS[resolvedVariant],
      isVisible: true,
    };

    setToasts((currentToasts) => [...currentToasts, nextToast].slice(-MAX_VISIBLE_TOASTS));
  };

  const dismissToast = (toastId) => {
    setToasts((currentToasts) => currentToasts.map((toast) => {
      if (toast.id !== toastId || !toast.isVisible) return toast;
      return { ...toast, isVisible: false };
    }));
  };

  const removeToast = (toastId) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {typeof document !== 'undefined' && toasts.length > 0 && createPortal(
        <div className={styles.viewport}>
          {[...toasts].reverse().map((toast) => (
            <Toast
              key={toast.id}
              message={toast.message}
              variant={toast.variant}
              durationMs={toast.durationMs}
              isVisible={toast.isVisible}
              onDismiss={() => dismissToast(toast.id)}
              onExited={() => removeToast(toast.id)}
            />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Returns the toast API for the current component tree.
 *
 * @returns {{showToast: ({message: string, variant?: 'success'|'error', durationMs?: number}) => void}}
 */
export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
};
