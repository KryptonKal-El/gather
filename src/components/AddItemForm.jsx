import { useState, useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import styles from './AddItemForm.module.css';

/**
 * Derives a deduplicated, sorted list of unique item names from history.
 * @param {Array<{name: string}>} history
 * @returns {string[]}
 */
const getUniqueNames = (history) => {
  const seen = new Set();
  const names = [];
  for (const entry of history) {
    const lower = entry.name.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      names.push(entry.name);
    }
  }
  return names.sort((a, b) => a.localeCompare(b));
};

/**
 * Form for adding new items to the shopping list.
 * Includes an input field with autocomplete from history,
 * optional store selector, and submit button.
 */
export const AddItemForm = ({ stores, history, onAdd }) => {
  const [value, setValue] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const uniqueNames = useMemo(() => getUniqueNames(history), [history]);

  const suggestions = useMemo(() => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return [];
    return uniqueNames.filter((name) => name.toLowerCase().includes(trimmed));
  }, [value, uniqueNames]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[highlightedIndex]) {
      items[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSelect = (name) => {
    setValue(name);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    const parsedPrice = price === '' ? null : parseFloat(price);
    onAdd(trimmed, selectedStore || null, quantity, Number.isFinite(parsedPrice) ? parsedPrice : null);
    setValue('');
    setQuantity(1);
    setPrice('');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleInputChange = (e) => {
    setValue(e.target.value);
    setIsDropdownOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isDropdownOpen || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const showDropdown = isDropdownOpen && suggestions.length > 0;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.topRow}>
        <div className={styles.inputWrapper} ref={wrapperRef}>
          <input
            className={styles.input}
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={() => value.trim() && setIsDropdownOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Add an item..."
            aria-label="New item name"
            autoComplete="off"
          />
          {showDropdown && (
            <ul className={styles.dropdown} ref={listRef} role="listbox">
              {suggestions.map((name, index) => (
                <li
                  key={name}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  className={`${styles.dropdownItem} ${index === highlightedIndex ? styles.highlighted : ''}`}
                  onMouseDown={() => handleSelect(name)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className={styles.button} type="submit" disabled={!value.trim()}>
          Add
        </button>
      </div>
      <div className={styles.bottomRow}>
        <div className={styles.qtyGroup}>
          <label className={styles.fieldLabel} htmlFor="add-qty">Qty</label>
          <div className={styles.stepper}>
            <button
              type="button"
              className={styles.stepBtn}
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <input
              id="add-qty"
              className={styles.qtyInput}
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setQuantity(Number.isFinite(v) && v >= 1 ? v : 1);
              }}
              aria-label="Quantity"
            />
            <button
              type="button"
              className={styles.stepBtn}
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </div>
        <div className={styles.priceGroup}>
          <label className={styles.fieldLabel} htmlFor="add-price">Price</label>
          <div className={styles.priceInputWrapper}>
            <span className={styles.currencySymbol}>$</span>
            <input
              id="add-price"
              className={styles.priceInput}
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              aria-label="Price"
            />
          </div>
        </div>
        {stores.length > 0 && (
          <div className={styles.storeGroup}>
            <label className={styles.fieldLabel} htmlFor="add-store">Store</label>
            <select
              id="add-store"
              className={styles.storeSelect}
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              aria-label="Assign to store"
            >
              <option value="">No store</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </form>
  );
};

AddItemForm.propTypes = {
  stores: PropTypes.array,
  history: PropTypes.array,
  onAdd: PropTypes.func.isRequired,
};

AddItemForm.defaultProps = {
  stores: [],
  history: [],
};
