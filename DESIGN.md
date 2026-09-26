# Align — Design Specification

Align is a household task manager for one family. It handles personal, shared and project tasks, does dependency-aware scheduling, runs token-based family voting, and has a chat box that accepts simple typed commands.


> **Picking this project up later, or handing it to another agent?** Start with **§13 Status & Handoff**. It covers what's built, what's next, what the user still has to set up, the environment, and gotchas. `CLAUDE.md` has the short version for coding agents.
## 1. Constraints

These rules override anything else in this document.

1. **No added cost.** Only free tiers:
   - Firebase **Spark** (free) plan. **No Cloud Functions** (they need the paid Blaze plan).
   - No paid APIs. Chat uses a local command parser, not an AI service.
   - Hosting on the existing Turbify web-hosting plan.
2. **Static hosting only.** The app is a single-page app: HTML, CSS and JS built into `dist/` and uploaded to Turbify at **https://align.itsallonesong.com**. It needs no server code.
3. **Browser-only logic.** Scheduling, vote totals and command parsing all run in the browser. Firestore security rules are the only access control.
4. **Household scale.** 3 active users and a few read-only viewers, with hundreds of tasks, not thousands. Choose simplicity over scalability.
5. **Trust model.** Users are family. Rules block outsiders and viewers, and each user can edit only their own private data. Rules don't try to stop a family member from gaming token counts.

## 2. Users and Roles

| Person | Household role | Access |
|---|---|---|
| Steve | `member` | Full |
| Wife | `member` | Full |
| Daughter (9) | `member` | Full. Same permissions and login type as the adults. |
| Grandparents, sisters (future) | `viewer` | Read-only. Sees only family lists and boards marked *visible to viewers*. |

- The household has **2 dogs, 2 cats, a bird and a fish**. They aren't users, but they can be a task's `for` target (§5.3).
- **No public sign-up.** Accounts (email/password) are created by hand in the Firebase console and added to the `household` document with a role. The app has a sign-in screen only.
- Anyone who signs in but isn't in `household.members` sees nothing. The rules enforce this.

## 3. Scope

### 3.1 MVP (use cases 1–7)

1. **Personal task management.** Private lists for chores, errands, work, lawn care and reminders. Create, edit, complete and prioritize tasks. View them by date, priority or dependency order.
2. **Shared family tasks.** Family lists that every member can edit, for household chores, family projects, travel and weekend plans. Updates sync in real time.
3. **Project tasks.** Lists marked as projects (lawn & garden, home renovation, vet business, long-term planning), with dependencies, automatic scheduling, a timeline and conflict warnings.
4. **Dependency and scheduling engine.** A DAG of tasks with day offsets (§6).
5. **Voting and tokens.** Family boards with weekly tokens that **roll over** (§7).
6. **Combined view.** All private and family tasks in one place, color-coded, with filters and sorting (§8).
7. **Chat commands.** Typed commands for common actions (§9).

Multi-device access and mobile layout come free with Firestore sync and a responsive UI, so they're part of the MVP.

### 3.2 Future ideas (not MVP, but don't design them out)

- Screens for managing viewer accounts
- Google sign-in
- Reminders and notifications (web push is free, but it needs a service worker)
- Recurring tasks, such as watering schedules and monthly flea meds
- Voting on tasks and a "voting weight" sort for tasks
- Offline-first caching (Firestore offline persistence)
- Capacitor wrapper for Android/iOS
- Google Calendar export (read-only `.ics`)

## 4. Architecture

```
Browser (React + TypeScript + Vite SPA)
  ├─ UI components
  ├─ Scheduling engine (pure TS, unit-tested)
  ├─ Command parser (pure TS, uses chrono-node for dates)
  └─ Firebase JS SDK ──► Firebase (Spark): Auth + Firestore + Security Rules

Turbify: serves static files from dist/ at align.itsallonesong.com
```

- **Routing:** use hash routing (`/#/tasks`) so Turbify needs no rewrite rules.
- **Firebase config** sits in the client bundle. That's normal and safe; the security rules protect the data.
- **Authorized domains:** add `align.itsallonesong.com` (and `localhost`) in Firebase Auth settings.
- The subdomain must have HTTPS.

## 5. Data Model (Firestore)

### 5.1 `household/main`

A single document.

```ts
{
  name: "Nelson Household",
  members: { [uid]: { role: "member" | "viewer", displayName: string, color: string } },
  pets: [{ id: string, name: string, kind: "dog" | "cat" | "bird" | "fish" }],
  weeklyTokens: number,        // default 10
  tokenStartDate: Timestamp,   // first grant week
}
```

### 5.2 `lists/{listId}`

```ts
{
  name: string,
  kind: "list" | "project",
  visibility: "private" | "family",
  ownerId: uid,
  viewerVisible: boolean,       // family lists only
  defaultContext: "family" | "work",
  createdAt, updatedAt
}
```

### 5.3 `tasks/{taskId}`

```ts
{
  listId: string,
  // Copied from the list so that queries and rules don't need a lookup:
  visibility: "private" | "family",
  ownerId: uid,
  viewerVisible: boolean,

  title: string,
  notes?: string,
  priority: 1 | 2 | 3,              // 1 = high
  status: "todo" | "doing" | "done",
  context: "family" | "work",       // e.g. vet business = work
  assigneeId?: uid,
  for?: string[],                   // member uids and/or pet ids

  startDate?: string,               // "YYYY-MM-DD" (days only)
  durationDays: number,             // default 1
  targetDate?: string,              // deadline, "YYYY-MM-DD"
  dependsOn: [{ taskId: string, offsetDays: number }],
  conflict?: string,                // set by the engine, e.g. "starts before prerequisite"

  createdBy: uid, createdAt, updatedAt
}
```

- Dependencies are stored **only** in `dependsOn`. There's no separate collection.
- If a list's visibility or owner changes, the client updates the copied fields on its tasks in one batch.

### 5.4 Voting

```
boards/{boardId}                        { name, viewerVisible, createdAt }
boards/{boardId}/items/{itemId}         { title, category?, status: "open" | "chosen" | "archived", createdBy, createdAt }
boards/{boardId}/items/{itemId}/votes/{uid}   { uid, tokens: number, updatedAt }
```

- Starter boards: **Movies & Shows**, **Restaurants & Meals**, **Weekend Activities**, **Travel Plans**. Members can add more.
- Totals are **computed in the client** from the `votes` subcollection. Nothing stores them.

## 6. Scheduling Engine

The engine is pure TypeScript with no Firebase dependency, so it's easy to unit test.

### 6.1 Rules

- Dates are whole days.
- `finish = startDate + durationDays - 1`
- A dependency `{ taskId: A, offsetDays: n }` on task B means that **B may start n days after A finishes**. So `earliestStart(B) = max(finish(A) + 1 + n)` across all of B's prerequisites.
  - Example: "Apply fertilizer" depends on "Armyworm treatment #2" with `+2`.
- **Cycles are rejected** when a dependency is added.
- A dependency may point to a task in another list, as long as the user can read it.

### 6.2 Conflicts

A task is in conflict when either is true:

- `startDate < earliestStart`: it starts too soon after a prerequisite.
- `finish > targetDate`: it misses its deadline.

Double-booking of a person is **not** checked.

### 6.3 Shifting

Shifting always shows a **preview** first. Then it applies the changes as one batched write.

- **Forward (push):** when a task moves later or grows longer, dependent tasks move later only as far as needed to satisfy their offsets.
- **Backward (pull), "meet new date":** when a task must finish by a date, its prerequisites move earlier only as far as needed.
- The engine changes only tasks the current user can edit. Any other affected task gets a conflict flag instead.

### 6.4 Timeline view

- Horizontal bars run from `startDate` to `finish`, with arrows for dependencies labeled with their offset (`+2d`).
- Dragging a bar starts a forward shift preview.
- Tasks in conflict are outlined in red.

## 7. Voting and Tokens

- Each member earns `weeklyTokens` every week, counted from `tokenStartDate`. **Unused tokens roll over** with no cap.
- `balance = weeklyTokens × weeksElapsed − Σ(my votes on items with status open or chosen)`
- Tokens can be moved or withdrawn while an item is `open`.
- When an item is marked **chosen** (we watched the movie), its tokens are **spent**.
- When an item is **archived** without being chosen, its tokens come back.
- Ranking sorts items by total tokens. The per-user bar shows each member's share.
- The client blocks overspending. The rules only check that users write their own vote document and that `tokens` is a whole number of 0 or more. This relies on the trust model in §1.

## 8. Combined View

- Shows all readable tasks: my private tasks plus every family task.
- **Colors:**
  - Private = blue
  - Family = purple
  - Project = green (project lists use green regardless of visibility)
  - Done = gray
- A **Work** badge marks tasks with `context: "work"`.
- **Filters:** list, context (family/work), `for` (person or pet), assignee, priority, status, date range.
- **Sort:** priority, date, or dependency order (topological).

## 9. Chat Commands

The chat panel runs a local, rule-based parser. Dates are parsed by `chrono-node`. Replies can include quick-action buttons.

| Command | Example |
|---|---|
| Add task | `add task fertilize lawn on Oct 5 to Lawn project for work priority high` |
| Complete | `done fertilize lawn` |
| Move | `move fertilize lawn to Oct 8` (runs a forward shift preview) |
| Meet date | `shift dependencies so apply fertilizer is done by Oct 10` |
| Recalculate | `recalculate lawn` |
| Show | `show board weekend activities` / `show today` / `show work` |
| Vote | `vote 3 on tacos in restaurants` |
| Help | `help` |

- Task names are matched with fuzzy search. If a match is ambiguous, the reply asks the user to pick one.

## 10. UI

- **Desktop:**
  - TopBar: title, current view, avatar, quick add
  - Sidebar: private lists, family lists, projects, boards, combined view
  - MainPanel: the current view
  - RightPanel: task details, dependencies, schedule
  - Chat: a slide-over panel
- **Mobile:** a BottomNav with Home, My Tasks, Family, Voting and Chat. The sidebar collapses.
- **TaskCard:** title, priority badge, list or owner badge, Work badge, `for` chips, status, target date, dependency and conflict indicators, and quick actions (complete, edit, move).
- **Viewers** see the same screens, but editing controls are hidden.

### 10.1 Folder structure

```
src/
  components/{AppShell,Tasks,Dependencies,Voting,Chat,UI}/
  engine/        scheduling.ts, graph.ts (+ tests)
  chat/          parser.ts (+ tests)
  firebase/      config.ts, auth.ts, db.ts, converters/
  hooks/  context/  utils/  styles/
firestore.rules
firestore.indexes.json
```

## 11. Security Rules (outline)

- `isMember()` means `household/main.members[uid].role == "member"`. `isViewer()` means the role is `"viewer"`.
- **`household/main`:**
  - Members and viewers can read it.
  - Members can update `pets`, `weeklyTokens` and their own entry's display fields, but not roles.
  - Roles change only in the console.
- **`lists` and `tasks`:**
  - `visibility == "private"`: read and write only if `ownerId == uid`.
  - `visibility == "family"`: members can read and write. Viewers can read if `viewerVisible`.
- **`boards` and `items`:** members can read and write. Viewers can read if the board is `viewerVisible`.
- **`votes/{uid}`:**
  - Members can read them.
  - Users can write only the document whose ID is their own uid, and `tokens` must be a whole number of 0 or more.
- Everything else is denied.
- Queries must match the rules. For example, private tasks are queried with `where("ownerId","==",uid)` and `where("visibility","==","private")`.
- Rules are tested with the Firebase emulator.

## 12. Development and Deployment

- **Environment:** WSL Ubuntu 24.04, VS Code, Node LTS, GitHub (`stevenelson35/align`).
- **Firebase setup:**
  1. Create a project on the Spark plan.
  2. Enable Email/Password Auth and Firestore.
  3. Add authorized domains.
  4. Create user accounts.
  5. Seed `household/main`.
- **Local development:** `npm run dev` against the Firebase emulators (Auth and Firestore).
- **Tests:** Vitest for the engine and parser, and the rules test SDK for security rules.
- **Deploy the backend:** `firebase deploy --only firestore:rules,firestore:indexes`. Rules and indexes are free.
- **Deploy the frontend:** `npm run build`, then upload `dist/` to the Turbify subdomain's document root (FTP or File Manager). An `lftp` script can come later.

## 13. Status & Handoff

### Where things stand (2026-09-26)
- **Stage 1: scaffold (done)**, commit `f4a987b` on `main` at `git@github.com:stevenelson35/align.git`:
  - Vite + React 19 + TypeScript app (`src/`), with Firebase wiring (`src/firebase/`) that uses the emulators in development
  - sign-in screen only (no sign-up), and a session provider that loads `household/main` and shows "Not in this household" to outsiders
  - an app shell with the top bar (household name, avatar, "View only" badge, sign out)
  - `scripts/seed-emulator.mjs` creates test accounts and the household on the emulator
- **Stage 2: security rules (done).** `firestore.rules` implements §11, and `tests/rules/firestore.rules.test.ts` has **18 tests, all passing** (verified 2026-09-26). The build is clean.
- **Nothing is deployed yet.** There's no Firebase project and no Turbify subdomain so far.

### Next stages (planned order)
3. **Lists and tasks:** list CRUD (private/family, list/project, `viewerVisible`, `defaultContext`), task CRUD with the copied list fields (§5.3), the combined view with colors and filters (family/work context, `for` person/pet, assignee, priority, status, dates), and hash routing.
4. **Scheduling engine** (§6): pure TypeScript in `src/engine/`, with Vitest tests for earliest start, conflicts, forward/backward shifting and cycle rejection, plus the timeline view with drag-to-shift previews.
5. **Voting and tokens** (§7): boards and items, votes, a computed balance (weekly grant, rollover, chosen = spent, archived = returned), and a collection-group query on `votes`.
6. **Chat command parser** (§9): pure TypeScript with `chrono-node` dates and fuzzy task matching, plus tests.
7. **First deploy:** Firebase rules/indexes, the production `.env`, and uploading `dist/` to the Turbify subdomain.

### What the user still has to do (can't be done by an agent)
1. **Firebase:**
   - Create a project on the free **Spark** plan.
   - Enable **Email/Password** auth and **Firestore**.
   - Add the authorized domain `align.itsallonesong.com`.
   - Register a **Web app** and put its config in `.env.production.local` (see `.env.example`).
   - Run `firebase login` (interactive), then `firebase use --add`.
2. **Accounts:** create the family's accounts in the Firebase console, then add their uids to `household/main.members` with roles. Real names for the wife, daughter and pets are still needed; the seed script uses placeholders.
3. **Turbify:**
   - Create the subdomain `align.itsallonesong.com` in cPanel, with HTTPS.
   - Note its document root. SPA routing uses hashes, so no rewrite rules are needed.
   - **FTP facts from the psort project, verified 2026-09-26:**
     - Use explicit **FTPS** to **`cpanel292.turbify.biz`**; the TLS certificate names that server, and SFTP port 22 is closed.
     - The account `sjnelson@itsallonesong.com` starts at the main website root. The subdomain's docroot is probably a folder under it. The root listing showed a folder named `itsallonesong.com` created 2026-09-26; confirm what it is.
     - psort's `blog.Uploader` in `stevenelson35/psort` is a working FTPS upload example.

### Environment
- **WSL Ubuntu 24.04.** Node **v24.21.0** via nvm (`~/.nvm`); load it with `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"`.
- `firebase-tools` 15.31 is installed globally under nvm. Java 21 is present (for the emulators).
- **Emulator project ID:** `demo-align` ("demo-" projects never reach real Firebase). The emulator UI is at http://127.0.0.1:4000.
- **Test accounts** (password `align-dev`): `steve@`, `wife@`, `daughter@` (members) and `grandparent@` (viewer), all `@example.com`.

### Gotchas
- npm skipped the install scripts for `@firebase/util` and `protobufjs`. That's harmless: the stub `postinstall.mjs` ships with the package.
- `vite build` warns that the chunk is over 500 KB. It's the Firebase SDK, and code-splitting is optional.
- **Tasks copy their list's visibility fields**, so queries and rules need no lookups. The rules check them against the list with `getAfter()`, so a batch that changes a list and its tasks together is valid. Any code that changes a list's visibility or owner **must update its tasks in the same batch**.
- **Queries must match the rules.** Viewers must query family tasks with `where("viewerVisible","==",true)`.
- `firestore.indexes.json` declares the collection-group single-field index on `votes.uid` that the token-balance query needs.
- Don't put spaces in generated file or folder names (user preference). All pushes go over SSH.

