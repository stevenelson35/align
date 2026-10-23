// Help (DESIGN.md §10.4): one short entry per part of Align, shown two ways from this one place: a small ⓘ beside
// a heading (the `tip`), and the Help page (#/help, every topic's `body`). Keep the wording plain and short, and
// update a topic whenever the feature it describes changes.

export type HelpTopicId =
  | 'start'
  | 'today'
  | 'tasks'
  | 'taskViews'
  | 'projects'
  | 'checklists'
  | 'notes'
  | 'links'
  | 'picks'
  | 'cards'
  | 'daily'
  | 'privacy'
  | 'details'
  | 'texting'
  | 'goals'
  | 'photos'
  | 'voting'
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
    tip: 'Your day: goals to log, photos from this date, and what’s to do. ‹ › move between days. “+ Add” adds a to do for this day; “Push rest” moves what’s left to tomorrow.',
    body: [
      'Today shows one day at a time; ‹ and › go to other days (past days show what was done, skipped or pushed then).',
      '• Goals: the goals you log, with a small trend chart. They start hidden each morning; tap “Goals” or Show.',
      '• On This Day / Near This Day / Archive Pics: favorite photos taken on this date in earlier years (or near it, or a few from the archive). Tap one to see it larger or text it.',
      '• To do: tasks for the day, overdue ones, and what’s in progress. The buttons on each card move it to the next day, mark it won’t do, or text someone about it.',
      '• + Add: type a to do for this day (it goes to your Inbox list); “Title: note” puts what follows the colon in the note. Push rest (⏭): the end-of-day sweep to tomorrow.',
      '• Tap a section’s title (To Do, Done, Won’t Do, Pushed, Goals, Archive Pics) to fold it away or open it again.',
      '• The color swatch next to the count shows what the card colors mean (who can see each task).',
      '• Also show: tasks you can see but not change (someone kept editing their list to themselves) are left off; tick a person, or Everyone, to include theirs.',
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
      'A task can be To do, Doing, Done or Canceled. Calendar events show up as tasks too (see Google Calendar).',
    ],
  },
  {
    id: 'taskViews',
    title: 'My tasks, Family tasks, Work, Everything',
    tip: 'Tasks from every list in one place. Filter by list, family or work, who it’s for, who’s doing it, priority and status; sort by date, priority or dependency order.',
    body: [
      'These pages gather tasks from all the lists you can see (checklist items, notes and links stay in their own lists):',
      '• My tasks: your private tasks. Family tasks: tasks on Family and Everyone lists. Work: tasks with the Work context. Everything: all of them.',
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
    tip: 'A set of cards to learn: think of the answer, Show answer, then “Got it” or “Not yet”. Study in order, shuffled, or only the ones you haven’t got yet.',
    body: [
      'Make a set with “+ New list” → Flashcards (spelling words, times tables, state capitals…).',
      '• Add a card with its front (the question) and back (the answer), or “Import a set of cards…”: paste lines like “Paris | Capital of France” (or Q: / A: lines), or choose a YAML file with front: / back: for each card.',
      '• Study: pick In order, Shuffled, or Only ones not known yet, then Start. Think, tap Show answer, and say Got it or Not yet; at the end you can go over the ones you missed.',
      '• Results are kept for each person (the ✓ / ✗ beside each card is yours). Start over forgets yours; anyone who can see the set can study it.',
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
      'Tasks, checklist items, notes, links, vote options and goal days all share the same details:',
      '• Note: anything worth writing down.',
      '• Links: a name (shown) and an address (Show address reveals it); tapping opens it in a new tab.',
      '• Pictures: “+ Add a picture” uses your phone’s photo picker, then lets you crop or rotate; they’re stored in Align and only household accounts can open them. “From favorites” picks one of the family photos.',
      '• Comments: anyone who can see the entry can read them; members can add their own. The message icon on a comment texts it to someone.',
    ],
  },
  {
    id: 'texting',
    title: 'Texting',
    tip: '“Text about this” opens Messages on your phone with a note and a link filled in; you press Send. Nothing is sent by Align itself.',
    body: [
      'Align doesn’t send texts; it fills them in for your own Messages app, so it’s free and replies come back as normal texts.',
      '• Each person adds their mobile number in Settings so others can text them from Align.',
      '• “Text about this” on any entry includes its title, when it happens, and a link that opens it in Align.',
      '• In chat: “text Sam I picked up milk”, or “text Sam about pick up Alex: are you getting her?”.',
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
      'Each board is a decision (movies, restaurants, weekend plans, trips). Anyone in the family can suggest an option.',
      '• Spend tokens with ＋ and −; your balance is at the top. Tokens arrive each week and unused ones roll over, so saving them up counts for more on something you care about.',
      '• Tap an option for its note, links, pictures and comments; the board has its own Discussion.',
      '• Mark the winner Chosen, or Archive options that are out.',
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
    tip: 'Your own settings: who sees new things by default, your phone number, the Parents group, your password, the blog token, icons and theme.',
    body: [
      'Tap your initial (top right) for Settings.',
      '• Who can see new things: your default for new lists and quick adds.',
      '• New tasks without a date: due the day you add them (so they show on Today), or no date.',
      '• Your mobile number: so others can text you from Align.',
      '• Parents: who “Parents” means. Once set, only a parent can change it.',
      '• Password: change it here; forgot it? Use “Forgot password?” on the sign-in screen.',
      '• Blog posting, Icons and Theme are saved on this device only.',
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
