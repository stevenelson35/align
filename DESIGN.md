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
| Steve | `member` | Full. Has an account. |
| Linda (wife) | `member` | Full. **No account yet** (test account `wife@example.com` stands in). |
| Camilla (daughter, 9) | `member` | Full: same permissions and login type as the adults. **No account yet** (`daughter@example.com` in tests). |
| Grandparents, sisters (future) | `viewer` | Read-only: family lists and boards marked *visible to viewers*, plus lists shared with them by name. |
| Calendar bot | `member` with `bot: true` | The Google Calendar sync's account (§5.5); hidden from people pickers. |

- The household has **2 dogs, 2 cats, a bird and a fish**. They aren't users, but they can be a task's `for` target (§5.3).
- **No public sign-up.** Accounts (email/password) are created by hand in the Firebase console and added to `household/main.members` with a role (console only). The app has a sign-in screen only.
- Anyone who signs in but isn't in `household.members` sees nothing. The rules enforce this.
- The daughter can't be given fewer permissions than a parent in the rules (decided 2026-09-25). Privacy from her comes from **list privacy** (§5.2): private lists and lists shared with chosen people.

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

Built since the MVP (§13): checklists, notes, sharing with chosen people, texting, Google Calendar import with refresh, dark mode, Settings.

- Screens for managing accounts and roles (today: Firebase console)
- Google sign-in
- Reminders and notifications (web push is free, but it needs a service worker and a sender; the Apps Script could be the sender)
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
  members: {
    [uid]: {
      role: "member" | "viewer",          // console only
      displayName: string,
      color: string,
      bot?: true,                         // the calendar-sync account (console only)
      defaultVisibility?: "private" | "family", // own Settings: default for new lists and quick adds
      phone?: string,                     // own Settings: mobile number for "text <name> …" (≤ 24 chars)
    }
  },
  pets: [{ id: string, name: string, kind: "dog" | "cat" | "bird" | "fish" }],
  weeklyTokens: number,        // default 10
  tokenStartDate: Timestamp,   // first grant week
  groups?: { parents?: uid[] } // "Parents" sharing shortcut (Settings). Once set, only a parent can change it.
}
```

### 5.2 `lists/{listId}`

```ts
{
  name: string,
  kind: "list" | "project" | "checklist" | "notes" | "links",
  visibility: "private" | "family" | "shared",
  sharedWith?: uid[],           // only when shared: 1–20 people, always including ownerId
  audience?: "parents",         // shared with the Parents group (shown as "Parents" rather than "Chosen people")
  ownerId: uid,
  viewerVisible: boolean,       // family lists only (false otherwise)
  defaultContext: "family" | "work",
  createdAt, updatedAt
}
```

- **Kinds:** `list` and `project` hold **tasks** (projects add dependencies, the timeline and recalculate). `checklist` holds things to tick off that aren't tasks (shopping, gifts, people to call). `notes` holds reference info (title + text). `links` holds bookmarks (name, address, optional note, and a `Home/Utilities`-style category that nests into a collapsible tree). Checklist items and notes are stored in `tasks` (same rules and copied fields) but are kept out of every task view, chat command and the scheduling engine (`DataState.listItems` vs `tasks`).
- **Privacy:** `private` = the owner only; `family` = every member (and viewers if `viewerVisible`); `shared` = exactly the people in `sharedWith` (members can edit; viewers in it can read).
- **The five choices** (`utils/audience.ts`, `AudiencePicker`), the same everywhere (lists, goals' view and log, the Settings default): **Only me** = private; **Parents** = shared + `sharedWith` = owner ∪ Parents group + `audience: "parents"`; **Family** = family, `viewerVisible: false`; **Chosen people** = shared; **Everyone** = family, `viewerVisible: true`. The default everywhere is **Everyone** (`members[uid].defaultVisibility` may be private / parents / family / everyone). The UI never names grandparents: view-only accounts are "anyone with view-only access". Voting boards are household-wide, so they offer Family / Everyone only.

### 5.3 `tasks/{taskId}`

```ts
{
  listId: string,
  // Copied from the list so that queries and rules don't need a lookup:
  visibility: "private" | "family" | "shared",
  sharedWith?: uid[],               // only when shared; equals the list's
  ownerId: uid,
  viewerVisible: boolean,

  title: string,
  notes?: string,                   // for a note: its text
  priority: 1 | 2 | 3,              // 1 = high
  status: "todo" | "doing" | "done" | "canceled",  // done and canceled are both "finished"
  context: "family" | "work",       // e.g. vet business = work
  assigneeId?: uid,
  for?: string[],                   // member uids and/or pet ids

  startDate?: string,               // "YYYY-MM-DD" (days only)
  durationDays: number,             // default 1
  targetDate?: string,              // deadline, "YYYY-MM-DD"
  dependsOn: [{ taskId: string, offsetDays: number }],
  conflict?: string,                // set by the engine, e.g. "starts before prerequisite"
  calendar?: { eventId, time?, location?, link? },  // set only by the calendar sync (§5.5)
  finishedOn?: string,              // "YYYY-MM-DD" it became done/canceled (withStatus); cleared if reopened
  pushedFrom?: string[],            // days it was pushed off with "⏭ next day"
  url?: string, category?: string,  // links lists only

  createdBy: uid, createdAt, updatedAt   // createdAt orders checklist items
}
```

- Dependencies are stored **only** in `dependsOn`. There's no separate collection. "Waiting on" / "Unblocks" / "Needed by" are computed from it (a prerequisite is satisfied when finished: done or canceled).
- If a list's visibility, sharing or owner changes, the client updates the copied fields on its tasks in **one batch** (`updateList`; `copiedFields` in `src/firebase/db.ts`).

### 5.4 Voting

```
boards/{boardId}                        { name, viewerVisible, createdAt }
boards/{boardId}/items/{itemId}         { title, category?, status: "open" | "chosen" | "archived", createdBy, createdAt }
boards/{boardId}/items/{itemId}/votes/{uid}   { uid, tokens: number, updatedAt }
```

- Starter boards: **Movies & Shows**, **Restaurants & Meals**, **Weekend Activities**, **Travel Plans**. Members can add more.
- Totals are **computed in the client** from the `votes` subcollection. Nothing stores them.

### 5.5 Google Calendar import

The family Google Calendar is copied one way into a family list named **Family Calendar** by `scripts/apps-script/calendar-sync.gs`. Setup steps are in that folder's README.

- **Runs in Google Apps Script** (free) under the account that can see the calendar, on a 15-minute trigger, and on demand when a member taps **↻ Refresh calendar** (the script is also published as a web app; its `doPost` checks the Firebase ID token with `accounts:lookup` and household membership, skips taps within a minute, and shares a lock with the trigger). Align itself still has no server code.
- **Auth:** the script signs in to Firebase Auth's REST API as a dedicated **calendar-bot** account. That account is a normal `member` in `household/main`, with `bot: true` so the UI hides it from people pickers. The security rules apply to it unchanged.
- **Reads** use the Advanced Calendar service (`Calendar.Events.list`, `singleEvents: true`, read-only scope). Event ids are stable when an event moves, and each instance of a recurring event has its own id.
- **Each event becomes a task with id `gcal_<eventId>`:**
  - `startDate` and `durationDays` follow the event; all-day ends are exclusive, and timed events use the calendar's time zone.
  - `calendar: { eventId, time?, location?, link? }` holds the event details; `link` is the event's own Google Calendar page (`htmlLink`).
  - New tasks get the list's copied fields, `priority: 2`, `status: "todo"`, and `createdBy` set to the bot.
- **The sync owns `title`, `startDate`, `durationDays` and `calendar`.** Updates use an update mask limited to those fields, so status, notes, priority, assignee, `for` and dependencies set in Align survive.
- **Time zone:** times and dates use the `TIME_ZONE` script property, or else the script's zone from `appsscript.json`. They never use the calendar's own zone setting: the family calendar turned out to be set to UTC, which showed 4 PM events as 8 PM.
- **Removals:** an imported task whose event is gone is deleted only if its date falls inside the sync window (7 days back to 8 weeks ahead). Tasks family members add to the list by hand are never touched.

### 5.8 Pick lists (`lists` kind `picks`)

What to watch / play / read: a list (kind `picks`, `pickKind`: shows, movies, theater, music, books, games, other) whose items are task docs in `listItems` with `ratings: { uid: 1..5 }` and `watched: ['YYYY-MM-DD', …]`, plus the usual details and comments.
- **Ratings:** any member who can see an item may set (or clear) only their own stars and add / remove watched days, even when only the owner edits the list (a separate task update rule). View-only accounts see ratings but don't rate.
- **Tonight** (`utils/picks.ts` `rankPicks`): for the people ticked as here (remembered per list per device), score = 0.6 × average + 0.4 × lowest, unrated counting as 3 ("least misery"). Watched in the last 30 days: left out ("resting"); within 180 days: up to a star lower, fading back. Top 3 shown; **Pick for us** (`pickOne`) is a weighted random choice among the top 5 (score² + 0.25); "✓ Watched tonight" records the day.
- The list itself sorts by Tonight, Rating, Newest or A–Z. Tapping a title opens the usual entry panel with your stars, everyone's ratings and the watched days.

### 5.9 Flashcards (`lists` kind `cards`)
Items are cards: title = front, notes = back, plus `results: { uid: { known, right, wrong, last } }` (each person's own; any member who can see the set may write only their own, like pick-list ratings). The page opens on Study; the card list (with your ✓ / ✗) folds under “Cards (n)”, and its Edit shows the add / import form plus Export and Edit list (an empty set opens ready for adding). Study in order, shuffled (a short shuffle animation), or only ones not known yet; Show answer → Got it / Not yet; a summary offers the missed ones again; Start over clears your results. Import from pasted text or a file: `front | back`, tab-separated, `Q:`/`A:` lines, JSON, or YAML (`front`/`back`, `q`/`a`, `term`/`definition`, or `cards:`); the YAML reader (js-yaml) loads only when needed (`utils/flashcards.ts`, tested).

### 5.10 Contacts (`lists` kind `contacts`)
Items are people: title = name, `contact: { phones[], emails[], addresses[] (each { label: mobile|home|work|other, value }), org, jobTitle, birthday }`, plus notes / links / pictures / comments. The list page searches name, company, numbers (digits too), emails and addresses, with one-tap call / text / email; the panel's view links phones (`tel:`, and `sms:` to text), emails (`mailto:`) and addresses (Google Maps). Import: vCard (.vcf: Google, Samsung, iPhone, Outlook) or Google / Outlook CSV; duplicates within the file and against the list are merged (same name, email, or last-10-digit phone), so importing each source consolidates them. Export: vCard 3.0 (`utils/contacts.ts`, tested). Rules: kind `contacts`, `contact` map. `contact.tags` (free words, several per person; `cleanTags`, starter suggestions incl. Christmas List) come from vCard `CATEGORIES`, Google `Labels` and Outlook `Categories`, merge on import, and export. Filters (`ContactTags.tsx`): list and tag chips, All by default, remembered per device; any chosen tag matches, plus No tag. With a search or filter on, Export saves those people as vCard or CSV (`contactsToCsv`: one row each, for mail merges). Today has a folded Contacts section (`ContactsStrip`) with the same filters; a tag alone lists everyone with it; 8 shown, then Show all; “All contacts” opens the list page.

### 5.11 Family map (`locations/{uid}`)
One document per person sharing: `{ lat, lon, acc, batt, tst (ms), trail: [{lat, lon, tst}] (24 h, ≤100), off, updatedAt }`. OwnTracks on each phone posts (HTTP mode) to the Apps Script web app with `?loc=<uid>.<HMAC>`; `location_` checks the signature (LOCATION_SECRET or VOICE_SECRET) and writes as the helper account. Align gets the key from the script (`action: 'locationKey'`, after checking the ID token and membership) and offers a one-tap `owntracks:///config?inline=` setup link. `#/map` (`FamilyMap`, Leaflet loaded lazily, OpenStreetMap tiles) shows pins (faded after 2 h), accuracy, trail, Directions, and your own Set up / Pause / Delete. Rules: members read; the person writes (pause/resume) or deletes theirs; the helper (`bot: true`) may write a member's only while `off == false` and can't change `off`. Setup: `scripts/location/README.md`.

### 5.12 Gift lists (`lists` kind `gifts`) and related notes
A gift list is for one person: `recipientId` (a member, incl. yourself for a wish list) or `recipientName` (anyone else). Made for another member, a new list starts **hidden from them** (shared with every other member; the editor says so, and adding them under Who can see it shows it); then the page drops the secret-idea option, since the whole list is a surprise. Made by the recipient (a wish list), it's seen by the family, who claim and add secret ideas. Items are entries with `gift: { qty, color, size }`, details in `notes`, links / pictures as usual. **Secrecy is in the rules, not the app:**
- **Secret ideas** live in a hidden companion list (`giftSecret: true`, `secretOf: <gift list>`, shared with every member except the recipient; the rules refuse a companion whose `sharedWith` includes them). Others see it merged into the gift list (badge "secret idea"); it's never in the menu.
- **Who claims:** any household account, view-only ones too (an extended family coordinating gifts); secret companions and lists hidden from a recipient are shared with every account but theirs, viewers included. `sharedWith` allows up to 50 people (was 20). View-only accounts may also add ideas (rules `viewerGiftList`): always to a secret companion (they may create it), and to the list itself unless its editAudience is narrower than Family / Everyone; they change or remove only ideas they created (`ownGiftIdea`), may store pictures, and get no writes anywhere else.
- **Claims** are `giftClaims/{itemId}_{uid}`: `{ listId, itemId, recipientId (uid or "name:…"), claimedBy, title, qty, bought, note }`. Read by household accounts except the recipient (queried `where recipientId == <recipient>`); written only by the claimer, for an item of that list, with the list's real recipient, never by the recipient. One claim per person per item; quantities add up (`claimState`).
- Comments on a gift idea are visible to the recipient (the panel says so); claim notes are for surprises.
Today → **Gifts** (`GiftsStrip`): what you're getting (tick Bought) and each list's open count. `utils/gifts.ts`, `firebase/gifts.ts`, tested.

**Related notes** (`noteIds`, ≤10, any task or item): link notes you keep (sizes, brands, paint colors) instead of copying them. `RelatedNotes` shows each opening in place; `NotePicker` in the edit forms warns when a note is seen by fewer people than the entry.

### 5.7 `images/{imageId}` (pictures stored in Align)

```ts
{ data: "data:image/jpeg;base64,…",  // ≤ 1,000,000 characters (longest side ≤ 1600 px, JPEG quality stepped down to fit)
  width: number, height: number, createdBy: uid, createdAt }
```

- Added from any details section (**+ Add a picture**): the phone's own picker (photo library, camera or files) → `PictureEditor` (Original / Square / 4:3 / 3:4 / 16:9, drag to position, zoom, rotate) → `addImage` (returns the id at once, like `addTaskNow`). Entries keep `"align-image:<id>"` in `images` beside ordinary addresses (`utils/pictures.ts`); `<Picture>` shows either, and `PictureLightbox` shows one full screen.
- **HEIC** (iPhone / some Android photos): the browser's own decoder is tried first (Safari opens HEIC); otherwise `heic-to` (LGPL, loaded only for HEIC files, ~3 MB, its own chunk) converts it to JPEG in the browser. Other unreadable files get a message naming the file and its type.
- **Access:** any household account can `get` one by id, nobody can `list` the collection, so a picture is reachable only through an entry you can see. Never updated; the person who added it can delete it. Removing a picture and saving, or deleting a task / list / goal, deletes the stored pictures you added (`deleteRemovedImages`).
- **Free tier:** about 150–300 KB a picture against Firestore's 1 GiB, so a few thousand pictures. Cloudinary is now used only as the blog's temporary upload step; pictures uploaded to Cloudinary from Align before this keep working as addresses.

### 5.6 `goals/{goalId}`

Daily goals (not tasks): shown on each day they apply, logged per day, charted over time.

```ts
{
  name: string,
  kind: "check" | "tally" | "progressive" | "measure" | "total",
  unit?: string,                                 // "$" / "€" / "£" / "¥" are written in front ("$350")
  perDay?: number,                               // tally: taps per day (e.g. 8 glasses)
  progression?: { start, step, every, per: "day" | "week", min?, max?, from: "YYYY-MM-DD" },  // progressive; step < 0 goes down
  target?: number,                               // measure: fixed target; progressive: the goal it stops at; total: the amount to reach
  direction?: "down" | "up",                     // measure (lower / higher is better)
  weekdays?: number[],                           // 0 = Sunday; absent = every day
  visibility, sharedWith?, audience?, ownerId, viewerVisible, // WHO CAN VIEW: same five choices as lists
  editAudience?: "private" | "parents" | "family" | "shared" | "everyone",  // WHO CAN LOG (default private)
  editors?: uid[],                               // for Parents / Chosen people logging: owner + those people
  log?: { [day]: { done?, count?, value?, by?, note?, url?, imageUrl? } },  // one entry per day (~20 KB/year)
  archived?: boolean, createdBy, createdAt, updatedAt
}
```

- **Suggested amount** (progressive) on a day = `start + step × floor(days since from ÷ (every × 1|7))`, stopping at `target` (and older goals' min..max) (`utils/goals.ts`). Example: weight, start 200, step −1 every 2 days, goal 169.
- **Met:** check = done; tally = count ≥ perDay; progressive = value ≥ suggestion (≤ when it goes down); measure = at/below (or above) target; total = running total ≥ target.
- **Running total** (vacation savings): each day's `value` is what was added; `addToTotal` uses `increment()`, so several people adding on one day all count. The chart steps up toward the target.
- **View vs log:** viewers see the goal, chart, table and notes, read-only. The rules let the owner change anything; others who can log (`canLogGoal`: Family / Everyone = all members, Parents / Chosen people = `editors`) may change only `log` and `updatedAt`. The editor widens "who can view" to cover everyone who can log (`viewCoveringEditors`), so the normal visibility queries find the goal for them. Goals made before `editAudience` keep the old rule (anyone who could edit them).
- **Grouping** (`goalGroups`, menu ▸ Goals and the Goals page): My goals (only you log), Shared goals (others can log too), then "<Name>'s goals" (view only). The day strip shows only goals you can log.
- **Details:** any day's entry can carry a note, links and pictures (the shared details, as on every entry).
- `logGoal` writes only that day's fields (`log.<day>.…`), so two people logging a family goal don't overwrite each other.

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

- **Views:** Today (the start page, `#/`), Everything (`#/all`), My tasks, Family tasks, Work. They show **tasks only** (never checklist items or notes).
- **Colors** (left edge of each card; a color key is shown at the top):
  - Private = blue 🔒
  - Family = purple
  - Shared (chosen people) = teal 👥
  - Project = green (project lists use green regardless of privacy)
  - Finished (done or canceled) = gray, struck through
- Badges: Work, `for` chips, assignee, 📅 time for calendar events, ⏳ Waiting on …, Unblocks N, ✕ Canceled, conflict ⚠. In mixed views the list badge carries 🔒 / 👥 for non-family lists.
- **Filters:** list, context, `for`, assignee, priority, status (Not done / Any / To do / Doing / Done / Canceled), date range, **Ready to do only** (hides tasks waiting on an unfinished prerequisite).
- **Sort:** date (with clock time for calendar events: all-day, then timed in clock order, then untimed), priority, or dependency order.
- **Today is a day view** (`DayView`, `#/today`; other days `#/day/YYYY-MM-DD` with ‹ ›): the day's **Goals** strip (a summary: status, trend, a pencil to log one goal; **Log all** shows every control, remembered per device; goals not on that weekday greyed as "Not today"), **Family Map** and **Contacts** and **Gifts** (today only), quick add for that day, then **To do** (today: in progress, scheduled/due today, overdue; a past day: what was on for it and is still open, labeled "Not done"), **Done** (finishedOn that day), **Won't do** (canceled that day) and **Pushed to a later day** (pushedFrom includes it, with "→ moved to …"). Rows have ✓, **⏭ next day** and **✕ won't do**; **⏭ Push the rest** is the end-of-day sweep. A push that would move dependents opens the schedule preview (pushedFrom is written in the same batch). Ticking on a past day records it as done that day (`utils/day.ts`). Tasks finished before 2026-10-20 have no finishedOn, so they don't appear on past days.
- Everything / My / Family / Work keep the filters below; a task ticked there stays (grayed) until you leave the view.
- Calendar events that are over are hidden by **Not done**. Dates show the weekday, e.g. "Wed, Oct 7".
- Today's header has **📅 Google Calendar ↗** and **↻ Refresh calendar** (§5.5).

## 9. Chat Commands

The chat panel runs a local, rule-based parser (`src/chat/parser.ts`, dates by `chrono-node`) and executor (`src/chat/execute.ts`). Replies can include quick-action buttons; buttons that open a task or another page (Open it, Go to …, Show board) close the chat so the result isn't hidden under it.

| Command | Example |
|---|---|
| Add | `add task fertilize lawn on Oct 5 to Lawn project for work priority high` · `add milk to Groceries` (works for checklists too) |
| Complete | `done fertilize lawn` (Undo button) |
| Cancel | `cancel fertilize lawn` (Undo button) |
| Move | `move fertilize lawn to Oct 8` (runs a forward shift preview) |
| Meet date | `shift dependencies so apply fertilizer is done by Oct 10` |
| Recalculate | `recalculate lawn` |
| Show | `show board weekend activities` / `show today` / `show work` / `show <list>` |
| Vote | `vote 3 on tacos in restaurants` |
| Text | `text Linda I picked up milk` · `text Linda about pick up Camilla: are you getting her?` |
| Help | `help` |

- Names are matched with fuzzy search. If a match is ambiguous, the reply asks the user to pick one.
- **Add without a list** goes to the user's inbox for their default privacy: their private **Inbox**, or the shared **Family Inbox** (created when first needed). "for <names>" tags people/pets; if none match, the words stay in the title. The reply names the privacy ("Added … to Inbox (🔒 private)").
- **Text** answers with **📱 Send text** (an `sms:` link: Messages opens with the number and text filled in; the user presses Send, so it's a real text and replies come back as texts) and **Copy text**. "about <task>" looks up a task, checklist item or note and adds "Re: <title> (<when>)" plus a `#/task/<id>` link. The recipient's number comes from their own Settings. Viewers may use it too.

## 10. UI

- **TopBar:** ☰ (phone), Align, **+ Quick add** (opens chat with `add task `), Chat, ◐/☀/☾ theme (Match device → Light → Dark, per device), avatar (opens ⚙ Settings), Sign out.
- **Sidebar:** Today, Everything, My tasks, Family tasks, Work; sections My lists / Family lists / Shared lists (task lists), Projects, Checklists, Notes (with 🔒/👥 on non-family names and open/unchecked counts); Voting boards; ⚙ Settings. On phones it's a slide-out menu with a backdrop (tap outside or Escape closes it).
- **List pages by kind:** task list / project (`ListView`: quick add that doesn't open the panel, finished tasks crossed off at the bottom with a remembered **Hide N finished**; projects add **Timeline** and **Recalculate**), checklist (`ChecklistView`: items in the order added, ticked ones crossed off, **Hide N checked**, **Clear checked**), notes (`NotesView`: alphabetical cards with the first lines). The header (`ListHeader`) shows the privacy badge, "with You and Linda" for shared lists, and **Edit list**.
- **Right panel:** `TaskDetails` for tasks (Save in a sticky header next to ✕; privacy sentence under the List picker; dependencies with ✓/✕/⏳ links and a **Needed by** section; Finish-by shift), `ItemDetails` for checklist items and notes. Both have **💬 Text about this**. On phones the panel covers the page and closes after Save or when changing views.
- **Task and checklist rows** have a **💬** at the right end: opens the item with the text form ready.
- **⚙ Settings** (`SettingsDialog`): Default privacy, your mobile number, Parents (read-only unless you may change it), theme.
- **List editor:** name, kind, who can see it (🔒 Just me / 👪 Family / 👥 Chosen people with name chips and a **Parents** shortcut), default context, owner, visible to viewers.
- **Mobile:** BottomNav with Today, My Tasks, Family, Voting, Chat.
- **Viewers** see the same screens, but editing controls are hidden.
- **Links:** hash routes (`src/utils/routes.ts`): `#/today`, `#/all`, `#/mine`, `#/family`, `#/work`, `#/list/<id>[/timeline]`, `#/boards`, `#/board/<id>`, and `#/task/<id>` (opens that task in its list; used in texts).

- **🎯 Goals** (`GoalsView`, `#/goals`; one goal `#/goal/<id>`): log today's goals, open one for its chart (check: day squares with streak; tally: a column per day with the daily goal line; progressive/measure: actual vs suggestion/target, two lines with a crosshair tooltip), 14/30/90/365-day ranges, a table view, a log-any-day box, edit, archive. Logging controls (`GoalControl`): a checkbox, one dot per time (tap the last to take it back), "✓ <suggestion>" or type an amount. Chart colors are the dataviz reference palette slots 1–2 (`--series-1/2`), validated on both themes.
- **Links** (`LinksView`): paste an address (https:// added; only http/https/mailto/tel are clickable, so a `javascript:` address can't run), optional name (defaults to the host) and category; a collapsible tree (closed state remembered per list); **Addresses** / **Notes** switches; ✎ edit; 💬 texts the link's own address.
- **🔍 Search** (top bar, or `/`): tasks, checklist items, notes, links and list names (`utils/search.ts`). **Keyboard (desktop):** `/` search, `n` quick add, `t` today.
- **Home-screen install:** `public/manifest.json`, icons (`icon-192/512`, maskable, `apple-touch-icon`), `theme-color`; opens full screen at `#/today`. No service worker (nothing is cached offline).
- **✍ New blog post** (`#/blog`, §10.2).

### 10.2 Blog posting

`BlogPostView` replaces the old `blogupdate.html` flow inside Align:
- Same post shape (title, date, author, categories, tags, up to 6 text+photo blocks, YouTube id, closing text, quote) and the same `repository_dispatch` "new-post" body (`src/blog/post.ts`, tested against blogupdate's), sent to the blog repo's `process-blog-post.yml` Action, which renders the post, makes image sizes, uploads them to Turbify and commits (about 2 minutes).
- Photos go through the same Cloudinary upload widget and unsigned preset (`src/blog/cloudinary.ts`, loaded on demand).
- **The GitHub token** (fine-grained, only the blog repo, Contents read+write) is entered once per device in ⚙ Settings → Blog posting and kept in `localStorage` (`align-github-token`), never in Firestore or the code. Settings tests it.
- After posting: the post's address (`/<categories>/YYYY/MM/DD/<slug>.html`), **Open post ↗**, and **💬 Text the link**. The blog's top nav has **✍ Post** linking here.
- The old `turbify_only/blogupdate.html` and `image-rotation.html` (blog repo, git-ignored, served from Turbify) no longer contain a token: they ask once and keep it in that browser.

### 10.3 Favorite photos (psort)
psort's `publish-browse` puts the family's starred, non-private photos on Turbify for the blog's photo browser: web sizes at `https://www.itsallonesong.com/pics/browse/<size>/<id>-<size>.jpg` and `browse-manifest.json` (id, taken_at, people's names, event, top). psort's `.htaccess` lets the blog read the manifest, and lets Align read it too, but only for requests from Align. Align only reads it (`src/photos/favorites.ts`, loaded once per session):
- **📷 Photos** (`#/photos`): a searchable grid (names, years, months, events; Top picks), a larger view, **Full size**, and **Text this photo** (sends the 2048px image link). It also links to the blog's photo browser.
- **On this day** on the day view (`photosForDay`): favorites from the same date in earlier years ("6 years ago"); if none, **Near this day** (the nearest date within a week, wrapping at New Year); if still none, **From the archive** (3 picked at random, the same pick all day). Hide lasts for the rest of the day (`useDailyFlag`). It doesn't show if the list can't be reached.
- **From favorites** next to Upload in the blog composer (the 2048px copy; the blog's Action downloads it like a Cloudinary upload; alt text starts as the caption) and in every note/link/picture box (goal entries, voting items; the 1024px copy).
- Dev servers (localhost) aren't allowed to read the manifest, so browser tests serve a copy with `page.route`.

### 10.4 Help
- **One source:** `src/help/topics.ts` has a topic per part of Align (Getting started, Today, Lists and tasks, Who can see it, Notes/links/pictures/comments, Texting, Goals, Photos, Voting, Blog, Google Calendar, Chat, Settings, About), each with a short `tip` and a longer `body`. **Update the topic when the feature changes.**
- **ⓘ tips** (`UI/HelpTip`): beside section and page headings, the privacy pickers, Settings, the comments heading, chat and the calendar buttons. Tap for the tip; "More in Help →" opens the topic. Stays on screen (fixed position); closes on tap elsewhere, scroll, or Esc.
- **Help page** `#/help` / `#/help/<topic>` (menu → Help & about): contents chips, every topic, the chat's own command examples, and About with the build's commit and time (`__BUILD_COMMIT__`, `__BUILD_TIME__` from vite.config.ts).

### 10.5 The Daily
On Today, between On this day and To do (folded each morning; `components/Daily/TheDaily.tsx`). Each item is a `RevealCard` (something first, the answer or more after a tap).
- **Built in** (`src/daily/content.ts`, the same for everyone each day): word of the day, a quote (only well-sourced ones), something to think about, a science question, a riddle. **Math puzzle** made from the day and a grade 1–8 (`src/daily/math.ts`, tested).
- **Fetched** (`src/daily/sources.ts`, free sites a browser may read, no keys; once a day per device in localStorage; hidden if a site is down): a joke (JokeAPI safe mode, else icanhazdadjoke), a space picture (NASA image library; NASA's APOD API only returned a placeholder logo in Oct 2026), Wikipedia's picture of the day, and an iNaturalist animal photo (guess, then reveal).
- **Chess:** an easy mate-in-one from Lichess (`/api/puzzle/next?angle=mateIn1&difficulty=easiest`, browser-readable; `chess.js`, loaded only for this, turns the game into a position and the answer into notation) on a drawn board, plus a built-in chess lesson. **Poker odds** (Texas Hold'em) are built in (`src/daily/poker.ts`).
- **Mini Philosophy:** one of Jonny Thomson's short videos (YouTube @philosophyminis) a day, from `src/daily/miniPhilosophy.json`; YouTube doesn't let a browser read the channel, so refresh the list with `node scripts/update-mini-philosophy.mjs` (keeps old videos, adds new).
- Settings → The Daily (this device): which items show, and the math grade. A daily script (e.g. the Apps Script writing a `daily/<date>` doc) is only worth adding for a source that needs a key or blocks browsers.

### 10.6 Import / Export (`utils/transfer.ts`, `Tasks/ListTransfer.tsx`, on every list's header)
One file is one whole list.
- **Notes:** Markdown, each note a `## Title` section (import also reads `# Title` sections, `title:` / `note:` blocks, JSON, or a plain file = one note named after the file).
- **Links:** Markdown with categories as nested headings (`## Home` → `### Utilities` = Home/Utilities), `- [Name](url) — note` items; import also reads indented bullets and bare addresses. Or the browser bookmarks file (Netscape format) both ways; the browser's own top folder ("Bookmarks bar"…) is dropped, addresses already in the list are skipped, and an optional "put them under a category" prefixes everything.
- **Checklists, task lists, projects:** Markdown checklists (`- [ ]` / `- [x]`, notes indented); projects add `{start YYYY-MM-DD, N days, due YYYY-MM-DD, after: A; B}`, so a project round-trips with its schedule and dependencies (matched by title). **Flashcards** export as YAML (import is in the set itself). Pick lists aren't exported.

### 10.1 Folder structure

```
src/
  components/
    AppShell/      AppShell, TopBar, Sidebar, BottomNav, MainView, SettingsDialog, SearchDialog, ThemeToggle
    Tasks/         DayView, CombinedView, ListView, ChecklistView, NotesView, LinksView, ListHeader, ListEditor,
                   SharePicker, TaskCard, TaskDetails, ItemDetails, TextAbout (TextForm), CalendarActions, NumberField
    Goals/         GoalsStrip, GoalsView, GoalDetail, GoalControl, GoalEditor, GoalChart
    Blog/          BlogPostView
    Dependencies/  TimelineView, ShiftDialog
    Voting/        BoardsView, BoardView
    Chat/          ChatPanel
    Auth/          SignIn, Setup, NotAuthorized
  engine/          dates.ts, graph.ts, scheduling.ts (+ tests)
  chat/            parser.ts (+ tests), execute.ts
  voting/          tokens.ts (+ tests)
  firebase/        config.ts, auth.ts, db.ts (all Firestore access), calendarSync.ts
  blog/            post.ts (+ tests), github.ts (token per device), cloudinary.ts
  context/         DataProvider (live data: tasks, listItems, dependents…), AppContext, Session*
  hooks/           useApp, useHashRoute, useSession, useStoredFlag, useVoting
  utils/           tasks.ts (filters, privacy, finished/waiting), day.ts (day buckets, push), goals.ts, links.ts,
                   search.ts, text.ts (texting), calendar.ts, theme.ts, routes.ts, fuzzy.ts (+ tests)
scripts/           deploy-turbify.sh, seed-emulator.mjs, apps-script/ (calendar sync + README)
tests/             rules/ (security rules), apps-script/ (unit + emulator run)
firestore.rules, firestore.indexes.json
```

## 11. Security Rules (outline)

`firestore.rules`, tested in `tests/rules/` (36 tests) against the emulator.

- `isMember()` means `household/main.members[uid].role == "member"`. `isViewer()` means `"viewer"`.
- **`household/main`:**
  - Members and viewers can read it. Any signed-in user may `get` it only while it doesn't exist, and `create` it then (first-time setup).
  - Members can update `pets`, `weeklyTokens`, `groups`, and **their own** member entry's `displayName`, `color`, `defaultVisibility` (private/family) and `phone` (string ≤ 24). Never roles.
  - `groups.parents` (`parentsChangeOk`): anyone may set it while it's empty; after that only someone already in it may change it.
- **`lists` and `tasks`** (tasks carry copies of their list's fields; checked against the list with `getAfter()`, so a list + its tasks can change in one batch):
  - read: `private` → owner; `family` → members, or viewers if `viewerVisible`; anyone (member or viewer) whose uid is in `sharedWith`.
  - write: members, if `family`, or owner, or in `sharedWith`. Only the current owner may hand a list to someone else.
  - `sharedOk`: `sharedWith` exists **if and only if** visibility is `shared`, has 1–20 entries and includes the owner. Because only shared docs have it, "shared with me" is the single query `where('sharedWith','array-contains',uid)`.
  - Lists: `kind` in list/project/checklist/notes/links. Tasks: valid status (incl. `canceled`), priority, context, duration, `dependsOn` list, optional `calendar` map, `finishedOn` (10-char string), `pushedFrom` (list), `url` (≤ 2048), `category` (≤ 200), and copied fields equal to the list's (incl. `sharedWith`).
- **`goals`** (`validGoal`): same read/write and owner-change rules as lists (private/family/shared via `canRead`/`canWrite`/`sharedOk`); `kind` in check/tally/progressive/measure; name 1–100 chars; `log` a map; `weekdays` a list.
- **`boards` and `items`:** members can read and write (items may carry `note` ≤ 5000, `url` and `imageUrl` ≤ 2048). Viewers can read if the board is `viewerVisible`.
- **`comments`** (on a board or an item): readable by anyone who can see the board; members create with their own `uid`, and edit or delete only their own (`validComment`: text 1–2000).
- **`votes/{uid}`:** members can read; users write only their own document, `tokens` a whole number ≥ 0.
- Everything else is denied.
- **Queries must match the rules** (`visibleQueries` in `db.ts`, for lists, tasks and goals): members query own private docs, family docs and shared-with-me docs; viewers query viewer-visible family docs and shared-with-me docs.

## 12. Development and Deployment

- **Environment:** WSL Ubuntu 24.04, Node via nvm, GitHub `stevenelson35/align` (SSH remote), Firebase project `align-a32c1` (Spark), Turbify hosting.
- **Local development:** `npm run emulators` + `npm run seed` + `npm run dev` (see CLAUDE.md / README).
- **Tests:** `npm test` (unit: engine, tokens, parser, utils, Apps Script helpers), `npm run test:rules` (starts its own emulators; don't run it while `npm run emulators` is up), `npm run test:calendar` (needs emulators + seed running).
- **Deploy order matters when the rules change: rules first, then the web app.** Otherwise the new app's writes are rejected by the old rules.
  - Rules + indexes: `npm run deploy:rules` (targets `--project prod` = `align-a32c1`; needs `firebase login`).
  - Web: `ALIGN_FTP_DIR=/align.itsallonesong.com npm run deploy:web` builds and uploads `dist/` over explicit FTPS with lftp. **It prompts for the FTP password**, so the user runs it in their own terminal (a `!` command in Claude Code can't answer the prompt; the script now says "No password entered" instead of exiting silently).
  - Calendar sync script: pasted into the Apps Script editor by the user; web app updates via **Deploy → Manage deployments → edit → New version** (keeps the URL).
- **Verify a web deploy:** fetch https://align.itsallonesong.com/, read the `assets/index-*.js` name, and grep that bundle for a string from the latest change.

## 13. Status & Handoff

### 2026-10-23 (wall view, adoptable pets, Alexa voice): built, tested, NOT yet committed
- **Wall display** `#/wall` (menu → Wall display): full-screen, read-only time / date, today's calendar (+ tomorrow), to-dos, goals with status and sparklines, and a family photo that changes each minute; live data, midnight rollover, Screen Wake Lock where supported. Meant for an Echo Show's Silk browser or a spare tablet.
- **Adoptable pet** in The Daily from RescueGroups.org (free key; CORS allowed) within 25 miles of Winter Park 32789; the key lives in `config/integrations` (household-only; Settings → Adoptable pets). Without a key: a card with links to Pet Alliance of Greater Orlando, Orange County Animal Services, Petfinder and Adopt-a-Pet. (Petfinder reportedly stopped issuing API keys.) Rules: `config/{doc}` + test.
- **Alexa voice** (`scripts/alexa/`): an Alexa-hosted skill ("Alexa, ask sir georgie to add …" / "…what's on today") posts `{voice, secret, action, text}` to the Apps Script web app; `voice_` in calendar-sync.gs checks `VOICE_SECRET` and adds to the Family Inbox (due today), or to the family list named after a final "to" / "on" ("milk to groceries": `voiceTarget_`, a task list, project or checklist, no date), or reads today. Setup steps in `scripts/alexa/README.md`; the user pastes the new script and creates the skill.
- **Deploy the rules before the web app.** Tests: 139 unit, 44 rules.

### 2026-10-23 (contacts, pet tips, help fixes): built and deployed (`d333829`, rules deployed)
- **Contacts** (§5.10). **Deploy the rules before the web app** (new kind and `contact` field).
- The Daily: Pet Health tip (built in; vet guidance incl. Florida specifics) and a dog / cat fun fact (dogapi.dog / catfact.ninja).
- Help: Today's heading shows the Today topic, To Do (and Also show) its own To Do topic, Archive Pics its own topic (others checked).
- The breadcrumb's section link scrolls that section to the top of the menu (as far as it can).
- Tests: 136 unit, 43 rules.

### 2026-10-23 (import / export): built and pushed (`1722edd`)
- Import / Export on lists (§10.6). Showing To Do's color key also opens the To Do list (hiding the key leaves it). Pin wording says "only you see it" (pins were already personal). No rules change. Tests: 131 unit.

### 2026-10-23 (decks, Title Case, chess, poker, Mini Philosophy): built and pushed (`70adf8a`)
- `samples/flashcards/`: seven decks (state ↔ capital, country → capital, country → continent, U.S. city → state, world city → country, Texas Hold'em odds) built by `make_decks.py`; `tests/samples/sampleDecks.test.ts` (part of `npm test`) checks they all import.
- Today's headings in Title Case ("Archive Pics" for the archive photos, "To Do", "Won't Do", "Pushed to a Later Day", Daily labels).
- The Daily: chess puzzle and lesson, poker odds, Mini Philosophy video (§10.5). No rules change. Tests: 123 unit.

### 2026-10-23 (The Daily, flashcards, breadcrumb): built and deployed (`bcea1ec`, rules deployed)
- **The Daily** (§10.5) and **Flashcards** (§5.9), sharing `RevealCard`.
- **Breadcrumb** on list pages ("Menu › Links › Art"): Menu opens the ☰ menu, the section name opens it with that section expanded (`openMenu`, `utils/menu.ts` `menuSectionOf`, also used by the menu).
- Measure goals' "better is" now defaults from the unit (lower for lb / kg / $ / calories, else higher); the user's Walking goal was set to "lower" by the old default.
- Rules: kind `cards`, `results` map, and results in the rate / watched update path, plus a test. **Deploy the rules before the web app.** Tests: 121 unit, 43 rules.

### 2026-10-23 ("Align Updates" round 2): built and pushed (`76c698f`)
- No family name in what ships or is public: the manifest, About, setup default and test data say "our family"; the top bar no longer shows the household name; real names in source and tests replaced with Sam / Alex / Lee (the repo is public). Older docs and git history still mention them.
- **New tasks without a date** (list quick add, chat): due the day added, so they show on Today, unless Settings says "no date" (`members[uid].newTaskDue`; rules + test).
- **Goal status** (`goalStatus`): none / "4 to go" / Done / "+3 extra"; lower-is-better single measurements say "1.2 lb to go" / On target / "0.8 lb ahead"; totals "… to go" / Reached. Count-up goals (`accumulates`) get "+ more" and Reset.
- Today: "Also show" lists everyone (with counts, 0 included); To do / Done / Won't do / Pushed fold by tapping their titles (`align-day-hidden`); On this day has an "All" photos shortcut.
- Quick adds take "Title: note" (`splitTitleNote`; a time like 3:30 stays in the title).
- Note boxes in edit forms grow to fit their text (`AutoTextarea`, up to 60% of the screen).
- **Deploy the rules before the web app** (they also include the not-yet-deployed `a296af2` changes). Tests: 115 unit, 43 rules.

### 2026-10-22 (pinned links): built and pushed (`a296af2`), rules NOT yet deployed
- **Pin to my menu** for links (when adding, in Edit, or Pin / Unpin on the link's page): a shortcut in your own ☰ menu, under the blog link, that opens the site in a new tab. Stored per person as `household.members[uid].pinnedLinks` (≤ 30 link ids), so it follows you to every device; links you can no longer see drop out. Rules + test.

### 2026-10-22 (pick lists): built, tested, NOT yet committed
- **Pick lists** (§5.8): a new list kind for shows, movies, theater, music, books, games or other; 1–5 stars per person; Tonight with who's here, top 3, Pick for us, and watched days that rest a title for a month. Menu section "Pick lists"; help topic `picks`.
- Rules: kind `picks`, `pickKind`, `ratings` map, `watched` list, and the rate / mark-watched update path, plus a test. **Deploy the rules before the web app.** Tests: 112 unit, 42 rules. Playwright with three accounts.

### 2026-10-22 (help fixes, timer add, Datatype, who can edit): built, tested, NOT yet committed
- Help page: topic chips scroll to their topic (route changes within Help no longer scroll to the top), the chip row stays pinned under the top bar, and the highlight follows the section in view. Topics added for task views, projects, checklists, notes and links; list pages show their own kind's tip.
- Goal timer: "Add 12.5 min" adds the time to the day's entry and resets, so several walks add up (totals: adds to the running total).
- Settings → Goal mini charts: Lines (default) or the Datatype font (`@fontsource-variable/datatype`, OFL; ~70 KB, downloaded only when used; nothing shows until the font has loaded). Check = bars, tally = bars, progressive / measure = sparkline, total = pie.
- **Who can edit** on lists (`editAudience` / `editors`, copied onto tasks like the other privacy fields): absent = anyone who can see it edits (as before). Rules `canWrite` now checks it (and requires being able to see); only the owner changes it. Today shows what you can edit; "Also show" chips add others' view-only tasks (per person or Everyone, remembered). View-only accounts are unaffected.
- **Deploy the rules before the web app.** Tests: 109 unit, 41 rules. Playwright at 390px with two accounts.

### 2026-10-22 (help): built and pushed (`940d561`)
- Help & about page plus ⓘ tips throughout (§10.4). Settings closes when you go to another page (e.g. "More in Help"). No rules change. Tests: 105 unit.

### 2026-10-22 (passwords): built, tested, NOT yet committed
- **Forgot password?** on the sign-in screen sends Firebase's reset email (free; wording in Firebase console → Authentication → Templates). Same message whether or not the address has an account.
- **Settings → Password → Change password:** current password (checked first, which Firebase needs anyway), new one twice, at least 8 characters.
- No rules change. Tested on the emulators (reset email recorded; wrong current password refused; new password works, old doesn't).

### 2026-10-22 (consistency): built and pushed (`ac61878`)
- Section titles with Show / Hide (Goals, On this day / From the archive) toggle when tapped (`SectionHeader onTitleClick`).
- To do's color key starts shown and remembers being hidden (`align-color-key-shown`).
- No big purple buttons: inline add / send buttons are outline icon buttons (`.icon-button`: chat Send, Add board, Suggest, checklist / notes / links / list quick adds, comment Post); dialog and form actions use the compact size (Save, Create, Publish, Apply, Use picture). The sign-in and first-time setup screens keep their full-size button.
- No rules change. Tests: 103 unit.

### 2026-10-22 ("Align Updates" list): built and pushed (`21d78eb`)
The user's own task list "Align Updates" (in Align) held 8 requests; all were done:
- Top bar: the purple "+" became a plain chat-bubble-plus icon (Quick add in chat), like search and theme.
- Day view To do: "+ Add" in the heading opens the add box (stays open for several adds; Esc closes); its submit is an outline ＋ icon button. A swatch next to the count shows the color key (`ColorKey`, shared with the task views). "Push the rest" is now "Push rest" (full wording on hover) so the heading fits a phone.
- Task editor: "+ New list…" in the List chooser and "+ New checklist…" for Add an item (`NewListInline`; your default who-can-see).
- Goals: a sparkline per goal row (`GoalSparkline`: last 14 days, dashed target, dot on the last value; tap for the chart); number boxes in the goal editor can be cleared and retyped (`NumberField` now takes decimals / negatives); an optional **timer** per number goal (`timer: true`; `GoalTimer`: start / pause / reset, Use puts the time in the entry box, keeps running on the device); shared goals show who else logs them ("(with Linda)", `otherLoggers`) and Today lists your own goals first.
- No rules change. Tests: 103 unit, 40 rules. Playwright at 390px.
- Reading the list used the Firebase CLI's sign-in (the user allowed it); marking the tasks done was blocked by the permission check, so the user ticks them.

### 2026-10-21 (entry views): built and deployed (`d8ac8a5`, rules deployed)
- **Every entry opens as a view, with Edit** (tasks, checklist items, notes, links in the side panel via `EntryPanel`; voting items inline): title, facts (status, when, who, list and who can see it, what it waits on), then the **common block** `EntryExtras`: note (sized to its text), links, pictures, **comments**, **Text about this**. Save returns to the view; Cancel leaves the form. The goal page has the same block (goal comments).
- **Comments on any entry** (`commentThread` in db.ts: boards, voting items, `tasks/{id}/comments`, `goals/{id}/comments`); each comment has a 💬 that opens Text about this with the comment as the message. Rules: whoever can see the task / goal reads; members who can see it write; edit / delete own. Plus a test.
- **Links have a name and an address** (`{ url, label? }`; bare addresses saved earlier still read). Views show the name (opens in a new tab) with Show address(es).
- **Section headings** (`SectionHeader`): icon tile, title, count pill, actions on the right — Goals, On this day / Near this day / From the archive, To do / Not done, Done, Won't do, Pushed, and the voting board's Discussion.
- **Deploy the rules before the web app.** Tests: 101 unit, 40 rules. Playwright at 390px.

### 2026-10-21 (HEIC): built and pushed (`cdb8bf2`)
- Day view: **Goals** has Show / Hide and starts hidden each morning; **On this day** starts shown each morning. A change lasts for the rest of that day on that device (`useDailyFlag`, keys `align-goals-hidden`, `align-on-this-day-hidden`).
- The picture editor converts HEIC photos (the user hit "That file isn't a picture this browser can open" on the live site). No rules change.

### 2026-10-21 (stored pictures): built and deployed (`c709097`, rules deployed)
- **Pictures are stored in Align (Firestore), not Cloudinary** (§5.7): the phone's own picker, a built-in crop / rotate editor, full-screen view, and cleanup when removed or deleted. Blog posts still upload through Cloudinary (its Action copies them to Turbify).
- Menu: **Travelin' On blog** link (opens blog.itsallonesong.com in a new tab) under New blog post and Photos.
- Rules: `images/{id}` (get by id for the household, no list, create own ≤ 1 MB data URL, delete own), plus a test. **Deploy the rules before the web app.**
- Tests: 101 unit, 39 rules. Playwright at 390px: upload + crop + rotate (186 KB stored), another family member sees it, remove deletes it, voting item full-screen view.

### 2026-10-21 (on this day fallback): built, tested, NOT yet committed
- On this day falls back to Near this day, then From the archive (§10.3). No rules change. Tests: 98 unit.

### 2026-10-21 (details): built and deployed (`a556ee7`, rules deployed)
- **The same details on every entry** (`utils/details.ts`, `components/UI/Details.tsx`): a note, up to 10 links ("+ Add link", ✕ each) and up to 10 pictures (Upload / From favorites / paste an address; ✕ each). Used by voting items, goal entries, tasks, checklist items, notes and links. Stored as `links` / `images` arrays; the older single `url` / `imageUrl` on items and goal entries read as the first of each and are cleared on the next save. A task's `url` stays its own address (links-list item, "Read:" task), so its `links` are extras. Rows show link / picture marks (`DetailsMarks`).
- **Text about this everywhere:** voting items (link `#/board/<board>/<item>` opens and scrolls to the item, closed ones too) and goals (`#/goal/<id>`), as tasks, items and photos already had.
- Rules: `links` / `images` lists (≤10) on tasks and voting items, plus a test. **Deploy the rules before the web app.**
- Tests: 97 unit, 38 rules. Playwright at 390px.

### 2026-10-21 (photos): built and pushed (`72b1ab9`; psort `dbd94e2`)
- **Favorite photos from psort in Align** (§10.3): Photos page with Text this photo, On this day on the day view, From favorites in the blog composer and in note/link/picture boxes. No rules change. Blog photo boxes no longer overflow on phones.
- **psort** (separate repo): `publish-browse` writes an `.htaccess` that also lets Align read the manifest. The user needs to run `psort publish-browse` once to upload it; until then Align's photo features stay empty (On this day hides itself).
- Tests: 95 unit, 37 rules. Playwright at 390px with the manifest served by the test.

### 2026-10-21 (later): built and deployed (`b595580`)
- **Five privacy choices everywhere** (§5.2): Only me · Parents · Family · Chosen people · Everyone, through one `AudiencePicker`; default Everyone (lists, goals, Settings "Who can see new things", inbox / reading list, new voting boards). No "grandparents" wording anywhere; boards offer Family / Everyone.
- **Goals: who can view vs who can log** (§5.6): two pickers (view default Everyone, log default Only me); others see progress read-only; menu ▸ Goals groups goals (My / Shared / <Name>'s). Only the owner changes a goal's settings.
- **Progressive toward a goal** (down or up, stops at the goal; the axis doesn't start at 0 for decreasing goals; no suggestion before the start date) and a **Running total** kind (Add amount, several people, stepped chart vs target).
- **Note, link or picture on any goal day** (shared `Details` component, also used by voting items); table column with indicators; view-only people get a "Notes and pictures" list.
- **Icons default to Outline** (Emoji is still a choice). New drawings: parents, everyone (globe), photo.
- **📷 Photos** in the menu opens the blog's photo browser (psort's published favorites, https://blog.itsallonesong.com/browse.html).
- Rules: `total` kind, `editAudience`, `editors`, `canLogGoal`; non-owners may change only `log`; defaultVisibility parents/everyone. **Deploy the rules before the web app.**
- Tests: 92 unit, 37 rules. Playwright at 390px with three accounts (owner, a co-logger, a view-only account).

### 2026-10-21: built and deployed (`201927e`)
- **Faster start:** `index.html` holds a static outline (top bar + placeholder blocks, theme-aware, inline CSS) that shows before any code downloads; `AppSkeleton` reuses it while the session and first data load. Firestore uses a **persistent device cache** (`persistentLocalCache`, multi-tab), so later opens show the last data at once; **Sign out** terminates Firestore and clears the cache, then reloads.
- **Menu sections collapse** (`Sidebar` `Section`): one open at a time, remembered (`align-menu-open`); a collapsed heading shows its count and is highlighted when the current page is inside it.
- **Quick adds clear at once** (`addTaskNow` returns the id immediately; `createTask` still awaits): repeated taps on a slow connection had added one link 6 times. Links also refuse an address already in the list.
- **New pages start at the top** (AppShell scrolls window and main panel on route change).
- **Reading list:** adding a link can also make a "Read: <name>" task (`linkId`, `url`) in the "Reading list" task list (created on first use, default privacy) or any task list; links show 📖 to read / ✓ read; tasks with a `url` show ↗ and "Open the link". Rules + test for `linkId`.
- **Voting items:** editable title plus optional note, link and picture (`note`/`url`/`imageUrl`; pictures via the blog's Cloudinary widget or a pasted address); tap an item for details and **comments**; each board has a **Discussion**. Comments live in `boards/{b}/comments` and `boards/{b}/items/{i}/comments` (members write their own, edit/delete only their own; anyone who can see the board reads). Rules + tests. Phone layout of vote rows fixed (title keeps room; buttons wrap below).
- Tests then: 85 unit, 36 rules. Playwright at 390px, plus the startup outline checked on the production build with the JS held back.
- **Icon styles** (⚙ Settings → Icons, per device, `align-icons`): Emoji, Emoji gray, Outline, Solid, Duotone. `components/UI/Icon.tsx` draws each icon once on a 24×24 grid in three layers (`fill`, `line`, `detail`), so the three flat styles come from one drawing (Solid knocks the detail out in the background color). The top bar, menu, row actions, badges, privacy markers and main buttons use it; option text, chat replies and ✓/✕ glyphs stay text. Isometric was considered and left out (it's an illustration style that doesn't read at 16–20px).
- **Blog nav:** ✍ Post removed (blog repo `1a0b16e`); posting starts in Align.

### 2026-10-20: built, tested, NOT yet deployed (uncommitted until the user asks)
- **Day view** as Today (§8): done / won't do / pushed per day, ⏭ next day, ✕ won't do, Push the rest; `finishedOn` + `pushedFrom` on tasks (rules + tests).
- **🎯 Goals** (§5.6, §10): check / tally / progressive / measure, day strip, Goals page, goal page with chart + table; `goals` collection (rules + tests).
- **Links** lists (§5.2, §10) with a category tree, address/notes switches, sharing the address.
- **✍ New blog post** in Align with Text the link (§10.2); GitHub token per device in Settings. Blog nav **✍ Post** (blog repo commit `bfb15f4`, unpushed).
- **🔍 Search**, keyboard shortcuts, home-screen install (manifest + icons), phone top bar "+".
- Tests: 85 unit, 34 rules, calendar run. Checked with Playwright at 390px (day view, goals incl. charts in light/dark, links, blog posting with GitHub and Cloudinary mocked).
- **Deploy order:** rules first (`npm run deploy:rules`), then the web app (the user runs `deploy:web`).
- **Security fix (2026-10-20):** the old `blogupdate.html` / `image-rotation.html` had a classic GitHub token written into them; the user revoked it. Both pages now ask for a token and keep it in the browser (not in git; the user uploads them to Turbify).

### 2026-10-11 (other agent, deployed): project prerequisites and task editing
- Task-panel prerequisite choices default to the selected project (**Show other tasks** widens it); **Delete** beside Save; quick-add a checklist item from the task panel; project tasks default their start to today; **Next task follows [last task]**; prerequisite / priority / date ordering with **Select order** linking. No new stored fields. This is live (verified 2026-10-20).

### Where things stand (2026-10-11)
- **Everything below is built, tested, committed, pushed and deployed.** `main` = `1595fc9`; the live site (https://align.itsallonesong.com) serves that build, and the Firestore rules from that commit are deployed to `align-a32c1`. The calendar sync script with event links is deployed in Apps Script.
- **In use by:** Steve only so far. Linda's and Camilla's accounts haven't been created (see "Waiting on the user").
- **Tests:** 69 unit (`npm test`), including project linking, date defaults and batched writes; 30 security-rule (`npm run test:rules`), and the calendar script's emulator run (`npm run test:calendar`, 17 checks). Each feature was also checked in a phone-sized browser with Playwright against the emulators (scripts are throwaway, kept outside the repo; see "How to work on it").

### What's built (by area; details in the spec sections)
- **Tasks and lists** (§5, §8, §10): task lists, projects (dependencies, scheduling engine, timeline, shift previews, conflicts), checklists, notes. Statuses To do / Doing / Done / Canceled. Today / Everything / My / Family / Work views with filters, sorts, color key, Ready-to-do filter. Quick add that keeps focus; finished items crossed off with remembered hide toggles.
- **Dependencies you can see:** ⏳ Waiting on / Unblocks N on cards, a confirm before ticking a waiting task, ✓/✕/⏳ prerequisite links and **Needed by** in the panel.
- **Privacy** (§5.2, §11): 🔒 Just me, 👪 Family (+ visible to viewers), 👥 Chosen people (`sharedWith`) with a **Parents** shortcut. Per-person default privacy in Settings (applies to new lists and to adds without a list: Inbox / Family Inbox). Markers, color key and plain sentences everywhere.
- **Chat** (§9): add / done / cancel / move / meet / recalculate / show / vote / text / help, fuzzy matching with pick buttons.
- **Texting:** `text <name> [about <task>:] <message>` and **💬 Text about this** (panels, and a 💬 on task and checklist rows) open Messages filled in, with a `#/task/<id>` link. Numbers come from each person's Settings. No in-app messaging or push (decided 2026-10-11: replies arrive as normal texts, so an Align inbox adds little).
- **Google Calendar** (§5.5): one-way import every 15 minutes into "Family Calendar"; **↻ Refresh calendar** (Apps Script web app, membership-checked, 1-minute cooldown); **📅 Google Calendar ↗** with auto-refresh on return; events open in Google Calendar from their panel.
- **Voting** (§7): boards, weekly rollover tokens, ranking, chosen/archive.
- **Settings:** default privacy, mobile number, Parents, theme. **Dark mode** (per device, no flash).

### Waiting on the user (can't be done by an agent)
0. **Adding Linda and Camilla:** Firebase console → Authentication → Add user (email + a starting password you choose), then `household/main.members.<uid>` = `{ role: "member", displayName, color }`. They can change the password in ⚙ Settings, or use Forgot password?.
1. **Set the Parents group now** (⚙ Settings → Parents → tick You). Whoever sets it first controls it; do it before other accounts exist.
2. **Create Linda's and Camilla's accounts:** Firebase console → Authentication → Users → Add user (email/password). Then add each to `household/main.members` in the Firestore console: `{ role: "member", displayName: "Linda", color: "#bf3989" }` (Camilla likewise). Roles can only be set in the console.
3. **Each person adds their mobile number** in ⚙ Settings so "text <name>" works; Linda ticks herself under Parents (Steve can also tick her).
4. Optional: grandparents as `viewer` accounts the same way.

### Next ideas (not started; ask before building)
- Goals: reminders, and a weekly goals summary; recurring *tasks* are still separate from goals.
- Recurring tasks (watering, monthly flea meds) (§3.2).
- Reminders / phone alerts: web push needs a sender; the Apps Script could send via Firebase Cloud Messaging for free, but setup is heavier and iPhones need Align added to the home screen.
- "I'll do it" / claim buttons on family tasks and calendar events (answers "who's picking up Camilla?" in the app).
- Typed "show …" commands still leave the chat open over the page on phones.
- The Firebase SDK makes the JS bundle ~880 KB: code-split if first load feels slow.
- Commit the Playwright smoke checks as real tests.
- Settings for weekly tokens and pets (currently Firestore console).

### How to work on it
- Read CLAUDE.md first (commands, rules for agents). The user asks for "commit and push" explicitly; then usually "deploy the rules"; they run the web upload themselves and ask the agent to verify the live site.
- **Workflow that has worked:** change code → `npx tsc -b`, `npm run lint`, `npm test` → `npm run test:rules` if rules changed → browser check → update this section and CLAUDE.md test counts → commit when asked → `npm run deploy:rules` (if rules changed) → user runs `deploy:web` → verify the live bundle.
- **Browser checks:** install `playwright-core` into a scratch folder (e.g. `/tmp/align-pw`), use the cached headless shell at `~/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`, run against `npm run emulators` + `npm run seed` + `npm run dev -- --port 5199`. Use a 390×800 viewport. Sign in as `steve@`/`wife@`/`daughter@example.com` (password `align-dev`) to test sharing across accounts. To test the Refresh button, point `VITE_CALENDAR_SYNC_URL` at a small local stub that returns `{"ok":true,…}` with `Access-Control-Allow-Origin: *`; `npm run test:calendar` loads real imported events into the emulator.

### Environment
- **WSL Ubuntu 24.04.** Node **v24.21.0** via nvm (`~/.nvm`); load it with `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"`.
- `firebase-tools` 15.31 under nvm, logged in as steve.john.nelson@gmail.com. Java 21 for the emulators.
- **Firebase:** project `align-a32c1` (alias `prod` in `.firebaserc`; default alias `demo-align` for the emulators). Web config and `VITE_CALENDAR_SYNC_URL` are in `.env.production.local` (gitignored).
- **Turbify:** docroot `/align.itsallonesong.com`, explicit FTPS to `cpanel292.turbify.biz` as `sjnelson@itsallonesong.com` (password: the user types it). LiteSpeed, HTTPS forced by `public/.htaccess`.
- **Apps Script:** "Align calendar sync" in the user's Google account; script properties hold the bot login and calendar id; deployed as a web app (execute as me, anyone).
- **Emulator:** project `demo-align`, UI at http://127.0.0.1:4000. Test accounts (password `align-dev`): `steve@`, `wife@`, `daughter@` (members), `grandparent@` (viewer), `calendar-bot@` (bot), all `@example.com`.

### Gotchas
- **Tasks copy their list's `visibility`, `ownerId`, `viewerVisible` and `sharedWith`.** Any code that changes those on a list must update its tasks in the same batch (`updateList`); moving a task re-copies them (`updateTask(…, moveTo)`). `copiedFields` handles all four, including deleting `sharedWith` when a list stops being shared.
- **`sharedWith` must exist only on shared docs** (rules: `sharedOk`). That's what makes the single "shared with me" query provable by the rules.
- **Checklist items and notes are task docs.** `DataProvider` splits them into `listItems`; anything that should treat them as tasks (or not) must pick the right array. List deletion and visibility batches use both.
- **Queries must match the rules** (`visibleQueries`). Viewers must use `where("viewerVisible","==",true)` for family docs.
- **Deploy rules before the web app** whenever the rules changed.
- **The household listener ignores snapshots with `hasPendingWrites`** (otherwise first-time setup raced the rules into "Missing or insufficient permissions"; production-only).
- **TaskDetails is re-keyed on the task's full JSON** so its form never keeps stale dates after a shift.
- **The `#/task/<id>` view is derived, not stored:** AppShell shows the linked task while the hash is a task link; selecting another task or closing the panel moves to `#/list/<id>`.
- **Number inputs** use `NumberField` (clamping on every keystroke made "0" impossible to delete).
- **Controlled checkboxes tick after the database confirms:** in Playwright use `click()` + a short wait, not `check()`. Headless Chrome has no emoji font, so emoji show as boxes in screenshots.
- **Don't `pkill -f <pattern>` / match `ps` output in the same shell command line that contains the pattern:** it kills the calling shell. List PIDs in one command, kill them in the next.
- `vite build` warns that the chunk is over 500 KB (the Firebase SDK); harmless.
- npm skipped the install scripts for `@firebase/util` and `protobufjs`; harmless.
- `firestore.indexes.json` declares the collection-group index on `votes.uid` for the token-balance query; the shared-with-me queries need no composite index.
- No spaces in generated file or folder names (user preference). Pushes go over SSH.

### History
- **2026-09-25/26:** design reviewed; scaffold; security rules.
- **2026-10-07:** MVP (lists/tasks, scheduling engine, timeline, voting, chat, first-time setup); first deploy; Google Calendar import (Apps Script, calendar bot).
- **2026-10-08:** Today fixes (ticked tasks, clock order), quick-add "for" fallback, phone task panel; Canceled status; visible dependencies; menu backdrop; dark mode; 15-minute sync + Refresh button; number boxes.
- **2026-10-09:** checklists and notes; crossed-off finished items with hide toggles; Save at the top of panels; per-person default privacy, markers, color key; chat buttons close the chat.
- **2026-10-10:** Google Calendar link with auto-refresh on return; event links stored by the sync.
- **2026-10-11:** 👥 sharing with chosen people + Parents; texting (chat and panels) with task links; Parents group lock; 💬 on rows; Settings alignment. (Other agent:) project prerequisite ordering and task-panel streamlining.
- **2026-10-20:** day view with day history; Goals with charts; Links; blog posting in Align; search, shortcuts, home-screen install; blog pages' embedded token removed.
