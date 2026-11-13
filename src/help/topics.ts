// Help (DESIGN.md §10.4): one short entry per part of Align, shown two ways from this one place: a small ⓘ beside
// a heading (the `tip`), and the Help page (#/help, every topic's `body`). Keep the wording plain and short, and
// update a topic whenever the feature it describes changes.

export type HelpTopicId =
  | 'start'
  | 'today'
  | 'todo'
  | 'onThisDay'
  | 'tasks'
  | 'taskViews'
  | 'projects'
  | 'checklists'
  | 'notes'
  | 'links'
  | 'picks'
  | 'cards'
  | 'contacts'
  | 'gifts'
  | 'daily'
  | 'privacy'
  | 'details'
  | 'texting'
  | 'inbox'
  | 'goals'
  | 'rewards'
  | 'games'
  | 'photos'
  | 'map'
  | 'voting'
  | 'investing'
  | 'blog'
  | 'calendar'
  | 'chat'
  | 'settings'
  | 'about'

export interface HelpTopic {
  id: HelpTopicId
  title: string
  /** One or two sentences for the ⓘ tip. */
  tip: string
  /** The Help page: short paragraphs; lines starting with "• " are shown as a list. */
  body: string[]
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'start',
    title: 'Getting started',
    tip: 'Align keeps the family’s tasks, lists, goals, calendar and votes in one place. Start on Today; everything else is in the ☰ menu.',
    body: [
      'Align is the family’s shared to-do list, notebook, calendar and decision helper. It works in a browser on phones and computers; on a phone, “Add to Home Screen” makes it open like an app.',
      '• Today: what’s on for the day, your goals, and Archive Pics from this day in other years.',
      '• ☰ menu: My tasks, Family tasks, Work, Goals, Photos, the blog, your lists (they fold up by kind), Voting, Settings and this Help.',
      '• The chat-bubble ＋ at the top: add a task by typing a sentence (see Chat).',
      '• Tap anything (a task, a list item, a note, a vote option) to see it; Edit changes it.',
      'Each list or goal says who can see it (see Who can see it). Look for ⓘ next to headings for a quick explanation.',
    ],
  },
  {
    id: 'today',
    title: 'Today',
    tip: 'The place to start: Goals, Family Map, Contacts, Gifts, Lists, Projects, Flashcards, Archive Pics, The Daily and To Do. Every other page has a Back to Today button at the top right.',
    body: [
      'Today is yours to arrange: a list of tiles in your order. A tile can be a whole panel (Goals, Family Map, To Do…), a list, one entry (a person to call, a link, a task, a note), or part of a panel (someone’s location, Wordle of the day, the Word of the day). Group headings you name sit between them (tap one to fold it). ‹ and › go to other days, which show what belongs to a day: Goals, Archive Pics, The Daily and To Do (with what was done, skipped or pushed).',
      '• Add a tile: + in the footer searches everything you can pin; or “Pin to Today” in an entry’s ⋯ menu (press and hold a row on a phone), in its details, or at the top of a list.',
      '• Arrange: press and hold any heading on Today (or tap Arrange in the footer), then drag ⠿ (or use ↑ ↓). New group adds a heading; Rename names it. ✕ only takes a tile off Today. Tiles below the “More…” line are folded into More… in the footer. Saved for you on every device.',
      'The panels:',
      '• Goals: a summary of the goals you log: where each stands (“4 to go”, Done) and a small trend chart. Tapping a goal (its name, trend or pencil) opens logging for just that one, right there; Manage goes to the Goals page; Log all shows every goal ready to log (remembered on this device). Goals that don’t run that day (a weekdays-only walk on Saturday) show greyed as “Not today”. Folded each morning.',
      '• Family Map: pin the people you check most with ☆, search by name, or Show all to see everyone’s last location. Tap a name to open the map on them. Map pins are separate from contact pins.',
      '• Reveal: the expanded panel shows the hidden family picture, with progress, your moves and Play underneath.',
      '• Gifts: what you’re getting for others (tick when bought) and each gift list.',
      '• To Do filters by All / Mine / Family / Shared, like the Tasks page and Goals (remembered on this device); picking one opens the list. Folded, it shows “Show 28”.',
      '• The weather icon beside the date (Today only) shows the weather now; tap it for the high / low, chance of rain and a link to the full forecast. Settings → Weather picks the place (automatic: where you are while you share your location on the family map, otherwise Orlando) and the forecast site. Data from Open-Meteo (©), refreshed every 30 minutes.',
      '• The footer at the bottom of Today has More…, Arrange and +. More… holds the tiles you use less (Gifts, Lists, Links, Projects, Flashcards, Voting and Investing to start); tap it again, its title, ✕, or anywhere outside it to close it. Your old Shortcuts are now tiles under a “Shortcuts” group.',
      '• A pinned list shows what’s left on it (up to 8, then Show all), with + to add and Open for the whole list. A pinned person keeps call / text / email; a link opens in one tap.',
      '• Gifts, Lists, Links, Projects, Flashcards and Contacts each have + in the heading: a new list, project, set or gift list, or a new link or person (pick which list it goes in).',
      '• Family Map, Contacts, Lists, Links, Projects, Flashcards and Voting all open the same way: an inset panel with what you pinned (☆) first, then a search box (with filters: contact lists and tags; Mine / Family / Shared for lists), then Show all to scroll through everything right here. Pins are yours and follow you across devices. Lists, Projects and Flashcards show as rows or cards. “All contacts” opens the contacts page (import, export, editing).',
      '• On This Day / Archive Pics: favorite family photos from this date in earlier years (see Archive Pics).',
      '• The Daily: a word, joke, puzzles, pictures and more, with answers to reveal. Folded each morning.',
      '• To Do: the day’s tasks (see To Do), then Done, Won’t Do and Pushed to a Later Day.',
      'Tap any section’s title to fold it away or open it again. Opening another section folds the others; opening More… also folds the main sections. Goals return to your personal summary (logging and family goals close), and Archive Pics can stay open. Inside More…, an opened section scrolls up to reveal its contents. Google Calendar and Refresh at the top keep the family calendar in step.',
    ],
  },
  {
    id: 'todo',
    title: 'To Do',
    tip: 'Tasks for this day, ones overdue, and ones in progress. “+” adds one; ⏭ “Push rest” moves what’s left to tomorrow. The swatch explains the card colors.',
    body: [
      'To Do lists the day’s tasks: scheduled or due that day, overdue ones, and ones marked Doing. On a past day it’s called Not Done.',
      '• +: type a task for this day (it goes to your Inbox list); “Title: note” puts what follows the colon in the note. The box stays open for several adds; Esc closes it.',
      '• On each card: ⏭ moves it to the next day, ✕ marks it won’t do, the message icon texts someone about it. Tap the card to see it; Edit to change it.',
      '• ⏭ Push rest: the end-of-day sweep of everything left to tomorrow.',
      '• The swatch next to the count shows what the card colors mean (who can see each task); showing it also opens the list.',
      '• Also show: tasks you can see but not change (someone kept editing their list to themselves) are left off; tick a person, or Everyone, to include theirs.',
      '• Done, Won’t Do and Pushed to a Later Day below show what happened to the rest; tap a title to fold any of them.',
    ],
  },
  {
    id: 'onThisDay',
    title: 'Archive Pics (On This Day)',
    tip: 'Favorite family photos taken on this date in earlier years; if none, a nearby date, or a few picked from the archive. Tap one to see it larger or text it.',
    body: [
      'The photos come from the family photo library’s favorites (see Photos). The heading tells you which you’re seeing:',
      '• On This Day: photos taken on this date in earlier years (“6 years ago”).',
      '• Near This Day: none on this date, so the closest date within a week.',
      '• Archive Pics: nothing close, so three favorites picked from the archive (the same three all day).',
      'Tap a photo to see it larger, then swipe left or right (or use Previous and Next) to browse the pictures in that strip. You can also open it full size or text it to someone. “All” opens the Photos page. It starts shown each morning; Hide (or tap the title) folds it for the day.',
    ],
  },
  {
    id: 'tasks',
    title: 'Lists and tasks',
    tip: 'A task list holds to dos with dates, priority, who it’s for and who’s doing it. Tap a task to see it; Edit to change it, or move it to another list.',
    body: [
      'Make a list with “+ New list” in the menu, or “+ New list…” when choosing a task’s list. Kinds:',
      '• Task list: to dos with dates, priority, who it’s for and who’s doing it.',
      '• Project: tasks that depend on each other (“can’t start until…”), with a timeline; moving one offers to move the ones after it.',
      '• Checklist: things to tick off (shopping, packing); finished items stay crossed off until you hide them.',
      '• Notes: reference info (sizes, numbers, instructions).',
      '• Links: bookmarks grouped by category; a link can also go on your Reading list as a task.',
      'Quick adds take “Title: note” (the note is everything after the colon). New tasks are due the day you add them unless you chose “no date” in Settings.',
      'Import / Export (beside Edit list) saves any list as a Markdown file or adds items from one: links can also use your browser’s bookmarks file, and projects keep their dates and dependencies.',
      'A task can be To do, Doing, Done or Canceled. Calendar events show up as tasks too (see Google Calendar).',
    ],
  },
  {
    id: 'taskViews',
    title: 'Tasks',
    tip: 'Tasks from every list in one place. All / Mine / Family / Shared, then filter by list, who it’s for, who’s doing it, priority and status; sort by date, priority or dependency order.',
    body: [
      'Menu → Tasks gathers tasks from all the lists you can see, any date (Today’s To Do is just today’s, with the same chips; “All tasks” there opens this page):',
      '• All, Mine (yours to do: your private ones, plus ones the family can see but only you can edit, or that are assigned to you), Family (Family and Everyone that the family shares) or Shared (shared with chosen people). Work appears only if something is marked work.',
      '• To keep a project visible to the family but off their To Do: make its list Family (who can see it) and Only me (who can edit it). It shows under your Mine; they can still open it, or tick Also show under To Do.',
      '• Filters: one list, family or work, who it’s for, who’s doing it, priority, and To do / Doing / Done / Canceled (Not done hides finished ones).',
      '• Sort by date, by priority, or in dependency order (what has to happen first). The color key shows who can see each task.',
    ],
  },
  {
    id: 'projects',
    title: 'Projects',
    tip: 'A project is a task list where tasks depend on each other. Set “Depends on” in a task, use Timeline to see the plan, and Recalculate to fix the dates.',
    body: [
      'Use a project for anything with steps in order (a room remodel, a trip).',
      '• In a task’s Edit, “Depends on” says what must finish first (plus a gap in days if needed). The task shows “Waiting on …”; the other shows “Needed by …”.',
      '• Select order: tap tasks in the order they happen, then “Preview prerequisite links” to link them in one go.',
      '• Moving a task’s date offers to move the tasks after it; you see the changes before anything is saved. Recalculate redoes all the dates.',
      '• Timeline shows the plan as bars across the days. “Ready to do” tasks have nothing left to wait on.',
      '• Export saves the project as a Markdown checklist with each task’s dates and what it waits on ({start …, 2 days, after: …}); Import brings one back, so a project can be copied or shared as a template.',
    ],
  },
  {
    id: 'checklists',
    title: 'Checklists',
    tip: 'Things to tick off that aren’t tasks: shopping, packing, people to call. Checked items stay crossed off until you hide or delete them.',
    body: [
      'A checklist is for items, not tasks: they don’t have dates and don’t show on Today.',
      '• Type in “Add an item…” and press Enter; tap the box to check it off.',
      '• Checked items stay crossed off at the bottom; Hide tucks them away (remembered on this device), and you can delete all the checked ones at once.',
      '• Tap an item for its details (size, brand, a link, a picture) and comments; the message icon texts someone about it.',
    ],
  },
  {
    id: 'notes',
    title: 'Notes',
    tip: 'Reference information worth keeping: sizes, account numbers, instructions, door codes. Each note has a title and text, plus links, pictures and comments.',
    body: [
      'A notes list keeps things you look up rather than do.',
      '• Add a note by its title, then tap it and Edit to write the text (it keeps line breaks).',
      '• Notes are listed by title; the start of each note shows under it.',
      '• Like everything else, a notes list has a “who can see it”, so private notes can be Only me.',
      '• Export saves the whole list as one Markdown file (each note a “## Title” section); Import reads the same, title: / note: blocks, or a plain file (one note).',
    ],
  },
  {
    id: 'links',
    title: 'Links',
    tip: 'Bookmarks grouped by category (“Home/Utilities” nests). Tap a name to open it; a link can also go on your Reading list as a “Read:” task.',
    body: [
      'A links list keeps web addresses in folders.',
      '• Paste an address; a name and a category are optional. A category like “Home/Utilities” makes a folder inside a folder.',
      '• Tap a name to open it in a new tab. Switches show the addresses or the notes under each name.',
      '• “Add to reading list” makes a “Read: …” task (in your Reading list or another list); the link shows when it’s been read.',
      '• Export saves the list as Markdown (categories as headings) or as a bookmarks file your browser can import; Import reads either, or a bookmarks file exported from Chrome, Edge, Firefox or Safari (folders become categories). Addresses already in the list are skipped.',
      '• Pin to my menu (when adding a link, in its Edit, or from its page) puts a shortcut to the site in your own ☰ menu; it opens in a new tab. Pins are just yours and follow you to every device.',
    ],
  },
  {
    id: 'picks',
    title: 'Pick lists (what to watch tonight)',
    tip: 'A list of shows, movies, songs or anything to choose from. Everyone rates each one 1–5; Tonight ranks them for whoever is there, and Pick for us chooses.',
    body: [
      'Make one with “+ New list” → Pick list, and choose what’s on it (streaming shows, movies, theater, music, books, games or other). Make one list per kind.',
      '• Add titles; tap the stars to give yours (tap the same star again to clear it). Everyone who can see the list can rate, even if only its owner edits it.',
      '• Tonight: tick who’s there. Align ranks what’s on the list by their ratings, favoring things nobody dislikes over a high average with one strong no. Unrated counts as a maybe.',
      '• Pick for us chooses one of the top few at random, leaning toward the best. “Watched” (or Played, Read…) records the day; it sits out for a month, then works its way back up.',
      '• Each title has the usual note, links (a trailer, where to stream it), pictures (a poster) and comments.',
    ],
  },
  {
    id: 'cards',
    title: 'Flashcards',
    tip: 'A set of cards to learn: think of the answer, tap the card to show it, then “Got it” or “Not yet”. Study in order, shuffled, or only the ones you haven’t got yet.',
    body: [
      'Make a set with “+ New list” → Flashcards (spelling words, times tables, state capitals…).',
      '• The set opens ready to study. Tap Cards (the number of cards) to list them with your ✓ / ✗, and Edit there to add cards, import a set, export, or change the list.',
      '• Add a card with its front (the question) and back (the answer), or “Import a set of cards…”: paste lines like “Paris | Capital of France” (or Q: / A: lines), or choose a YAML file with front: / back: for each card.',
      '• Study: pick In order, Shuffled, or Only ones not known yet, then Start. Think, tap anywhere on the card to see the answer, and say Got it or Not yet. Got it sparkles, a little more for each one right in a row; every card right ends with a burst. At the end you can go over the ones you missed.',
      '• Challenge (by Start, or on the Leaderboard): 10 cards at random, with four answers to pick from on each and no skipping, timed. Your best round goes on the set’s Leaderboard, beside how many cards you’ve mastered (picked right in multiple choice). Got it on its own doesn’t count there, so everyone is compared the same way.',
      '• Stuck? Choices offers four answers to pick from (Multiple choice, by Start, offers them on every card). A right pick sparkles; a wrong one shows the right answer and counts as not yet.',
      '• Geography: cards that name a country or US state (or its capital) get maps. On the front, Show map shows the region with the place filled in and its neighbors outlined, no names. The back shows it labeled, with the capital marked and the neighbors named, the countries or states it borders, and Learn more (a few lines from Wikipedia). Map first, by Start, shows only the map: name the place.',
      '• Results are kept for each person (the ✓ / ✗ beside each card is yours). Start over forgets yours; anyone who can see the set can study it.',
    ],
  },
  {
    id: 'contacts',
    title: 'Contacts',
    tip: 'People with their phones, emails and addresses (tap to call, text, email or map), plus notes, links, pictures and comments. Import and export vCard files to bring contacts together from your phone, Google and Outlook.',
    body: [
      'Make a contacts list with “+ New list” → Contacts (for example “Steve’s Contacts”); who can see or edit it works like any list, so Linda can keep her own.',
      '• Each contact has a name, company and job title, birthday, and any number of phones, emails and addresses (labeled mobile, home, work or other), plus the usual note, links, pictures and comments.',
      '• Tap a phone number to call it (or the message icon to text), an email to write, or an address to open it in Maps.',
      '• Import: a .vcf file (Google Contacts, Samsung Contacts, iPhone and Outlook all export these) or the CSV file Google or Outlook exports. The same person from several files—or already in the list—is merged (same name, email or phone), so importing from each source brings them together.',
      '• Export saves the list as a .vcf file you can import into your phone, Google Contacts or Outlook.',
      '• Tags group people (Family, School, Services, Christmas List, Ballet…): in Edit, tap a suggested tag or type a new one; a person can have several. Tags come in from Google labels, Outlook categories and vCard CATEGORIES on import, and go out on export.',
      '• Filter by tag above the list (any of the chosen tags; No tag finds people not tagged yet). With a search or filter on, Export saves just those people: vCard for a phone, or a spreadsheet (.csv) for mailing labels such as Christmas cards.',
      '• Today has a Contacts section too: choose which contact lists and tags to include, type a name, company or number, and call, text or email from there. “All contacts” opens the full list.',
    ],
  },
  {
    id: 'daily',
    title: 'The Daily',
    tip: 'Something new each day: a word, a joke, a quote, things to think about, science, a riddle, math and chess puzzles, poker odds and pictures. Tap to reveal answers.',
    body: [
      'The Daily on Today changes every day. Each item shows something first; “Show answer” (or “Tell me more”) reveals the rest, so you can guess or think first.',
      '• Word of the day, a quote, a question to think about, a science fact and a riddle come with Align (the same for everyone that day).',
      '• A Mini Philosophy short video by Jonny Thomson (YouTube @philosophyminis), a different one each day; “Watch here” plays it, or open it on YouTube.',
      '• An easy chess puzzle (mate in one, from Lichess), a short chess lesson, and Texas Hold’em poker odds.',
      '• A pet health tip (well-established guidance, Florida-aware: heartworm, toads, sago palms) and a dog or cat fun fact from public trivia sites.',
      '• A math puzzle at the grade you choose, a joke, NASA’s astronomy picture, Wikipedia’s picture of the day and a wild animal photo (guess what it is) are fetched fresh from free public sites.',
      '• Choose which items you see and the math grade in Settings → The Daily. Tap “The Daily” to fold it away; it remembers for the day.',
    ],
  },
  {
    id: 'privacy',
    title: 'Who can see it',
    tip: 'Only me · Parents · Family (household accounts) · Chosen people · Everyone (family plus view-only accounts). Lists and goals can also limit who edits. New things start at your default in Settings.',
    body: [
      'Every list and goal has one of five choices, and everything in a list follows its list:',
      '• Only me: just you.',
      '• Parents: the people ticked under Settings → Parents.',
      '• Family: everyone with a household account.',
      '• Chosen people: the names you pick.',
      '• Everyone: the family plus anyone with view-only access.',
      'Lists and goals also have “who can edit” (for goals, “who can log it”), using the same choices: for example, everyone can see your list but only you change it. Until a list’s owner picks one, anyone who can see it can edit it. View-only accounts never edit. Your default for new lists and quick adds is in Settings.',
    ],
  },
  {
    id: 'details',
    title: 'Notes, links, pictures and comments',
    tip: 'Any entry can have a note, named links, pictures and comments, and “Text about this” sends someone a link to it.',
    body: [
      'Every list shows its entries the same way. Simple / Medium / Detail (by the list’s name, remembered on this device) chooses how much each row shows: Simple is the title (and a checkbox where there is one); Medium adds marks for links and pictures and the entry’s own facts (a task’s dates, a link’s address, a title’s stars); Detail shows the text, links and pictures in place.',
      'Tap a title to open it in place, with Open, Edit, Move, Comment, Send and Pin to Today. ⋯ at the end of the row (or pressing and holding the row) opens the same as a menu. 💬 texts someone about it in one tap. A link’s name opens the site; a person keeps call, text and email on the row.',
      'Tasks, checklist items, notes, links, vote options and goal days all share the same details:',
      '• Note: anything worth writing down.',
      '• Links: a name (shown) and an address (Show address reveals it); tapping opens it in a new tab.',
      '• Pictures: “+ Add a picture” uses your phone’s photo picker, then lets you crop or rotate; they’re stored in Align and only household accounts can open them. “From favorites” picks one of the family photos.',
      '• Comments: anyone who can see the entry can read them; members can add their own. The message icon on a comment texts it to someone.',
      '• Related notes (in Edit): link notes you already keep, such as sizes and brands for a gift, or the paint colors for a project task. Each opens in place to show its text. A note seen by fewer people than the entry says so.',
    ],
  },
  {
    id: 'texting',
    title: 'Sending and texting',
    tip: '“Send about this”: pick a person, add a note, and send it to their Align Inbox, as a text from your phone, or both.',
    body: [
      '“Send about this” (💬 on a row, Send… in its menu) sends what you’re looking at to one person: Align (their Inbox, with a notification within seconds if they turned notifications on), Text (Messages opens on your phone with your note and a link filled in; you press Send), or Both. Align remembers your last choice on this device.',
      'Align doesn’t send texts itself; it fills them in for your own Messages app, so it’s free and replies come back as normal texts.',
      '• Each person adds their mobile number in Settings so others can text them from Align.',
      '• “Text about this” on any entry includes its title, when it happens, and a link that opens it in Align.',
      '• In chat: “text Sam I picked up milk”, or “text Sam about pick up Alex: are you getting her?”.',
    ],
  },
  {
    id: 'inbox',
    title: 'Inbox',
    tip: 'What family members sent you in Align, and game invitations. Tap one to open it; ✕ clears it.',
    body: [
      'Your Inbox is on Today (a tile, at the top until you move it) and behind the ✉ in the top bar, with how many are new.',
      '• Tap a message to open what it’s about (an entry, a board, a photo, a game); it’s then marked read. ✕ clears it; Mark all read and Clear read tidy up. Only you and the sender can see a message.',
      '• Notifications: Settings → Notifications turns them on for this device (on iPhone and iPad, add Align to the Home Screen first). The sender’s phone asks for the notification at once, so it arrives in seconds; if that doesn’t get through, one goes out within 15 minutes. You can keep notifications for family map alerts but turn them off for the Inbox.',
      '• While Align is open, a new message shows a banner at the top; a game invitation stays until you play or close it.',
    ],
  },
  {
    id: 'goals',
    title: 'Goals',
    tip: 'Daily goals you log: done or not, a tally, a number that moves toward a goal, a measurement, or a running total. Others can see them without logging unless you allow it.',
    body: [
      'Kinds of goal:',
      '• Check: done or not each day. Tally: tap once each time (water glasses).',
      '• Progressive: a suggestion that changes on a schedule toward a goal (a weight from 180 down 1 every 2 days to 165).',
      '• Measure: a fixed target. Running total: amounts add up toward a target (vacation savings).',
      'Each day shows where you stand: “4 to go”, Done, “+3 extra”, or for lower-is-better goals like weight “1.2 lb to go” / “0.8 lb ahead”. Count-up goals (reps, minutes) have “+ more” to add to the day and Reset to clear it.',
      'Each goal has “who can view” and “who can log” (only you, by default). The Goals page groups them: yours, shared ones (with who else logs them), and other people’s.',
      'Turn on “Show a timer” for number goals: time a walk, then “Add” puts the minutes on that day (time several walks and they add up). Each day can also have a note, links and pictures; the goal page has a chart, a table and comments.',
      'On Today, Show the family’s goals (under yours) lists everyone else’s goals for the day with where they stand and their trend, view only.',
      'Meeting a goal today sparkles in your color, more with each one done; finishing all of today’s goals bursts with “All done today” and the Goals heading glows gold for the rest of the day.',
      'Good weeks, not streaks: a week is good when the goal is met on 5 of its days (or all of them, if it’s on fewer). Good weeks only add up; a missed day never takes one away. The goal page shows the count, this week so far and your best week.',
    ],
  },
  {
    id: 'rewards',
    title: 'Reveal and rewards',
    tip: 'Every goal you meet is a spark. Sparks are moves in a match game that uncovers a family photo together, and the family’s total unlocks rewards.',
    body: [
      'Sparks: each goal you meet earns one (up to 5 a day), and finishing all of your day’s goals earns 2 more. They’re banked: never spent and never lost.',
      'On Today, open Reveal for an inset picture panel with progress, your moves and the Play link below the picture.',
      'Reveal: a family photo, picked by chance, sits under frosted ice, and the game board is laid right on it. Each spark is one move: swipe a gem toward a neighbor (or tap one, then the other) to line up 3 or more of a color. They burst, the gems above fall, and chains keep going. Each burst breaks the frost under it (thicker frost takes more), and a broken square stays clear: that bit of the photo shows around the gems that fall onto it. Hold Peek to fade the gems and look. Everyone gets 3 moves when a new reveal starts.',
      'A parent can assign one Reveal picture manager in Settings. Only that account sees or changes the current and next picture controls; the next-picture choice is used once, then future reveals return to random picks.',
      '• 4 in a row makes a gem with stripes that clears its whole row or column; an L or T makes a bomb that clears around it; 5 in a row makes a rainbow wheel that clears every gem of the color you swap it with.',
      'The photo is shared: whatever anyone breaks stays broken, and two people can play at the same time. When the last ice breaks, everyone sees the photo uncovered, with who helped.',
      'Rewards: the family’s sparks, all time, unlock the ladder (Ice cream night, Movie night…). Nothing is spent, so each one stays unlocked. Edit the ladder on the Reveal page.',
    ],
  },
  {
    id: 'games',
    title: 'Family games',
    tip: 'Short family puzzles with leaderboards. Invite someone to solve the same puzzle, then compare moves, guesses or time.',
    body: [
      'Games has Lights Out, Tower of Hanoi, Picture Slider and Wordle. Choose a favorite photo and a 3 × 3, 4 × 4 or 5 × 5 slider board; invitations replay the same picture and board size.',
      'Wordle gives the family the same daily five-letter word, or lets you choose a 2–12 letter word and invite members to guess it. Five-letter games accept the Wordle guess list and require hard mode; other word lengths accept any letters-only guess. Leaderboards rank fewest guesses, then fastest time, and identify hard-mode scores.',
      'In hard mode, keep green letters in their places and use the revealed yellow letters in later guesses. Yellow letters may be used again in the same position. Quit leaves the daily game to resume later; Give up ends it.',
      'Wordle offers separate chosen-word invites, live chosen-word and live random-word challenges, and Real-time Live Wordle. Live random games start each player’s timer when they open the invitation. In Real-time Live Wordle, everyone opens the invitation and taps Ready; the shared timer and game begin together when all players are ready. Any player can cancel the waiting lobby. It expires after 15 minutes, checked the next time someone connects. Live challenge updates show each player’s status, guess count, time and fixed-size six-row board; letters and answers stay private.',
      'Leaderboards compare fewest moves or guesses first, then fastest time, for the same puzzle. Solving a Wordle brings a celebration. You can invite someone to replay the same puzzle from the game.',
      'Game invitations appear at the top of the expanded Today Games panel, with open and complete counts on one line. Expand or collapse Invitations, Pinned Games, Search Games and Live Wordle Updates by tapping their headings; only one section stays open, and your last choice is remembered on this device. Each live challenge update opens to show every player’s progress. Updates do not expire automatically: clear a completed invitation to hide its update on your account. Expand Games to play or decline new invitations, review results, and clear old invitations. In a live Wordle, a player who finishes does not end anyone else’s game. Everyone can keep guessing or give up, and the fixed player boards and message row show progress without a leaderboard during play.',
    ],
  },
  {
    id: 'gifts',
    title: 'Gift lists',
    tip: 'Ideas for one person. Everyone sees the ideas; everyone except that person also sees secret ideas and quietly marks what they’re getting.',
    body: [
      'Make one with “+ New list” → Gift list, and choose who it’s for: a family member (yourself, for a wish list) or anyone else by name.',
      '• Two ways to use it: someone makes their own wish list (the family sees it and quietly claims ideas), or you make a list for someone else, which starts hidden from them (shared with everyone else) so the whole list is a surprise. Add them under Who can see it to show it to them.',
      '• Add an idea with how many, color, size and details. Tap it → Edit to add links (where to buy), pictures, and Related notes: link a note you already keep (sizes, brands) instead of retyping it.',
      '• I’ll get it quietly claims an idea (or what’s left of a quantity). Tap Mark bought when you have it. Your claim note (where, price, wrapped) is for the family only.',
      '• The person a list is for never sees claims or secret ideas: the database refuses to show them. Ideas they wrote themselves, and comments, they can see, so keep surprises in secret ideas and claim notes.',
      '• Secret idea (when adding to someone else’s list) hides that idea from them; it lives in a hidden companion list shared with everyone else.',
      '• Extended family with view-only accounts can claim too (and see claims and secret ideas, except on lists for themselves), so everyone coordinates in one place. They can add ideas as well (secret ideas always; ideas on the list itself unless its owner set Who can edit to only some people) and change or remove the ones they added. A list can be shared with up to 50 people.',
      '• Today → Gifts lists what you’re getting (tick when bought) and how many ideas are still open on each list.',
    ],
  },
  {
    id: 'map',
    title: 'Family Map',
    tip: 'Where everyone who shares their location is, from the free OwnTracks app on their phone. Only members of the household see it.',
    body: [
      'Menu → Family map shows a pin for each person sharing (faded when the last report is more than 2 hours old), how long ago it was, battery, and how accurate it is. Show centers on them, Trail draws their last day, Directions opens Google Maps.',
      'On Today, Family Map shows your pinned people first, then a name search and Show all. ☆ pins someone; ★ unpins them. These pins follow you across devices and are separate from contact pins.',
      '• To share: under Your location, tap Set up my phone, install OwnTracks (iPhone or Android), tap Set up OwnTracks on the phone, and allow location Always. It reports in the background and saves battery by only reporting real moves.',
      '• If a phone checks in but its newest location is old, Align says so on the map. A red number on the OwnTracks icon is reports waiting to send: iPhones only send them while OwnTracks is open, oldest first, so open it and keep it open until the number is gone. Catching up updates the map but sends no arrive / leave alerts.',
      '• Still stuck? Look at OwnTracks’ status (ⓘ). “HTTP Response error 302” means an old link: on that phone, Family map → Set up another phone → Set up OwnTracks. Both Android and iPhone use the Align relay address. Otherwise, on an iPhone: Settings → OwnTracks → Location → Always (Precise on), and Background App Refresh on; Low Power Mode pauses it.',
      '• Your link is yours alone: it can only post your location. Pause sharing stops updates (everyone sees “paused”); Delete my location removes your position and trail. Only the last day’s trail is kept.',
      '• Places (geofences): + Add place, name it, set the center with Here, Tap the map (or drag the pin), or an address or “lat, lon”, and a radius (150 m or more works best). The map then shows who’s “at School” and when they arrived or left.',
      '• Alerts for me: “Alert me when Daughter arrives at School” (anyone or one person; arrives, leaves or both; any place or one). They come by email, and/or as notifications on the devices where you tap Turn on here (Android in Chrome; iPhone from Align on the Home Screen). Only you see your alerts; they can lag a few minutes behind.',
      '• Viewers (like grandparents) don’t see the map. Nothing here costs money: the reports go through the family’s Google Apps Script into Align.',
    ],
  },
  {
    id: 'photos',
    title: 'Photos',
    tip: 'The family’s favorite photos, published from the photo library. Search by name, year or event; tap one to see it larger or text it.',
    body: [
      'Favorites come from the family photo library (psort): starred photos that aren’t marked private are published for the blog’s photo browser, and Align shows the same ones.',
      '• Photos page: search names, years, months or events; Top picks; tap to see larger, open full size, or text it.',
      '• On This Day / Archive Pics (on Today): favorites from this date, a nearby date, or the archive.',
      '• “From favorites” adds one to a blog post, a task, a vote option or a goal day.',
    ],
  },
  {
    id: 'voting',
    title: 'Voting',
    tip: 'Boards for family decisions. Everyone gets tokens each week to spend on the options they like; the most tokens wins. Unused tokens roll over.',
    body: [
      'Find boards in the menu under Voting, or on Today in More… → Voting (+ makes a new board).',
      'On Today, tap ☆ on the right of a board to pin it. Pinned boards appear immediately when you open Voting, without searching or choosing Show all. ★ unpins it; your favorites follow you across devices.',
      '💬 Text about this board sends someone its name and link from your phone, to bring them to it. Each idea has its own Text about this and comments; the board has a Discussion.',
      'Voting is for one decision (the house color): spend tokens on the options you want, then mark the winner chosen. For things you choose from again and again (what to watch tonight), use a pick list instead: everyone rates titles once, and Tonight ranks them for whoever is there.',
      'Each board is a decision (movies, restaurants, weekend plans, trips). Anyone in the family can suggest an option.',
      '• Spend tokens with ＋ and −; your balance is at the top. Tokens arrive each week and unused ones roll over, so saving them up counts for more on something you care about.',
      '• Tap an option for its note, links, pictures and comments; the board has its own Discussion.',
      '• Mark the winner Chosen, or Archive options that are out.',
    ],
  },
  {
    id: 'investing',
    title: 'Investing',
    tip: 'Expandable investment lists and a separate post-earnings overreactions feed. Private by default, with sharing chosen per list. Information only — never advice.',
    body: [
      'Find it on Today in More… → Investing. My investments keeps your existing stocks. + New list creates another investment list; each opens and closes independently. Post-earnings overreactions stays last.',
      '• Edit / sharing chooses Only me, Parents, Family, Chosen people or Everyone for that list alone. Only its owner edits. Shared people see the whole list, including positions, quantities, costs and results. You can share holdings with your spouse and the overreactions feed with a viewer separately.',
      '• Add stocks follows ticker symbols or imports a portfolio CSV (E*TRADE: Portfolio → Download → Spreadsheet). Positions show your shares, what you paid and the change since.',
      '• Each stock shows its price, day and week move, and big-move flags. Tap it for headlines, its 52-week closing-price range, distance from the high, and trailing / forward P/E when available. The range is price context, not intrinsic valuation; forward earnings are estimates.',
      '• Peer comparisons use at least three other stocks in the same list with the same reported industry and positive forward P/E. They show the median and your stock’s premium or discount, not an industry-wide survey or a ten-year valuation history. Missing data is labeled; ETFs may have no useful P/E.',
      '• The watchlist is a “market overreaction detector”: a scanner hunts for quality mid-caps that dropped 15–40% right after earnings while revenue still grows, cash flow stays positive, debt stays manageable and insiders are buying. After a full pass it publishes up to 10 highest-scoring qualifying candidates, not the first 10 found. Failed source lookups are skipped, not confirmed rejections. Each candidate gets a 0–100 score. With GEMINI_API_KEY configured and a successful response, it also gets a one-page note: why it fell, whether the fundamentals changed, historical analogs, the bull and bear case, and a recovery estimate. New results show whether a note was generated and when, attempted but failed, or not configured. Older results do not record the outcome, so a disclaimer alone cannot tell whether generation was attempted.',
      '• Most scans find nothing — the screen is picky on purpose. Candidates are things to read about and check yourself.',
      '• Open a stock or scanner candidate and choose Text about this. Pick a person, add a note, then Send text opens your phone’s Messages app; you send it there. Copy text also works. Recipients must sign in and have access to the list: texting does not grant access. Links open the latest report, not an archived scan; a stock that has left the list is labeled.',
      '• Scores and AI recovery estimates are uncalibrated research aids, not measured probabilities. After upgrading, old results remain visible to their owner; shared people see results once the updated scanner refreshes that list. A watchlist publishes only after a complete scanning and scoring pass.',
      '• Expanded lists show scanner status even before the first watchlist is ready: phase, price-screening percentage, waiting candidates and last full pass. Last slice and data quality shows work and failures; holdings have a separate refresh timestamp. Percentages are phase-specific, not overall completion. Stale activity is flagged.',
      '• Save the updated scanner in the same Apps Script project, keep the trigger and Script Properties, then run scanStatus to publish saved progress without advancing or resetting it. Do not run resetScanner. Earlier run history cannot be reconstructed.',
      '• P/E is refreshed separately from the candidate scan. Not supplied in this result means missing data, not a bad valuation; non-positive ratios are labeled not meaningful. Source errors and lookup times appear in the stock details. Old price-only results need a refresh from the updated script.',
      'The data comes from a free Google Apps Script (scripts/market-scanner in the repo) that runs every few hours; prices and summaries refresh with it. None of this is investment advice, and nothing here trades.',
    ],
  },
  {
    id: 'blog',
    title: 'Blog',
    tip: '“New blog post” writes a post for the Travelin’ On blog (text, photos, video, a quote) and gives you its link to text. It needs the blog’s GitHub token on this device (Settings).',
    body: [
      'Posts go to the Travelin’ On blog (blog.itsallonesong.com); the menu link opens it.',
      '• New blog post: a title, then blocks of text with a photo (upload, or From favorites), plus an optional video, closing text and quote. It’s live in about 2 minutes; then text the link to someone.',
      '• Posting needs the blog’s GitHub token, saved only on the device (Settings → Blog posting). Without it you can still read the blog.',
    ],
  },
  {
    id: 'calendar',
    title: 'Google Calendar',
    tip: 'Events from the family Google Calendar appear as tasks on their days, updated every 15 minutes (or tap Refresh). Change the event in Google Calendar; add notes here.',
    body: [
      'The family Google Calendar is copied into Align every 15 minutes; “Refresh calendar” on Today does it now.',
      '• Events show as tasks on their day with the time and place; “Google Calendar” opens the calendar.',
      '• The title and time come from the calendar (change them there); notes, links, pictures and comments added in Align stay.',
    ],
  },
  {
    id: 'chat',
    title: 'Chat',
    tip: 'Type what you want in plain words, like “add task mow lawn on Saturday”. Type “help” in the chat for examples.',
    body: [
      'Open chat with the chat-bubble ＋ at the top (or “Chat”). It understands short commands, for example:',
      // The command examples are added from the chat's own list (chat/parser.ts HELP_TEXT) on the Help page.
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    tip: 'Your own settings, an optional four-digit device PIN, and switching accounts. Switching stays available without a PIN.',
    body: [
      'Tap your initial (top right) for Settings.',
      '• Who can see new things: your default for new lists and quick adds.',
      '• New tasks without a date: due the day you add them (so they show on Today), or no date.',
      '• Your mobile number: so others can text you from Align.',
      '• Parents: who “Parents” means. Once set, only a parent can change it.',
      '• Settings PIN: optionally require a four-digit PIN to open this account’s settings on this device. Switching accounts remains available without a PIN; this is a convenience lock, not account security.',
      '• Password: change it here; forgot it? Use “Forgot password?” on the sign-in screen.',
      '• Someone else using this phone (a child borrowing it)? Switch to, at the top of Settings, opens Align as them in one tap, and everything they do counts as them. Add someone signs them in the first time; after that no password is needed to switch either way.',
      '• Today panel colors & stickers: personalize Today and More separately; those choices follow your account across devices.',
      '• Your color (the circle with your initial, your map dot) is saved for everyone to see. Blog posting, Icons, Theme, Accent color, Phone bars and Color key colors are saved on this device only.',
    ],
  },
  {
    id: 'about',
    title: 'About Align',
    tip: 'A free, family-only app. Your data is kept in the family’s own Firebase project; nothing is shared or sold.',
    body: [
      'Align was built for our family. It runs on free services: the app is hosted with the family website, the data lives in the family’s own Firebase project (Google), and the calendar sync is a Google Apps Script.',
      '• Only accounts added to the household can sign in, and each list’s “who can see it” is enforced by the database itself, not just the screen.',
      '• Pictures added in Align are stored with the family data; texts go through your own phone.',
    ],
  },
]

export const helpTopic = (id: HelpTopicId) => HELP_TOPICS.find((t) => t.id === id)!
