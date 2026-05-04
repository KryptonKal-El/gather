import { useEffect, useRef, useState } from 'react';

const TOGGLE_DELAY_MS = 1500;

const removePendingChecked = (pendingCheckedById, itemId) => {
  if (!Object.hasOwn(pendingCheckedById, itemId)) {
    return pendingCheckedById;
  }

  const nextPendingCheckedById = { ...pendingCheckedById };
  delete nextPendingCheckedById[itemId];
  return nextPendingCheckedById;
};

/**
 * Tracks optimistic checked state and delayed toggle commits per item.
 * Pending state is held above item rows so it survives row unmounts.
 *
 * @param {{
 *   items: Array<{ id: string, isChecked: boolean }>,
 *   onCommitToggle: (listId: string, itemId: string, nextChecked: boolean) => Promise<void>
 * }} params - Current items plus async commit handler.
 * @returns {{
 *   getEffectiveChecked: (item: { id: string, isChecked: boolean }) => boolean,
 *   handleToggle: (item: { id: string, isChecked: boolean, listId?: string }) => void
 * }} Pending toggle helpers.
 */
export const usePendingToggles = ({ items, onCommitToggle }) => {
  const [pendingCheckedById, setPendingCheckedById] = useState({});
  const pendingTogglesRef = useRef(new Map());
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const clearPendingToggle = (itemId) => {
    const existingEntry = pendingTogglesRef.current.get(itemId);
    if (existingEntry?.timerId) {
      clearTimeout(existingEntry.timerId);
    }

    pendingTogglesRef.current.delete(itemId);
    setPendingCheckedById((prev) => removePendingChecked(prev, itemId));
  };

  useEffect(() => {
    const stalePendingIds = [];

    for (const item of items) {
      const pendingEntry = pendingTogglesRef.current.get(item.id);
      if (!pendingEntry) {
        continue;
      }

      if (item.isChecked !== pendingEntry.originalChecked) {
        stalePendingIds.push(item.id);
      }
    }

    if (stalePendingIds.length === 0) {
      return undefined;
    }

    queueMicrotask(() => {
      for (const itemId of stalePendingIds) {
        clearPendingToggle(itemId);
      }
    });

    return undefined;
  }, [items]);

  const getEffectiveChecked = (item) => {
    if (Object.hasOwn(pendingCheckedById, item.id)) {
      return pendingCheckedById[item.id];
    }

    return item.isChecked;
  };

  const handleToggle = (item) => {
    const existingEntry = pendingTogglesRef.current.get(item.id);

    if (existingEntry) {
      if (existingEntry.timerId === null) {
        return;
      }

      clearPendingToggle(item.id);
      return;
    }

    if (!item.listId) {
      return;
    }

    const targetChecked = !item.isChecked;
    const timerId = setTimeout(() => {
      const pendingEntry = pendingTogglesRef.current.get(item.id);
      if (!pendingEntry) {
        return;
      }

      pendingTogglesRef.current.set(item.id, {
        ...pendingEntry,
        timerId: null,
      });

      onCommitToggle(pendingEntry.listId, item.id, pendingEntry.targetChecked)
        .then(() => {
          const hasCurrentItem = itemsRef.current.some((currentItem) => currentItem.id === item.id);
          if (!hasCurrentItem) {
            clearPendingToggle(item.id);
          }
        })
        .catch((err) => {
          console.error(`Failed to commit pending toggle for item ${item.id}:`, err);
          clearPendingToggle(item.id);
        });
    }, TOGGLE_DELAY_MS);

    pendingTogglesRef.current.set(item.id, {
      listId: item.listId,
      originalChecked: item.isChecked,
      targetChecked,
      timerId,
    });

    setPendingCheckedById((prev) => ({
      ...prev,
      [item.id]: targetChecked,
    }));
  };

  return {
    getEffectiveChecked,
    handleToggle,
  };
};
