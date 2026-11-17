/**
 * ImagePicker — modal for selecting an item image via upload or web search.
 * When an image exists, shows view-only mode (large preview + remove).
 * When no image exists (or after removal), shows full picker with search/upload tabs.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { getEnabledImageSources, searchImageSource } from '../services/imageSearch.js';
import { ImageCropDialog } from './ImageCropDialog.jsx';
import styles from './ImagePicker.module.css';

const LOADING_SECTION = { status: 'loading', results: [] };

const buildLoadingSections = (sources) => Object.fromEntries(sources.map(({ key }) => [key, LOADING_SECTION]));

/**
 * Modal overlay for picking an item image.
 * Supports file upload and online image search with an editable query field.
 * Each enabled search source gets its own section that loads, fails, and retries independently.
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
export const ImagePicker = ({ itemName, currentImageUrl = null, onSelectUrl, onUpload, onRemove, onClose, isUploading = false, uploadError = null, imageSearchSettings = null, onNavigateToSettings = null }) => {
  const [viewMode, setViewMode] = useState(!!currentImageUrl);
  const [searchQuery, setSearchQuery] = useState(itemName);
  const [sections, setSections] = useState(() => (
    !currentImageUrl && itemName.trim() ? buildLoadingSections(getEnabledImageSources(imageSearchSettings)) : {}
  ));
  const [collapsedSources, setCollapsedSources] = useState({});
  const [activeTab, setActiveTab] = useState('search');
  const [cropFile, setCropFile] = useState(null);
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);
  const didAutoSearch = useRef(false);
  const searchIdRef = useRef(0);
  const searchedQueryRef = useRef('');
  const enabledSources = getEnabledImageSources(imageSearchSettings);
  const allSourcesOff = enabledSources.length === 0;
  const searchedSources = enabledSources.filter(({ key }) => sections[key]);
  const isSearching = searchedSources.some(({ key }) => sections[key].status === 'loading');

  const fetchSource = useCallback(async (source, query, searchId) => {
    try {
      const results = await searchImageSource(query, source);
      if (searchIdRef.current !== searchId) return;
      setSections((prev) => ({ ...prev, [source]: { status: 'done', results } }));
    } catch (err) {
      console.error(`Image search failed for ${source}:`, err);
      if (searchIdRef.current !== searchId) return;
      setSections((prev) => ({ ...prev, [source]: { status: 'error', results: [] } }));
    }
  }, []);

  const fetchAllSources = useCallback((query) => {
    didAutoSearch.current = true;
    searchIdRef.current += 1;
    searchedQueryRef.current = query;
    getEnabledImageSources(imageSearchSettings).forEach(({ key }) => fetchSource(key, query, searchIdRef.current));
  }, [fetchSource, imageSearchSettings]);

  const handleSearch = useCallback(() => {
    const q = searchQuery.trim();
    if (!q) return;
    setSections(buildLoadingSections(getEnabledImageSources(imageSearchSettings)));
    fetchAllSources(q);
  }, [fetchAllSources, imageSearchSettings, searchQuery]);

  const handleToggleSource = (source) => {
    setCollapsedSources((prev) => ({ ...prev, [source]: !prev[source] }));
  };

  const handleRetrySource = (source) => {
    setSections((prev) => ({ ...prev, [source]: LOADING_SECTION }));
    fetchSource(source, searchedQueryRef.current, searchIdRef.current);
  };

  // Sections start in the loading state (see initial state), so the mount search only fires the requests.
  useEffect(() => {
    if (viewMode || didAutoSearch.current) return;
    const q = searchQuery.trim();
    if (q) fetchAllSources(q);
  }, [fetchAllSources, searchQuery, viewMode]);

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
      // Crop before uploading; reset the input so the same file can be re-picked later.
      setCropFile(file);
    }
    e.target.value = '';
  };

  const handleCropComplete = (blob) => {
    const original = cropFile;
    setCropFile(null);
    if (!original) return;
    onUpload(blob ? new File([blob], 'item.jpg', { type: 'image/jpeg' }) : original);
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
    <>
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

                    {searchedSources.map(({ key, label }) => {
                      const { status, results } = sections[key];
                      const isCollapsed = !!collapsedSources[key];
                      const bodyId = `image-search-section-${key}`;
                      return (
                        <section key={key} className={styles.resultGroup} aria-busy={status === 'loading'}>
                          <h4 className={styles.groupTitle}>
                            <button
                              type="button"
                              className={styles.groupToggle}
                              onClick={() => handleToggleSource(key)}
                              aria-expanded={!isCollapsed}
                              aria-controls={bodyId}
                            >
                              <span className={`${styles.chevron} ${isCollapsed ? '' : styles.chevronOpen}`} aria-hidden="true" />
                              <span className={styles.groupLabel}>{label}</span>
                              {status === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
                              {status === 'error' && <span className={styles.groupWarning} aria-hidden="true">!</span>}
                              {status === 'done' && <span className={styles.groupCount} aria-hidden="true">{results.length}</span>}
                            </button>
                          </h4>
                          <div id={bodyId} className={styles.groupBody} hidden={isCollapsed}>
                          {status === 'loading' && (
                            <div className={styles.sectionStatus} role="status">
                              Searching {label}...
                            </div>
                          )}
                          {status === 'error' && (
                            <div className={styles.sectionStatus}>
                              <span className={styles.sectionError}>Couldn&apos;t load {label} results.</span>
                              <button
                                type="button"
                                className={styles.retryBtn}
                                onClick={() => handleRetrySource(key)}
                                aria-label={`Retry ${label}`}
                              >
                                Retry
                              </button>
                            </div>
                          )}
                          {status === 'done' && results.length === 0 && (
                            <p className={styles.sectionStatus}>No results</p>
                          )}
                          {results.length > 0 && (
                            <div className={styles.grid}>
                              {results.map((img) => (
                                <div key={`${key}-${img.url}`} className={styles.gridCell}>
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
                          )}
                          </div>
                        </section>
                      );
                    })}
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
    </div>
    {cropFile && (
      <ImageCropDialog
        file={cropFile}
        onCrop={handleCropComplete}
        onCancel={() => setCropFile(null)}
      />
    )}
    </>,
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

