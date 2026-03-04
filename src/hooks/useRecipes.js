import { useContext } from 'react';
import { RecipeContext } from '../context/RecipeContext.jsx';

/**
 * Hook to access recipe state and actions.
 * Must be used within a RecipeProvider.
 * @returns {{ state: Object, actions: Object }}
 */
export const useRecipes = () => {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error('useRecipes must be used within a RecipeProvider');
  }
  return context;
};
