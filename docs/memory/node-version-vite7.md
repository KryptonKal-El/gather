# Node Version Requirement (Vite 7.x)

## Problem
Vite 7.3.1 requires Node.js >=20.19.0 or >=22.12.0. The project was on Node 18.16.1, which caused `npm run dev` and `npm run build` to fail silently or with cryptic errors.

## Fix
Installed nvm and upgraded to Node v22.22.0. Every shell command in agent sessions must be prefixed with:
```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```
Without this prefix, the shell falls back to the system Node (v18) and commands fail.

## Impact
This affects all `npm run dev`, `npm run build`, `npx eslint`, and any Node-dependent command.
