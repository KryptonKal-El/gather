# React Component Conventions

## Exports

- Named exports only. No default exports.
- One component per file. Filename matches component name (`UserProfile.jsx` → `UserProfile`).

## JSDoc

Every exported component must have a JSDoc comment with `@param` for props. `@returns` is optional for components but recommended for custom hooks that return a structured object.

```jsx
/**
 * Displays a single shopping list item with edit controls.
 * @param {Object} props
 * @param {Object} props.item - The item to display.
 * @param {Function} props.onUpdate - Called when the item is updated.
 */
export function ItemRow({ item, onUpdate }) { … }

/**
 * Returns the shopping list context value.
 * @returns {{ state: Object, actions: Object, activeList: Object }}
 */
export function useShoppingList() { … }
```

## PropTypes

Every exported component must have PropTypes. Define them at the bottom of the file (after the component function).

```jsx
ItemRow.propTypes = {
  item: PropTypes.object.isRequired,
  onUpdate: PropTypes.func.isRequired,
};
```

## Styling

- CSS Modules exclusively for component styling. One `.module.css` per component file.
- No inline styles, **except** for dynamic `transform`/`transition` values in drag-and-drop contexts (driven by `@dnd-kit` — see [dnd-kit.md](dnd-kit.md)).
- Import as `import styles from './ComponentName.module.css'`.

## Event Handlers and Callbacks

- Event handler functions: `handle` prefix → `handleClick`, `handleSubmit`, `handleInputChange`.
- Callback props: `on` prefix → `onClick`, `onSubmit`, `onChange`.

## Constants

Module-level fixed values: `UPPER_SNAKE_CASE`.

```jsx
const PRESET_COLORS = ['#e57373', '#81c784', …];
const TYPE_ICON_MAP = { produce: '🥦', dairy: '🥛', … };
```

## Forms

- Controlled inputs only. Bind value to state and update via `onChange`.
- No uncontrolled inputs (`ref`-based access) unless integrating a non-React library.

## UI States

Always handle loading, error, and empty states explicitly.

```jsx
if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
if (items.length === 0) return <EmptyState />;
return <ItemList items={items} />;
```

## Guard Clauses

Use early returns to flatten logic. Avoid deeply nested conditionals.

## Mobile / Desktop Branching

Use the `useIsMobile` hook to branch between mobile and desktop rendering. Do not use CSS-only breakpoints for structural differences.

## File-Local Sub-components

Pure render helpers that are not reused elsewhere may be defined in the same file as the component that uses them. They do not get their own file.

## Click-Outside Handling

Use `useRef` + a `mousedown` event listener on `document` for click-outside detection. Do not use a third-party hook for this.

## Fragments

Use `<>…</>` to avoid unnecessary wrapper `<div>` elements.

## Keys

Use stable, unique identifiers for `key` (database IDs, UUIDs). Do not use array indices unless the list is static and never reordered.
