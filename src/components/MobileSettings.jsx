/**
 * Mobile settings screen styled as an iOS grouped table view.
 * Displays account info, dark mode toggle, and sign out action.
 */
import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { uploadProfileImage } from '../services/imageStorage.js';
import { useSortPreferences } from '../hooks/useSortPreferences.js';
import { useShoppingList } from '../hooks/useShoppingList.js';
import { SortLevelEditor } from './SortLevelEditor.jsx';
import { CategoryEditor } from './CategoryEditor.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { SYSTEM_DEFAULT_SORT_CONFIG } from '../utils/sortPipeline.js';
import { getSystemDefaultCategories } from '../utils/categories.js';
import styles from './MobileSettings.module.css';

/**
 * Renders the mobile settings screen.
 * @param {Object} props
 * @param {Object} props.user - Supabase user object with profile
 * @param {Function} props.onSignOut - Sign out callback
 */
export const MobileSettings = ({ user, onSignOut }) => {
  const { theme, toggleTheme } = useTheme();
  const { refreshUser } = useAuth();
  const { userPreferences, loading: prefsLoading, updateDefaultSort } = useSortPreferences();
  const { state, actions } = useShoppingList();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedCategoryType, setSelectedCategoryType] = useState('grocery');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef(null);

  const isDark = theme === 'dark';
  const currentDefaultSort = userPreferences?.default_sort_config ?? SYSTEM_DEFAULT_SORT_CONFIG;

  const categoryTypes = [
    { value: 'grocery', label: 'Grocery' },
    { value: 'packing', label: 'Packing' },
    { value: 'todo', label: 'To-Do' },
  ];

  const getCurrentDefaults = (listType) => {
    const userDefault = state.userCategoryDefaults.find(d => d.listType === listType);
    return userDefault?.categories ?? getSystemDefaultCategories(listType) ?? [];
  };

  const displayName = user?.user_metadata?.full_name ?? user?.profile?.display_name ?? 'User';
  const email = user?.email ?? '';
  const avatarLetter = (displayName.charAt(0).toUpperCase() || 'U');
  const photoURL = user?.profile?.avatar_url ?? user?.user_metadata?.avatar_url;

  const handleAvatarClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      await uploadProfileImage(user, file);
      await refreshUser();
    } catch (err) {
      console.error('Profile image upload failed:', err);
      setUploadError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDefaultSortChange = async (config) => {
    try {
      await updateDefaultSort(config);
    } catch (err) {
      console.error('Failed to update default sort:', err);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionHeader}>Account</h3>
      <div className={styles.section}>
        <div className={styles.accountRow}>
          <div
            className={`${styles.avatar} ${styles.avatarTappable}`}
            onClick={handleAvatarClick}
            role="button"
            tabIndex={0}
            aria-label="Change profile photo"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAvatarClick(); }}
          >
            {isUploading ? (
              <div className={styles.uploadSpinner} />
            ) : photoURL ? (
              <img src={photoURL} alt="" className={styles.avatarImage} />
            ) : (
              avatarLetter
            )}
            {!isUploading && (
              <div className={styles.avatarOverlay}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenInput}
            onChange={handleFileChange}
            aria-hidden="true"
            tabIndex={-1}
          />
          <div className={styles.accountInfo}>
            <span className={styles.displayName}>{displayName}</span>
            {email && <span className={styles.email}>{email}</span>}
          </div>
        </div>
        {uploadError && (
          <div className={styles.uploadError}>
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      <h3 className={styles.sectionHeader}>Appearance</h3>
      <div className={styles.section}>
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Dark Mode</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={isDark}
              onChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
            <span className={styles.toggleTrack} />
          </label>
        </div>
      </div>

      <h3 className={styles.sectionHeader}>Display</h3>
      <div className={styles.section}>
        <div className={styles.sortHeader}>
          <span className={styles.sortLabel}>Default Sort</span>
        </div>
        <SortLevelEditor
          config={currentDefaultSort}
          onConfigChange={handleDefaultSortChange}
          disabled={prefsLoading}
        />
      </div>

      <h3 className={styles.sectionHeader}>Category Defaults</h3>
      <div className={styles.section}>
        <div className={styles.row}>
          <div className={styles.categoryTypeTabs}>
            {categoryTypes.map(type => (
              <button
                key={type.value}
                type="button"
                className={`${styles.categoryTypeTab} ${selectedCategoryType === type.value ? styles.categoryTypeTabActive : ''}`}
                onClick={() => setSelectedCategoryType(type.value)}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.categoryEditorWrapper}>
          <CategoryEditor
            categories={getCurrentDefaults(selectedCategoryType)}
            listType={selectedCategoryType}
            onSave={(cats) => actions.saveUserCategoryDefault(selectedCategoryType, cats)}
            showHeader={false}
          />
        </div>

        <div className={styles.row}>
          <button
            type="button"
            className={styles.resetDefaultsButton}
            onClick={() => setShowResetConfirm(true)}
          >
            Reset to System Defaults
          </button>
        </div>
      </div>

      {showResetConfirm && (
        <ConfirmDialog
          message={`This will replace your ${categoryTypes.find(t => t.value === selectedCategoryType)?.label} category defaults with the system defaults. Continue?`}
          confirmLabel="Reset"
          onConfirm={() => {
            const systemDefaults = getSystemDefaultCategories(selectedCategoryType);
            if (systemDefaults) {
              actions.saveUserCategoryDefault(selectedCategoryType, systemDefaults);
            }
            setShowResetConfirm(false);
          }}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      <h3 className={styles.sectionHeader}>Account Actions</h3>
      <div className={styles.section}>
        <button
          type="button"
          className={styles.destructiveRow}
          onClick={onSignOut}
        >
          <span className={styles.destructiveText}>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

MobileSettings.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    email: PropTypes.string,
    user_metadata: PropTypes.shape({
      full_name: PropTypes.string,
      avatar_url: PropTypes.string,
    }),
    profile: PropTypes.shape({
      display_name: PropTypes.string,
      avatar_url: PropTypes.string,
    }),
  }),
  onSignOut: PropTypes.func.isRequired,
};
