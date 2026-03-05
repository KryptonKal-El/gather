import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { DEFAULT_CATEGORIES, getAllCategoryLabels, getAllCategoryColors, getAllCategoryKeys } from '../utils/categories.js';
import { useAuth } from '../context/AuthContext.jsx';
import { uploadItemImage } from '../services/imageStorage.js';
import { ImagePicker } from './ImagePicker.jsx';
import styles from './ShoppingItem.module.css';

/**
 * A single shopping list item with a compact row and expandable edit panel.
 * The compact row shows image, name (with qty), store/category badges, price,
 * and a pencil icon to toggle the edit panel. The edit panel contains qty
 * stepper, price input, store/category pickers, and delete button.
 */
export const ShoppingItem = ({ item, stores, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem, isRestored, onRestoreAnimationDone }) => {
  const { user } = useAuth();
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isStorePickerOpen, setIsStorePickerOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [priceValue, setPriceValue] = useState('');
  const [nameValue, setNameValue] = useState('');
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState(null);
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

  const categories = assignedStore?.categories ?? DEFAULT_CATEGORIES;
  const allLabels = getAllCategoryLabels(categories);
  const allColors = getAllCategoryColors(categories);
  const allKeys = getAllCategoryKeys(categories);

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

  // Swipe gesture handlers (mobile only)
  const handleTouchStart = (e) => {
    if (!isMobile || isEditOpen) return;
    const touch = e.touches[0];
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
        <div className={styles.details} onDoubleClick={onToggle}>
          <span className={styles.label}>
            <span className={styles.name}>
              {item.name}
              {qty > 1 && <span className={styles.qty}> ({qty})</span>}
            </span>
          </span>
          <div className={styles.badges}>
            {assignedStore && (
              <span className={styles.storeBadgeCompact} style={{ backgroundColor: assignedStore.color }}>
                {assignedStore.name}
              </span>
            )}
            {item.category && (
              <span
                className={styles.categoryCompact}
                style={{ backgroundColor: allColors[item.category] ?? '#9e9e9e' }}
              >
                {allLabels[item.category] ?? 'Other'}
              </span>
            )}
          </div>
        </div>
        <span className={styles.price} onDoubleClick={onToggle}>
          {lineTotal !== null ? `$${lineTotal.toFixed(2)}` : '$–'}
        </span>
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
          <div className={styles.editRow}>
            <span className={styles.editLabel}>Quantity</span>
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
          <div className={styles.editRow}>
            <span className={styles.editLabel}>Price</span>
            <div className={styles.priceEdit}>
              <span className={styles.priceCurrency}>$</span>
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
          {stores.length > 0 && (
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

      {isImagePickerOpen && (
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
  }).isRequired,
  stores: PropTypes.array,
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
  isRestored: false,
  onRestoreAnimationDone: null,
};
