# E2E Shopping List Test Gotchas

## CSS Modules break class selectors

Direct class selectors like `.details` don't work because CSS modules mangle class names (e.g., `._details_xyz_123`). 

**Fix:** Use `[class*="confirmBtn"]` to match partial class names.

## Multiple test lists from failed runs

Previous test runs can leave orphaned lists in the database. Selectors must be specific enough to match the exact list name being tested.

**Fix:** Use `filter({ hasText: LIST_NAME }).filter({ hasText: /\d+ items?/ })` to match the specific list.

## AI Suggestions section contains item names

The AI Suggestions section shows item names (e.g., "apples") based on shopping history. When asserting an item was removed, the selector may match the AI suggestion instead of the list item.

**Fix:** Be specific about WHERE you're looking for items. List items have category headings like "Produce 1" and "Edit item" buttons; AI suggestions have "Purchased X times before" text.

## Realtime/database timing issues

Operations like "clear checked" and "delete list" complete (dialog closes) before the database change is reflected in the UI via realtime subscriptions.

**Fix:** Add `page.reload()` after these operations to ensure fresh data is loaded before asserting the change took effect.

## ConfirmDialog renders via portal

The ConfirmDialog component renders via `createPortal` to `document.body`, not inside the component tree. Use global selectors to find dialog elements.

## Button name conflicts

`getByRole('button', { name: LIST_NAME })` can match multiple buttons (the list button AND the options menu button).

**Fix:** Use more specific locators that filter by expected structure.
