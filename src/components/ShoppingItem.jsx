import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { DEFAULT_CATEGORIES, getAllCategoryLabels, getAllCategoryColors, getAllCategoryKeys } from '../utils/categories.js';
import { useAuth } from '../context/AuthContext.jsx';
import { uploadItemImage } from '../services/imageStorage.js';
import { ImagePicker } from './ImagePicker.jsx';
import styles from './ShoppingItem.module.css';

/**
 * A single shopping list item row with optional image thumbnail, clickable
 * name (toggles checked state), quantity stepper, price, clickable category
 * badge, clickable store badge, and delete button.
 * Quantity, price, and image are editable inline. The category picker shows
 * the assigned store's categories (or global defaults).
 */
export const ShoppingItem = ({ item, stores, onToggle, onRemove, onUpdateCategory, onUpdateStore, onUpdateItem }) => {
  const { user } = useAuth();
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [isStorePickerOpen, setIsStorePickerOpen] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState('');
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const categoryPickerRef = useRef(null);
  const storePickerRef = useRef(null);
  const priceInputRef = useRef(null);

  const storeMap = {};
  for (const s of stores) {
    storeMap[s.id] = s;
  }
  const assignedStore = item.store ? storeMap[item.store] : null;

  // Use the assigned store's categories, or global defaults
  const categories = assignedStore?.categories ?? DEFAULT_CATEGORIES;
  const allLabels = getAllCategoryLabels(categories);
  const allColors = getAllCategoryColors(categories);
  const allKeys = getAllCategoryKeys(categories);

  // Close category picker on outside click
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

  // Close store picker on outside click
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
    if (key !== item.category) {
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

  const handlePriceClick = () => {
    setPriceValue(price !== null ? price.toFixed(2) : '');
    setIsEditingPrice(true);
  };

  const commitPrice = () => {
    setIsEditingPrice(false);
    const parsed = parseFloat(priceValue);
    const newPrice = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    if (newPrice !== price) {
      onUpdateItem(item.id, { price: newPrice });
    }
  };

  const handlePriceKeyDown = (e) => {
    if (e.key === 'Enter') commitPrice();
    if (e.key === 'Escape') setIsEditingPrice(false);
  };

  // Auto-focus the price input when entering edit mode
  useEffect(() => {
    if (isEditingPrice && priceInputRef.current) {
      priceInputRef.current.focus();
      priceInputRef.current.select();
    }
  }, [isEditingPrice]);

  const imageUrl = item.imageUrl ?? null;

  const handleSelectImageUrl = (url) => {
    onUpdateItem(item.id, { imageUrl: url });
    setIsImagePickerOpen(false);
  };

  const handleUploadImage = async (file) => {
    if (!user?.uid) return;
    setIsUploadingImage(true);
    try {
      const url = await uploadItemImage(user.uid, item.id, file);
      onUpdateItem(item.id, { imageUrl: url });
      setIsImagePickerOpen(false);
    } catch (err) {
      console.error(`Failed to upload image for item ${item.id}:`, err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    onUpdateItem(item.id, { imageUrl: null });
    setIsImagePickerOpen(false);
  };

  return (
    <div className={`${styles.item} ${item.isChecked ? styles.checked : ''}`}>
      <button
        type="button"
        className={`${styles.thumbnail} ${imageUrl ? styles.thumbnailHasImage : ''} ${isUploadingImage ? styles.thumbnailLoading : ''}`}
        onClick={() => setIsImagePickerOpen(true)}
        title="Set item image"
      >
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className={styles.thumbnailImg} />
        ) : (
          <span className={styles.thumbnailPlaceholder}>+</span>
        )}
      </button>
      <span
        className={styles.label}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        <span className={styles.name}>{item.name}</span>
      </span>
      <div className={styles.meta}>
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
        {isEditingPrice ? (
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
        ) : (
          <button
            type="button"
            className={styles.priceDisplay}
            onClick={handlePriceClick}
            title="Set price"
          >
            {lineTotal !== null ? `$${lineTotal.toFixed(2)}` : '$–'}
          </button>
        )}
      </div>
      <div className={styles.badges}>
        {stores.length > 0 && (
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
        )}
        <div className={styles.categoryWrapper} ref={categoryPickerRef}>
          <button
            type="button"
            className={styles.category}
            style={{ backgroundColor: allColors[item.category] ?? '#9e9e9e' }}
            onClick={() => setIsCategoryPickerOpen(!isCategoryPickerOpen)}
            title="Change category"
          >
            {allLabels[item.category] ?? 'Other'}
          </button>
          {isCategoryPickerOpen && (
            <div className={styles.picker}>
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
      <button
        className={styles.deleteBtn}
        onClick={onRemove}
        aria-label={`Remove ${item.name}`}
      >
        x
      </button>
      {isImagePickerOpen && (
        <ImagePicker
          itemName={item.name}
          currentImageUrl={imageUrl}
          onSelectUrl={handleSelectImageUrl}
          onUpload={handleUploadImage}
          onRemove={handleRemoveImage}
          onClose={() => setIsImagePickerOpen(false)}
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
};

ShoppingItem.defaultProps = {
  stores: [],
};
