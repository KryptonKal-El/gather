# Toolkit Gap Report — prd-list-scoped-stores

## prd-list-scoped-stores — All 8 Stories Completed (2026-06-02)

### Context

**PRD:** prd-list-scoped-stores — Migration of store ownership from per-user to per-list scoping. All 8 stories completed. Stores migrated from per-user to per-list ownership. react-dev and swift-dev implemented DB migration, service layer, context, UI components, iOS native, and list type config. react-tester added 56 tests. react-critic reviewed all source and tests.

**Files touched:** 26 files across React services, context, components, iOS views + ViewModels, tests, utilities, and Supabase migrations.

**Routers dispatched:** Concepture-Developer, Concepture-Quality, requirements-critic, Concepture-Critic-Source, Concepture-Tester, Concepture-Critic-Tests.

**Specialists dispatched:**
- react-dev (Concepture-Developer)
- swift-dev (Concepture-Developer)
- commands.lint / commands.quality (Concepture-Quality — no project-level quality specialist)
- react-critic (Concepture-Critic-Source)
- react-tester (Concepture-Tester)
- react-tester Review mode (Concepture-Critic-Tests)

**Soft warnings raised during execution:**
- No project-level quality specialist — fell back to commands.lint
- No security-critic specialist — fell back to global security-critic
- docs/CONVENTIONS.md not found — convention loading skipped
- userStoreDefaults not subscribed (one-time fetch only) — advisory, not fixed
- editColor state in UserStoreDefaultsManager has no UI yet — advisory, not fixed

---

### Findings

#### Missing project conventions

- **Priority:** high
- **Scope:** project
- **Remediation:** project-setup
- **Layer file:** `docs/CONVENTIONS.md` (top-level index)
- **Gap:** Project has no conventions file or convention layer files. The soft warning "docs/CONVENTIONS.md not found — convention loading skipped" indicates the `conventions-load` skill could not be invoked, meaning specialists and routers could not load stack-specific patterns for React, testing, state management, Supabase queries, or iOS development.
- **Rationale:** Convention-aware tooling (`Concepture-Explore`, `Concepture-Developer`, routers, and specialists) require `docs/CONVENTIONS.md` to discover available layers and infer relevant patterns for context. Without it, the toolkit operates in degraded mode: conventions cannot be lazy-loaded, and future workers must reverse-engineer patterns from code rather than consulting documented practices.
- **Impact:** Roadmap for conventions adoption is blocked. Testing patterns, React component structure, Supabase query conventions, and iOS development patterns (all present in this PRD work) should be recorded in convention layers and made discoverable for future workers.
- **Suggested fix:**
  1. Create `docs/CONVENTIONS.md` — top-level index of available convention layers. Include a frontmatter section listing all available layers and a table with `layer`, `file`, `description`, and optional `linkedFiles` columns.
  2. Create initial convention layer files for layers revealed by this PRD work:
     - `docs/conventions/testing.md` — test strategy for React (unit vs. integration boundaries, mock patterns, test data setup)
     - `docs/conventions/react.md` — React component patterns (state lifting, context usage, hook extraction, form control)
     - `docs/conventions/database.md` — Supabase and database patterns (query structure, RLS assumptions, migration ownership)
     - `docs/conventions/ios.md` — iOS/Swift development patterns (ViewModel conventions, View architecture, ObservableObject usage)
  3. Run conventions-load at the start of the next PRD or story to validate the infrastructure.

#### Specialists block all declared and complete

- **Priority:** informational
- **Scope:** project
- **Remediation:** none
- **Finding:** All specialists dispatched are declared in AGENTS.md Specialists block with descriptions present. No missing entries or stale descriptions detected.
- **Declaration:** 
  ```
  | developer | react-dev | .opencode/agents/react-dev.md |
  | developer | swift-dev | .opencode/agents/swift-dev.md |
  | tester | react-tester | .opencode/agents/react-tester.md |
  | critic | react-critic | .opencode/agents/react-critic.md |
  ```
- **Status:** All four agents ran without issues. Descriptions accurately cover the work that ran (React components, Swift iOS, test writing, code review). No amendments needed.

#### No template or global gaps detected

- **Priority:** informational
- **Scope:** global, template
- **Remediation:** none
- **Finding:** Toolkit templates library is complete for the stacks used. Global routing, critic agents, and quality discipline functioned correctly. No missing agents, skills, or broken references in toolkit layer.

### Recommended next actions

1. **High priority — project setup:** Create `docs/CONVENTIONS.md` and initial convention layers (`testing.md`, `react.md`, `database.md`, `ios.md`) to enable convention-aware tooling and pattern discovery. This unblocks the `conventions-load` skill for future stories.

2. **Medium priority — documentation:** Add a brief section to project README documenting the convention layers and when to check them (e.g., "Before starting a new story, check `docs/conventions/` for stack-specific patterns").

3. **Low priority — future:** Once conventions are established, consider whether a dedicated `project-quality` specialist would improve code quality enforcement beyond the current lint-based approach.

---

**Assessment complete.** All specialists declared and present. No global or template gaps. One project-level convention infrastructure gap (high priority).
