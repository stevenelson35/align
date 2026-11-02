# Align

Household task manager for the Nelson family, live at https://align.itsallonesong.com. It holds:
- task lists and projects (dependencies, timeline)
- checklists and notes
- the family Google Calendar
- voting boards
- texting family members about a task

See [DESIGN.md](DESIGN.md) for the full spec. Its §13 "Status & Handoff" says where things stand, and [CLAUDE.md](CLAUDE.md) has notes for coding agents.

React + TypeScript + Vite in the browser, with Firebase Auth and Firestore on the free Spark plan. The app is static files hosted on Turbify. The calendar sync runs as a free Google Apps Script (`scripts/apps-script/`).

## Local development

Requires Node LTS (via nvm), Java 21 (for the Firebase emulators), and `npm install -g firebase-tools`.

```sh
npm install
npm run emulators   # terminal 1: Auth + Firestore emulators, UI at http://127.0.0.1:4000
npm run seed        # terminal 2: test accounts + household (password "align-dev")
npm run dev         # terminal 2: app at http://localhost:5173
```

Test accounts: `steve@`, `wife@`, `daughter@` (members) and `grandparent@` (viewer), all `@example.com`.

## Adding a person

Everyone who signs in needs two things: a **login** (Firebase Authentication) and an **entry in the household**
(Firestore, `household/main` → `members`). The entry is what lets them in and says what they can do; a login without
one sees "Not in this household".

**The part that's easy to get wrong:** each person's entry is a **map whose name is their User UID**. The UID isn't a
field called `userid` inside it; it *is* the map's name, and the map holds that person's fields:

```
household/main
  members                                   (map: one entry per person)
    Xy7Qa21b…  ← the map's NAME is the UID  (map)
      role:         "member"                (string)
      displayName:  "Steve"                 (string)
      color:        "#0f7b7d"               (string)
    Lm4Rt98k…                               (map)
      role:         "member"
      displayName:  "Linda"
      color:        "#bf3989"
    Cb5Zp30w…                               (map: the calendar / location helper)
      role:         "member"
      displayName:  "Calendar"
      color:        "#57606a"
      bot:          true                    (boolean, not the text "true")
```

Steps:

1. **Login:** Firebase console → **Authentication** → **Users** → **Add user**: their email and a starting password (they
   can change it in Settings, or use Forgot password?). Copy the new row's **User UID**.
2. **Household entry:** Firebase console → **Firestore** → `household` → `main`. Hover the **`members`** row itself (not
   anyone's entry inside it) and click **+** (Add field):
   - **Field name:** paste the User UID. **Type:** `map`.
   - Inside that new map, add **role** (string), **displayName** (string) and **color** (string, a `#rrggbb` color;
     they can change it later in Settings → Your color).
3. **Check:** `members` now shows the new UID beside the others (one level down from `members`, never inside someone
   else's entry), and they can sign in. On a shared phone, add them with Settings → **+ Add someone**.

Roles:

| Who | `role` | What they get |
|---|---|---|
| Family (adults and children) | `member` | Everything: tasks, lists, goals, flashcards, the family map, settings. |
| Someone outside the family (grandparents, a sitter, relatives) | `viewer` | Read-only: lists and boards marked *visible to viewers*, and lists shared with them by name. No goals, map or editing. |
| The calendar / location helper | `member` plus `bot: true` | The account the Apps Script signs in as (Google Calendar sync, family map reports, Alexa). Hidden from people pickers. Keep it: without it calendar sync and location reports stop. |

Afterwards: a parent can add another parent in **Settings → Parents** (only someone already in Parents can change it).
Each person sets their own default privacy, mobile number (for "text <name>") and color in Settings.

**Don't:**
- add a field like `displayName` directly under `members` (it must go inside a person's map);
- click the trash icon on `members` or on someone's whole entry when you mean one field inside it: that removes the
  person (their data stays, tied to their UID, and comes back when the entry is added again with the same UID);
- type `true` as a string for `bot`.

## Tests

```sh
npm test               # unit tests
npm run test:rules     # Firestore security rules (starts its own emulators)
npm run test:calendar  # calendar sync script against the running emulators (after seed)
npm run lint
```

## Deploying

1. Copy `.env.example` to `.env.production.local` and fill in the Firebase web app config (and `VITE_CALENDAR_SYNC_URL` for the Refresh calendar button).
2. `firebase login --no-localhost`, `firebase use --add` (pick the `align` project), then `npm run deploy:rules`. **When the rules change, deploy them before the web app.**
3. `ALIGN_FTP_DIR=/align.itsallonesong.com npm run deploy:web` builds and uploads `dist/` to Turbify over FTPS. It asks for the FTP password, so run it in a terminal. To preview without changing anything, run `npm run build` and then `ALIGN_FTP_DIR=... scripts/deploy-turbify.sh --dry-run`.
4. First visit: sign in and complete the one-time household setup screen. Calendar sync setup is in `scripts/apps-script/README.md`.
