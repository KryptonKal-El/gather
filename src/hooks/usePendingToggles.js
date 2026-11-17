import { useEffect, useRef, useState } from 'react';

const HOLD_DELAY_MS = 1500;

const omitKey = (record, key) => {
  if (!Object.hasOwn(record, key)) {
    return record;
  }

  const next = { ...record };
  delete next[key];
  return next;
};

/**
 * Commits item toggles immediately while holding each toggled item in its
 * current section. Every toggle restarts one shared timer; when it finally
 * expires, all held items move to their new section together, so the list
 * never shifts while the user is still crossing items off.
 * State is held above item rows so it survives row unmounts.
 *
 * @param {{
 *   items: Array<{ id: string, isChecked: boolean }>,
 *   onCommitToggle: (listId: string, itemId: string, nextChecked: boolean) => Promise<void>
 * }} params - Current items plus async commit handler.
 * @returns {{
 *   getEffectiveChecked: (item: { id: string, isChecked: boolean }) => boolean,
 *   getPlacementChecked: (item: { id: string, isChecked: boolean }) => boolean,
 *   handleToggle: (item: { id: string, isChecked: boolean, listId?: string }) => void
 * }} `getEffectiveChecked` is the state to render on the row; `getPlacementChecked`
 * is the section (checked or unchecked) the row should currently sit in.
 */
export const usePendingToggles = ({ items, onCommitToggle }) => {
  const [optimisticCheckedById, setOptimisticCheckedById] = useState({});
  const [heldCheckedById, setHeldCheckedById] = useState({});
  const commitsRef = useRef(new Map());
  const heldIdsRef = useRef(new Set());
  const releaseTimerRef = useRef(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => clearTimeout(releaseTimerRef.current), []);

  const isSettled = (itemId) => {
    const entry = commitsRef.current.get(itemId);
    return Boolean(entry) && entry.pendingCount === 0 && !heldIdsRef.current.has(itemId);
  };

  const clearOptimistic = (itemId) => {
    commitsRef.current.delete(itemId);
    setOptimisticCheckedById((prev) => omitKey(prev, itemId));
  };

  /**
   * Drops the optimistic state once the server state can be trusted again:
   * the commit failed, the item is gone, or the items already show the target.
   * Otherwise the override waits for the next items change (the realtime echo).
   */
  const clearOptimisticIfConfirmed = (itemId) => {
    if (!isSettled(itemId)) {
      return;
    }

    const entry = commitsRef.current.get(itemId);
    const currentItem = itemsRef.current.find((item) => item.id === itemId);
    if (entry.hasFailed || !currentItem || currentItem.isChecked === entry.targetChecked) {
      clearOptimistic(itemId);
    }
  };

  useEffect(() => {
    const settledIds = [...commitsRef.current.keys()].filter(isSettled);
    if (settledIds.length === 0) {
      return;
    }

    queueMicrotask(() => {
      for (const itemId of settledIds) {
        if (isSettled(itemId)) {
          clearOptimistic(itemId);
        }
      }
    });
  }, [items]);

  const releaseHeldItems = () => {
    const releasedIds = [...heldIdsRef.current];
    heldIdsRef.current.clear();
    releaseTimerRef.current = null;
    setHeldCheckedById({});

    for (const itemId of releasedIds) {
      clearOptimisticIfConfirmed(itemId);
    }
  };

  const runCommit = async (entry, previousCommit, listId, itemId, targetChecked) => {
    await previousCommit;

    try {
      await onCommitToggle(listId, itemId, targetChecked);
      entry.hasFailed = false;
    } catch (err) {
      console.error(`Failed to commit toggle for item ${itemId}:`, err);
      entry.hasFailed = true;
    }

    entry.pendingCount -= 1;
    clearOptimisticIfConfirmed(itemId);
  };

  const getEffectiveChecked = (item) => optimisticCheckedById[item.id] ?? item.isChecked;

  const getPlacementChecked = (item) => heldCheckedById[item.id] ?? item.isChecked;

  const handleToggle = (item) => {
    if (!item.listId) {
      return;
    }

    const entry = commitsRef.current.get(item.id)
      ?? { targetChecked: item.isChecked, pendingCount: 0, hasFailed: false, commit: Promise.resolve() };
    const targetChecked = !entry.targetChecked;

    entry.targetChecked = targetChecked;
    entry.pendingCount += 1;
    // Chained per item so rapid re-toggles reach the database in tap order.
    entry.commit = runCommit(entry, entry.commit, item.listId, item.id, targetChecked);
    commitsRef.current.set(item.id, entry);

    setOptimisticCheckedById((prev) => ({ ...prev, [item.id]: targetChecked }));

    if (!heldIdsRef.current.has(item.id)) {
      heldIdsRef.current.add(item.id);
      setHeldCheckedById((prev) => ({ ...prev, [item.id]: item.isChecked }));
    }

    clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(releaseHeldItems, HOLD_DELAY_MS);
  };

  return {
    getEffectiveChecked,
    getPlacementChecked,
    handleToggle,
  };
};
