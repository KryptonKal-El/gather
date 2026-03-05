import { useState, useCallback } from 'react';

/**
 * @typedef {Object} UndoAction
 * @property {string} type - The type of action (e.g., 'delete-item', 'remove-recipe')
 * @property {*} data - Arbitrary data associated with the action
 * @property {() => Promise<void>} restore - Async function to restore/undo the action
 */

/**
 * @typedef {Object} UseUndoStackOptions
 * @property {number} [maxDepth=20] - Maximum number of actions to keep in the stack
 */

/**
 * @typedef {Object} UseUndoStackReturn
 * @property {(action: UndoAction) => void} push - Add an action to the top of the stack
 * @property {() => Promise<void>} undo - Pop and execute the most recent action's restore function
 * @property {boolean} canUndo - Whether there are actions available to undo
 * @property {() => UndoAction | null} peek - View the top action without removing it
 * @property {() => void} clear - Remove all actions from the stack
 */

/**
 * Hook that manages an in-memory undo stack for reversible actions.
 * Stack is cleared on unmount. Oldest entries are dropped when maxDepth is exceeded.
 *
 * @param {UseUndoStackOptions} [options] - Configuration options
 * @returns {UseUndoStackReturn} Undo stack API
 */
export const useUndoStack = ({ maxDepth = 20 } = {}) => {
  const [stack, setStack] = useState([]);

  const push = useCallback((action) => {
    setStack((prev) => {
      const newStack = [...prev, action];
      if (newStack.length > maxDepth) {
        return newStack.slice(1);
      }
      return newStack;
    });
  }, [maxDepth]);

  const undo = useCallback(async () => {
    let actionToRestore = null;

    setStack((prev) => {
      if (prev.length === 0) return prev;
      actionToRestore = prev[prev.length - 1];
      return prev.slice(0, -1);
    });

    if (actionToRestore) {
      await actionToRestore.restore();
    }
  }, []);

  const peek = useCallback(() => {
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }, [stack]);

  const clear = useCallback(() => {
    setStack([]);
  }, []);

  const canUndo = stack.length > 0;

  return { push, undo, canUndo, peek, clear };
};
