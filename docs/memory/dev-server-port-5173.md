# Dev Server Port: Vite Default 5173

## Problem
The project registry (`~/.config/opencode/projects.json`) has `devPort: 4000`, but the actual Vite dev server runs on port **5173**. There is no `server.port` setting in `vite.config.js`, so Vite uses its default.

## Impact
Dev server health checks targeting port 4000 will fail. Always check port 5173 for this project, or update the registry to match.

## Why Not Fix the Registry
The registry port is used by the agent system's dev server management. It should be updated to 5173, but this requires a planner/toolkit change, not a builder change.
