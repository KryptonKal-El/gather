# Toolkit Health Check — Conventions Implementation

**Date:** 2026-06-02  
**Project:** Gather (`/Users/dorianpineda/code/gather`)  
**Work Completed:** Created `docs/CONVENTIONS.md` and six convention layer files (`react-components.md`, `react-testing.md`, `database-service.md`, `state-management.md`, `swift-ios.md`, `dnd-kit.md`) — documentation only, no source code changes.

**Toolkit Root:** `/Users/dorianpineda/Documents/GitHub/Concepture-toolkit`

---

## Context

This health check was triggered after Gather implemented its project-tier convention layer system. The conventions index and layer files were created to document project-specific patterns for React components, React testing, database services, state management, Swift/iOS, and drag-and-drop functionality.

The work involved:
- Creating `docs/CONVENTIONS.md` as the single index
- Creating six layer files in `docs/conventions/` to document patterns for distinct concerns
- No changes to source code or tests
- No changes to toolkit files (`.opencode/agents/`, global skills, or manifests)

---

## Findings

### Finding 1: Missing React/Vite/PWA Stack Manifest

**Gap ID:** TKIT-001  
**Scope:** `template`  
**Priority:** High  
**Remediation:** `Concepture-Toolkit`

**Finding:** The toolkit templates library contains stack manifests for Next.js, .NET, Swift iOS, Swift macOS, and static web—but no manifest for React + Vite + PWA + Supabase, which is Gather's exact stack.

**Rationale:** Gather's `project.json` declares:
```json
{
  "stack": {
    "language": "javascript",
    "framework": "react",
    "bundler": "vite",
    "backend": "supabase",
    "pwa": true,
    "native": "capacitor"
  }
}
```

This does not map to any existing stack manifest. The closest match is `nextjs.json`, but Next.js and React + Vite are architecturally different (Next.js is full-stack with App Router; React + Vite is frontend-only with a separate backend).

Gather was bootstrapped with manually-copied agents (`react-dev.md`, `react-tester.md`, `react-critic.md`) that do not exist in the templates library. Future projects with similar stacks (React + Vite + Supabase, or React + Vite + other backend) will face the same situation: no discoverable template, no codified agents to copy, and no manifest to automate `project-bootstrap`.

**Suggested Fix:** Create `templates/stacks/react-vite-pwa.json` manifest that:
- Declares agents: `react-dev`, `react-tester`, `react-critic`, `react-quality`, `supabase-data` (or similar)
- Declares skills: (to be determined by Concepture-Toolkit based on this stack's typical needs)
- Declares specialists block with roles: `developer` (react-dev), `tester` (react-tester), `critic-source` (react-critic), `quality` (react-quality), `data` (supabase-data)
- Declares commands: `dev`, `build`, `test`, `lint`, `quality`, `preview`
- Declares conventions stubs matching Gather's layers: `react-components`, `react-testing`, `state-management`, `database-service`, `styling`, `error-handling`, `naming`
- Ensure corresponding template agent files exist in `templates/agents/` with the exact names referenced in the manifest.

**Impact:** Without this template, future React + Vite + Supabase projects must manually bootstrap, copying agents by hand and discovering patterns ad-hoc. Codifying this as a template eliminates friction and ensures consistency.

---

### Finding 2: Orphan Template Skills Without Standalone Markers

**Gap ID:** TKIT-002  
**Scope:** `template`  
**Priority:** Medium  
**Remediation:** `Concepture-Toolkit`

**Finding:** Two template skills are not referenced by any stack manifest and lack `standalone: true` markers in their frontmatter:
- `templates/skills/marketing-copy/SKILL.md`
- `templates/skills/swiftdata-migration-checklist/SKILL.md`

**Rationale:** According to TOOLKIT-CONVENTIONS.md, every template skill must either:
1. Be referenced by at least one stack manifest, OR
2. Declare `standalone: true` in its frontmatter to signal that it is an optional asset for ad-hoc use.

These two skills are orphans. They are not discoverable through `project-bootstrap` (which scans manifests) and not marked as standalone. This creates three problems:

1. **Discoverability:** Project teams cannot discover these skills through the canonical bootstrap workflow.
2. **Convention violation:** TOOLKIT-CONVENTIONS.md explicitly requires one of these two conditions; the absence of both is a structural issue.
3. **Maintenance ambiguity:** A future Concepture-Toolkit contributor cannot tell whether these skills are intentionally optional or accidentally orphaned.

**Suggested Fix:** For each orphan skill, decide:
- **Option A (Manifest-Driven):** Add the skill to one or more stack manifests where it is relevant. Example: if `marketing-copy` is useful for .NET projects, add it to `dotnet.json`'s `skills` array and document its purpose.
- **Option B (Standalone-Driven):** Add `standalone: true` to the skill's SKILL.md frontmatter with an explanation (in a comment) of when and why projects should opt into it. Update the skill's "When to Load" section to clarify that it is an optional utility.

**Impact:** Without this fix, `toolkit-critic` will continue to flag these skills as convention violations. Resolving them clarifies the skill's role and makes the templates library structure clearer for future contributors.

---

## Toolkit Validation Results

### Templates Library Health

✅ **Stack Manifest Schema Validation:** All five manifest files (dotnet.json, nextjs.json, static-web.json, swift-ios.json, swift-macos.json) are well-formed JSON and conform structurally.

✅ **Agent Reference Integrity:** All agent names referenced in stack manifests exist under `templates/agents/` (e.g., `nextjs-dev`, `swift-dev`, `web-dev` all have corresponding `.md` files).

✅ **Skill Reference Integrity:** All skill names referenced in stack manifests exist under `templates/skills/` with a valid `SKILL.md` (e.g., `unit-test-xctest`, `swiftui-concurrency-audit`).

✅ **Manifest Filename Consistency:** All manifest filenames (without `.json`) match their `stack` field in the manifest body.

✅ **Orphan Agent Handling:** All nine orphan agents declare `standalone: true` and are properly marked:
- exploit-critic, cdp-critic, docs-critic, oddball-critic, copy-critic, docs-writer, api-critic, ui-tester-playwright, network-critic

❌ **Orphan Skill Handling (2 issues):** See Finding 2 above.

### Project Conventions System

✅ **CONVENTIONS.md Index:** Well-formed. Correctly lists all six layer files with descriptions and scopes.

✅ **Convention Layers:** All six layers exist and contain substantive content:
- `react-components.md` — React component structure, styling, props, JSDoc, PropTypes
- `react-testing.md` — Vitest + React Testing Library patterns
- `database-service.md` — Supabase service layer patterns
- `state-management.md` — React Context + hooks patterns
- `swift-ios.md` — Swift/SwiftUI/iOS conventions
- `dnd-kit.md` — Drag-and-drop with @dnd-kit library

✅ **conventions-load Skill Compatibility:** The skill correctly infers relevant layers based on task context using 8 dimensions. No gaps in layer loading logic.

### Specialists Block

✅ **Project AGENTS.md Specialists Block:** Gather's Specialists block correctly declares roles and specialists:
- developer: react-dev, swift-dev
- tester: react-tester
- critic: react-critic (note: uses deprecated `critic` role instead of `critic-source`; not a gap per TOOLKIT-CONVENTIONS.md backward-compatibility rule)
- quality: (none — falls back to commands)
- security: (none — falls back to global security-critic)

All declared specialists have corresponding agent files in `.opencode/agents/`.

---

## Recommended Next Actions

### Priority 1: High (Blocking Template Gaps)

1. **Create React/Vite/PWA stack manifest** (`Concepture-Toolkit`)
   - File: `templates/stacks/react-vite-pwa.json`
   - Actions: Define agents, skills, specialists, commands, and convention stubs based on Gather's current setup and best practices for this stack.
   - Create or verify template agent files exist: `react-dev.md`, `react-tester.md`, `react-critic.md`, `react-quality.md`, `supabase-data.md` (adjust names as needed per toolkit naming rules).
   - Validate manifest against schema before commit.

### Priority 2: Medium (Convention Adherence)

2. **Resolve orphan template skills** (`Concepture-Toolkit`)
   - **marketing-copy:** Decide if it belongs in a manifest (e.g., dotnet, nextjs) or should declare `standalone: true`. Update frontmatter accordingly.
   - **swiftdata-migration-checklist:** Same decision — manifest-driven or standalone. Update frontmatter accordingly.
   - Re-validate templates library after resolution.

### Priority 3: Optional (Gather Project Quality)

3. **Update Gather's Specialists block** (project-setup or `Concepture-Toolkit` per policy)
   - Change `critic: react-critic` to `critic-source: react-critic` to use the current (non-deprecated) role name.
   - This aligns Gather with TOOLKIT-CONVENTIONS.md role definitions and future-proofs the project.

---

## Summary

**Total Findings:** 2  
**Critical:** 0  
**High:** 1 (missing React/Vite/PWA stack manifest)  
**Medium:** 1 (orphan skills without standalone markers)  
**Low:** 0

**Toolkit Health Status:** Good  
Gather's convention implementation is sound. The two gaps are in the toolkit templates library, not in Gather's usage of conventions. Both gaps are easily remedied by `Concepture-Toolkit` with per-file human approval.

The convention system is working as designed: Gather created an index, defined layers relevant to its stack, and the `conventions-load` skill will correctly infer and load them for future work.
