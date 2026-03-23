import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { DEFAULT_CATEGORIES, getAllCategoryLabels, getAllCategoryColors, getAllCategoryKeys } from '../utils/categories.js';
import { getTypeConfig } from '../utils/listTypes.js';
import { formatPrice, getCurrencySymbol } from '../utils/formatPrice.js';
import { useAuth } from '../context/AuthContext.jsx';
import { uploadItemImage } from '../services/imageStorage.js';
import { fetchCompletionHistory } from '../services/database.js';
import { ImagePicker } from './ImagePicker.jsx';
import { ITEM_UNITS } from '../constants/units.js';
import styles from './ShoppingItem.module.css';

const RSVP_COLORS = {
  invited: '#42a5f5',
  confirmed: '#4caf50',
  declined: '#f44336',
  maybe: '#ff9800',
  not_invited: '#9e9e9e',
};

/**
 * A single shopping list item with a compact row and expandable edit panel.
 * The compact row shows image, name (with qty), store/category badges, price,
 * and a pencil icon to toggle the edit panel. The edit panel contains qty
 * stepper, price input, store/category pickers, and delete button.
 * Field visibility is determined by the list type configuration.
 */
export const ShoppingItem = ({ item, stores, listType, listCategories, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem, isRestored, onRestoreAnimationDone }) => {
  const { user } = useAuth();
  const typeConfig = getTypeConfig(listType);
  const { fields } = typeConfig;

  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isStorePickerOpen, setIsStorePickerOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [priceValue, setPriceValue] = useState('');
  const [nameValue, setNameValue] = useState('');
  const [unitValue, setUnitValue] = useState('each');
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const categoryPickerRef = useRef(null);
  const storePickerRef = useRef(null);
  const priceInputRef = useRef(null);

  // Swipe gesture state
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const touchStartRef = useRef(null);
  const swipeDirectionRef = useRef(null);

  // Restore animation state
  const [showRestoreAnimation, setShowRestoreAnimation] = useState(isRestored ?? false);

  // Mobile detection (coarse pointer = touch device)
  const [isMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });

  // Reduced motion preference
  const [prefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Clear restore animation after it plays
  useEffect(() => {
    if (!showRestoreAnimation) return;
    const timer = setTimeout(() => {
      setShowRestoreAnimation(false);
      onRestoreAnimationDone?.();
    }, 1200); // 0.2s expand + 1s green fade
    return () => clearTimeout(timer);
  }, [showRestoreAnimation, onRestoreAnimationDone]);

  const storeMap = {};
  for (const s of stores) {
    storeMap[s.id] = s;
  }
  const assignedStore = item.store ? storeMap[item.store] : null;

  // For category data, use listCategories if provided, otherwise fall back to type-specific or defaults
  const typeCategories = typeConfig.categories;
  const allLabels = {};
  const allColors = {};
  const allKeys = [];
  if (listCategories?.length > 0) {
    for (const cat of listCategories) {
      allLabels[cat.key] = cat.name;
      allColors[cat.key] = cat.color;
      allKeys.push(cat.key);
    }
  } else if (typeCategories) {
    for (const cat of typeCategories) {
      allLabels[cat.key] = cat.name;
      allColors[cat.key] = cat.color;
      allKeys.push(cat.key);
    }
  } else {
    const fallbackCats = DEFAULT_CATEGORIES;
    Object.assign(allLabels, getAllCategoryLabels(fallbackCats));
    Object.assign(allColors, getAllCategoryColors(fallbackCats));
    allKeys.push(...getAllCategoryKeys(fallbackCats));
  }

  useEffect(() => {
    if (!isCategoryPickerOpen) return;
    const handleClick = (e) => {
      if (categoryPickerRef.current && !categoryPickerRef.current.contains(e.target)) {
        setIsCategoryPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isCategoryPickerOpen]);

  useEffect(() => {
    if (!isStorePickerOpen) return;
    const handleClick = (e) => {
      if (storePickerRef.current && !storePickerRef.current.contains(e.target)) {
        setIsStorePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isStorePickerOpen]);

  const handleSelectCategory = (key) => {
    if (key !== (item.category ?? null)) {
      onUpdateCategory(item.id, key);
    }
    setIsCategoryPickerOpen(false);
  };

  const handleSelectStore = (storeId) => {
    if (storeId !== (item.store ?? null)) {
      onUpdateStore(item.id, storeId);
    }
    setIsStorePickerOpen(false);
  };

  const qty = item.quantity ?? 1;
  const price = item.price ?? null;
  const lineTotal = price !== null ? qty * price : null;

  const handleQtyChange = (delta) => {
    const next = Math.max(1, qty + delta);
    if (next !== qty) {
      onUpdateItem(item.id, { quantity: next });
    }
  };

  const commitPrice = () => {
    const parsed = parseFloat(priceValue);
    const newPrice = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    if (newPrice !== price) {
      onUpdateItem(item.id, { price: newPrice });
    }
  };

  const handlePriceKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitPrice();
      e.target.blur();
    }
  };

  const commitName = () => {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== item.name) {
      onUpdateItem(item.id, { name: trimmed });
    }
  };

  const handleUnitChange = (e) => {
    const newUnit = e.target.value;
    setUnitValue(newUnit);
    onUpdateItem(item.id, { unit: newUnit });
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitName();
      e.target.blur();
    }
  };

  const handleEditToggle = () => {
    if (isEditOpen) {
      commitName();
      commitPrice();
      setIsEditOpen(false);
    } else {
      setNameValue(item.name);
      setPriceValue(price !== null ? price.toFixed(2) : '');
      setUnitValue(item.unit ?? 'each');
      setIsEditOpen(true);
    }
  };

  const imageUrl = item.imageUrl ?? null;

  const handleSelectImageUrl = (url) => {
    onUpdateItem(item.id, { imageUrl: url });
    setIsImagePickerOpen(false);
  };

  const handleUploadImage = async (file) => {
    if (!user?.id) return;
    setIsUploadingImage(true);
    setUploadError(null);
    try {
      const url = await uploadItemImage(user.id, item.id, file);
      onUpdateItem(item.id, { imageUrl: url });
      setIsImagePickerOpen(false);
    } catch (err) {
      console.error(`Failed to upload image for item ${item.id}:`, err);
      setUploadError('Upload failed. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    onUpdateItem(item.id, { imageUrl: null });
    setIsImagePickerOpen(false);
  };

  const handleShowHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const history = await fetchCompletionHistory(item.listId, item.name);
      setHistoryItems(history);
      setShowHistory(true);
    } catch (err) {
      console.error('Failed to fetch completion history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Swipe gesture handlers (mobile only)
  const handleTouchStart = (e) => {
    if (!isMobile || isEditOpen) return;
    const touch = e.touches[0];
    // Ignore touches near screen edges (iOS back gesture, Android edge gestures)
    const EDGE_THRESHOLD = 20;
    if (touch.clientX <= EDGE_THRESHOLD || touch.clientX >= window.innerWidth - EDGE_THRESHOLD) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeDirectionRef.current = null;
  };

  const handleTouchMove = (e) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Direction lock: determine swipe direction on first significant movement
    if (swipeDirectionRef.current === null) {
      if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        swipeDirectionRef.current = 'vertical';
        return;
      }
      swipeDirectionRef.current = 'horizontal';
    }

    if (swipeDirectionRef.current === 'vertical') return;

    // Horizontal swipe: only allow left swipe (negative deltaX)
    const clampedDeltaX = Math.min(0, deltaX);
    setSwipeX(clampedDeltaX);
    setIsSwiping(true);
    e.preventDefault();
  };

  const handleTouchEnd = () => {
    if (!isSwiping || !touchStartRef.current) {
      touchStartRef.current = null;
      swipeDirectionRef.current = null;
      return;
    }

    const SWIPE_THRESHOLD = 80;
    if (Math.abs(swipeX) >= SWIPE_THRESHOLD) {
      // Threshold met: trigger exit animation
      setIsExiting(true);
      setSwipeX(0);
      setIsSwiping(false);
    } else {
      // Reset swipe state (snap-back if threshold not met)
      setSwipeX(0);
      setIsSwiping(false);
    }
    touchStartRef.current = null;
    swipeDirectionRef.current = null;
  };

  const handleAnimationEnd = (e) => {
    // Only fire on the collapseHeight animation ending on the wrapper
    if (isExiting && e.target === e.currentTarget) {
      onRemove();
    }
  };

  // Build inline style for swipe transform
  const getSwipeStyle = () => {
    // CSS animation handles exit
    if (isExiting) return undefined;
    if (prefersReducedMotion) {
      // No translate animation for reduced motion
      return undefined;
    }
    if (isSwiping || swipeX !== 0) {
      return {
        transform: `translateX(${swipeX}px)`,
        transition: isSwiping ? 'none' : 'transform 0.2s ease-out',
      };
    }
    return undefined;
  };

  return (
    <div
      className={`${styles.itemWrapper} ${isExiting ? styles.itemExiting : ''} ${showRestoreAnimation ? styles.itemRestored : ''}`}
      onAnimationEnd={handleAnimationEnd}
    >
      {/* Delete zone revealed behind item during swipe */}
      {isMobile && !isExiting && (isSwiping || swipeX !== 0) && (
        <div className={`${styles.deleteZone} ${Math.abs(swipeX) >= 80 ? styles.deleteZoneActive : ''}`}>
          <svg
            className={styles.deleteZoneIcon}
            style={{ opacity: Math.min(1, Math.abs(swipeX) / 60) }}
            width="20"
            height="20"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M1.75 3.5h10.5M5.25 3.5V2.33c0-.46.37-.83.83-.83h1.84c.46 0 .83.37.83.83V3.5m1.5 0v8.17c0 .46-.37.83-.83.83H4.58a.83.83 0 0 1-.83-.83V3.5h8.5Z" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <div
        className={`${styles.item} ${item.isChecked ? styles.checked : ''} ${isSwiping && !isExiting ? styles.itemSwiping : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={getSwipeStyle()}
      >
        {fields.image && (
          <button
            type="button"
            className={`${styles.thumbnail} ${imageUrl ? styles.thumbnailHasImage : ''} ${isUploadingImage ? styles.thumbnailLoading : ''}`}
            onClick={() => {
              setUploadError(null);
              setIsImagePickerOpen(true);
            }}
            title="Set item image"
          >
            {imageUrl ? (
              <img src={imageUrl} alt={item.name} className={styles.thumbnailImg} />
            ) : (
              <span className={styles.thumbnailPlaceholder}>+</span>
            )}
          </button>
        )}
        <div className={styles.details} onDoubleClick={onToggle}>
          <span className={styles.label}>
            <span className={styles.name}>
              {item.name}
              {fields.quantity && (
                (item.unit && item.unit !== 'each')
                  ? <span className={styles.qty}> ({qty} {item.unit})</span>
                  : qty > 1 && <span className={styles.qty}> ({qty})</span>
              )}
            </span>
          </span>
          <div className={styles.badges}>
            {fields.store && assignedStore && (
              <span className={styles.storeBadgeCompact} style={{ backgroundColor: assignedStore.color }}>
                {assignedStore.name}
              </span>
            )}
            {fields.category && item.category && (
              <span
                className={styles.categoryCompact}
                style={{ backgroundColor: allColors[item.category] ?? '#9e9e9e' }}
              >
                {allLabels[item.category] ?? 'Other'}
              </span>
            )}
            {fields.rsvpStatus && (
              <div className={styles.rsvpPickerWrapper}>
                <select
                  className={styles.rsvpPickerSelect}
                  value={item.rsvpStatus ?? 'invited'}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdateItem(item.id, { rsvpStatus: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ backgroundColor: RSVP_COLORS[item.rsvpStatus] ?? RSVP_COLORS.invited }}
                >
                  <option value="invited">Invited</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="declined">Declined</option>
                  <option value="maybe">Maybe</option>
                  <option value="not_invited">Not Yet Invited</option>
                </select>
              </div>
            )}
          </div>
        </div>
        {fields.price && lineTotal !== null && (
          <span className={styles.price} onDoubleClick={onToggle}>
            {formatPrice(lineTotal)}
          </span>
        )}
        <button
          type="button"
          className={styles.editBtn}
          onClick={handleEditToggle}
          aria-label="Edit item"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.13 1.87a1.25 1.25 0 0 1 1.77 0l1.23 1.23a1.25 1.25 0 0 1 0 1.77L5.04 13.96l-3.46.77.77-3.46L11.13 1.87Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {isEditOpen && (
        <div className={styles.editPanel}>
          <div className={styles.editRow}>
            <span className={styles.editLabel}>Name</span>
            <input
              className={styles.nameEditInput}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={handleNameKeyDown}
            />
          </div>
          {fields.quantity && (
            <div className={styles.editRow}>
              <span className={styles.editLabel}>{typeConfig.quantityLabel ?? 'Quantity'}</span>
              <div className={styles.qtyStepper}>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => handleQtyChange(-1)}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className={styles.qtyValue}>{qty}</span>
                <button
                  type="button"
                  className={styles.qtyBtn}
                  onClick={() => handleQtyChange(1)}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          )}
          {fields.unit && (
            <div className={styles.editRow}>
              <span className={styles.editLabel}>Unit</span>
              <select
                className={styles.unitSelect}
                value={unitValue}
                onChange={handleUnitChange}
              >
                {ITEM_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          )}
          {fields.price && (
            <div className={styles.editRow}>
              <span className={styles.editLabel}>Price</span>
              <div className={styles.priceEdit}>
                <span className={styles.priceCurrency}>{getCurrencySymbol()}</span>
                <input
                  ref={priceInputRef}
                  className={styles.priceEditInput}
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  onBlur={commitPrice}
                  onKeyDown={handlePriceKeyDown}
                />
              </div>
            </div>
          )}
          {fields.store && stores.length > 0 && (
            <div className={styles.editRow}>
              <span className={styles.editLabel}>Store</span>
              <div className={styles.storeWrapper} ref={storePickerRef}>
                <button
                  type="button"
                  className={styles.storeBadge}
                  style={assignedStore ? { backgroundColor: assignedStore.color } : undefined}
                  onClick={() => setIsStorePickerOpen(!isStorePickerOpen)}
                  title="Change store"
                >
                  {assignedStore ? assignedStore.name : 'No store'}
                </button>
                {isStorePickerOpen && (
                  <div className={styles.picker}>
                    <button
                      type="button"
                      className={`${styles.pickerOption} ${!item.store ? styles.pickerActive : ''}`}
                      onClick={() => handleSelectStore(null)}
                    >
                      <span className={styles.pickerDot} style={{ backgroundColor: '#bbb' }} />
                      No store
                    </button>
                    {stores.map((store) => (
                      <button
                        key={store.id}
                        type="button"
                        className={`${styles.pickerOption} ${store.id === item.store ? styles.pickerActive : ''}`}
                        onClick={() => handleSelectStore(store.id)}
                      >
                        <span
                          className={styles.pickerDot}
                          style={{ backgroundColor: store.color }}
                        />
                        {store.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {fields.category && (
            <div className={styles.editRow}>
              <span className={styles.editLabel}>Category</span>
              <div className={styles.categoryWrapper} ref={categoryPickerRef}>
                <button
                  type="button"
                  className={styles.category}
                  style={{ backgroundColor: item.category ? (allColors[item.category] ?? '#9e9e9e') : '#bbb' }}
                  onClick={() => setIsCategoryPickerOpen(!isCategoryPickerOpen)}
                  title="Change category"
                >
                  {item.category ? (allLabels[item.category] ?? 'Other') : 'No category'}
                </button>
                {isCategoryPickerOpen && (
                  <div className={styles.picker}>
                    <button
                      type="button"
                      className={`${styles.pickerOption} ${!item.category ? styles.pickerActive : ''}`}
                      onClick={() => handleSelectCategory(null)}
                    >
                      <span className={styles.pickerDot} style={{ backgroundColor: '#bbb' }} />
                      No category
                    </button>
                    {allKeys.map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`${styles.pickerOption} ${key === item.category ? styles.pickerActive : ''}`}
                        onClick={() => handleSelectCategory(key)}
                      >
                        <span
                          className={styles.pickerDot}
                          style={{ backgroundColor: allColors[key] ?? '#9e9e9e' }}
                        />
                        {allLabels[key] ?? key}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {fields.rsvpStatus && (
            <div className={styles.editRow}>
              <span className={styles.editLabel}>RSVP</span>
              <select
                className={styles.rsvpSelect}
                value={item.rsvpStatus ?? 'invited'}
                onChange={(e) => onUpdateItem(item.id, { rsvpStatus: e.target.value })}
              >
                <option value="invited">Invited</option>
                <option value="confirmed">Confirmed</option>
                <option value="declined">Declined</option>
                <option value="maybe">Maybe</option>
                <option value="not_invited">Not Yet Invited</option>
              </select>
            </div>
          )}
          {fields.dueDate && (
            <div className={styles.editRow}>
              <span className={styles.editLabel}>Due Date</span>
              <div className={styles.dueDateRow}>
                <input
                  type="date"
                  className={styles.dueDateInput}
                  value={item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    onUpdateItem(item.id, { dueDate: val });
                  }}
                />
                {item.dueDate && (
                  <button
                    type="button"
                    className={styles.dueDateClear}
                    onClick={() => onUpdateItem(item.id, { dueDate: null })}
                    aria-label="Clear due date"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}
          {(item.recurrenceRule || item.parentItemId) && (
            <div className={styles.editRow}>
              <button
                className={styles.historyToggle}
                onClick={handleShowHistory}
                type="button"
              >
                <span className={styles.editLabel}>Completion History</span>
                <span className={styles.historyChevron}>{showHistory ? '▼' : '▶'}</span>
              </button>
            </div>
          )}
          {(item.recurrenceRule || item.parentItemId) && historyLoading && (
            <div className={styles.historyLoading}>Loading...</div>
          )}
          {(item.recurrenceRule || item.parentItemId) && showHistory && !historyLoading && (
            <div className={styles.historyList}>
              {historyItems.length === 0 ? (
                <p className={styles.historyEmpty}>No completions yet</p>
              ) : (
                historyItems.map((h) => (
                  <div key={h.id} className={styles.historyEntry}>
                    <span className={styles.historyCheck}>✓</span>
                    <span className={styles.historyDate}>
                      {h.dueDate ? new Date(h.dueDate).toLocaleDateString() : '—'}
                    </span>
                    <span className={styles.historyTime}>
                      {h.checkedAt ? new Date(h.checkedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
          <div className={styles.editFooter}>
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={onRemove}
              aria-label={`Remove ${item.name}`}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.75 3.5h10.5M5.25 3.5V2.33c0-.46.37-.83.83-.83h1.84c.46 0 .83.37.83.83V3.5m1.5 0v8.17c0 .46-.37.83-.83.83H4.58a.83.83 0 0 1-.83-.83V3.5h8.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Delete
            </button>
          </div>
        </div>
      )}

      {fields.image && isImagePickerOpen && (
        <ImagePicker
          itemName={item.name}
          currentImageUrl={imageUrl}
          onSelectUrl={handleSelectImageUrl}
          onUpload={handleUploadImage}
          onRemove={handleRemoveImage}
          onClose={() => setIsImagePickerOpen(false)}
          isUploading={isUploadingImage}
          uploadError={uploadError}
        />
      )}
    </div>
  );
};

ShoppingItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    category: PropTypes.string.isRequired,
    isChecked: PropTypes.bool.isRequired,
    store: PropTypes.string,
    quantity: PropTypes.number,
    price: PropTypes.number,
    imageUrl: PropTypes.string,
    unit: PropTypes.string,
    rsvpStatus: PropTypes.string,
    dueDate: PropTypes.string,
    listId: PropTypes.string,
    recurrenceRule: PropTypes.string,
    parentItemId: PropTypes.string,
  }).isRequired,
  stores: PropTypes.array,
  listType: PropTypes.string,
  listCategories: PropTypes.array,
  onToggle: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onUpdateCategory: PropTypes.func.isRequired,
  onUpdateStore: PropTypes.func.isRequired,
  onUpdateItem: PropTypes.func.isRequired,
  isRestored: PropTypes.bool,
  onRestoreAnimationDone: PropTypes.func,
};

ShoppingItem.defaultProps = {
  stores: [],
  listType: 'grocery',
  listCategories: null,
  isRestored: false,
  onRestoreAnimationDone: null,
};
