# Pre-existing Lint Errors

## Problem
Running `npm run lint` (which lints the entire project) reports 29 errors and 4 warnings in files NOT modified by this PRD:
- ThemeContext.jsx
- AuthContext.jsx
- useShoppingList.js
- vite.config.js

## Workaround
To verify new code lints clean, always lint specific files:
```bash
npx eslint src/components/NewFile.jsx src/hooks/newHook.js
```
Do NOT use `npm run lint` as a pass/fail gate — it will always fail due to pre-existing errors.

## eslint.config.js Change
Added `argsIgnorePattern: '^_'` to the `no-unused-vars` rule to allow underscore-prefixed parameters (e.g., `_currentUserId`). This is a project-wide convention now.
