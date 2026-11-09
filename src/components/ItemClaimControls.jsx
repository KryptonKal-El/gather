import { useState } from 'react';
import PropTypes from 'prop-types';
import styles from './ItemClaimControls.module.css';

/**
 * Gift-claim status and actions for one wish-list item.
 * Givers can claim, change how many they're getting, or unclaim; the owner
 * (with claims revealed) only sees the status line.
 */
export const ItemClaimControls = ({ item, claims, currentUserId, nameFor, isGiver, onClaim, onUnclaim }) => {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);

  const total = item.quantity ?? 1;
  const claimedCount = claims.reduce((sum, claim) => sum + claim.quantity, 0);
  const mine = claims.find((claim) => claim.claimedBy === currentUserId) ?? null;
  const remaining = Math.max(total - claimedCount, 0);
  const otherNames = claims.filter((claim) => claim !== mine).map((claim) => nameFor(claim.claimedBy));

  const run = async (action) => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err.cause?.message ?? err.message);
    } finally {
      setIsBusy(false);
    }
  };

  let status = null;
  if (total > 1 && claimedCount > 0) {
    status = `${claimedCount} of ${total} claimed`;
    if (mine) status += ` · you're getting ${mine.quantity}`;
  } else if (mine) {
    status = "You're getting this";
  } else if (otherNames.length > 0) {
    status = `Claimed by ${otherNames.join(', ')}`;
  }

  if (!isGiver && !status) return null;

  const maxForMe = (mine?.quantity ?? 0) + remaining;

  return (
    <div
      className={styles.claim}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {status && <span className={`${styles.status} ${mine ? styles.mine : ''}`}>{status}</span>}
      {isGiver && mine && total > 1 && maxForMe > 1 && (
        <select
          className={styles.qtySelect}
          value={mine.quantity}
          disabled={isBusy}
          onChange={(e) => run(() => onClaim(item.id, Number(e.target.value)))}
          aria-label={`How many ${item.name} you're getting`}
        >
          {Array.from({ length: maxForMe }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      )}
      {isGiver && mine && (
        <button type="button" className={styles.unclaimBtn} disabled={isBusy} onClick={() => run(() => onUnclaim(item.id))}>
          Unclaim
        </button>
      )}
      {isGiver && !mine && remaining > 0 && (
        <button type="button" className={styles.claimBtn} disabled={isBusy} onClick={() => run(() => onClaim(item.id, 1))}>
          {claimedCount > 0 ? "I'll get one" : "I'm getting this"}
        </button>
      )}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
};

ItemClaimControls.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    quantity: PropTypes.number,
  }).isRequired,
  claims: PropTypes.arrayOf(PropTypes.shape({
    claimedBy: PropTypes.string.isRequired,
    quantity: PropTypes.number.isRequired,
  })).isRequired,
  currentUserId: PropTypes.string,
  nameFor: PropTypes.func.isRequired,
  isGiver: PropTypes.bool.isRequired,
  onClaim: PropTypes.func.isRequired,
  onUnclaim: PropTypes.func.isRequired,
};
