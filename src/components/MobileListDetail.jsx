import PropTypes from 'prop-types';
import { AddItemForm } from './AddItemForm.jsx';
import { ShoppingList } from './ShoppingList.jsx';
import { Suggestions } from './Suggestions.jsx';
import styles from './MobileListDetail.module.css';

/**
 * Full-screen mobile list detail view with iOS-style navigation.
 * Shows a top nav bar with back arrow, list name, and share button.
 */
export const MobileListDetail = ({
  list,
  stores,
  history,
  suggestions,
  isGuest,
  onBack,
  onAddItem,
  onToggle,
  onRemove,
  onUpdateCategory,
  onUpdateStore,
  onUpdateItem,
  onClearChecked,
  onShareClick,
  restoredItemIds,
  onRestoreAnimationDone,
}) => {
  return (
    <div className={styles.container}>
      <nav className={styles.navBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={onBack}
          aria-label="Back to My Lists"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className={styles.navTitle}>
          {list.emoji && <span>{list.emoji} </span>}
          {list.name}
        </h1>
        {!isGuest && (
          <button
            type="button"
            className={styles.shareButton}
            onClick={() => onShareClick(list)}
            aria-label="Share list"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
        )}
        {isGuest && <div className={styles.spacer} />}
      </nav>

      <div className={styles.scrollContent}>
        <AddItemForm stores={stores} history={history} onAdd={onAddItem} />
        <ShoppingList
          items={list.items}
          stores={stores}
          onToggle={onToggle}
          onRemove={onRemove}
          onUpdateCategory={onUpdateCategory}
          onUpdateStore={onUpdateStore}
          onUpdateItem={onUpdateItem}
          onClearChecked={onClearChecked}
          restoredItemIds={restoredItemIds}
          onRestoreAnimationDone={onRestoreAnimationDone}
        />
        <Suggestions suggestions={suggestions} onAdd={onAddItem} collapsible />
      </div>
    </div>
  );
};

MobileListDetail.propTypes = {
  list: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    emoji: PropTypes.string,
    items: PropTypes.array.isRequired,
  }).isRequired,
  stores: PropTypes.array.isRequired,
  history: PropTypes.array.isRequired,
  suggestions: PropTypes.array.isRequired,
  isGuest: PropTypes.bool,
  onBack: PropTypes.func.isRequired,
  onAddItem: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onUpdateCategory: PropTypes.func.isRequired,
  onUpdateStore: PropTypes.func.isRequired,
  onUpdateItem: PropTypes.func.isRequired,
  onClearChecked: PropTypes.func.isRequired,
  onShareClick: PropTypes.func.isRequired,
  restoredItemIds: PropTypes.instanceOf(Set),
  onRestoreAnimationDone: PropTypes.func,
};

MobileListDetail.defaultProps = {
  isGuest: false,
  restoredItemIds: null,
  onRestoreAnimationDone: null,
};
