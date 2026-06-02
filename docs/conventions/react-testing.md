# React Testing Conventions

## Framework

Vitest + React Testing Library. Test files are co-located with source:

- `ComponentName.test.jsx` next to `ComponentName.jsx`
- `service.test.js` next to `service.js`

## Test Structure

```js
describe('FeatureOrModule', () => {
  it('returns an empty array when no results match', () => { … });
  it('calls onUpdate with the new value when input changes', () => { … });
});
```

- `describe` names the feature or module.
- `it` states the expected behavior in plain English — not "test X".
- One logical assertion per test. Multiple `expect` calls verifying a single outcome are fine.
- Test error cases and edge cases, not just the happy path.

## Fixtures

Define a `defaultProps` (or equivalent) object at the top of the test file for consistent test data.

```js
const defaultProps = {
  list: { id: 'list-1', name: 'Groceries' },
  onSelect: vi.fn(),
};
```

## beforeEach

Use `beforeEach` to reset mocks between tests.

```js
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Mocking Supabase

Mock at the module level using `vi.mock`. The mock shape must include `from`, `channel`, and `removeChannel`.

```js
import { vi } from 'vitest';

const channel = { on: vi.fn(), subscribe: vi.fn() };
channel.on.mockReturnValue(channel);
channel.subscribe.mockReturnValue(channel);

vi.mock('./supabase.js', () => ({
  default: {
    from: vi.fn(),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  },
}));
```

### makeRealtimeChannel factory

Use a factory for the realtime channel mock to keep tests readable:

```js
function makeRealtimeChannel() {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
  return channel;
}
```

## Mocking the Database Module

In Context tests, mock the entire database module with all exports as `vi.fn()`:

```js
vi.mock('./database.js', () => ({
  fetchLists: vi.fn(),
  createList: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
  // … all exports
}));
```

## Mocking AuthContext

```js
vi.mock('./AuthContext.jsx', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'user-1' }, sessionVersion: 0 })),
}));
```

## Wrapping with Context Providers

Wrap the component under test directly with `ShoppingListProvider` (or the relevant provider). No extra wrapper utility.

```jsx
render(
  <ShoppingListProvider>
    <ComponentUnderTest {...defaultProps} />
  </ShoppingListProvider>
);
```
