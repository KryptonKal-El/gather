/**
 * EatOutDealEditor — the add / edit form for one eat-out deal, shown inside EatOutDealsDialog.
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { MEAL_TYPES, toDateKey, fromDateKey } from '../utils/mealPlan.js';
import styles from './EatOutDeals.module.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const formatChecked = (key) => {
  if (!key) return 'Never';
  if (key === toDateKey(new Date())) return 'Today';
  return fromDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * @param {Object} props
 * @param {Object|null} props.deal - The deal being edited, or null for a new one
 * @param {Function} props.onSave - Called with (id, deal); rejects when saving fails
 * @param {Function} props.onDelete - Called with the deal
 * @param {Function} props.onCancel
 */
export const EatOutDealEditor = ({ deal, onSave, onDelete, onCancel }) => {
  const [restaurant, setRestaurant] = useState(deal?.restaurant ?? '');
  const [details, setDetails] = useState(deal ? deal.details ?? '' : 'Kids eat free');
  const [address, setAddress] = useState(deal?.address ?? '');
  const [weekdays, setWeekdays] = useState(() => new Set(deal?.weekdays ?? []));
  const [meals, setMeals] = useState(() => new Set(deal?.meals ?? ['dinner']));
  const [isActive, setIsActive] = useState(deal?.isActive ?? true);
  const [lastCheckedOn, setLastCheckedOn] = useState(deal ? deal.lastCheckedOn : toDateKey(new Date()));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const canSave = restaurant.trim() && weekdays.size > 0 && meals.size > 0 && !isSaving;

  const toggle = (set, setter, value) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(deal?.id ?? null, {
        restaurant: restaurant.trim(),
        details: details.trim() || null,
        address: address.trim() || null,
        weekdays: [...weekdays],
        meals: MEAL_TYPES.map((m) => m.id).filter((id) => meals.has(id)),
        isActive,
        lastCheckedOn,
      });
      onCancel();
    } catch (err) {
      console.error('[EatOutDealEditor] Failed to save deal:', err);
      setSaveError("Couldn't save this deal. Try again.");
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h3 className={styles.title}>{deal ? 'Edit deal' : 'New deal'}</h3>
        <button type="button" className={styles.closeBtn} onClick={onCancel} aria-label="Close">
          &times;
        </button>
      </div>

      <div className={styles.section}>
        <label className={styles.label} htmlFor="deal-restaurant">Restaurant</label>
        <input
          id="deal-restaurant"
          className={styles.input}
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          placeholder="e.g. Chili's"
          autoFocus
        />
        <input
          className={styles.input}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address (optional)"
          aria-label="Address"
        />
      </div>

      <div className={styles.section}>
        <label className={styles.label} htmlFor="deal-details">Deal</label>
        <input
          id="deal-details"
          className={styles.input}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="e.g. Kids eat free"
        />
        <p className={styles.hint}>Shown on your plan, e.g. &ldquo;Kids eat free at Chili&apos;s&rdquo;.</p>
      </div>

      <fieldset className={styles.chips}>
        <legend className={styles.label}>Days</legend>
        {WEEKDAYS.map((name, index) => (
          <button
            key={name}
            type="button"
            className={`${styles.chip} ${weekdays.has(index) ? styles.chipActive : ''}`}
            aria-pressed={weekdays.has(index)}
            onClick={() => toggle(weekdays, setWeekdays, index)}
          >
            {name}
          </button>
        ))}
      </fieldset>

      <fieldset className={styles.chips}>
        <legend className={styles.label}>Meals</legend>
        {MEAL_TYPES.map((meal) => (
          <button
            key={meal.id}
            type="button"
            className={`${styles.chip} ${meals.has(meal.id) ? styles.chipActive : ''}`}
            aria-pressed={meals.has(meal.id)}
            onClick={() => toggle(meals, setMeals, meal.id)}
          >
            {meal.label}
          </button>
        ))}
      </fieldset>

      <div className={styles.section}>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Deal is on
        </label>
        <div className={styles.checkedRow}>
          <span>Last checked: {formatChecked(lastCheckedOn)}</span>
          <button type="button" className={styles.linkBtn} onClick={() => setLastCheckedOn(toDateKey(new Date()))}>
            Checked it today
          </button>
        </div>
        <p className={styles.hint}>Deals change often. Switch one off rather than deleting it if it might come back.</p>
      </div>

      {saveError && <p className={styles.error} role="alert">{saveError}</p>}

      {deal && (
        <div className={styles.section}>
          <button type="button" className={`${styles.linkBtn} ${styles.dangerLink}`} onClick={() => setIsConfirmingDelete(true)}>
            Delete deal
          </button>
        </div>
      )}

      <div className={styles.footer}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.saveBtn} disabled={!canSave}>
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {isConfirmingDelete && (
        <ConfirmDialog
          title="Delete this deal?"
          message="It will be removed for everyone on this plan."
          onConfirm={() => {
            setIsConfirmingDelete(false);
            onDelete(deal);
            onCancel();
          }}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </form>
  );
};

EatOutDealEditor.propTypes = {
  deal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    restaurant: PropTypes.string.isRequired,
    details: PropTypes.string,
    address: PropTypes.string,
    weekdays: PropTypes.arrayOf(PropTypes.number).isRequired,
    meals: PropTypes.arrayOf(PropTypes.string).isRequired,
    isActive: PropTypes.bool.isRequired,
    lastCheckedOn: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
