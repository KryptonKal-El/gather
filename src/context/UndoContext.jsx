/**
 * Undo context for managing reversible actions app-wide.
 * Provides an undo stack that components can push actions to and trigger undo.
 */
import { createContext, useContext, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Capacitor } from '@capacitor/core';
import { useUndoStack } from '../hooks/useUndoStack.js';
import { useShakeDetection, requestMotionPermission } from '../hooks/useShakeDetection.js';

export const UndoContext = createContext(null);

/**
 * Provides undo capabilities to the component tree.
 * Wraps useUndoStack and exposes push, undo, and canUndo via context.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element}
 */
export const UndoProvider = ({ children }) => {
  const stack = useUndoStack();
  const [isMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });

  const [motionPermission, setMotionPermission] = useState(() => {
    if (typeof window === 'undefined') return 'unknown';
    if (typeof DeviceMotionEvent?.requestPermission !== 'function') return 'granted';
    if (Capacitor.isNativePlatform()) {
      localStorage.setItem('shake-motion-permission', 'granted');
      return 'granted';
    }
    return localStorage.getItem('shake-motion-permission') ?? 'unknown';
  });

  const requestPermissionIfNeeded = useCallback(async () => {
    if (motionPermission !== 'unknown') return;
    const result = await requestMotionPermission();
    setMotionPermission(result);
  }, [motionPermission]);

  const wrappedPushUndo = useCallback((action) => {
    stack.push(action);
    requestPermissionIfNeeded();
  }, [stack, requestPermissionIfNeeded]);

  const handleShake = useCallback(() => {
    if (!stack.canUndo) return;
    stack.undo();
    navigator.vibrate?.(50);
  }, [stack]);

  useShakeDetection({ onShake: handleShake, enabled: isMobile && stack.canUndo, permissionState: motionPermission });

  const value = {
    pushUndo: wrappedPushUndo,
    undo: stack.undo,
    canUndo: stack.canUndo,
  };

  return (
    <UndoContext.Provider value={value}>
      {children}
    </UndoContext.Provider>
  );
};

UndoProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Hook to access undo capabilities.
 * Must be used within an UndoProvider.
 *
 * @returns {{ pushUndo: (action: Object) => void, undo: () => Promise<void>, canUndo: boolean }}
 */
export const useUndo = () => {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
};
