import { useState, useEffect, useCallback, useRef } from 'react';

const TRANSITION_DURATION = 300;

/**
 * Hook that manages mobile navigation state for iOS-style tab/detail navigation.
 * Tracks the active tab and which list/recipe (if any) is open in detail view.
 * Manages push/pop transition states for slide animations.
 * Integrates with browser history for back button support.
 * 
 * @param {Array} lists - Current lists array to lookup list data during transitions
 * @param {Array} recipes - Current recipes array to lookup recipe data during transitions
 * @returns {{
 *   activeTab: 'lists' | 'recipes' | 'stores' | 'settings',
 *   openListId: string | null,
 *   openRecipeId: string | null,
 *   transition: 'pushing' | 'popping' | null,
 *   poppingListData: object | null,
 *   poppingRecipeData: object | null,
 *   handleTabChange: (tab: string) => void,
 *   handleOpenList: (listId: string) => void,
 *   handleOpenRecipe: (recipeId: string) => void,
 *   handleBack: () => void,
 *   handleRecipeBack: () => void,
 * }}
 */
export const useMobileNav = (lists = [], recipes = []) => {
  const [activeTab, setActiveTab] = useState('lists');
  const [openListId, setOpenListId] = useState(null);
  const [openRecipeId, setOpenRecipeId] = useState(null);
  const [transition, setTransition] = useState(null);
  const [poppingListData, setPoppingListData] = useState(null);
  const [poppingRecipeData, setPoppingRecipeData] = useState(null);
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
    setPoppingRecipeData(null);
    setActiveTab(tab);
    setOpenListId(null);
    setOpenRecipeId(null);
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

  const startRecipePopTransition = useCallback((currentRecipeId, currentRecipes) => {
    clearTransitionTimeout();
    const recipeData = currentRecipes.find((r) => r.id === currentRecipeId);
    setPoppingRecipeData(recipeData ?? null);
    setTransition('popping');

    transitionTimeoutRef.current = setTimeout(() => {
      setOpenRecipeId(null);
      setTransition(null);
      setPoppingRecipeData(null);
    }, TRANSITION_DURATION);
  }, [clearTransitionTimeout]);

  const handleOpenRecipe = useCallback((recipeId) => {
    if (openRecipeId === recipeId) return;
    clearTransitionTimeout();
    setOpenRecipeId(recipeId);
    setPoppingRecipeData(null);
    setTransition('pushing');
    window.history.pushState({ view: 'recipe-detail', recipeId }, '');

    transitionTimeoutRef.current = setTimeout(() => {
      setTransition(null);
    }, TRANSITION_DURATION);
  }, [clearTransitionTimeout, openRecipeId]);

  const handleRecipeBack = useCallback(() => {
    startRecipePopTransition(openRecipeId, recipes);
  }, [startRecipePopTransition, openRecipeId, recipes]);

  useEffect(() => {
    const onPopState = () => {
      if (openRecipeId && !transition) {
        startRecipePopTransition(openRecipeId, recipes);
      } else if (openListId && !transition) {
        startPopTransition(openListId, lists);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [openListId, openRecipeId, transition, startPopTransition, startRecipePopTransition, lists, recipes]);

  useEffect(() => {
    return () => clearTransitionTimeout();
  }, [clearTransitionTimeout]);

  return {
    activeTab,
    openListId,
    openRecipeId,
    transition,
    poppingListData,
    poppingRecipeData,
    handleTabChange,
    handleOpenList,
    handleOpenRecipe,
    handleBack,
    handleRecipeBack,
  };
};
