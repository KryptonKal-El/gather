import { useState, useEffect, useRef, useCallback } from 'react';
import { useShoppingList } from './hooks/useShoppingList.js';
import { useRecipes } from './hooks/useRecipes.js';
import { useAuth } from './context/AuthContext.jsx';
import { useUndo } from './context/UndoContext.jsx';
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
import { StoreManager } from './components/StoreManager.jsx';
import { ShareListModal } from './components/ShareListModal.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import { PWAPrompt } from './components/PWAPrompt.jsx';
import { PWAInstallBanner } from './components/PWAInstallBanner.jsx';
import { BottomTabBar } from './components/BottomTabBar.jsx';
import { MobileListDetail } from './components/MobileListDetail.jsx';
import { MobileSettings } from './components/MobileSettings.jsx';
import { RecipeSelector } from './components/RecipeSelector.jsx';
import { MobileRecipeDetail } from './components/MobileRecipeDetail.jsx';
import { RecipeForm } from './components/RecipeForm.jsx';
import { AddToListModal } from './components/AddToListModal.jsx';
import { ShareCollectionModal } from './components/ShareCollectionModal.jsx';
import { OnlineRecipeSearch } from './components/OnlineRecipeSearch.jsx';
import { OnlineRecipePreview } from './components/OnlineRecipePreview.jsx';
import { SaveRecipeModal } from './components/SaveRecipeModal.jsx';
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
  const { state: recipeState, actions: recipeActions } = useRecipes();
  const { pushUndo } = useUndo();
  const [sharingListId, setSharingListId] = useState(null);
  const [sharingCollectionId, setSharingCollectionId] = useState(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState(null);
  const avatarFileInputRef = useRef(null);
  const isMobile = useIsMobile();
  const {
    activeTab,
    openListId,
    openRecipeId,
    openCollectionId,
    transition,
    poppingListData,
    poppingRecipeData,
    handleTabChange,
    handleOpenList,
    handleOpenRecipe,
    handleOpenCollection,
    handleBack,
    handleRecipeBack,
    handleCollectionBack,
  } = useMobileNav(state.lists, recipeState.recipes);
  const { showBanner, platform, promptInstall, dismissBanner } = usePWAInstall();
  const [showRecipeForm, setShowRecipeForm] = useState(null);
  const [addToListIngredients, setAddToListIngredients] = useState(null);
  const [desktopView, setDesktopView] = useState('lists');
  const [desktopRecipeFormId, setDesktopRecipeFormId] = useState(null);
  const [restoredItemIds, setRestoredItemIds] = useState(new Set());
  const [showOnlineSearch, setShowOnlineSearch] = useState(false);
  const [onlinePreviewRecipe, setOnlinePreviewRecipe] = useState(null);
  const [saveRecipeDetail, setSaveRecipeDetail] = useState(null);

  // Sync openListId with the shopping list state on mobile
  useEffect(() => {
    if (isMobile && openListId) {
      actions.selectList(openListId);
    }
  }, [isMobile, openListId, actions]);

  // US-010: Sync openCollectionId with recipe context when browser back clears collection
  useEffect(() => {
    if (!openCollectionId && recipeState.activeCollectionId && isMobile) {
      recipeActions.selectCollection(null);
    }
  }, [openCollectionId, recipeState.activeCollectionId, recipeActions, isMobile]);

  const suggestions = getSuggestions(
    state.history,
    activeList?.items ?? [],
  );

  const handleAddItem = (name, storeId = null) => {
    if (!activeList) return;
    actions.addItem(activeList.id, name, storeId);
  };

  const handleToggleItem = (itemId) => {
    if (!activeList) return;
    actions.toggleItem(activeList.id, itemId);
  };

  const handleRemoveItem = (itemId) => {
    if (!activeList) return;
    const item = activeList.items.find((i) => i.id === itemId);
    if (item) {
      const snapshot = {
        name: item.name,
        category: item.category,
        isChecked: item.isChecked,
        store: item.store,
        quantity: item.quantity,
        price: item.price,
        imageUrl: item.imageUrl,
      };
      const listId = activeList.id;
      pushUndo({
        type: 'delete-item',
        data: { listId, item: snapshot },
        restore: async () => {
          const newId = await actions.restoreItem(listId, snapshot);
          if (newId) {
            setRestoredItemIds((prev) => new Set(prev).add(newId));
          }
        },
      });
    }
    actions.removeItem(activeList.id, itemId);
  };

  const handleRestoreAnimationDone = useCallback((itemId) => {
    setRestoredItemIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const handleClearChecked = () => {
    if (!activeList) return;
    const checkedItems = activeList.items.filter((i) => i.isChecked);
    if (checkedItems.length > 0) {
      const snapshots = checkedItems.map((item) => ({
        name: item.name,
        category: item.category,
        isChecked: item.isChecked,
        store: item.store,
        quantity: item.quantity,
        price: item.price,
        imageUrl: item.imageUrl,
      }));
      const listId = activeList.id;
      pushUndo({
        type: 'clear-checked',
        data: { listId, items: snapshots },
        restore: async () => {
          await actions.restoreItems(listId, snapshots);
        },
      });
    }
    actions.clearChecked(activeList.id);
  };

  const handleMoveRecipe = async (recipeId, targetCollectionId) => {
    const recipe = recipeState.allRecipes.find((r) => r.id === recipeId);
    if (recipe) {
      const fromCollectionId = recipe.collectionId ?? null;
      pushUndo({
        type: 'move-recipe',
        data: { recipeId, fromCollectionId, toCollectionId: targetCollectionId },
        restore: async () => {
          await recipeActions.moveRecipe(recipeId, fromCollectionId);
        },
      });
    }
    await recipeActions.moveRecipe(recipeId, targetCollectionId);
  };

  const handleSaveOnlineRecipe = async (collectionId) => {
    const detail = saveRecipeDetail;
    if (!detail) return;

    const descParts = [];
    if (detail.readyInMinutes) descParts.push(`Ready in ${detail.readyInMinutes} minutes`);
    if (detail.servings) descParts.push(`Serves ${detail.servings}`);
    if (detail.sourceUrl) descParts.push(`Source: ${detail.sourceUrl}`);
    const description = descParts.join(' · ');

    const newId = await recipeActions.createRecipe({
      name: detail.title,
      description,
      collectionId,
    });

    if (!newId) throw new Error('Failed to create recipe');

    if (detail.extendedIngredients?.length > 0) {
      const ingredients = detail.extendedIngredients.map((ing, idx) => ({
        name: ing.name,
        quantity: ing.original,
        sortOrder: idx,
      }));
      await recipeActions.updateIngredients(newId, ingredients);
    }

    const steps = detail.analyzedInstructions?.[0]?.steps ?? [];
    if (steps.length > 0) {
      const stepData = steps.map((s) => ({
        instruction: s.step,
        sortOrder: s.number - 1,
      }));
      await recipeActions.updateSteps(newId, stepData);
    }

    recipeActions.selectCollection(collectionId);
    recipeActions.selectRecipe(newId);

    setOnlinePreviewRecipe(null);
    setShowOnlineSearch(false);
    setSaveRecipeDetail(null);
  };

  const handleUnshareList = async (listId, email) => {
    pushUndo({
      type: 'unshare-list',
      data: { listId, email },
      restore: async () => {
        await actions.shareList(listId, email);
      },
    });
    await actions.unshareList(listId, email);
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

  const handleSaveTemplate = async (template) => {
    const ingredients = template.ingredients.map((name, i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      quantity: '',
      sortOrder: i,
    }));
    await recipeActions.createRecipe({
      name: template.name,
      description: template.description,
      ingredients,
      steps: [],
    });
  };

  const handleAddTemplateToList = (template) => {
    const ingredients = template.ingredients.map((name) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      quantity: '',
    }));
    setAddToListIngredients(ingredients);
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
                onToggle={handleToggleItem}
                onRemove={handleRemoveItem}
                onUpdateCategory={handleUpdateCategory}
                onUpdateStore={handleUpdateStore}
                onUpdateItem={handleUpdateItem}
                onClearChecked={handleClearChecked}
                onShareClick={(list) => setSharingListId(list.id)}
                restoredItemIds={restoredItemIds}
                onRestoreAnimationDone={handleRestoreAnimationDone}
              />
            </section>
          )}
        </div>
      );
    }

    if (activeTab === 'recipes') {
      const handleRecipeSave = async (recipeData) => {
        if (showRecipeForm === 'create') {
          const newId = await recipeActions.createRecipe({
            name: recipeData.name,
            description: recipeData.description,
            ingredients: recipeData.ingredients,
            steps: recipeData.steps,
          });
          if (recipeData.imageFile && newId) {
            await recipeActions.uploadImage(newId, recipeData.imageFile);
          }
        } else {
          const recipeId = showRecipeForm;
          await recipeActions.updateRecipe(recipeId, {
            name: recipeData.name,
            description: recipeData.description,
            imageUrl: recipeData.imageUrl,
          });
          await recipeActions.updateIngredients(recipeId, recipeData.ingredients);
          await recipeActions.updateSteps(recipeId, recipeData.steps);
          if (recipeData.imageFile) {
            await recipeActions.uploadImage(recipeId, recipeData.imageFile);
          }
        }
        setShowRecipeForm(null);
      };

      if (showRecipeForm) {
        const editRecipe =
          showRecipeForm !== 'create' ? recipeState.activeRecipe : null;
        return (
          <div className={styles.mobileFullScreen}>
            <RecipeForm
              recipe={editRecipe}
              onSave={handleRecipeSave}
              onBack={() => setShowRecipeForm(null)}
            />
          </div>
        );
      }

      // Online recipe preview
      if (onlinePreviewRecipe) {
        return (
          <div className={styles.mobileFullScreen}>
            <OnlineRecipePreview
              recipe={onlinePreviewRecipe}
              onSaveAsRecipe={(detail) => setSaveRecipeDetail(detail)}
              onAddToList={(ingredients) => {
                setAddToListIngredients(ingredients);
              }}
              onBack={() => setOnlinePreviewRecipe(null)}
            />
          </div>
        );
      }

      // Online recipe search
      if (showOnlineSearch) {
        return (
          <div className={styles.mobileFullScreen}>
            <OnlineRecipeSearch
              onSelectRecipe={(recipe) => setOnlinePreviewRecipe(recipe)}
              onBack={() => setShowOnlineSearch(false)}
            />
          </div>
        );
      }

      const showDetail = openRecipeId && recipeState.activeRecipe;
      const showListScreen = !openRecipeId || transition;
      const showDetailScreen = showDetail || transition === 'popping';

      const getRecipeListScreenClass = () => {
        if (transition === 'pushing') return `${styles.listScreen} ${styles.pushing}`;
        if (transition === 'popping') return `${styles.listScreen} ${styles.popping}`;
        if (showDetail) return `${styles.listScreen} ${styles.hidden}`;
        return styles.listScreen;
      };

      const getRecipeDetailScreenClass = () => {
        if (transition === 'pushing') return `${styles.detailScreen} ${styles.pushing}`;
        if (transition === 'popping') return `${styles.detailScreen} ${styles.popping}`;
        if (!showDetail) return `${styles.detailScreen} ${styles.hidden}`;
        return styles.detailScreen;
      };

      const handleRecipeSelect = (recipeId) => {
        recipeActions.selectRecipe(recipeId);
        handleOpenRecipe(recipeId);
      };

      const handleRecipeBackNav = () => {
        handleRecipeBack();
      };

      const handleRecipeEdit = (recipeId) => {
        recipeActions.selectRecipe(recipeId);
        setShowRecipeForm(recipeId);
      };

      const handleMobileSelectCollection = (collectionId) => {
        recipeActions.selectCollection(collectionId);
        handleOpenCollection(collectionId);
      };

      const handleMobileCollectionBack = () => {
        recipeActions.selectCollection(null);
        handleCollectionBack();
      };

      const detailRecipe = recipeState.activeRecipe ?? poppingRecipeData;

      return (
        <div className={styles.slideContainer}>
          {showListScreen && (
            <section className={getRecipeListScreenClass()}>
              <div className={styles.mobileFullScreen}>
                <RecipeSelector
                  recipes={recipeState.recipes}
                  collections={recipeState.collections}
                  sharedCollections={recipeState.sharedCollections}
                  activeCollectionId={recipeState.activeCollectionId}
                  allRecipes={recipeState.allRecipes}
                  currentUserId={user.id}
                  onSelect={handleRecipeSelect}
                  onCreate={() => setShowRecipeForm('create')}
                  onEdit={handleRecipeEdit}
                  onDelete={recipeActions.deleteRecipe}
                  onSelectCollection={handleMobileSelectCollection}
                  onCreateCollection={recipeActions.createCollection}
                  onUpdateCollection={recipeActions.updateCollection}
                  onDeleteCollection={recipeActions.deleteCollection}
                  onShareCollection={(collectionId) => setSharingCollectionId(collectionId)}
                  onLeaveCollection={(collectionId) => recipeActions.unshareCollection(collectionId, user.email)}
                  onMoveRecipe={handleMoveRecipe}
                  onSaveTemplate={handleSaveTemplate}
                  onAddTemplateToList={handleAddTemplateToList}
                  onCollectionBack={handleMobileCollectionBack}
                  onSearchOnline={() => setShowOnlineSearch(true)}
                />
              </div>
            </section>
          )}
          {showDetailScreen && detailRecipe && (
            <section className={getRecipeDetailScreenClass()}>
              <div className={styles.mobileFullScreen}>
                <MobileRecipeDetail
                  recipe={detailRecipe}
                  isOwner={detailRecipe.ownerId === user.id}
                  collectionName={recipeState.collections?.find((c) => c.id === recipeState.activeCollectionId)?.name}
                  collections={recipeState.collections}
                  activeCollectionId={recipeState.activeCollectionId}
                  onMoveRecipe={handleMoveRecipe}
                  onBack={handleRecipeBackNav}
                  onEdit={(recipeId) => {
                    recipeActions.selectRecipe(recipeId);
                    setShowRecipeForm(recipeId);
                  }}
                  onDelete={(recipeId) => {
                    recipeActions.deleteRecipe(recipeId);
                    handleRecipeBackNav();
                  }}
                  onAddToList={(selectedIngredients) => setAddToListIngredients(selectedIngredients)}
                />
              </div>
            </section>
          )}
        </div>
      );
    }

    if (activeTab === 'stores') {
      return (
        <section className={styles.mobileScreen}>
          <StoreManager
            stores={state.stores}
            onAdd={actions.addStore}
            onUpdate={actions.updateStore}
            onDelete={actions.deleteStore}
            onReorder={actions.reorderStores}
          />
        </section>
      );
    }

    if (activeTab === 'settings') {
      return (
        <section className={styles.mobileScreen}>
          <div className={styles.mobileHeader}>
            <h2 className={styles.mobileHeaderTitle}>Settings</h2>
          </div>
          <div className={styles.mobileScrollContent}>
            <MobileSettings user={user} onSignOut={signOut} />
          </div>
        </section>
      );
    }

    return null;
  };

  const handleDesktopRecipeSave = async (recipeData) => {
    if (desktopRecipeFormId === 'create') {
      const newId = await recipeActions.createRecipe({
        name: recipeData.name,
        description: recipeData.description,
        ingredients: recipeData.ingredients,
        steps: recipeData.steps,
      });
      if (recipeData.imageFile && newId) {
        await recipeActions.uploadImage(newId, recipeData.imageFile);
      }
    } else {
      const recipeId = desktopRecipeFormId;
      await recipeActions.updateRecipe(recipeId, {
        name: recipeData.name,
        description: recipeData.description,
        imageUrl: recipeData.imageUrl,
      });
      await recipeActions.updateIngredients(recipeId, recipeData.ingredients);
      await recipeActions.updateSteps(recipeId, recipeData.steps);
      if (recipeData.imageFile) {
        await recipeActions.uploadImage(recipeId, recipeData.imageFile);
      }
    }
    setDesktopRecipeFormId(null);
  };

  const renderDesktopContent = () => {
    const renderListsView = () => (
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
                restoredItemIds={restoredItemIds}
                onRestoreAnimationDone={handleRestoreAnimationDone}
              />
              <Suggestions suggestions={suggestions} onAdd={handleAddItem} />
            </>
          ) : (
            <div className={styles.noList}>
              <h2>Welcome to Gather Lists</h2>
              <p>Create a new list to get started.</p>
            </div>
          )}
        </section>
      </>
    );

    const renderRecipesView = () => (
      <>
        <aside className={styles.sidebar}>
          {onlinePreviewRecipe ? (
            <OnlineRecipePreview
              recipe={onlinePreviewRecipe}
              onSaveAsRecipe={(detail) => setSaveRecipeDetail(detail)}
              onAddToList={(ingredients) => {
                setAddToListIngredients(ingredients);
              }}
              onBack={() => setOnlinePreviewRecipe(null)}
            />
          ) : showOnlineSearch ? (
            <OnlineRecipeSearch
              onSelectRecipe={(recipe) => setOnlinePreviewRecipe(recipe)}
              onBack={() => setShowOnlineSearch(false)}
            />
          ) : (
            <RecipeSelector
              recipes={recipeState.recipes}
              collections={recipeState.collections}
              sharedCollections={recipeState.sharedCollections}
              activeCollectionId={recipeState.activeCollectionId}
              allRecipes={recipeState.allRecipes}
              currentUserId={user.id}
              onSelect={(recipeId) => {
                recipeActions.selectRecipe(recipeId);
                setDesktopRecipeFormId(null);
              }}
              onCreate={() => setDesktopRecipeFormId('create')}
              onEdit={(recipeId) => {
                recipeActions.selectRecipe(recipeId);
                setDesktopRecipeFormId(recipeId);
              }}
              onDelete={recipeActions.deleteRecipe}
              onSelectCollection={recipeActions.selectCollection}
              onCreateCollection={recipeActions.createCollection}
              onUpdateCollection={recipeActions.updateCollection}
              onDeleteCollection={recipeActions.deleteCollection}
              onShareCollection={(collectionId) => setSharingCollectionId(collectionId)}
              onLeaveCollection={(collectionId) => recipeActions.unshareCollection(collectionId, user.email)}
              onMoveRecipe={handleMoveRecipe}
              onSaveTemplate={handleSaveTemplate}
              onAddTemplateToList={handleAddTemplateToList}
              onSearchOnline={() => setShowOnlineSearch(true)}
            />
          )}
        </aside>

        <section className={styles.content}>
          {desktopRecipeFormId ? (
            <RecipeForm
              recipe={desktopRecipeFormId !== 'create' ? recipeState.activeRecipe : null}
              onSave={handleDesktopRecipeSave}
              onBack={() => setDesktopRecipeFormId(null)}
            />
          ) : recipeState.activeRecipe ? (
            <MobileRecipeDetail
              recipe={recipeState.activeRecipe}
              isOwner={recipeState.activeRecipe.ownerId === user.id}
              collectionName={recipeState.collections?.find((c) => c.id === recipeState.activeCollectionId)?.name}
              collections={recipeState.collections}
              activeCollectionId={recipeState.activeCollectionId}
              onMoveRecipe={handleMoveRecipe}
              onBack={() => recipeActions.selectRecipe(null)}
              onEdit={(recipeId) => {
                recipeActions.selectRecipe(recipeId);
                setDesktopRecipeFormId(recipeId);
              }}
              onDelete={(recipeId) => {
                recipeActions.deleteRecipe(recipeId);
              }}
              onAddToList={(selectedIngredients) => setAddToListIngredients(selectedIngredients)}
            />
          ) : (
            <div className={styles.noList}>
              <h2>Recipes</h2>
              <p>Select a recipe or create a new one.</p>
            </div>
          )}
        </section>
      </>
    );

    const renderStoresView = () => (
      <div className={styles.storesViewWrap}>
        <StoreManager
          stores={state.stores}
          onAdd={actions.addStore}
          onUpdate={actions.updateStore}
          onDelete={actions.deleteStore}
          onReorder={actions.reorderStores}
        />
      </div>
    );

    return (
      <div className={styles.desktopWrapper}>
        <div className={styles.desktopTabs}>
          <button
            type="button"
            className={`${styles.desktopTab} ${desktopView === 'lists' ? styles.desktopTabActive : ''}`}
            onClick={() => setDesktopView('lists')}
          >
            Lists
          </button>
          <button
            type="button"
            className={`${styles.desktopTab} ${desktopView === 'recipes' ? styles.desktopTabActive : ''}`}
            onClick={() => setDesktopView('recipes')}
          >
            Recipes
          </button>
          <button
            type="button"
            className={`${styles.desktopTab} ${desktopView === 'stores' ? styles.desktopTabActive : ''}`}
            onClick={() => setDesktopView('stores')}
          >
            Stores
          </button>
        </div>
        <div className={styles.desktopBody}>
          {desktopView === 'lists' && renderListsView()}
          {desktopView === 'recipes' && renderRecipesView()}
          {desktopView === 'stores' && renderStoresView()}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.app}>
      <PWAInstallBanner
        showBanner={showBanner}
        platform={platform}
        onInstall={promptInstall}
        onDismiss={dismissBanner}
      />
      <header className={styles.header}>
        {!isMobile && (
          <>
            <h1 className={styles.logoGroup}>
              <img src="/logo/icon-name-tagline.svg" alt="Gather Lists" className={styles.headerLogo} />
            </h1>
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
            onUnshare={handleUnshareList}
            onClose={() => setSharingListId(null)}
          />
        );
      })()}

      {addToListIngredients && (
        <AddToListModal
          ingredients={addToListIngredients}
          lists={state.lists}
          onAddItems={(listId, items) => actions.addItems(listId, items)}
          onClose={() => setAddToListIngredients(null)}
        />
      )}

      {sharingCollectionId && (() => {
        const collectionToShare = recipeState.collections.find((c) => c.id === sharingCollectionId);
        if (!collectionToShare) return null;
        return (
          <ShareCollectionModal
            collection={collectionToShare}
            ownerEmail={user.email}
            onShare={recipeActions.shareCollection}
            onUnshare={recipeActions.unshareCollection}
            getShares={recipeActions.getCollectionShares}
            onClose={() => setSharingCollectionId(null)}
          />
        );
      })()}

      {saveRecipeDetail && (
        <SaveRecipeModal
          recipeDetail={saveRecipeDetail}
          collections={recipeState.collections}
          activeCollectionId={recipeState.activeCollectionId}
          onSave={handleSaveOnlineRecipe}
          onClose={() => setSaveRecipeDetail(null)}
        />
      )}

      {isMobile && <BottomTabBar activeTab={activeTab} onTabChange={handleTabChange} />}

      <PWAPrompt />
    </div>
  );
};
