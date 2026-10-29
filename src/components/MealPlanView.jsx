/**
 * MealPlanView — the Plan tab: a shared weekly meal plan with breakfast, lunch
 * and dinner per day. Slots open MealSlotEditor; the menu shares the plan,
 * picks which meals show, and adds the week's ingredients to a list.
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { AvatarGroup } from './AvatarGroup.jsx';
import { MealSlotEditor } from './MealSlotEditor.jsx';
import { EatOutDealsDialog } from './EatOutDealsDialog.jsx';
import { MEAL_TYPES, ENTRY_KINDS, toDateKey, fromDateKey, entryDisplayTitle, dealBadgeText } from '../utils/mealPlan.js';
import styles from './MealPlanView.module.css';

const MAX_DAY_COUNT = 90;

const KIND_ICONS = Object.fromEntries(ENTRY_KINDS.map((k) => [k.id, k.icon]));

const LockIcon = ({ isLocked }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill={isLocked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d={isLocked ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-1.9'} fill="none" />
  </svg>
);

LockIcon.propTypes = { isLocked: PropTypes.bool.isRequired };

// SVG rather than ‹ › ⋯ characters: font glyphs sit off-centre in their line box.
const Chevron = ({ direction }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={direction === 'left' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
  </svg>
);

Chevron.propTypes = { direction: PropTypes.oneOf(['left', 'right']).isRequired };

const MoreIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

const formatRange = (days) => {
  const fmt = { month: 'short', day: 'numeric' };
  return `${days[0].toLocaleDateString(undefined, fmt)} – ${days[days.length - 1].toLocaleDateString(undefined, fmt)}`;
};

const isToday = (day) => toDateKey(day) === toDateKey(new Date());

/**
 * Lets the user plan an arbitrary stretch of days from any start date, alongside the week view.
 * @param {Object} props
 * @param {Date} props.weekStart - Current window start, used as the default
 * @param {number} props.dayCount - Current day count, used as the default
 * @param {boolean} props.isCustomRange - Whether a custom range is already active
 * @param {Function} props.onApply - Called with (startDate, count)
 * @param {Function} props.onWeekView - Returns to the Monday-aligned week view
 * @param {Function} props.onClose
 */
const RangeDialog = ({ weekStart, dayCount, isCustomRange, onApply, onWeekView, onClose }) => {
  const [startKey, setStartKey] = useState(toDateKey(weekStart));
  const [count, setCount] = useState(dayCount);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const clampedCount = Math.min(Math.max(Math.round(Number(count)) || 1, 1), MAX_DAY_COUNT);
  const startDate = startKey ? fromDateKey(startKey) : null;
  const endDate = startDate
    ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + clampedCount - 1)
    : null;

  const handleApply = () => {
    if (!startDate) return;
    onApply(startDate, clampedCount);
    onClose();
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.rangeDialog} role="dialog" aria-modal="true" aria-label="Custom range">
        <div className={styles.rangeHeader}>
          <h2 className={styles.rangeTitle}>Custom range</h2>
          <button type="button" className={styles.rangeClose} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className={styles.rangeBody}>
          <label className={styles.rangeField}>
            <span className={styles.rangeFieldLabel}>Start date</span>
            <input
              type="date"
              className={styles.rangeInput}
              value={startKey}
              onChange={(e) => setStartKey(e.target.value)}
            />
          </label>
          <label className={styles.rangeField}>
            <span className={styles.rangeFieldLabel}>Days</span>
            <input
              type="number"
              className={styles.rangeInput}
              min="1"
              max={MAX_DAY_COUNT}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </label>
          {endDate && (
            <p className={styles.rangeEnds}>
              Ends {endDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
          )}
          <p className={styles.rangeHintText}>
            Plan any stretch of days — a long weekend, a two-week trip, even a whole month.
          </p>
        </div>
        <div className={styles.rangeActions}>
          {isCustomRange && (
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => { onWeekView(); onClose(); }}
            >
              Week view
            </button>
          )}
          <button type="button" className={styles.planBtn} onClick={handleApply} disabled={!startDate}>
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

RangeDialog.propTypes = {
  weekStart: PropTypes.instanceOf(Date).isRequired,
  dayCount: PropTypes.number.isRequired,
  isCustomRange: PropTypes.bool.isRequired,
  onApply: PropTypes.func.isRequired,
  onWeekView: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

/**
 * @param {Object} props
 * @param {Object} props.state - `state` from useMealPlan
 * @param {Object} props.actions - `actions` from useMealPlan
 * @param {string} props.userId
 * @param {Function} props.onViewRecipe - Called with a recipe id
 * @param {Function} props.onAddWeekToList - Called with merged week ingredients
 * @param {Function} props.onManageSharing - Opens the share / members dialog
 */
export const MealPlanView = ({ state, actions, userId, onViewRecipe, onAddWeekToList, onManageSharing }) => {
  const [editing, setEditing] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPreparingList, setIsPreparingList] = useState(false);
  const [isShowingDeals, setIsShowingDeals] = useState(false);
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isMenuOpen]);

  const handleAddWeekToList = async () => {
    setIsMenuOpen(false);
    setIsPreparingList(true);
    try {
      const ingredients = await actions.getWeekIngredients();
      if (ingredients.length > 0) onAddWeekToList(ingredients);
    } catch (err) {
      console.error('[MealPlanView] Failed to load week ingredients:', err);
    } finally {
      setIsPreparingList(false);
    }
  };

  const editingEntry = editing ? actions.getEntry(editing.dateKey, editing.meal.id) : null;

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.weekSwitcher}>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => actions.goToWeek(-1)}
            aria-label={state.isCustomRange ? 'Previous days' : 'Previous week'}
          >
            <Chevron direction="left" />
          </button>
          <div className={styles.weekLabel}>
            <span className={styles.range}>{formatRange(state.days)}</span>
            {state.isCustomRange ? (
              <>
                <span className={styles.weekHint}>{state.dayCount} days</span>
                <button type="button" className={styles.todayBtn} onClick={actions.goToCurrentWeek}>
                  Back to week view
                </button>
              </>
            ) : state.isCurrentWeek ? (
              <span className={styles.weekHint}>This week</span>
            ) : (
              <button type="button" className={styles.todayBtn} onClick={actions.goToCurrentWeek}>
                Back to this week
              </button>
            )}
          </div>
          <button
            type="button"
            className={styles.navBtn}
            onClick={() => actions.goToWeek(1)}
            aria-label={state.isCustomRange ? 'Next days' : 'Next week'}
          >
            <Chevron direction="right" />
          </button>
        </div>

        <div className={styles.toolbarActions}>
          {state.collaborators.length > 0 && (
            <button type="button" className={styles.avatarBtn} onClick={onManageSharing} aria-label="Plan members">
              <AvatarGroup collaborators={state.collaborators} size={28} color="var(--primary)" />
            </button>
          )}
          <div className={styles.menuWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="Plan options"
            >
              {isPreparingList ? '…' : <MoreIcon />}
            </button>
            {isMenuOpen && (
              <div className={styles.menu} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={handleAddWeekToList}
                  disabled={state.plannedRecipeIds.length === 0}
                >
                  {state.isCustomRange ? 'Add range to list' : 'Add week to list'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => { setIsMenuOpen(false); setIsRangeOpen(true); }}
                >
                  Custom range…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => { setIsMenuOpen(false); onManageSharing(); }}
                >
                  {state.isOwner ? 'Share plan' : 'Plan members'}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.menuItem}
                  onClick={() => { setIsMenuOpen(false); setIsShowingDeals(true); }}
                >
                  Eat-out deals
                </button>
                <div className={styles.menuGroup}>
                  <span className={styles.menuGroupLabel}>Meals shown</span>
                  {MEAL_TYPES.map((meal) => {
                    const checked = state.enabledMeals.some((m) => m.id === meal.id);
                    return (
                      <label key={meal.id} className={styles.menuCheck}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={checked && state.enabledMeals.length === 1}
                          onChange={(e) => actions.setMealEnabled(meal.id, e.target.checked)}
                        />
                        {meal.label}
                      </label>
                    );
                  })}
                </div>
                {state.plans.length > 1 && (
                  <div className={styles.menuGroup}>
                    <label className={styles.menuGroupLabel} htmlFor="meal-plan-select">Plan</label>
                    <select
                      id="meal-plan-select"
                      className={styles.menuSelect}
                      value={state.activePlanId ?? ''}
                      onChange={(e) => { setIsMenuOpen(false); actions.selectPlan(e.target.value); }}
                    >
                      {state.plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.ownerId === userId ? 'My plan' : 'Shared plan'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {!state.isOwner && (
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={() => { setIsMenuOpen(false); actions.leavePlan(); }}
                  >
                    Leave plan
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.planBar}>
        <button
          type="button"
          className={styles.planBtn}
          onClick={actions.planMyWeek}
          disabled={state.isPlanning || !state.activePlan}
        >
          {state.isPlanning ? 'Planning...' : `✨ ${state.isCustomRange ? 'Plan these days' : 'Plan my week'}`}
        </button>
        {state.hasReplaceableSuggestions && (
          <button type="button" className={styles.secondaryBtn} onClick={actions.regenerate} disabled={state.isPlanning}>
            Regenerate
          </button>
        )}
      </div>

      {state.libraryNote && (
        <div className={styles.note} role="status">
          <span>{state.libraryNote}</span>
          <button type="button" className={styles.noteDismiss} onClick={actions.dismissLibraryNote} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      {state.isLoading && !state.activePlan ? (
        <p className={styles.loading}>Loading your plan...</p>
      ) : (
        <div className={styles.days}>
          {state.days.map((day) => {
            const dateKey = toDateKey(day);
            const today = isToday(day);
            return (
              <section key={dateKey} className={`${styles.day} ${today ? styles.dayToday : ''}`} aria-label={day.toDateString()}>
                <h3 className={styles.dayHeader}>
                  <span className={styles.dayName}>{day.toLocaleDateString(undefined, { weekday: 'long' })}</span>
                  <span className={styles.dayDate}>{day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  {today && <span className={styles.todayBadge}>Today</span>}
                </h3>
                <ul className={styles.slots}>
                  {state.enabledMeals.map((meal) => {
                    const entry = actions.getEntry(dateKey, meal.id);
                    const recipe = entry?.recipeId ? state.recipesById.get(entry.recipeId) : null;
                    // No deal offer once the slot is already eating out or skipped.
                    const slotDeals = ['eating_out', 'skip'].includes(entry?.kind) ? [] : actions.getDealsForSlot(dateKey, meal.id);
                    return (
                      <li key={meal.id} className={styles.slotRow}>
                        <button
                          type="button"
                          className={`${styles.slot} ${entry?.kind === 'skip' ? styles.slotSkipped : ''}`}
                          onClick={() => setEditing({ day, dateKey, meal })}
                          aria-label={`${meal.label}: ${entry ? entryDisplayTitle(entry) : 'add a meal'}`}
                        >
                          {recipe?.imageUrl ? (
                            <img className={styles.thumb} src={recipe.imageUrl} alt="" />
                          ) : (
                            <span className={`${styles.thumb} ${entry ? styles.thumbFilled : ''}`} aria-hidden="true">
                              {entry ? KIND_ICONS[entry.kind] : '+'}
                            </span>
                          )}
                          <span className={styles.slotText}>
                            <span className={styles.mealLabel}>{meal.label}</span>
                            <span className={entry ? styles.slotTitle : styles.slotEmpty}>
                              {entry ? entryDisplayTitle(entry) : 'Add a meal'}
                            </span>
                            {entry?.note && <span className={styles.slotNote}>{entry.note}</span>}
                            {entry?.source === 'suggested' && entry.suggestionReason && (
                              <span className={styles.slotReason}>✨ {entry.suggestionReason}</span>
                            )}
                          </span>
                          {entry?.cookedAt && <span className={styles.cooked} aria-label="Cooked">✓</span>}
                        </button>
                        {entry?.source === 'suggested' && (
                          <span className={styles.slotActions}>
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${entry.isLocked ? styles.iconBtnActive : ''}`}
                              onClick={() => actions.toggleLock(dateKey, meal.id)}
                              aria-pressed={entry.isLocked}
                              aria-label={entry.isLocked ? `Unlock ${meal.label}` : `Keep ${meal.label}`}
                              title={entry.isLocked ? 'Kept — Regenerate leaves it' : 'Keep this when regenerating'}
                            >
                              <LockIcon isLocked={entry.isLocked} />
                            </button>
                            {!entry.isLocked && (
                              <button
                                type="button"
                                className={styles.iconBtn}
                                onClick={() => actions.swapSlot(dateKey, meal.id)}
                                aria-label={`Swap ${meal.label}`}
                                title="Suggest something else"
                              >
                                ↻
                              </button>
                            )}
                          </span>
                        )}
                        {slotDeals.map((deal) => (
                          <span key={deal.id} className={styles.dealBadge}>
                            <span className={styles.dealBadgeText}>🏷️ {dealBadgeText(deal)}</span>
                            <button
                              type="button"
                              className={styles.dealBadgeBtn}
                              onClick={() => actions.eatHere(deal, dateKey, meal.id)}
                              aria-label={`Eat at ${deal.restaurant} instead for ${meal.label}`}
                            >
                              Eat here instead
                            </button>
                          </span>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {editing && (
        <MealSlotEditor
          key={`${editing.dateKey}-${editing.meal.id}`}
          heading={`${editing.day.toLocaleDateString(undefined, { weekday: 'short' })} ${editing.meal.label}`}
          mealLabel={editing.meal.label}
          entry={editingEntry}
          recipes={state.recipes}
          deals={actions.getDealsForSlot(editing.dateKey, editing.meal.id)}
          onSave={(slot) => actions.saveSlot({ dateKey: editing.dateKey, meal: editing.meal.id, ...slot })}
          onClear={() => actions.clearSlot(editing.dateKey, editing.meal.id)}
          onViewRecipe={(recipeId) => { setEditing(null); onViewRecipe(recipeId); }}
          onClose={() => setEditing(null)}
        />
      )}

      {isShowingDeals && (
        <EatOutDealsDialog
          deals={state.deals}
          onSave={actions.saveDeal}
          onDelete={actions.deleteDeal}
          onClose={() => setIsShowingDeals(false)}
        />
      )}

      {isRangeOpen && (
        <RangeDialog
          weekStart={state.weekStart}
          dayCount={state.dayCount}
          isCustomRange={state.isCustomRange}
          onApply={actions.setCustomRange}
          onWeekView={actions.goToCurrentWeek}
          onClose={() => setIsRangeOpen(false)}
        />
      )}
    </div>
  );
};

MealPlanView.propTypes = {
  state: PropTypes.shape({
    plans: PropTypes.array.isRequired,
    activePlan: PropTypes.object,
    activePlanId: PropTypes.string,
    isOwner: PropTypes.bool.isRequired,
    weekStart: PropTypes.instanceOf(Date).isRequired,
    days: PropTypes.arrayOf(PropTypes.instanceOf(Date)).isRequired,
    dayCount: PropTypes.number.isRequired,
    isCustomRange: PropTypes.bool.isRequired,
    enabledMeals: PropTypes.array.isRequired,
    isCurrentWeek: PropTypes.bool.isRequired,
    recipes: PropTypes.array.isRequired,
    recipesById: PropTypes.instanceOf(Map).isRequired,
    collaborators: PropTypes.array.isRequired,
    deals: PropTypes.array.isRequired,
    plannedRecipeIds: PropTypes.array.isRequired,
    isLoading: PropTypes.bool.isRequired,
    error: PropTypes.string,
    isPlanning: PropTypes.bool.isRequired,
    libraryNote: PropTypes.string,
    hasReplaceableSuggestions: PropTypes.bool.isRequired,
  }).isRequired,
  actions: PropTypes.object.isRequired,
  userId: PropTypes.string.isRequired,
  onViewRecipe: PropTypes.func.isRequired,
  onAddWeekToList: PropTypes.func.isRequired,
  onManageSharing: PropTypes.func.isRequired,
};
