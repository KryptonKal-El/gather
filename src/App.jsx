import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useShoppingList } from './hooks/useShoppingList.js';
import { useAuth } from './context/AuthContext.jsx';
import { useIsMobile } from './hooks/useIsMobile.js';
import { useMobileNav } from './hooks/useMobileNav.js';
import { usePWAInstall } from './hooks/usePWAInstall.js';
import { getSuggestions } from './services/suggestions.js';
import { uploadProfileImage } from './services/imageStorage.js';
import { Login } from './components/Login.jsx';
import { ListSelector } from './components/ListSelector.jsx';
import { AddItemForm } from './components/AddItemForm.jsx';
import { ShoppingList } from './components/ShoppingList.jsx';
import { Suggestions } from './components/Suggestions.jsx';
import { RecipePanel } from './components/RecipePanel.jsx';
import { StoreManager } from './components/StoreManager.jsx';
import { ShareListModal } from './components/ShareListModal.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import { PWAPrompt } from './components/PWAPrompt.jsx';
import { PWAInstallBanner } from './components/PWAInstallBanner.jsx';
import { BottomTabBar } from './components/BottomTabBar.jsx';
import { MobileListDetail } from './components/MobileListDetail.jsx';
import { MobileSettings } from './components/MobileSettings.jsx';
import { AppUrlListener } from './components/AppUrlListener.jsx';
import styles from './App.module.css';

/**
 * Root application component.
 * Gates content behind authentication.
 * Composes the list selector, item form, shopping list, suggestions,
 * recipe panel, store manager, and share modal.
 */
export const App = () => {
  const { user, isLoading, signOut, refreshUser } = useAuth();
  const { state, actions, activeList } = useShoppingList();
  const [sharingListId, setSharingListId] = useState(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState(null);
  const avatarFileInputRef = useRef(null);
  const isMobile = useIsMobile();
  const {
    activeTab,
    openListId,
    transition,
    poppingListData,
    handleTabChange,
    handleOpenList,
    handleBack,
  } = useMobileNav(state.lists);
  const { showBanner, platform, promptInstall, dismissBanner } = usePWAInstall();

  // Hide native splash screen after auth check completes
  useEffect(() => {
    if (!isLoading && Capacitor.isNativePlatform()) {
      SplashScreen.hide();
    }
  }, [isLoading]);

  // Configure native status bar for edge-to-edge display
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setOverlaysWebView({ overlay: true });
      StatusBar.setStyle({ style: Style.Default });
    }
  }, []);

  // Sync openListId with the shopping list state on mobile
  useEffect(() => {
    if (isMobile && openListId) {
      actions.selectList(openListId);
    }
  }, [isMobile, openListId, actions]);

  const suggestions = getSuggestions(
    state.history,
    activeList?.items ?? [],
  );

  const handleAddItem = (name, storeId = null) => {
    if (!activeList) return;
    actions.addItem(activeList.id, name, storeId);
  };

  const handleAddItems = (items) => {
    if (!activeList) return;
    actions.addItems(activeList.id, items);
  };

  const handleToggleItem = (itemId) => {
    if (!activeList) return;
    actions.toggleItem(activeList.id, itemId);
  };

  const handleRemoveItem = (itemId) => {
    if (!activeList) return;
    actions.removeItem(activeList.id, itemId);
  };

  const handleClearChecked = () => {
    if (!activeList) return;
    actions.clearChecked(activeList.id);
  };

  const handleUpdateCategory = (itemId, newCategory) => {
    if (!activeList) return;
    actions.updateItem(activeList.id, itemId, { category: newCategory });
  };

  const handleUpdateStore = (itemId, newStoreId) => {
    if (!activeList) return;
    actions.updateItem(activeList.id, itemId, { store: newStoreId });
  };

  const handleUpdateItem = (itemId, updates) => {
    if (!activeList) return;
    actions.updateItem(activeList.id, itemId, updates);
  };

  const handleAvatarClick = () => {
    if (isAvatarUploading) return;
    avatarFileInputRef.current?.click();
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAvatarUploading(true);
    setAvatarUploadError(null);
    try {
      await uploadProfileImage(user, file);
      await refreshUser();
    } catch (err) {
      console.error('Profile image upload failed:', err);
      setAvatarUploadError('Upload failed. Please try again.');
    } finally {
      setIsAvatarUploading(false);
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (!avatarUploadError) return;
    const timer = setTimeout(() => setAvatarUploadError(null), 3000);
    return () => clearTimeout(timer);
  }, [avatarUploadError]);

  if (isLoading) {
    return (
      <>
        <PWAInstallBanner
          showBanner={showBanner}
          platform={platform}
          onInstall={promptInstall}
          onDismiss={dismissBanner}
        />
        <div className={styles.loading}>
          <p>Loading...</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <PWAInstallBanner
          showBanner={showBanner}
          platform={platform}
          onInstall={promptInstall}
          onDismiss={dismissBanner}
        />
        <Login />
      </>
    );
  }

  const displayName = user.user_metadata?.full_name ?? user.profile?.display_name ?? user.email ?? 'User';
  const avatarLetter = (displayName.charAt(0).toUpperCase() || 'U');
  const photoURL = user.profile?.avatar_url ?? user.user_metadata?.avatar_url;

  const handleListSelect = (listId) => {
    if (isMobile) {
      handleOpenList(listId);
    } else {
      actions.selectList(listId);
    }
  };

  const renderMobileContent = () => {
    if (activeTab === 'lists') {
      const showDetail = openListId && activeList;
      const showListScreen = !openListId || transition;
      const showDetailScreen = showDetail || transition === 'popping';
      
      const detailList = activeList ?? poppingListData;

      const getListScreenClass = () => {
        if (transition === 'pushing') return `${styles.listScreen} ${styles.pushing}`;
        if (transition === 'popping') return `${styles.listScreen} ${styles.popping}`;
        if (showDetail) return `${styles.listScreen} ${styles.hidden}`;
        return styles.listScreen;
      };

      const getDetailScreenClass = () => {
        if (transition === 'pushing') return `${styles.detailScreen} ${styles.pushing}`;
        if (transition === 'popping') return `${styles.detailScreen} ${styles.popping}`;
        if (!showDetail) return `${styles.detailScreen} ${styles.hidden}`;
        return styles.detailScreen;
      };

      return (
        <div className={styles.slideContainer}>
          {showListScreen && (
            <section className={getListScreenClass()}>
              <div className={styles.mobileFullScreen}>
                <ListSelector
                  lists={state.lists}
                  activeListId={state.activeListId}
                  currentUserId={user.id}
                  onSelect={handleListSelect}
                  onCreate={actions.createList}
                  onUpdateDetails={actions.updateListDetails}
                  onDelete={actions.deleteList}
                  onShareClick={(list) => setSharingListId(list.id)}
                />
              </div>
            </section>
          )}
          {showDetailScreen && detailList && (
            <section className={getDetailScreenClass()}>
              <MobileListDetail
                list={detailList}
                stores={state.stores}
                history={state.history}
                suggestions={suggestions}
                onBack={handleBack}
                onAddItem={handleAddItem}
                onAddItems={handleAddItems}
                onToggle={handleToggleItem}
                onRemove={handleRemoveItem}
                onUpdateCategory={handleUpdateCategory}
                onUpdateStore={handleUpdateStore}
                onUpdateItem={handleUpdateItem}
                onClearChecked={handleClearChecked}
                onShareClick={(list) => setSharingListId(list.id)}
              />
            </section>
          )}
        </div>
      );
    }

    if (activeTab === 'stores') {
      return (
        <section className={styles.mobileFullScreen}>
          <h2 className={styles.mobileTitle}>Stores</h2>
          <StoreManager
            stores={state.stores}
            onAdd={actions.addStore}
            onUpdate={actions.updateStore}
            onDelete={actions.deleteStore}
            onReorder={actions.reorderStores}
            alwaysOpen
          />
        </section>
      );
    }

    if (activeTab === 'settings') {
      return (
        <section className={styles.mobileFullScreen}>
          <h2 className={styles.mobileTitle}>Settings</h2>
          <MobileSettings user={user} onSignOut={signOut} />
        </section>
      );
    }

    return null;
  };

  const renderDesktopContent = () => (
    <>
      <aside className={styles.sidebar}>
        <ListSelector
          lists={state.lists}
          activeListId={state.activeListId}
          currentUserId={user.id}
          onSelect={actions.selectList}
          onCreate={actions.createList}
          onUpdateDetails={actions.updateListDetails}
          onDelete={actions.deleteList}
          onShareClick={(list) => setSharingListId(list.id)}
        />
      </aside>

      <section className={styles.content}>
        {activeList ? (
          <>
            <h2 className={styles.listTitle}>
              {activeList.emoji && <span>{activeList.emoji} </span>}
              {activeList.name}
            </h2>
            <AddItemForm stores={state.stores} history={state.history} onAdd={handleAddItem} />
            <ShoppingList
              items={activeList.items}
              stores={state.stores}
              onToggle={handleToggleItem}
              onRemove={handleRemoveItem}
              onUpdateCategory={handleUpdateCategory}
              onUpdateStore={handleUpdateStore}
              onUpdateItem={handleUpdateItem}
              onClearChecked={handleClearChecked}
            />
            <Suggestions suggestions={suggestions} onAdd={handleAddItem} />
            <RecipePanel onAddItems={handleAddItems} />
            <StoreManager
              stores={state.stores}
              onAdd={actions.addStore}
              onUpdate={actions.updateStore}
              onDelete={actions.deleteStore}
              onReorder={actions.reorderStores}
            />
          </>
        ) : (
          <div className={styles.noList}>
            <h2>Welcome to ShoppingListAI</h2>
            <p>Create a new list to get started.</p>
          </div>
        )}
      </section>
    </>
  );

  return (
    <div className={styles.app}>
      <AppUrlListener />
      <PWAInstallBanner
        showBanner={showBanner}
        platform={platform}
        onInstall={promptInstall}
        onDismiss={dismissBanner}
      />
      <header className={styles.header}>
        {!isMobile && (
          <>
            <h1 className={styles.logo}>ShoppingList<span className={styles.ai}>AI</span></h1>
            <div className={styles.headerRight}>
              <div
                className={styles.headerAvatarWrap}
                onClick={handleAvatarClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAvatarClick(); } }}
                aria-label="Change profile photo"
              >
                {isAvatarUploading ? (
                  <div className={styles.headerUploadSpinner} />
                ) : photoURL ? (
                  <img src={photoURL} alt="" className={styles.headerAvatar} />
                ) : (
                  <span className={styles.headerAvatar}>{avatarLetter}</span>
                )}
                {!isAvatarUploading && (
                  <div className={styles.headerAvatarOverlay}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                )}
              </div>
              <input
                ref={avatarFileInputRef}
                type="file"
                accept="image/*"
                className={styles.headerFileInput}
                onChange={handleAvatarFileChange}
                aria-hidden="true"
                tabIndex={-1}
              />
              {avatarUploadError && (
                <span className={styles.headerUploadError}>{avatarUploadError}</span>
              )}
              <span className={styles.userName}>
                {displayName}
              </span>
              <ThemeToggle />
              <button className={styles.signOutBtn} onClick={signOut} type="button">
                Sign out
              </button>
            </div>
          </>
        )}
      </header>

      <main className={styles.main}>
        {isMobile ? renderMobileContent() : renderDesktopContent()}
      </main>

      {sharingListId && (() => {
        const listToShare = state.lists.find((l) => l.id === sharingListId);
        if (!listToShare) return null;
        return (
          <ShareListModal
            list={listToShare}
            onShare={actions.shareList}
            onUnshare={actions.unshareList}
            onClose={() => setSharingListId(null)}
          />
        );
      })()}

      {isMobile && <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />}

      <PWAPrompt />
    </div>
  );
};
