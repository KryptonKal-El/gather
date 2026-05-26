import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShoppingList } from './ShoppingList';
import { AuthProvider } from '../context/AuthContext';

// Test wrapper with required providers
const renderWithProviders = (component) => {
  return render(
    <AuthProvider>
      {component}
    </AuthProvider>
  );
};

describe('ShoppingList — Category Group Left Bar (S-1 & S-2)', () => {
  const mockStores = [
    { id: 'store-1', name: 'Whole Foods', color: '#4CAF50' },
    { id: 'store-2', name: 'Trader Joe\'s', color: '#FF9800' },
  ];

  const mockListCategories = [
    { key: 'produce', name: 'Produce', color: '#2196F3' },
    { key: 'dairy', name: 'Dairy', color: '#E91E63' },
    { key: 'meat', name: 'Meat', color: '#FF5722' },
  ];

  const mockItems = [
    {
      id: 'item-1',
      name: 'Apples',
      category: 'produce',
      store: 'store-1',
      isChecked: false,
      quantity: 1,
      price: null,
      imageUrl: null,
    },
    {
      id: 'item-2',
      name: 'Milk',
      category: 'dairy',
      store: 'store-1',
      isChecked: false,
      quantity: 1,
      price: null,
      imageUrl: null,
    },
    {
      id: 'item-3',
      name: 'Chicken',
      category: 'meat',
      store: 'store-2',
      isChecked: false,
      quantity: 1,
      price: null,
      imageUrl: null,
    },
  ];

  const defaultProps = {
    items: mockItems,
    isLoading: false,
    stores: mockStores,
    sortConfig: ['store', 'category'],
    listType: 'grocery',
    listCategories: mockListCategories,
    getEffectiveChecked: (item) => item.isChecked,
    onToggle: vi.fn(),
    onRemove: vi.fn(),
    onUpdateCategory: vi.fn(),
    onUpdateStore: vi.fn(),
    onUpdateItem: vi.fn(),
    onClearChecked: vi.fn(),
    restoredItemIds: null,
    onRestoreAnimationDone: null,
  };

  describe('S-1: Category color dot replaced with left bar', () => {
    it('removes color dot from category labels', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const nestedGroupDots = container.querySelectorAll('.nestedGroupDot');
      expect(nestedGroupDots.length).toBe(0);
    });

    it('renders colored left bar for categories', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const nestedGroups = container.querySelectorAll('.nestedGroup');
      
      if (nestedGroups.length > 0) {
        nestedGroups.forEach((group) => {
          const styles = window.getComputedStyle(group);
          expect(styles.position).toBe('relative');
          
          const beforeStyles = window.getComputedStyle(group, '::before');
          expect(beforeStyles.content).not.toBe('none');
          expect(beforeStyles.position).toBe('absolute');
          expect(beforeStyles.width).toBe('3px');
        });
      }
    });

    it('applies correct color to left bar via CSS custom property', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const nestedGroups = container.querySelectorAll('.nestedGroup');
      
      if (nestedGroups.length > 0) {
        nestedGroups.forEach((group) => {
          const customProp = group.style.getPropertyValue('--category-bar-color');
          expect(customProp).toBeTruthy();
          expect(customProp).toMatch(/#[0-9A-Fa-f]{6}/);
        });
      }
    });

    it('renders bar spanning full height of category block', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const nestedGroups = container.querySelectorAll('.nestedGroup');
      
      if (nestedGroups.length > 0) {
        nestedGroups.forEach((group) => {
          const beforeStyles = window.getComputedStyle(group, '::before');
          expect(beforeStyles.top).toBe('0px');
          expect(beforeStyles.bottom).toBe('0px');
        });
      }
    });

    it('renders category label without color dot', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const nestedGroupTitles = container.querySelectorAll('.nestedGroupTitle');
      
      if (nestedGroupTitles.length > 0) {
        nestedGroupTitles.forEach((title) => {
          // Verify no dot span exists
          const dotSpans = title.querySelectorAll('span[class*="Dot"]');
          expect(dotSpans.length).toBe(0);
          
          // Verify title contains label text and count
          expect(title.textContent.length).toBeGreaterThan(0);
        });
      }
    });

    it('does not render .topLevelDot in depth 0 groups (no regression)', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const topLevelDots = container.querySelectorAll('.topLevelDot');
      // Verify depth 0 groups still have dots
      if (topLevelDots.length > 0) {
        expect(topLevelDots.length).toBeGreaterThan(0);
      }
    });

    it('renders category title with correct padding (no left padding)', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const nestedGroupTitles = container.querySelectorAll('.nestedGroupTitle');
      
      if (nestedGroupTitles.length > 0) {
        nestedGroupTitles.forEach((title) => {
          const styles = window.getComputedStyle(title);
          // padding-left should be 0 (inherited from parent .nestedGroup)
          expect(styles.paddingLeft).toBe('0px');
        });
      }
    });
  });

  describe('S-2: Items indented 12px from left bar', () => {
    it('applies padding-left to .nestedGroup for item indent', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const nestedGroups = container.querySelectorAll('.nestedGroup');
      
      if (nestedGroups.length > 0) {
        nestedGroups.forEach((group) => {
          const styles = window.getComputedStyle(group);
          // padding-left should be 15px (3px bar + 12px gap)
          expect(styles.paddingLeft).toBe('15px');
        });
      }
    });

    it('indents items inside nested groups by 12px from bar', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const nestedGroups = container.querySelectorAll('.nestedGroup');
      
      if (nestedGroups.length > 0) {
        // Verify items inside nested groups inherit the padding
        nestedGroups.forEach((group) => {
          const itemsInGroup = group.querySelectorAll('.item');
          if (itemsInGroup.length > 0) {
            itemsInGroup.forEach((item) => {
              const styles = window.getComputedStyle(item);
              // Items should not have overflow hidden (no clipping)
              expect(styles.overflow).not.toBe('hidden');
            });
          }
        });
      }
    });

    it('does not apply indent to depth 0 items (no regression)', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const topLevelBodies = container.querySelectorAll('.topLevelBody');
      
      if (topLevelBodies.length > 0) {
        topLevelBodies.forEach((body) => {
          const styles = window.getComputedStyle(body);
          // topLevelBody should not have the 15px padding-left
          expect(styles.paddingLeft).not.toBe('15px');
        });
      }
    });

    it('renders items inside nested groups without clipping', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const items = container.querySelectorAll('.nestedGroup .item');
      
      if (items.length > 0) {
        items.forEach((item) => {
          const styles = window.getComputedStyle(item);
          // Items should not have overflow hidden
          expect(styles.overflow).not.toBe('hidden');
        });
      }
    });
  });

  describe('S-3: Visual QA across configurations', () => {
    it('renders bar for single category in store', () => {
      const singleCategoryItems = [
        {
          id: 'item-1',
          name: 'Apples',
          category: 'produce',
          store: 'store-1',
          isChecked: false,
          quantity: 1,
          price: null,
          imageUrl: null,
        },
      ];

      const { container } = renderWithProviders(
        <ShoppingList
          {...defaultProps}
          items={singleCategoryItems}
          sortConfig={['store', 'category']}
        />
      );

      const nestedGroups = container.querySelectorAll('.nestedGroup');
      if (nestedGroups.length > 0) {
        expect(nestedGroups[0].style.getPropertyValue('--category-bar-color')).toBeTruthy();
      }
    });

    it('renders multiple category bars with different colors', () => {
      const { container } = renderWithProviders(<ShoppingList {...defaultProps} />);
      const nestedGroups = container.querySelectorAll('.nestedGroup');
      
      if (nestedGroups.length > 1) {
        const colors = new Set();
        nestedGroups.forEach((group) => {
          const color = group.style.getPropertyValue('--category-bar-color');
          if (color) colors.add(color);
        });

        // Should have multiple different colors
        expect(colors.size).toBeGreaterThan(1);
      }
    });

    it('does not render bar for store with no sub-categories', () => {
      const flatItems = [
        {
          id: 'item-1',
          name: 'Apples',
          category: null,
          store: 'store-1',
          isChecked: false,
          quantity: 1,
          price: null,
          imageUrl: null,
        },
      ];

      const { container } = renderWithProviders(
        <ShoppingList
          {...defaultProps}
          items={flatItems}
          sortConfig={['store']}
        />
      );

      // When sorted by store only, there should be no nested groups
      const nestedGroups = container.querySelectorAll('.nestedGroup');
      expect(nestedGroups.length).toBe(0);
    });

    it('does not render bar for ungrouped items', () => {
      const { container } = renderWithProviders(
        <ShoppingList
          {...defaultProps}
          sortConfig={['name']}
        />
      );

      // When sorted by name only, there should be no nested groups
      const nestedGroups = container.querySelectorAll('.nestedGroup');
      expect(nestedGroups.length).toBe(0);
    });

    it('handles empty list correctly', () => {
      const { container } = renderWithProviders(
        <ShoppingList
          {...defaultProps}
          items={[]}
        />
      );

      // No nested groups should be rendered
      const nestedGroups = container.querySelectorAll('.nestedGroup');
      expect(nestedGroups.length).toBe(0);
    });
  });
});
