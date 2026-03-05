/**
 * Undo context for managing reversible actions app-wide.
 * Provides an undo stack that components can push actions to and trigger undo.
 */
import { createContext, useContext } from 'react';
import PropTypes from 'prop-types';
import { useUndoStack } from '../hooks/useUndoStack.js';

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

  const value = {
    pushUndo: stack.push,
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
