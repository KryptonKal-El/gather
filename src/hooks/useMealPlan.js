import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  fetchMealPlans,
  createMealPlan,
  updateEnabledMeals,
  fetchMealPlanEntries,
  upsertMealPlanEntry,
  deleteMealPlanEntry,
  saveSuggestedEntries,
  deleteMealPlanEntries,
  setMealPlanEntryLocked,
  fetchPlannedRecipeDates,
  fetchCookDates,
  fetchPlannableRecipes,
  fetchIngredientsForRecipes,
  shareMealPlan,
  unshareMealPlan,
  getMealPlanShares,
  getMealPlanCollaborators,
  subscribeMealPlans,
} from '../services/mealPlanDatabase.js';
import { fetchAllRecipeAttributes } from '../services/recipeAttributesDatabase.js';
import { planWeek } from '../utils/mealPlanner.js';
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
  const [isPlanning, setIsPlanning] = useState(false);
  const [libraryNote, setLibraryNote] = useState(null);
  // Recipes already swapped out of each slot this session, so Swap keeps moving forward.
  const swappedOutRef = useRef(new Map());

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
    setLibraryNote(null);
    swappedOutRef.current = new Map();
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

  /**
   * Gathers everything the planner reads: recipe details, cook history for the past year,
   * and what was planned in the five weeks before this one (recent plans count as recent).
   */
  const loadPlannerContext = useCallback(async (planId) => {
    const start = weekStartRef.current;
    const lookbackStart = shiftWeek(start, -5);
    const dayBefore = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
    const yearAgo = new Date(start.getFullYear() - 1, start.getMonth(), start.getDate()).toISOString();
    const [attributes, cooks, planned] = await Promise.all([
      fetchAllRecipeAttributes(),
      fetchCookDates(yearAgo),
      fetchPlannedRecipeDates(planId, toDateKey(lookbackStart), toDateKey(dayBefore)),
    ]);
    const cookDates = new Map();
    for (const { recipeId, date } of cooks) {
      cookDates.set(recipeId, [...(cookDates.get(recipeId) ?? []), date]);
    }
    const lastPlanned = new Map();
    for (const { recipeId, date } of planned) {
      if (!lastPlanned.has(recipeId) || lastPlanned.get(recipeId) < date) lastPlanned.set(recipeId, date);
    }
    return { attributes, cookDates, lastPlanned };
  }, []);

  /** Slots from today onward, in day→meal order, for the visible week's enabled meals. */
  const upcomingSlots = useCallback(() => {
    const todayKey = toDateKey(new Date());
    return days.flatMap((day) => enabledMeals.map((meal) => ({ date: toDateKey(day), meal: meal.id })))
      .filter((slot) => slot.date >= todayKey);
  }, [days, enabledMeals]);

  const runPlanner = useCallback(async ({ slots, filled, excluded }) => {
    const planId = activePlanIdRef.current;
    const context = await loadPlannerContext(planId);
    const result = planWeek({ slots, filled, recipes, excluded, ...context });
    const saved = await saveSuggestedEntries(
      planId,
      result.suggestions.map((s) => ({ ...s, title: recipesById.get(s.recipeId)?.name ?? null })),
      userId,
    );
    setEntries((prev) => {
      const next = { ...prev };
      for (const entry of saved) next[slotKey(entry.date, entry.meal)] = entry;
      return next;
    });
    setLibraryNote(result.libraryNote);
    return saved.length;
  }, [loadPlannerContext, recipes, recipesById, userId]);

  const filledSlots = (entryMap) => Object.values(entryMap)
    .map((e) => ({ date: e.date, meal: e.meal, recipeId: e.kind === 'recipe' ? e.recipeId : null }));

  /** Fills every empty upcoming slot with a suggestion. */
  const planMyWeek = useCallback(async () => {
    if (!activePlanIdRef.current) return;
    setIsPlanning(true);
    setError(null);
    try {
      const slots = upcomingSlots().filter((slot) => !entries[slotKey(slot.date, slot.meal)]);
      if (slots.length === 0) {
        setLibraryNote(null);
        return;
      }
      await runPlanner({ slots, filled: filledSlots(entries) });
    } catch (err) {
      console.error('[useMealPlan] Failed to plan the week:', err);
      setError("Couldn't plan the week. Try again.");
    } finally {
      setIsPlanning(false);
    }
  }, [entries, upcomingSlots, runPlanner]);

  /** Replaces every unlocked suggestion from today on, keeping manual and locked meals. */
  const regenerate = useCallback(async () => {
    if (!activePlanIdRef.current) return;
    setIsPlanning(true);
    setError(null);
    try {
      const todayKey = toDateKey(new Date());
      const replaceable = Object.values(entries)
        .filter((e) => e.source === 'suggested' && !e.isLocked && e.date >= todayKey);
      // Previously suggested recipes step aside this round so Regenerate really changes things.
      const excluded = new Map(replaceable.map((e) => [slotKey(e.date, e.meal), new Set([e.recipeId])]));
      const remaining = { ...entries };
      for (const e of replaceable) delete remaining[slotKey(e.date, e.meal)];
      await deleteMealPlanEntries(replaceable.map((e) => e.id));
      setEntries(remaining);
      const slots = upcomingSlots().filter((slot) => !remaining[slotKey(slot.date, slot.meal)]);
      await runPlanner({ slots, filled: filledSlots(remaining), excluded });
    } catch (err) {
      console.error('[useMealPlan] Failed to regenerate:', err);
      setError("Couldn't regenerate suggestions. Try again.");
    } finally {
      setIsPlanning(false);
    }
  }, [entries, upcomingSlots, runPlanner]);

  /** Replaces one slot with the next-best suggestion, never repeating one already swapped out. */
  const swapSlot = useCallback(async (dateKey, meal) => {
    const key = slotKey(dateKey, meal);
    const current = entries[key];
    const seen = swappedOutRef.current.get(key) ?? new Set();
    if (current?.recipeId) seen.add(current.recipeId);
    swappedOutRef.current.set(key, seen);
    const others = { ...entries };
    delete others[key];
    setError(null);
    try {
      const count = await runPlanner({
        slots: [{ date: dateKey, meal }],
        filled: filledSlots(others),
        excluded: new Map([[key, seen]]),
      });
      if (count === 0) setError('No other recipes fit this meal right now.');
    } catch (err) {
      console.error('[useMealPlan] Failed to swap:', err);
      setError("Couldn't swap that meal. Try again.");
    }
  }, [entries, runPlanner]);

  const toggleLock = useCallback(async (dateKey, meal) => {
    const key = slotKey(dateKey, meal);
    const entry = entries[key];
    if (!entry) return;
    setEntries((prev) => ({ ...prev, [key]: { ...entry, isLocked: !entry.isLocked } }));
    try {
      const saved = await setMealPlanEntryLocked(entry.id, !entry.isLocked);
      setEntries((prev) => ({ ...prev, [key]: saved }));
    } catch (err) {
      console.error('[useMealPlan] Failed to toggle lock:', err);
      setEntries((prev) => ({ ...prev, [key]: entry }));
      setError("Couldn't update that meal.");
    }
  }, [entries]);

  const hasReplaceableSuggestions = Object.values(entries)
    .some((e) => e.source === 'suggested' && !e.isLocked && e.date >= toDateKey(new Date()));

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
      isPlanning,
      libraryNote,
      hasReplaceableSuggestions,
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
      planMyWeek,
      regenerate,
      swapSlot,
      toggleLock,
      dismissLibraryNote: () => setLibraryNote(null),
      refresh: loadAll,
      clearError: () => setError(null),
    },
  };
};
