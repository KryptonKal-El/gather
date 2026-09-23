import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchMealPlans,
  createMealPlan,
  updateEnabledMeals,
  fetchMealPlanEntries,
  upsertMealPlanEntry,
  deleteMealPlanEntry,
  fetchPlannableRecipes,
  fetchIngredientsForRecipes,
  shareMealPlan,
  unshareMealPlan,
  getMealPlanShares,
  getMealPlanCollaborators,
  subscribeMealPlans,
} from '../services/mealPlanDatabase.js';
import {
  MEAL_TYPES,
  startOfWeek,
  weekDays,
  shiftWeek,
  toDateKey,
  slotKey,
  mergeWeekIngredients,
} from '../utils/mealPlan.js';

const ACTIVE_PLAN_KEY = 'gather_active_meal_plan_id';

const readStoredPlanId = () => {
  try {
    return localStorage.getItem(ACTIVE_PLAN_KEY);
  } catch {
    return null;
  }
};

const storePlanId = (planId) => {
  try {
    if (planId) localStorage.setItem(ACTIVE_PLAN_KEY, planId);
    else localStorage.removeItem(ACTIVE_PLAN_KEY);
  } catch {
    // Ignore storage errors (e.g. private mode).
  }
};

/**
 * Keeps the current plan if still visible, else the remembered one, else a plan someone
 * shared with the user (they joined a household), else their own.
 */
const chooseActivePlan = (plans, currentId, userId) => {
  if (currentId && plans.some((p) => p.id === currentId)) return currentId;
  const stored = readStoredPlanId();
  if (stored && plans.some((p) => p.id === stored)) return stored;
  return plans.find((p) => p.ownerId !== userId)?.id ?? plans[0]?.id ?? null;
};

/**
 * State and actions for the Plan tab: the active shared meal plan, the visible week's
 * slots, plannable recipes, sharing, and building the week's shopping ingredients.
 * @param {string|null} userId
 * @param {string|null} userEmail
 */
export const useMealPlan = (userId, userEmail) => {
  const [plans, setPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState({});
  const [recipes, setRecipes] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const activePlanIdRef = useRef(null);
  const weekStartRef = useRef(weekStart);
  activePlanIdRef.current = activePlanId;
  weekStartRef.current = weekStart;

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const activePlan = plans.find((p) => p.id === activePlanId) ?? null;
  const isOwner = activePlan?.ownerId === userId;
  const enabledMeals = useMemo(
    () => MEAL_TYPES.filter((m) => (activePlan?.enabledMeals ?? MEAL_TYPES.map((t) => t.id)).includes(m.id)),
    [activePlan],
  );
  const isCurrentWeek = toDateKey(weekStart) === toDateKey(startOfWeek(new Date()));
  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const loadWeek = useCallback(async (planId, start) => {
    if (!planId) {
      setEntries({});
      return;
    }
    const range = weekDays(start);
    const rows = await fetchMealPlanEntries(planId, toDateKey(range[0]), toDateKey(range[6]));
    // Ignore a stale response if the user moved to another week or plan meanwhile.
    if (planId !== activePlanIdRef.current || toDateKey(start) !== toDateKey(weekStartRef.current)) return;
    setEntries(Object.fromEntries(rows.map((row) => [slotKey(row.date, row.meal), row])));
  }, []);

  const loadCollaborators = useCallback(async (planId) => {
    if (!planId) return;
    try {
      setCollaborators(await getMealPlanCollaborators(planId));
    } catch (err) {
      console.error('[useMealPlan] Failed to load collaborators:', err);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    let fetched = await fetchMealPlans();
    if (fetched.length === 0) {
      try {
        fetched = [await createMealPlan(userId)];
      } catch (err) {
        // Another device may have just created it (one owned plan per user); use theirs.
        fetched = await fetchMealPlans();
        if (fetched.length === 0) throw err;
      }
    }
    const nextId = chooseActivePlan(fetched, activePlanIdRef.current, userId);
    setPlans(fetched);
    setActivePlanId(nextId);
    activePlanIdRef.current = nextId;
    return nextId;
  }, [userId]);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const planId = await loadPlans();
      const [recipeRows] = await Promise.all([
        fetchPlannableRecipes(),
        loadWeek(planId, weekStartRef.current),
      ]);
      setRecipes(recipeRows);
      await loadCollaborators(planId);
    } catch (err) {
      console.error('[useMealPlan] Failed to load:', err);
      setError("Couldn't load your meal plan.");
    } finally {
      setIsLoading(false);
    }
  }, [userId, loadPlans, loadWeek, loadCollaborators]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!userId) return undefined;
    return subscribeMealPlans(userId, {
      onEntries: () => {
        loadWeek(activePlanIdRef.current, weekStartRef.current).catch((err) =>
          console.error('[useMealPlan] Failed to refresh week:', err));
      },
      onPlans: async () => {
        try {
          const planId = await loadPlans();
          await loadWeek(planId, weekStartRef.current);
          await loadCollaborators(planId);
        } catch (err) {
          console.error('[useMealPlan] Failed to refresh plans:', err);
        }
      },
    });
  }, [userId, loadPlans, loadWeek, loadCollaborators]);

  const changeWeek = useCallback(async (nextStart) => {
    setWeekStart(nextStart);
    weekStartRef.current = nextStart;
    setEntries({});
    setError(null);
    try {
      await loadWeek(activePlanIdRef.current, nextStart);
    } catch (err) {
      console.error('[useMealPlan] Failed to load week:', err);
      setError("Couldn't load this week.");
    }
  }, [loadWeek]);

  const goToWeek = useCallback((offset) => changeWeek(shiftWeek(weekStartRef.current, offset)), [changeWeek]);
  const goToCurrentWeek = useCallback(() => changeWeek(startOfWeek(new Date())), [changeWeek]);

  const selectPlan = useCallback(async (planId) => {
    if (planId === activePlanIdRef.current) return;
    setActivePlanId(planId);
    activePlanIdRef.current = planId;
    storePlanId(planId);
    setCollaborators([]);
    await changeWeek(weekStartRef.current);
    await loadCollaborators(planId);
  }, [changeWeek, loadCollaborators]);

  const getEntry = useCallback((dateKey, meal) => entries[slotKey(dateKey, meal)] ?? null, [entries]);

  /**
   * Saves a slot. `recipe` is required when kind is 'recipe'; `title` is used for 'custom'.
   * @returns {Promise<boolean>} Whether it saved
   */
  const saveSlot = useCallback(async ({ dateKey, meal, kind, recipe = null, title = null, note = null }) => {
    const planId = activePlanIdRef.current;
    if (!planId) return false;
    const existing = entries[slotKey(dateKey, meal)];
    const trimmedNote = note?.trim() || null;
    const trimmedTitle = title?.trim() || null;
    const isRecipe = kind === 'recipe';
    setError(null);
    try {
      const saved = await upsertMealPlanEntry({
        planId,
        date: dateKey,
        meal,
        kind,
        recipeId: isRecipe ? recipe.id : null,
        title: isRecipe ? recipe.name : trimmedTitle,
        note: trimmedNote,
        cookedAt: isRecipe && existing?.recipeId === recipe.id ? existing.cookedAt : null,
        userId,
      });
      setEntries((prev) => ({ ...prev, [slotKey(dateKey, meal)]: saved }));
      return true;
    } catch (err) {
      console.error('[useMealPlan] Failed to save slot:', err);
      setError("Couldn't save that meal. Try again.");
      return false;
    }
  }, [entries, userId]);

  const clearSlot = useCallback(async (dateKey, meal) => {
    const key = slotKey(dateKey, meal);
    const existing = entries[key];
    if (!existing) return;
    setError(null);
    setEntries((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    try {
      await deleteMealPlanEntry(existing.id);
    } catch (err) {
      console.error('[useMealPlan] Failed to clear slot:', err);
      setEntries((prev) => ({ ...prev, [key]: existing }));
      setError("Couldn't clear that meal. Try again.");
    }
  }, [entries]);

  const setMealEnabled = useCallback(async (meal, enabled) => {
    if (!activePlan) return;
    const current = activePlan.enabledMeals;
    const next = MEAL_TYPES.map((m) => m.id).filter((id) => (id === meal ? enabled : current.includes(id)));
    if (next.length === 0) return;
    setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? { ...p, enabledMeals: next } : p)));
    try {
      await updateEnabledMeals(activePlan.id, next);
    } catch (err) {
      console.error('[useMealPlan] Failed to update meals:', err);
      setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? { ...p, enabledMeals: current } : p)));
      setError("Couldn't update the meals shown.");
    }
  }, [activePlan]);

  const share = useCallback(async (planId, email) => {
    await shareMealPlan(planId, email, userId);
    await loadCollaborators(planId);
  }, [userId, loadCollaborators]);

  const unshare = useCallback(async (planId, email) => {
    await unshareMealPlan(planId, email);
    await loadCollaborators(planId);
  }, [loadCollaborators]);

  const leavePlan = useCallback(async () => {
    const planId = activePlanIdRef.current;
    if (!planId || isOwner || !userEmail) return;
    try {
      await unshareMealPlan(planId, userEmail);
      storePlanId(null);
      activePlanIdRef.current = null;
      const nextId = await loadPlans();
      await loadWeek(nextId, weekStartRef.current);
      await loadCollaborators(nextId);
    } catch (err) {
      console.error('[useMealPlan] Failed to leave plan:', err);
      setError("Couldn't leave this plan.");
    }
  }, [isOwner, userEmail, loadPlans, loadWeek, loadCollaborators]);

  /** Recipe ids for each planned recipe slot this week, in day then meal order. */
  const plannedRecipeIds = useMemo(
    () => days.flatMap((day) => MEAL_TYPES.map((m) => entries[slotKey(toDateKey(day), m.id)]))
      .filter((entry) => entry?.kind === 'recipe' && entry.recipeId)
      .map((entry) => entry.recipeId),
    [days, entries],
  );

  const getWeekIngredients = useCallback(async () => {
    const ingredients = await fetchIngredientsForRecipes([...new Set(plannedRecipeIds)]);
    return mergeWeekIngredients(plannedRecipeIds, ingredients);
  }, [plannedRecipeIds]);

  return {
    state: {
      plans,
      activePlan,
      activePlanId,
      isOwner,
      weekStart,
      days,
      enabledMeals,
      isCurrentWeek,
      recipes,
      recipesById,
      collaborators,
      plannedRecipeIds,
      isLoading,
      error,
    },
    actions: {
      getEntry,
      saveSlot,
      clearSlot,
      goToWeek,
      goToCurrentWeek,
      selectPlan,
      setMealEnabled,
      share,
      unshare,
      getShares: getMealPlanShares,
      leavePlan,
      getWeekIngredients,
      refresh: loadAll,
      clearError: () => setError(null),
    },
  };
};
