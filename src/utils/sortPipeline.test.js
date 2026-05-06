import { applySortPipeline } from './sortPipeline.js';

const stores = [
  { id: 'second-store', name: 'Second Store', color: '#222222', sort_order: 2 },
  { id: 'first-store', name: 'First Store', color: '#111111', sort_order: 1 },
];

const listCategories = [
  { key: 'produce', name: 'Produce', color: '#4caf50' },
  { key: 'dairy', name: 'Dairy', color: '#2196f3' },
];

const getGroupLabels = (groups) => groups.map((group) => group.label);

describe('applySortPipeline store grouping', () => {
  it('emits Unassigned after real stores when grouping by store and category', () => {
    const items = [
      { id: 'unassigned', name: 'Bananas', store: null, category: 'produce' },
      { id: 'second-store-item', name: 'Bread', store: 'second-store', category: 'produce' },
      { id: 'first-store-item', name: 'Milk', store: 'first-store', category: 'dairy' },
    ];

    const result = applySortPipeline(items, ['store', 'category'], stores, 'grocery', listCategories);

    expect(getGroupLabels(result.groups)).toEqual(['First Store', 'Second Store', 'Unassigned']);
    expect(result.ungrouped).toEqual([]);
  });

  it('sub-groups unassigned items by category', () => {
    const items = [
      { id: 'unassigned-produce', name: 'Bananas', store: null, category: 'produce' },
      { id: 'unassigned-dairy', name: 'Milk', store: null, category: 'dairy' },
      { id: 'store-item', name: 'Apples', store: 'first-store', category: 'produce' },
    ];

    const result = applySortPipeline(items, ['store', 'category'], stores, 'grocery', listCategories);
    const unassignedGroup = result.groups.at(-1);

    expect(getGroupLabels(unassignedGroup.subGroups)).toEqual(['Produce', 'Dairy']);
    expect(unassignedGroup.subGroups.map((group) => group.items.map((item) => item.id))).toEqual([
      ['unassigned-produce'],
      ['unassigned-dairy'],
    ]);
  });

  it('places missing categories inside the Unassigned Other category bucket', () => {
    const items = [
      { id: 'unassigned-without-category', name: 'Mystery Item', store: null, category: null },
      { id: 'store-item', name: 'Apples', store: 'first-store', category: 'produce' },
    ];

    const result = applySortPipeline(items, ['store', 'category'], stores, 'grocery', listCategories);
    const unassignedGroup = result.groups.at(-1);

    expect(unassignedGroup.subGroups).toEqual([
      {
        key: 'category-other',
        label: 'Other',
        color: '#9e9e9e',
        type: 'category',
        items: [items[0]],
      },
    ]);
  });

  it('uses gray for the Unassigned store group', () => {
    const items = [
      { id: 'unassigned', name: 'Bananas', store: null, category: 'produce' },
      { id: 'store-item', name: 'Apples', store: 'first-store', category: 'produce' },
    ];

    const result = applySortPipeline(items, ['store', 'category'], stores, 'grocery', listCategories);
    const unassignedGroup = result.groups.at(-1);

    expect(unassignedGroup).toMatchObject({
      key: 'store-unassigned',
      label: 'Unassigned',
      color: '#bbb',
      type: 'store',
    });
  });

  it('keeps store-only unassigned items in the existing ungrouped bucket', () => {
    const items = [
      { id: 'unassigned-b', name: 'Bananas', store: null, category: 'produce' },
      { id: 'store-item', name: 'Apples', store: 'first-store', category: 'produce' },
      { id: 'unassigned-a', name: 'Almonds', store: null, category: 'produce' },
    ];

    const result = applySortPipeline(items, ['store', 'name'], stores, 'grocery', listCategories);

    expect(getGroupLabels(result.groups)).toEqual(['First Store']);
    expect(result.groups.some((group) => group.label === 'Unassigned')).toBe(false);
    expect(result.ungrouped.map((item) => item.id)).toEqual(['unassigned-a', 'unassigned-b']);
  });

  it('returns the same Unassigned grouping shape for checked items', () => {
    const checkedItems = [
      { id: 'checked-unassigned', name: 'Bananas', store: null, category: 'produce', isChecked: true },
      { id: 'checked-store-item', name: 'Milk', store: 'first-store', category: 'dairy', isChecked: true },
    ];

    const result = applySortPipeline(checkedItems, ['store', 'category'], stores, 'grocery', listCategories);
    const unassignedGroup = result.groups.at(-1);

    expect(unassignedGroup).toMatchObject({
      key: 'store-unassigned',
      label: 'Unassigned',
      color: '#bbb',
      type: 'store',
      subGroups: [
        {
          key: 'category-produce',
          label: 'Produce',
          color: '#4caf50',
          type: 'category',
          items: [checkedItems[0]],
        },
      ],
    });
    expect(result.ungrouped).toEqual([]);
  });
});
