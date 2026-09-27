import { fireEvent, render, screen, within } from '@testing-library/react';

import { RecipeSelector } from './RecipeSelector';

const collections = [
  { id: 'c-soups', name: 'Soups', emoji: '🍲', isDefault: false },
  { id: 'c-bakes', name: 'Bakes', emoji: '🥖', isDefault: true },
];

const allRecipes = [
  { id: 'r1', name: 'Tomato Soup', collectionId: 'c-soups' },
  { id: 'r2', name: 'Banana Bread', collectionId: 'c-bakes' },
  { id: 'r3', name: 'Apple Pie', collectionId: 'c-bakes' },
];

const renderSelector = () =>
  render(
    <RecipeSelector
      collections={collections}
      sharedCollections={[]}
      sharedRecipesByCollection={{}}
      allRecipes={allRecipes}
      onSelect={vi.fn()}
      onCreate={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  );

const sectionHeadings = () =>
  screen.queryAllByRole('button', { expanded: true }).concat(screen.queryAllByRole('button', { expanded: false }));

const bakesToggle = () =>
  sectionHeadings().find((button) => button.textContent.includes('Bakes'));

describe('RecipeSelector "All" grouping', () => {
  beforeEach(() => localStorage.clear());

  it('groups recipes under collection headers A–Z by default', () => {
    renderSelector();

    expect(screen.getByRole('radio', { name: 'Collection' })).toHaveAttribute('aria-checked', 'true');
    const sections = document.querySelectorAll('section');
    expect(sections).toHaveLength(2);
    expect(within(sections[0]).getByText('Bakes')).toBeInTheDocument();
    expect(within(sections[0]).getByText('Banana Bread')).toBeInTheDocument();
    expect(within(sections[1]).getByText('Tomato Soup')).toBeInTheDocument();
  });

  it('shows one flat grid when grouping is set to None, and remembers it', () => {
    const { unmount } = renderSelector();

    fireEvent.click(screen.getByRole('radio', { name: 'None' }));

    expect(document.querySelectorAll('section')).toHaveLength(0);
    expect(sectionHeadings()).toHaveLength(0);
    expect(screen.getByText('Apple Pie')).toBeInTheDocument();
    expect(screen.getByText('Tomato Soup')).toBeInTheDocument();

    unmount();
    renderSelector();
    expect(screen.getByRole('radio', { name: 'None' })).toHaveAttribute('aria-checked', 'true');
  });

  it('collapses and expands a collection, and remembers it', () => {
    const { unmount } = renderSelector();
    fireEvent.click(bakesToggle());
    expect(bakesToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Banana Bread')).not.toBeInTheDocument();
    expect(screen.getByText('Tomato Soup')).toBeInTheDocument();

    unmount();
    renderSelector();
    expect(screen.queryByText('Banana Bread')).not.toBeInTheDocument();

    fireEvent.click(bakesToggle());
    expect(screen.getByText('Banana Bread')).toBeInTheDocument();
  });

  it('shows search matches inside collapsed collections', () => {
    renderSelector();
    fireEvent.click(bakesToggle());

    fireEvent.change(screen.getByPlaceholderText('Search recipes & collections...'), { target: { value: 'banana' } });

    expect(screen.getByText('Banana Bread')).toBeInTheDocument();
  });
});
