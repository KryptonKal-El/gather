import { useMemo } from 'react';

/**
 * Builds what list rows need for edit rights and wish-list gift claims.
 * Gift-givers (people a wish list is shared with) see and make claims; the
 * owner sees claims only after turning on "reveal claims" (the database
 * already hides them otherwise).
 * @param {Object|null} list - The active list from ShoppingListContext
 * @param {string|null} currentUserId - Signed-in user's ID
 * @param {Object} actions - ShoppingListContext actions (claimItem, unclaimItem)
 * @returns {Object|null} Claim context for ShoppingList/ShoppingItem, or null with no list
 */
export const useClaimContext = (list, currentUserId, actions) => {
  const listId = list?.id;
  const isWishList = list?.type === 'wish_list';
  const isShared = list?._isShared ?? false;
  const canEdit = list?.canEdit ?? true;
  const revealClaims = list?.revealClaims ?? false;
  const claims = list?.claims;
  const collaborators = list?._collaborators;
  const { claimItem, unclaimItem } = actions;

  return useMemo(() => {
    if (!listId) return null;

    const claimsByItem = new Map();
    for (const claim of claims ?? []) {
      if (!claimsByItem.has(claim.itemId)) claimsByItem.set(claim.itemId, []);
      claimsByItem.get(claim.itemId).push(claim);
    }

    const names = new Map((collaborators ?? []).map((c) => [c.user_id, c.display_name]));

    return {
      canEdit,
      isGiver: isWishList && isShared,
      showClaims: isWishList && (isShared || revealClaims),
      claimsByItem,
      currentUserId,
      nameFor: (userId) => names.get(userId) ?? 'Someone',
      onClaim: (itemId, quantity) => claimItem(listId, itemId, quantity),
      onUnclaim: (itemId) => unclaimItem(itemId),
    };
  }, [listId, isWishList, isShared, canEdit, revealClaims, claims, collaborators, currentUserId, claimItem, unclaimItem]);
};
