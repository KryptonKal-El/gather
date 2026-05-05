# Common Coding Guidelines

## Comments

- Do NOT over-comment. If the code is self-explanatory, leave it uncommented.
- Only add inline comments for esoteric or non-obvious logic that cannot be reasonably understood from the code alone.
- All exported functions and classes MUST have doc comments. Use JSDoc for JavaScript.

## Library Usage

When writing code that uses external libraries, use the `context7` MCP tool to look up current documentation before calling library APIs. Do not rely on training data for API signatures, method names, or parameter types. Look them up. This avoids hallucinating deprecated or nonexistent methods.

# JavaScript Coding Guidelines

These are defaults. If the project's existing code follows different conventions, match those instead.

## Language Features

- Use `const` by default. Use `let` only when reassignment is necessary. Never use `var`.
- Use `async`/`await` for asynchronous code. Avoid raw `.then()` chains and callbacks unless the API requires them.
- Use strict equality (`===` and `!==`). Never use `==` or `!=`.
- Use template literals over string concatenation: `` `Hello, ${name}` `` not `"Hello, " + name`.
- Use destructuring for object and array access where it improves clarity: `const { id, name } = user`.
- Use optional chaining (`?.`) instead of manual null checks: `user?.address?.city` not `user && user.address && user.address.city`.
- Use nullish coalescing (`??`) instead of `||` when the intent is to fall back only on `null`/`undefined`: `value ?? defaultValue`.
- Prefer modern ES module syntax (`import`/`export`) over CommonJS (`require`/`module.exports`) unless the project uses CommonJS.
- Prefer named exports over default exports. Named exports improve refactoring, auto-imports, and grep-ability.

## Naming

- Variables and functions: `camelCase`
- Classes: `PascalCase`
- Constants (module-level fixed values): `UPPER_SNAKE_CASE`
- Boolean variables: prefix with `is`, `has`, `should`, `can` when it aids readability

## Design

- Do not mutate function arguments. If you need to modify an object or array, create a copy first.
- Keep functions small and focused. Prefer pure functions where practical.
- Avoid deeply nested conditionals. Use early returns to flatten logic.

## Error Handling

- Always handle errors in async code. Every `await` in a function that can fail should be in a `try`/`catch` block, or the function should propagate the error to a caller that handles it.
- Never swallow promise rejections. At minimum, log them. Unhandled rejections crash Node.js processes and silently break browser apps.
- Include context in error messages. Bad: `"Failed"`. Good: `"Failed to fetch user: id=${userId}"`.
- When re-throwing, wrap the original error as the cause: `throw new Error("operation failed", { cause: err })`.

## Testing

- Use the project's existing test framework. Match the test file location and naming patterns already in use.
- Write descriptive test names that state the expected behavior, not the implementation.
- Prefer `it("returns an empty array when no results match")` over `it("test getResults")`.
- One logical assertion per test. Multiple `expect` calls verifying a single outcome are fine.
- Test error cases and edge cases, not just the happy path.

# React Coding Guidelines

These are guidelines, not rigid rules. Always defer to the project's existing patterns and conventions when they conflict with anything below.

## Components

- Use **functional components** with hooks. Do not use class components.
- Keep components small and focused on a single responsibility. If a component is doing too much, split it.
- One component per file. The filename must match the component name (`UserProfile.jsx` exports `UserProfile`).
- Use **PascalCase** for component names.
- Use **fragments** (`<>...</>`) to avoid unnecessary wrapper `<div>` elements.

## Props

- Destructure props in the function signature.
- Use `PropTypes` for prop validation.

## State Management

- Manage state at the lowest component level that needs it. Lift state up only when sibling components must share it.
- Use `useState` for simple local state. Use `useReducer` when state transitions are complex or interdependent.
- Do not reach for global state (Context, Redux, Zustand, etc.) when local state or prop drilling through one or two levels is sufficient.

## Custom Hooks

- Extract reusable or complex logic into custom hooks (`use` prefix, e.g. `useAuth`, `usePagination`).
- A custom hook should have a single clear purpose.

## Performance

- Do **not** wrap components in `React.memo` or use `useMemo`/`useCallback` preemptively. Apply these only when you have identified a measured performance problem.
- Avoid creating new objects, arrays, or functions inside render when they are passed as props to memoized children — but only if memoization is already in use.

## Event Handlers

- Prefix event handler functions with `handle` (e.g. `handleClick`, `handleSubmit`, `handleInputChange`).
- Prefix callback props with `on` (e.g. `onClick`, `onSubmit`, `onChange`).

## Keys

- Use **stable, unique identifiers** for the `key` prop (database IDs, UUIDs, etc.).
- Do not use array indices as keys unless the list is static and will never be reordered, filtered, or modified.

## Forms

- Use **controlled components** for form inputs. Bind input values to state and update via `onChange`.
- Avoid uncontrolled components (`ref`-based access) unless there is a specific reason (e.g. integrating with a non-React library).

## UI States

- Handle **loading**, **error**, and **empty** states explicitly. Do not render components in an undefined or partially loaded state.

```jsx
if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;
if (items.length === 0) return <EmptyState />;
return <ItemList items={items} />;
```

## Styling

- Do not use inline styles. Use the project's established styling solution (CSS modules, Tailwind, styled-components, etc.).
- If no convention exists, prefer CSS modules or the approach closest to the rest of the codebase.

## Exports

- Prefer **named exports** over default exports for components.

# Git Workflow: Single Project Repo

## Branches and Environments

| Branch | Environment |
|---|---|
| `develop` | Dev |
| `release/{shortcode}-{major.minor.patch}` | Test, Stage |
| `main` | Production |

## Workflow

1. Create feature branches from `main`.
2. Open PRs targeting `main`.
3. When ready for release, a release branch is cut from `main` (e.g. `release/app-1.0.0`).
4. The release branch is merged to `main` for production deployment.

## Branch Naming Conventions

Use `gh/{ticket_number}/short-summary` when a GitHub issue exists:

```
gh/{ticket_number}/short-summary
```

If there is no ticket, use just the short summary:

```
short-summary
```

### Rules

- Use lowercase and hyphens in the summary portion.
- Keep the summary short -- 2 to 4 words.
- Never include spaces or uppercase letters in branch names.

# Project Memory

Use `docs/memory/` in the project root to store lessons learned during development.

## What belongs here

Things that are NOT easily discoverable from the code or documentation alone:

- Gotchas and footguns
- Non-obvious configuration requirements
- Workarounds for known issues
- Decisions that were made and why
- Things that broke in surprising ways

## How to use it

- **At the start of work:** Read all files in `docs/memory/` to benefit from past lessons.
- **During work:** When you discover something non-obvious, write it to a new memory file.
- **File format:** Markdown files with descriptive names (e.g., `docs/memory/api-rate-limiting-workaround.md`).
- **Keep entries focused.** One topic per file. Be direct. State the problem, the cause, and the fix or workaround.

## What does NOT belong here

- Things obvious from reading the code
- Standard library or framework usage
- Information already in project documentation
- Temporary notes or TODOs

# Specialists

Project-level specialist agents that the four global Concepture routers (`Concepture-Developer`, `Concepture-Quality`, `Concepture-Tester`, `Concepture-Critic`) dispatch to for this project. Specialist agent files live in `.opencode/agents/`.

| Role | Specialist | File |
|------|------------|------|
| developer | `react-dev` | `.opencode/agents/react-dev.md` |
| tester | `react-tester` | `.opencode/agents/react-tester.md` |
| critic | `react-critic` | `.opencode/agents/react-critic.md` |
| quality | *(none — falls back to `commands.lint` and `commands.quality` from `docs/project.json`)* | — |
| security-critic | *(none — falls back to the global `security-critic` for universal concerns)* | — |

Notes:

- `react-tester` handles both test writing (Write mode) and test-file review (Review mode). `Concepture-Critic` routes `*.test.*`, `*.spec.*`, and `__tests__/` paths to `react-tester`; `Concepture-Critic` routes all other source files to `react-critic`.
- Quality runs through `commands.lint` (`npm run lint`) and `commands.quality` (currently aliased to lint). When project-specific quality rules accrete, a dedicated quality specialist can be added.
- The global `security-critic` covers universal stack-agnostic security concerns (secrets in source, RLS bypass attempts, auth handling). Add a `security-critic-js` specialist if and when JS-specific security rules accrete.

# Agent Models

Model and temperature settings for every sub-agent involved in this project. Routers (`Concepture-*`) are global and run with their own defaults; the project specialists below are pinned to specific models in their agent file frontmatter.

| Agent | Model | Temperature |
|-------|-------|-------------|
| react-dev | `github-copilot/gpt-5.5` | 0.2 |
| react-tester | `github-copilot/gpt-5.5` | 0.1 |
| react-critic | `github-copilot/gpt-5.5` | 0.0 |
| Concepture-Explore | (global default) | 0.0 |
| Concepture-Developer | (global default) | 0.0 |
| Concepture-Quality | (global default) | 0.0 |
| Concepture-Tester | (global default) | 0.0 |
| Concepture-Critic | (global default) | 0.0 |
| toolkit-critic | (global default) | 0.0 |
| security-critic | (global default) | 0.0 |

Notes:

- All project specialists run on `github-copilot/gpt-5.5`.
- Temperatures: developer 0.2 (some flexibility for implementation choice), tester 0.1 (mostly deterministic), critic 0.0 (deterministic review).
- Router agents inherit their model and temperature from the global toolkit agent definitions; only project specialists need explicit pinning here.
