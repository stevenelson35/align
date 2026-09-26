# Align: notes for coding agents

Household task and scheduling app for one family. Read `DESIGN.md`, especially **§13 Status & Handoff**, before starting. Stages 1–2 are done; stage 3 (lists and tasks) is next.

## Commands
```sh
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"   # Node v24 via nvm
npm install
npm run emulators      # terminal 1 (Auth + Firestore emulators)
npm run seed           # terminal 2: test accounts + household (password "align-dev")
npm run dev            # http://localhost:5173
npm test               # unit tests (vitest, src/)
npm run test:rules     # 18 security-rule tests against the emulator; must stay green
npm run build && npm run lint
```

## Rules
- **Zero cost is a hard constraint:** Firebase **Spark** plan only (no Cloud Functions, no paid APIs). Logic runs in the browser; Firestore rules are the only access control.
- **Change the rules and their tests together.** Every data-model change needs rules plus tests in `tests/rules/`.
- **Tasks copy their list's `visibility` / `ownerId` / `viewerVisible`.** Update them in the same batch as the list.
- Hash routing (static hosting on Turbify, no rewrites). No spaces in generated names.
- Match the existing style (functional React components, typed Firestore data in `src/types.ts`, small modules). Commit and push over SSH when the user asks.
