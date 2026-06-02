# Toolkit Gap Report — prd-image-search-source-toggles

## Image Search Source Toggles (S-1 through S-7) — 2026-05-29

### Context

Full PRD implementation for per-user image search source toggles: 7 stories spanning React web UI + settings, Swift iOS UI + settings, Supabase profile schema + edge function refactoring, and Supabase REST migration. All 24 files committed successfully. React and iOS specialists dispatched; test files added for React components and services. Edge function (S-4) implemented but no specialist was dispatched or credit recorded — indicates a backend/edge-function routing gap in the toolkit.

### Findings

#### Missing sub-agents / Specialists

- **Priority:** high
- **Scope:** template
- **Remediation:** Concepture-Toolkit
- **Finding:** No project-level Supabase/edge-function specialist was dispatched for S-4 (edge function refactoring: add `sources` param, group results, handle disabled source filtering).
- **Rationale:** Edge function work (TypeScript in `supabase/functions/search-products/index.ts`, complex logic with fallback chain and grouping) was completed by `react-dev` generalist rather than routed to a backend specialist. The project lacks a `supabase-backend` or `backend-dev-js` specialist to own Supabase-specific implementation (edge functions, RLS, migrations, remote logging).
- **Suggested fix:** 
  1. **Toolkit:** Add `supabase-backend` template specialist to `templates/agents/` — a developer specialist for Supabase edge functions, RLS, and migrations in JavaScript/TypeScript projects. Include it in the React/Supabase + Next.js/Supabase stack manifests.
  2. **Project:** Install the specialist and add a `- developer: supabase-backend | Supabase edge functions, migrations, RLS policies` entry to AGENTS.md Specialists block.
  3. **Routing:** When `Concepture-Developer` sees edge function or migration files in the diff, route to the `supabase-backend` specialist rather than the general web framework specialist.

#### Missing skills

- **Priority:** medium
- **Scope:** template
- **Remediation:** Concepture-Toolkit
- **Finding:** No "test strategy" or "testing layer" skill exists to guide specialists on how to choose between unit, integration, and E2E tests for a given story.
- **Rationale:** React tester added tests for services and components but the testing-layer patterns (e.g., "unit test boundaries, integration test full user flows") are not documented. Future testers or story writers will have to reverse-engineer the pattern from existing tests rather than consulting a documented testing convention.
- **Suggested fix:** Create a `templates/skills/testing-strategy-react/SKILL.md` global skill that guides test design decisions: where to unit test (services, pure utilities), where to integrate test (components with state, API interactions), when to skip E2E when unit + integration sufficient. Include decision tree and project examples.

#### Conventions gaps

- **Priority:** high
- **Scope:** project
- **Remediation:** project-setup
- **Layer file:** `docs/CONVENTIONS.md` (top-level) + `docs/conventions/testing.md` (specific layer)
- **Gap:** Project has no conventions layer files at all. Multiple progress entries note "conventions file is missing" when workers need to record patterns (React styling/mobile settings structure, testing strategy, Supabase/database access patterns).
- **Impact:** Each worker documents patterns inline in progress.txt or comments rather than contributing to shared project conventions. Future workers cannot discover documented patterns; toolkit skills cannot load project conventions via `conventions-load` skill because the files don't exist.
- **Suggested fix:** Create the conventions structure:
  1. Create `docs/CONVENTIONS.md` — top-level overview + layer index
  2. Create `docs/conventions/testing.md` — record the unit-boundary + integration-flow discipline (document what was learned in this story)
  3. Create `docs/conventions/styling.md` — document mobile settings patterns (sections, toggles, row structure)
  4. Create `docs/conventions/database.md` — document Supabase query patterns, RLS assumptions, profile schema ownership
  5. Run this session's stories again with conventions loading enabled to test the layer infrastructure.

#### Existing toolkit issues

- **Priority:** high
- **Severity:** high
- **Scope:** project
- **Remediation:** project-setup
- **File path:** `AGENTS.md` — Specialists block
- **Issue:** Specialists block still uses a table format with non-canonical role names (`critic` instead of `critic-source`/`critic-tests`, `security-critic` fallback entry rather than omitted). Previous gap report flagged this; issue persists.
- **Rationale:** TOOLKIT-CONVENTIONS.md defines canonical format as `- role: agent-name | description` list. The project's table format confuses routing agents that parse the Specialists block expecting the list format.
- **Suggested fix:** Rewrite the Specialists block to canonical format:
  ```markdown
  ## Specialists

  - developer: react-dev | React/Vite implementation, Supabase auth, image services
  - developer: swift-dev | Swift/SwiftUI implementation, iOS Supabase services
  - tester: react-tester | Vitest unit tests, React Testing Library component tests
  - critic-source: react-critic | React/Vite code review, design, correctness, accessibility
  - quality: *(none — falls back to commands.lint and commands.quality)*
  - security: *(falls back to global security-critic)*
  ```
  (Note: Also add `supabase-backend` once created.)

- **Priority:** medium
- **Severity:** medium
- **Scope:** global
- **Remediation:** Concepture-Toolkit
- **File path:** `skills/conventions-load/SKILL.md` or `TOOLKIT-CONVENTIONS.md`
- **Issue:** Project conventions loading works when layers exist, but zero-layer projects (like Gather before this gap report) silently skip — no warning is raised that conventions are unavailable and the project should set them up.
- **Rationale:** When a project has no `docs/CONVENTIONS.md` and no `docs/conventions/` directory, `conventions-load` returns silently with an empty result. Routers and specialists do not know whether conventions truly don't exist or haven't been created yet, so they cannot nudge workers to create them.
- **Suggested fix:** In `skills/conventions-load/SKILL.md`, when no convention layers are found, emit a non-blocking note: "No project conventions found. Consider creating `docs/CONVENTIONS.md` and `docs/conventions/` layers to document patterns discovered during implementation."

#### Test coverage gap

- **Priority:** medium
- **Scope:** project
- **Remediation:** project-setup (future stories)
- **Finding:** S-4 (edge function refactoring) has no test coverage recorded. TypeScript edge function with new grouping logic, source filtering, and multi-provider fallback chain was implemented but `deno test` or equivalent was not mentioned in progress.
- **Rationale:** Edge functions are harder to test locally (require Deno test runner + mocked Supabase context), but lack of testing leaves this logic unverified until deployed to production. Future changes to source ordering or filtering risk regressions.
- **Suggested fix:** Add a story or task to set up `supabase/functions/search-products/search-products.test.ts` with mock providers and test the grouping + filtering logic. Update the testing conventions to clarify that edge functions should have unit tests in `*.test.ts` alongside the function file.

### Recommended next actions

1. **Concepture-Toolkit:** Design and add `supabase-backend` specialist template, then add it to React/Supabase and Next.js/Supabase stack manifests. This unblocks proper backend specialist dispatch for future stories.
2. **Concepture-Toolkit:** Create `testing-strategy-react` global skill to guide specialists on unit vs. integration vs. E2E test boundaries.
3. **project-setup / Builder:** Normalize Gather's Specialists block to canonical list format (including new `supabase-backend` once created) and create the `docs/CONVENTIONS.md` + layer structure.
4. **Future stories:** Once conventions exist, document edge function testing patterns and add test coverage for the search-products function.
