/**
 * ImagePicker — modal for selecting an item image via upload or web search.
 * When an image exists, shows view-only mode (large preview + remove).
 * When no image exists (or after removal), shows full picker with search/upload tabs.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { searchImages } from '../services/imageSearch.js';
import styles from './ImagePicker.module.css';

/**
 * Modal overlay for picking an item image.
 * Supports file upload and Google image search with an editable query field.
 * @param {Object} props
 * @param {string} props.itemName - The item's name (used as initial search query)
 * @param {string|null} props.currentImageUrl - Currently assigned image URL
 * @param {Function} props.onSelectUrl - Called with the chosen image URL string
 * @param {Function} props.onUpload - Called with a File object to upload
 * @param {Function} props.onRemove - Called to clear the current image
 * @param {Function} props.onClose - Called to close the picker
 * @param {boolean} props.isUploading - Whether an upload is in progress
 * @param {string|null} props.uploadError - Error message from failed upload
 * @param {Object} props.imageSearchSettings - Enabled image search source settings
 * @param {Function} props.onNavigateToSettings - Called to open settings from empty state
 */
export const ImagePicker = ({ itemName, currentImageUrl, onSelectUrl, onUpload, onRemove, onClose, isUploading, uploadError, imageSearchSettings, onNavigateToSettings }) => {
  const [viewMode, setViewMode] = useState(!!currentImageUrl);
  const [searchQuery, setSearchQuery] = useState(itemName);
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('search');
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);
  const didAutoSearch = useRef(false);
  const allSourcesOff = imageSearchSettings && Object.values(imageSearchSettings).every(v => !v);
  const visibleGroups = results.filter((group) => group.results?.length > 0);

  const handleSearch = useCallback(async () => {
    if (allSourcesOff) return;
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setError(null);
    try {
      const groups = await searchImages(q, 25, imageSearchSettings);
      setResults(groups);
      setHasSearched(true);
    } catch (err) {
      setError(`Search failed: ${err.message}`);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [allSourcesOff, imageSearchSettings, searchQuery]);

  useEffect(() => {
    if (viewMode) return;
    if (!didAutoSearch.current && searchQuery.trim()) {
      didAutoSearch.current = true;
      handleSearch();
    }
  }, [handleSearch, searchQuery, viewMode]);

  const handleRemove = async () => {
    await onRemove();
    setViewMode(false);
    setActiveTab('search');
    handleSearch();
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
    if (e.key === 'Escape') onClose();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.header}>
          <h3 className={styles.title}>Item Image</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {viewMode && currentImageUrl ? (
          <div className={styles.currentImage}>
            <img src={currentImageUrl} alt="Current item" className={styles.preview} />
            <button type="button" className={styles.removeBtn} onClick={handleRemove}>
              Remove image
            </button>
          </div>
        ) : (
          <>
            <div className={styles.tabs}>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'search' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('search')}
              >
                Search online
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'upload' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('upload')}
              >
                Upload
              </button>
            </div>

            {activeTab === 'search' && (
              <div className={styles.searchPane}>
                {allSourcesOff ? (
                  <div className={styles.noResults}>
                    <p>Image search is turned off for all sources.</p>
                    <button type="button" className={styles.settingsLink} onClick={onNavigateToSettings}>
                      Open image search settings
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.searchRow}>
                      <input
                        className={styles.searchInput}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Search for images..."
                        aria-label="Image search query"
                      />
                      <button
                        type="button"
                        className={styles.searchBtn}
                        onClick={handleSearch}
                        disabled={isSearching || !searchQuery.trim()}
                      >
                        {isSearching ? 'Searching...' : 'Search'}
                      </button>
                    </div>

                    {error && <p className={styles.error}>{error}</p>}

                    {visibleGroups.map((group) => (
                      <section key={group.source} className={styles.resultGroup}>
                        <h4 className={styles.groupTitle}>{group.label}</h4>
                        <div className={styles.grid}>
                          {group.results.map((img) => (
                            <div key={`${group.source}-${img.url}`} className={styles.gridCell}>
                              <button
                                type="button"
                                className={styles.gridItem}
                                onClick={() => onSelectUrl(img.url)}
                                title={img.title}
                              >
                                <img
                                  src={img.thumbnail}
                                  alt={img.title}
                                  className={styles.gridImg}
                                  onError={(e) => { e.target.closest('.' + styles.gridCell)?.style.setProperty('display', 'none'); }}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))}

                    {hasSearched && visibleGroups.length === 0 && !isSearching && !error && (
                      <p className={styles.noResults}>No images found. Try a different search term.</p>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'upload' && (
              <div className={styles.uploadPane}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className={styles.fileInput}
                  disabled={isUploading}
                />
                <button
                  type="button"
                  className={styles.uploadBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Choose an image file'}
                </button>
                {uploadError && <p className={styles.error}>{uploadError}</p>}
                <p className={styles.uploadHint}>Supports JPG, PNG, GIF, WebP</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

ImagePicker.propTypes = {
  itemName: PropTypes.string.isRequired,
  currentImageUrl: PropTypes.string,
  onSelectUrl: PropTypes.func.isRequired,
  onUpload: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  isUploading: PropTypes.bool,
  uploadError: PropTypes.string,
  imageSearchSettings: PropTypes.object,
  onNavigateToSettings: PropTypes.func,
};

ImagePicker.defaultProps = {
  currentImageUrl: null,
  isUploading: false,
  uploadError: null,
  imageSearchSettings: null,
  onNavigateToSettings: null,
};
