import { useState, useEffect, useCallback, useRef } from 'react';

const TRANSITION_DURATION = 300;

/**
 * Hook that manages mobile navigation state for iOS-style tab/detail navigation.
 * Tracks the active tab and which list (if any) is open in detail view.
 * Manages push/pop transition states for slide animations.
 * Integrates with browser history for back button support.
 * 
 * @param {Array} lists - Current lists array to lookup list data during transitions
 * @returns {{
 *   activeTab: 'lists' | 'stores' | 'settings',
 *   openListId: string | null,
 *   transition: 'pushing' | 'popping' | null,
 *   poppingListData: object | null,
 *   handleTabChange: (tab: string) => void,
 *   handleOpenList: (listId: string) => void,
 *   handleBack: () => void,
 * }}
 */
export const useMobileNav = (lists = []) => {
  const [activeTab, setActiveTab] = useState('lists');
  const [openListId, setOpenListId] = useState(null);
  const [transition, setTransition] = useState(null);
  const [poppingListData, setPoppingListData] = useState(null);
  const transitionTimeoutRef = useRef(null);

  const clearTransitionTimeout = useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
  }, []);

  const handleTabChange = useCallback((tab) => {
    clearTransitionTimeout();
    setTransition(null);
    setPoppingListData(null);
    setActiveTab(tab);
    setOpenListId(null);
  }, [clearTransitionTimeout]);

  const handleOpenList = useCallback((listId) => {
    if (openListId === listId) return;
    clearTransitionTimeout();
    setOpenListId(listId);
    setPoppingListData(null);
    setTransition('pushing');
    window.history.pushState({ view: 'list-detail', listId }, '');

    transitionTimeoutRef.current = setTimeout(() => {
      setTransition(null);
    }, TRANSITION_DURATION);
  }, [clearTransitionTimeout, openListId]);

  const startPopTransition = useCallback((currentListId, currentLists) => {
    clearTransitionTimeout();
    const listData = currentLists.find((l) => l.id === currentListId);
    setPoppingListData(listData ?? null);
    setTransition('popping');

    transitionTimeoutRef.current = setTimeout(() => {
      setOpenListId(null);
      setTransition(null);
      setPoppingListData(null);
    }, TRANSITION_DURATION);
  }, [clearTransitionTimeout]);

  const handleBack = useCallback(() => {
    startPopTransition(openListId, lists);
  }, [startPopTransition, openListId, lists]);

  useEffect(() => {
    const onPopState = () => {
      if (openListId && !transition) {
        startPopTransition(openListId, lists);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [openListId, transition, startPopTransition, lists]);

  useEffect(() => {
    return () => clearTransitionTimeout();
  }, [clearTransitionTimeout]);

  return {
    activeTab,
    openListId,
    transition,
    poppingListData,
    handleTabChange,
    handleOpenList,
    handleBack,
  };
};
