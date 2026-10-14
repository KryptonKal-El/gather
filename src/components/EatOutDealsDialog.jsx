/**
 * EatOutDealsDialog — lists the plan's eat-out deals (e.g. "kids eat free on Tuesdays")
 * and opens EatOutDealEditor to add or change one.
 */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { EatOutDealEditor } from './EatOutDealEditor.jsx';
import { MEAL_TYPES, toDateKey, fromDateKey, dealWeekdaysText } from '../utils/mealPlan.js';
import styles from './EatOutDeals.module.css';

const MEAL_LABELS = Object.fromEntries(MEAL_TYPES.map((m) => [m.id, m.label]));
const RECHECK_DAYS = 90;

/** Deals change often, so flag ones nobody has confirmed in about three months. */
const needsCheck = (deal) => {
  if (!deal.lastCheckedOn) return true;
  const ageMs = fromDateKey(toDateKey(new Date())) - fromDateKey(deal.lastCheckedOn);
  return ageMs > RECHECK_DAYS * 24 * 60 * 60 * 1000;
};

/**
 * @param {Object} props
 * @param {Array<Object>} props.deals
 * @param {Function} props.onSave - Called with (id, deal); rejects when saving fails
 * @param {Function} props.onDelete - Called with the deal
 * @param {Function} props.onClose
 */
export const EatOutDealsDialog = ({ deals, onSave, onDelete, onClose }) => {
  // undefined = showing the list, null = adding a deal, object = editing that deal.
  const [editing, setEditing] = useState(undefined);
  const isEditing = editing !== undefined;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (isEditing) setEditing(undefined);
      else onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Eat-out deals">
      <div className={styles.modal}>
        {isEditing ? (
          <EatOutDealEditor
            deal={editing}
            onSave={onSave}
            onDelete={onDelete}
            onCancel={() => setEditing(undefined)}
          />
        ) : (
          <>
            <div className={styles.header}>
              <h3 className={styles.title}>Eat-out deals</h3>
              <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
                &times;
              </button>
            </div>
            <p className={styles.intro}>
              Restaurants with deals on certain days, like kids eat free on Tuesdays. Matching meals on your
              plan show the deal. Everyone on this plan sees these.
            </p>

            {deals.length === 0 ? (
              <p className={styles.empty}>No eat-out deals yet.</p>
            ) : (
              <ul className={styles.list}>
                {deals.map((deal) => (
                  <li key={deal.id}>
                    <button type="button" className={styles.dealBtn} onClick={() => setEditing(deal)}>
                      <span className={`${styles.dealIcon} ${deal.isActive ? '' : styles.dealIconOff}`} aria-hidden="true">🏷️</span>
                      <span className={styles.dealText}>
                        <span className={styles.dealName}>{deal.restaurant}</span>
                        {deal.details && <span className={styles.dealMeta}>{deal.details}</span>}
                        <span className={styles.dealMeta}>
                          {dealWeekdaysText(deal.weekdays)} · {deal.meals.map((m) => MEAL_LABELS[m]).join(', ')}
                        </span>
                        {!deal.isActive && <span className={styles.dealMeta}>Switched off</span>}
                        {deal.isActive && needsCheck(deal) && (
                          <span className={styles.dealWarn}>Check it&apos;s still running</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.footer}>
              <button type="button" className={styles.cancelBtn} onClick={onClose}>
                Done
              </button>
              <button type="button" className={styles.saveBtn} onClick={() => setEditing(null)}>
                Add a deal
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

EatOutDealsDialog.propTypes = {
  deals: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    restaurant: PropTypes.string.isRequired,
    details: PropTypes.string,
    weekdays: PropTypes.arrayOf(PropTypes.number).isRequired,
    meals: PropTypes.arrayOf(PropTypes.string).isRequired,
    isActive: PropTypes.bool.isRequired,
    lastCheckedOn: PropTypes.string,
  })).isRequired,
  onSave: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
