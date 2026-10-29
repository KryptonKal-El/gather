# Meal plan: custom date ranges

Shipped 2026-10-28. The Plan tab is no longer limited to a Monday-aligned 7-day week:
users can pick an arbitrary **start date** and **day count** (1…90) via "Custom range…".
The week view is still the default; the two modes sit side by side.

## Shape of the change (client-only)
The meal-plan **engine and DB were never the limit** — `MealPlanner.planWeek` is slot-driven
and `meal_plan_entries` keys by arbitrary date. The 7-day rigidity lived entirely in the two
clients' week-windowing, so this was a client change on both:

- **iOS**: `MealPlanWeek.days(from:count:)` generalizes the old `days(from:)`. `MealPlanViewModel`
  gained `isCustomRange` + `dayCount` (window start is still `weekStart`); `stepWindow(_:)` steps by
  a week in week mode or by `dayCount` days in custom mode; `applyCustomRange(start:dayCount:)` /
  `goToCurrentWeek()` switch modes. The week cache key now includes `dayCount`. UI: `CustomRangeSheet`
  in `MealPlanView.swift`, opened from the plan `…` menu.
- **Web**: `weekDays(start, count=7)` + new `shiftDays`/`startOfDay` in `utils/mealPlan.js`. `useMealPlan`
  mirrors iOS (`dayCount`/`isCustomRange` state + refs, `setCustomRange`, mode-aware `goToWeek`).
  `loadWeek` takes a count and fetches `range[0]…range[last]`. UI: `RangeDialog` in `MealPlanView.jsx`.

## Deferred follow-up (by explicit decision)
The **auto-planner's variety caps are tuned for ~a week** (e.g. reject ≥2 same protein / ≥3 same
cuisine per run, one copy per run, the single "something new" slot). Over a long custom range these
over-restrict and force relaxed-fallback repeats. The decision (2026-10-28) was to **ship flexible
dates first and tune the auto-planner for longer ranges later** — manual planning over any range is
fine today. "Plan my week"/"Plan these days" still runs over custom slots; it just isn't length-aware
yet. When tuning, scale the caps per rolling 7 days rather than per run.

The "Describe your week" brief is week-only (its day notes map to weekday indices 0–6), so it's hidden
in custom-range mode.

See [[history-mirrors-items]] for the reusable-columns pattern (unrelated, but same Plan area DB).
