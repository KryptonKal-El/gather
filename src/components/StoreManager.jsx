import { useState } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import styles from './StoreManager.module.css';

const PRESET_COLORS = [
  '#1565c0', '#6a1b9a', '#00838f', '#2e7d32', '#ef6c00',
  '#c62828', '#4527a0', '#00695c', '#ad1457', '#37474f',
  '#f9a825', '#4e342e', '#1b5e20', '#283593', '#bf360c',
  '#0277bd', '#558b2f', '#7b1fa2',
];

const CATEGORY_PRESET_COLORS = [
  '#4caf50', '#2196f3', '#e53935', '#ff9800', '#00bcd4',
  '#795548', '#9c27b0', '#ffc107', '#ff5722', '#607d8b',
  '#e91e63', '#9e9e9e', '#1565c0', '#6a1b9a', '#00838f',
  '#2e7d32', '#ef6c00', '#4527a0',
];

/**
 * Inline category editor for a single store.
 * Supports add, remove (with confirm), rename, reorder, color picker,
 * and keyword editing for each category.
 */
const StoreCategoryEditor = ({ categories, onSave }) => {
  const [localCats, setLocalCats] = useState(categories);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CATEGORY_PRESET_COLORS[0]);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [confirmingDeleteIndex, setConfirmingDeleteIndex] = useState(-1);

  const isDirty = JSON.stringify(localCats) !== JSON.stringify(categories);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (localCats.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    const key = `custom_${Date.now()}`;
    setLocalCats([...localCats, { key, name: trimmed, color: newColor, keywords: [] }]);
    setNewName('');
    setNewColor(CATEGORY_PRESET_COLORS[0]);
  };

  const handleAddKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleDelete = (index) => {
    setLocalCats(localCats.filter((_, i) => i !== index));
    setConfirmingDeleteIndex(-1);
  };

  const handleStartEdit = (index) => {
    const cat = localCats[index];
    setEditingIndex(index);
    setEditName(cat.name);
    setEditColor(cat.color);
    setEditKeywords(cat.keywords.join(', '));
  };

  const handleSaveEdit = () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditingIndex(-1);
      return;
    }
    const updated = [...localCats];
    updated[editingIndex] = {
      ...updated[editingIndex],
      name: trimmed,
      color: editColor,
      keywords: editKeywords
        .split(',')
        .map((kw) => kw.trim())
        .filter(Boolean),
    };
    setLocalCats(updated);
    setEditingIndex(-1);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveEdit();
    if (e.key === 'Escape') setEditingIndex(-1);
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const reordered = [...localCats];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    setLocalCats(reordered);
  };

  const handleMoveDown = (index) => {
    if (index === localCats.length - 1) return;
    const reordered = [...localCats];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    setLocalCats(reordered);
  };

  const handleSaveAll = () => {
    onSave(localCats);
  };

  return (
    <div className={styles.catEditor}>
      <h5 className={styles.catTitle}>Categories ({localCats.length})</h5>

      {localCats.length === 0 && (
        <p className={styles.catEmpty}>No categories. Add one below.</p>
      )}

      <div className={styles.catList}>
        {localCats.map((cat, index) => (
          <div key={`${cat.key}-${index}`} className={styles.catRow}>
            {editingIndex === index ? (
              <div className={styles.catEditForm}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className={styles.catRenameInput}
                  placeholder="Category name"
                  autoFocus
                />
                <div className={styles.catEditColorPicker}>
                  {CATEGORY_PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`${styles.catColorSwatch} ${editColor === c ? styles.catColorSelected : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditColor(c)}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
                <input
                  type="text"
                  value={editKeywords}
                  onChange={(e) => setEditKeywords(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className={styles.catRenameInput}
                  placeholder="Keywords (comma-separated)"
                />
                <div className={styles.catEditActions}>
                  <button
                    type="button"
                    className={styles.catEditSaveBtn}
                    onClick={handleSaveEdit}
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    className={styles.catEditCancelBtn}
                    onClick={() => setEditingIndex(-1)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span
                  className={styles.catBadge}
                  style={{ backgroundColor: cat.color }}
                >
                  {cat.name}
                </span>
                <span className={styles.catKeywordCount}>
                  {cat.keywords.length} keywords
                </span>
                <div className={styles.catActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    aria-label="Move up"
                    title="Move up"
                  >
                    &uarr;
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => handleMoveDown(index)}
                    disabled={index === localCats.length - 1}
                    aria-label="Move down"
                    title="Move down"
                  >
                    &darr;
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => handleStartEdit(index)}
                    aria-label="Edit"
                    title="Edit"
                  >
                    &#9998;
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconBtn} ${styles.deleteIcon}`}
                    onClick={() => setConfirmingDeleteIndex(index)}
                    aria-label={`Delete ${cat.name}`}
                    title="Delete"
                  >
                    &times;
                  </button>
                  {confirmingDeleteIndex === index && (
                    <ConfirmDialog
                      message={`Delete category "${cat.name}"?`}
                      onConfirm={() => handleDelete(index)}
                      onCancel={() => setConfirmingDeleteIndex(-1)}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className={styles.catAddRow}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleAddKeyDown}
          className={styles.catAddInput}
          placeholder="New category name..."
        />
        <div className={styles.catAddColorPicker}>
          {CATEGORY_PRESET_COLORS.slice(0, 6).map((c) => (
            <button
              key={c}
              type="button"
              className={`${styles.catColorSwatch} ${newColor === c ? styles.catColorSelected : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setNewColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
        <button
          type="button"
          className={styles.catAddBtn}
          onClick={handleAdd}
          disabled={!newName.trim()}
        >
          Add
        </button>
      </div>

      {isDirty && (
        <button
          type="button"
          className={styles.catSaveBtn}
          onClick={handleSaveAll}
        >
          Save Categories
        </button>
      )}
    </div>
  );
};

/**
 * Panel for managing stores: create, rename, delete, pick color, reorder,
 * and manage categories per store.
 */
export const StoreManager = ({
  stores,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [catExpandedId, setCatExpandedId] = useState(null);

  const handleCreate = (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAdd(trimmed, newColor);
    setNewName('');
    setNewColor(PRESET_COLORS[0]);
  };

  const handleStartEdit = (store) => {
    setEditingId(store.id);
    setEditName(store.name);
    setEditColor(store.color);
  };

  const handleSaveEdit = (id) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    onUpdate(id, { name: trimmed, color: editColor });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const reordered = [...stores];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    onReorder(reordered);
  };

  const handleMoveDown = (index) => {
    if (index === stores.length - 1) return;
    const reordered = [...stores];
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
    onReorder(reordered);
  };

  const handleSaveCategories = (storeId, categories) => {
    onUpdate(storeId, { categories });
  };

  const toggleCatExpanded = (storeId) => {
    setCatExpandedId((prev) => (prev === storeId ? null : storeId));
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.toggle}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className={styles.toggleIcon}>{isOpen ? '\u2212' : '+'}</span>
        Manage Stores
      </button>

      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>
              Your Stores ({stores.length})
            </h4>

            {stores.length === 0 && (
              <p className={styles.emptyHint}>
                No stores yet. Add a store to organize items by where you shop.
              </p>
            )}

            <div className={styles.storeList}>
              {stores.map((store, index) => (
                <div key={store.id} className={styles.storeItem}>
                  {editingId === store.id ? (
                    <div className={styles.editForm}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={styles.input}
                        placeholder="Store name"
                      />
                      <div className={styles.colorPicker}>
                        {PRESET_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`${styles.colorSwatch} ${editColor === c ? styles.colorSelected : ''}`}
                            style={{ backgroundColor: c }}
                            onClick={() => setEditColor(c)}
                            aria-label={`Color ${c}`}
                          />
                        ))}
                      </div>
                      <div className={styles.editActions}>
                        <button
                          type="button"
                          className={styles.saveBtn}
                          onClick={() => handleSaveEdit(store.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.storeItemRow}>
                        <span
                          className={styles.storeBadge}
                          style={{ backgroundColor: store.color }}
                        >
                          {store.name}
                        </span>
                        <span className={styles.catCount}>
                          {store.categories?.length ?? 0} categories
                        </span>
                        <div className={styles.itemActions}>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => toggleCatExpanded(store.id)}
                            aria-label="Manage categories"
                            title="Manage categories"
                          >
                            {catExpandedId === store.id ? '\u25BE' : '\u25B8'}
                          </button>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            aria-label="Move up"
                            title="Move up"
                          >
                            &uarr;
                          </button>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => handleMoveDown(index)}
                            disabled={index === stores.length - 1}
                            aria-label="Move down"
                            title="Move down"
                          >
                            &darr;
                          </button>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => handleStartEdit(store)}
                            aria-label="Edit"
                            title="Edit"
                          >
                            &#9998;
                          </button>
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.deleteIcon}`}
                            onClick={() => setConfirmingDeleteId(store.id)}
                            aria-label={`Delete ${store.name}`}
                            title="Delete"
                          >
                            &times;
                          </button>
                          {confirmingDeleteId === store.id && (
                            <ConfirmDialog
                              message={`Delete store "${store.name}"?`}
                              onConfirm={() => {
                                onDelete(store.id);
                                setConfirmingDeleteId(null);
                              }}
                              onCancel={() => setConfirmingDeleteId(null)}
                            />
                          )}
                        </div>
                      </div>
                      {catExpandedId === store.id && (
                        <StoreCategoryEditor
                          categories={store.categories ?? []}
                          onSave={(cats) => handleSaveCategories(store.id, cats)}
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <form className={styles.addForm} onSubmit={handleCreate}>
            <h4 className={styles.sectionTitle}>Add New Store</h4>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={styles.input}
              placeholder="Store name (e.g. Walmart, Costco)"
            />
            <div className={styles.colorPicker}>
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorSwatch} ${newColor === c ? styles.colorSelected : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setNewColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <button type="submit" className={styles.addBtn} disabled={!newName.trim()}>
              Add Store
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

StoreManager.propTypes = {
  stores: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      categories: PropTypes.arrayOf(
        PropTypes.shape({
          key: PropTypes.string.isRequired,
          name: PropTypes.string.isRequired,
          color: PropTypes.string.isRequired,
          keywords: PropTypes.arrayOf(PropTypes.string).isRequired,
        })
      ),
    })
  ).isRequired,
  onAdd: PropTypes.func.isRequired,
  onUpdate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onReorder: PropTypes.func.isRequired,
};
