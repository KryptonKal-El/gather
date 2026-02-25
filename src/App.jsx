import { useState, useEffect } from 'react';
import { useShoppingList } from './hooks/useShoppingList.js';
import { useAuth } from './context/AuthContext.jsx';
import { useIsMobile } from './hooks/useIsMobile.js';
import { useMobileNav } from './hooks/useMobileNav.js';
import { getSuggestions } from './services/suggestions.js';
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
import { BottomTabBar } from './components/BottomTabBar.jsx';
import { MobileListDetail } from './components/MobileListDetail.jsx';
import { MobileSettings } from './components/MobileSettings.jsx';
import styles from './App.module.css';

/**
 * Root application component.
 * Gates content behind authentication.
 * Composes the list selector, item form, shopping list, suggestions,
 * recipe panel, store manager, and share modal.
 */
export const App = () => {
  const { user, isLoading, signOut } = useAuth();
  const { state, actions, activeList } = useShoppingList();
  const [sharingListId, setSharingListId] = useState(null);
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

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isGuest = user.isAnonymous;

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
                  currentUserId={user.uid}
                  onSelect={handleListSelect}
                  onCreate={actions.createList}
                  onUpdateDetails={actions.updateListDetails}
                  onDelete={actions.deleteList}
                  onShareClick={isGuest ? undefined : (list) => setSharingListId(list.id)}
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
                isGuest={isGuest}
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
          currentUserId={user.uid}
          onSelect={actions.selectList}
          onCreate={actions.createList}
          onUpdateDetails={actions.updateListDetails}
          onDelete={actions.deleteList}
          onShareClick={isGuest ? undefined : (list) => setSharingListId(list.id)}
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
      <header className={styles.header}>
        {!isMobile && (
          <>
            <h1 className={styles.logo}>ShoppingList<span className={styles.ai}>AI</span></h1>
            <div className={styles.headerRight}>
              <span className={styles.userName}>
                {isGuest ? 'Guest' : user.displayName ?? user.email}
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
