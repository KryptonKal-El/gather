# Conventions Index

Project-level coding conventions for Gather. Loaded by AI agents via the `conventions-load` skill before implementation work begins.

## Layers

| File | Scope |
|------|-------|
| [react-components.md](conventions/react-components.md) | React component structure, styling, props, naming |
| [react-testing.md](conventions/react-testing.md) | Vitest + React Testing Library patterns |
| [database-service.md](conventions/database-service.md) | Supabase service layer (`src/services/database.js`) |
| [state-management.md](conventions/state-management.md) | React Context + hooks patterns |
| [swift-ios.md](conventions/swift-ios.md) | Swift / SwiftUI / iOS conventions |
| [dnd-kit.md](conventions/dnd-kit.md) | Drag-and-drop with `@dnd-kit` |

## Usage

When the `conventions-load` skill runs, it reads this index and loads the layer files relevant to the current task context. Agents must not rely on training data for project-specific patterns — consult these files instead.
