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
  fetchMealPlanFeedback,
  recordMealPlanFeedback,
  fetchPlannableRecipes,
  fetchIngredientsForRecipes,
  shareMealPlan,
  unshareMealPlan,
  getMealPlanShares,
  getMealPlanCollaborators,
  subscribeMealPlans,
} from '../services/mealPlanDatabase.js';
import { fetchAllRecipeAttributes } from '../services/recipeAttributesDatabase.js';
import { planWeek, buildPreferences, learnQuickWeekdays } from '../utils/mealPlanner.js';
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
 *
 * Nothing loads (and no plan is created) until the Plan tab is first opened for the signed-in
 * user; after that the plan stays loaded and live for the rest of the visit, matching iOS.
 * @param {string|null} userId
 * @param {string|null} userEmail
 * @param {boolean} isOpen - Whether the Plan tab is currently showing
 */
export const useMealPlan = (userId, userEmail, isOpen) => {
  const [openedForUserId, setOpenedForUserId] = useState(null);
  if (isOpen && userId && openedForUserId !== userId) {
    setOpenedForUserId(userId);
  }
  const isActive = Boolean(userId) && openedForUserId === userId;

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
  // This device's writes: how many have started and how many are still running. A refetch
  // that overlaps a write may predate it, so its result is dropped and the plan reloads once
  // the writes settle; otherwise a cleared meal or a hidden meal type could come back locally.
  const writesRef = useRef({ started: 0, inFlight: 0, needsReload: false });
  // Meals-shown saves run one at a time: two quick toggles sent in parallel can land in
  // either order, and the earlier one would win.
  const mealsSaveRef = useRef(Promise.resolve());

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
    const writes = writesRef.current;
    for (;;) {
      const startedBefore = writes.started;
      const wasWriting = writes.inFlight > 0;
      const rows = await fetchMealPlanEntries(planId, toDateKey(range[0]), toDateKey(range[6]));
      // Ignore a stale response if the user moved to another week or plan meanwhile.
      if (planId !== activePlanIdRef.current || toDateKey(start) !== toDateKey(weekStartRef.current)) return;
      if (!wasWriting && writes.started === startedBefore) {
        setEntries(Object.fromEntries(rows.map((row) => [slotKey(row.date, row.meal), row])));
        return;
      }
      if (writes.inFlight > 0) {
        writes.needsReload = true;
        return;
      }
    }
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
    const writes = writesRef.current;
    for (;;) {
      const startedBefore = writes.started;
      const wasWriting = writes.inFlight > 0;
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
      // Same rule as loadWeek: plans fetched across a write (e.g. Meals shown) may predate it.
      if (!wasWriting && writes.started === startedBefore) {
        setPlans(fetched);
        setActivePlanId(nextId);
        activePlanIdRef.current = nextId;
        return nextId;
      }
      if (writes.inFlight > 0) {
        writes.needsReload = true;
        return activePlanIdRef.current ?? nextId;
      }
    }
  }, [userId]);

  /** Runs a write to this plan so overlapping refetches can't undo it locally. */
  const trackWrite = useCallback(async (write) => {
    const writes = writesRef.current;
    writes.started += 1;
    writes.inFlight += 1;
    try {
      return await write();
    } finally {
      writes.inFlight -= 1;
      if (writes.inFlight === 0 && writes.needsReload) {
        writes.needsReload = false;
        loadPlans()
          .then((planId) => loadWeek(planId, weekStartRef.current))
          .catch((err) => console.error('[useMealPlan] Failed to refresh plan:', err));
      }
    }
  }, [loadPlans, loadWeek]);

  const loadAll = useCallback(async () => {
    if (!isActive) return;
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
  }, [isActive, loadPlans, loadWeek, loadCollaborators]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!isActive) return undefined;
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
  }, [isActive, userId, loadPlans, loadWeek, loadCollaborators]);

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

  /** Records reactions to suggestions so the planner learns (best-effort, never blocks the UI). */
  const recordFeedback = useCallback((events) => {
    const planId = activePlanIdRef.current;
    if (!planId) return;
    recordMealPlanFeedback(planId, events.filter((e) => e.recipeId), userId);
  }, [userId]);

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
      const saved = await trackWrite(() => upsertMealPlanEntry({
        planId,
        date: dateKey,
        meal,
        kind,
        recipeId: isRecipe ? recipe.id : null,
        title: isRecipe ? recipe.name : trimmedTitle,
        note: trimmedNote,
        cookedAt: isRecipe && existing?.recipeId === recipe.id ? existing.cookedAt : null,
        userId,
      }));
      setEntries((prev) => ({ ...prev, [slotKey(dateKey, meal)]: saved }));
      if (existing?.source === 'suggested' && existing.recipeId && saved.recipeId !== existing.recipeId) {
        recordFeedback([{ recipeId: existing.recipeId, event: 'swapped' }]);
      }
      return true;
    } catch (err) {
      console.error('[useMealPlan] Failed to save slot:', err);
      setError("Couldn't save that meal. Try again.");
      return false;
    }
  }, [entries, userId, recordFeedback, trackWrite]);

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
      await trackWrite(() => deleteMealPlanEntry(existing.id));
    } catch (err) {
      console.error('[useMealPlan] Failed to clear slot:', err);
      setEntries((prev) => ({ ...prev, [key]: existing }));
      setError("Couldn't clear that meal. Try again.");
    }
  }, [entries, trackWrite]);

  const setMealEnabled = useCallback(async (meal, enabled) => {
    if (!activePlan) return;
    const current = activePlan.enabledMeals;
    const next = MEAL_TYPES.map((m) => m.id).filter((id) => (id === meal ? enabled : current.includes(id)));
    if (next.length === 0) return;
    setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? { ...p, enabledMeals: next } : p)));
    try {
      const save = mealsSaveRef.current.then(() => updateEnabledMeals(activePlan.id, next));
      mealsSaveRef.current = save.catch(() => {});
      await trackWrite(() => save);
    } catch (err) {
      console.error('[useMealPlan] Failed to update meals:', err);
      setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? { ...p, enabledMeals: current } : p)));
      setError("Couldn't update the meals shown.");
    }
  }, [activePlan, trackWrite]);

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
   * Gathers everything the planner reads: recipe details, a year of cook history, what was
   * planned in the five weeks before this one, and the household's reactions to suggestions
   * (the learned preferences and busy days come from these).
   */
  const loadPlannerContext = useCallback(async (planId) => {
    const start = weekStartRef.current;
    const lookbackStart = shiftWeek(start, -5);
    const dayBefore = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
    const yearAgo = new Date(start.getFullYear() - 1, start.getMonth(), start.getDate()).toISOString();
    const halfYearAgo = new Date(start.getFullYear(), start.getMonth() - 6, start.getDate()).toISOString();
    const [attributes, cooks, planned, feedback] = await Promise.all([
      fetchAllRecipeAttributes(),
      fetchCookDates(yearAgo),
      fetchPlannedRecipeDates(planId, toDateKey(lookbackStart), toDateKey(dayBefore)),
      fetchMealPlanFeedback(planId, halfYearAgo),
    ]);
    const cookDates = new Map();
    for (const { recipeId, date } of cooks) {
      cookDates.set(recipeId, [...(cookDates.get(recipeId) ?? []), date]);
    }
    const lastPlanned = new Map();
    for (const { recipeId, date } of planned) {
      if (!lastPlanned.has(recipeId) || lastPlanned.get(recipeId) < date) lastPlanned.set(recipeId, date);
    }
    const preferences = buildPreferences({ todayKey: toDateKey(new Date()), cooks, feedback, planned });
    const quickWeekdays = learnQuickWeekdays(cooks.map((c) => {
      const started = new Date(c.startedAt);
      return {
        weekday: (started.getDay() + 6) % 7,
        minutes: (new Date(c.completedAt) - started) / 60000,
      };
    }));
    return { attributes, cookDates, lastPlanned, preferences, quickWeekdays };
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
    const saved = await trackWrite(() => saveSuggestedEntries(
      planId,
      result.suggestions.map((s) => ({ ...s, title: recipesById.get(s.recipeId)?.name ?? null })),
      userId,
    ));
    setEntries((prev) => {
      const next = { ...prev };
      for (const entry of saved) next[slotKey(entry.date, entry.meal)] = entry;
      return next;
    });
    setLibraryNote(result.libraryNote);
    return saved.length;
  }, [loadPlannerContext, recipes, recipesById, userId, trackWrite]);

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
      await trackWrite(() => deleteMealPlanEntries(replaceable.map((e) => e.id)));
      recordFeedback(replaceable.map((e) => ({ recipeId: e.recipeId, event: 'regenerated' })));
      setEntries(remaining);
      const slots = upcomingSlots().filter((slot) => !remaining[slotKey(slot.date, slot.meal)]);
      await runPlanner({ slots, filled: filledSlots(remaining), excluded });
    } catch (err) {
      console.error('[useMealPlan] Failed to regenerate:', err);
      setError("Couldn't regenerate suggestions. Try again.");
    } finally {
      setIsPlanning(false);
    }
  }, [entries, upcomingSlots, runPlanner, recordFeedback, trackWrite]);

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
    if (current?.recipeId) recordFeedback([{ recipeId: current.recipeId, event: 'swapped' }]);
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
  }, [entries, runPlanner, recordFeedback]);

  const toggleLock = useCallback(async (dateKey, meal) => {
    const key = slotKey(dateKey, meal);
    const entry = entries[key];
    if (!entry) return;
    setEntries((prev) => ({ ...prev, [key]: { ...entry, isLocked: !entry.isLocked } }));
    try {
      const saved = await trackWrite(() => setMealPlanEntryLocked(entry.id, !entry.isLocked));
      setEntries((prev) => ({ ...prev, [key]: saved }));
      if (saved.isLocked && saved.recipeId) recordFeedback([{ recipeId: saved.recipeId, event: 'kept' }]);
    } catch (err) {
      console.error('[useMealPlan] Failed to toggle lock:', err);
      setEntries((prev) => ({ ...prev, [key]: entry }));
      setError("Couldn't update that meal.");
    }
  }, [entries, recordFeedback, trackWrite]);

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
