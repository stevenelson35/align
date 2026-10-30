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
  | 'goals'
  | 'photos'
  | 'map'
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
    tip: 'The place to start: Goals, Family Map, Contacts, Gifts, Lists, Projects, Flashcards, Archive Pics, The Daily and To Do. Every other page has Today ✕ at the top right to come back.',
    body: [
      'Today shows one day; ‹ and › go to other days (past days show what was done, skipped or pushed then). From top to bottom:',
      '• Goals: a summary of the goals you log: where each stands (“4 to go”, Done) and a small trend chart. The pencil beside a goal opens logging for just that one; Log all shows every goal ready to log (remembered on this device). Goals that don’t run that day (a weekdays-only walk on Saturday) show greyed as “Not today”. Folded each morning.',
      '• Family Map: where everyone sharing their location was last seen; tap a name to open the map on them.',
      '• Gifts: what you’re getting for others (tick when bought) and each gift list.',
      '• To Do filters by All / Mine / Family / Shared, like the Tasks page and Goals (remembered on this device); picking one opens the list. Folded, it shows “Show 28”.',
      '• The weather icon beside the date (Today only) shows Orlando now; tap it for the high / low, chance of rain and a link to the full forecast (data from Open-Meteo, refreshed every 30 minutes).',
      '• The footer at the bottom of Today has More… and Shortcuts…. More… holds the sections you use less (Gifts, Lists, Links, Projects and Flashcards to start); Arrange Today, inside it, moves any section between the main page and More… (for you, on every device).',
      '• Shortcuts… holds the people and links you use most: open one and tap “Add to Shortcuts”. A person gets call / text / email; a link opens in one tap. Reorder… moves them up or down (or ✕ removes one).',
      '• Gifts, Lists, Links, Projects, Flashcards and Contacts each have + in the heading: a new list, project, set or gift list, or a new link or person (pick which list it goes in).',
      '• Contacts, Lists, Links, Projects and Flashcards all open the same way: what you pinned (☆) first, then a search box (with filters: contact lists and tags; Mine / Family / Shared for lists), then Show all to scroll through everything right here. Lists, Projects and Flashcards show as rows or cards. “All contacts” opens the contacts page (import, export, editing).',
      '• On This Day / Archive Pics: favorite family photos from this date in earlier years (see Archive Pics).',
      '• The Daily: a word, joke, puzzles, pictures and more, with answers to reveal. Folded each morning.',
      '• To Do: the day’s tasks (see To Do), then Done, Won’t Do and Pushed to a Later Day.',
      'Tap any section’s title to fold it away or open it again. Google Calendar and Refresh at the top keep the family calendar in step.',
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
      'Tap a photo to see it larger, open it full size, or text it to someone. “All” opens the Photos page. It starts shown each morning; Hide (or tap the title) folds it for the day.',
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
      '• All, Mine (your private lists), Family (Family and Everyone lists) or Shared (lists shared with chosen people). Work appears only if something is marked work.',
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
    tip: 'A set of cards to learn: think of the answer, Show answer, then “Got it” or “Not yet”. Study in order, shuffled, or only the ones you haven’t got yet.',
    body: [
      'Make a set with “+ New list” → Flashcards (spelling words, times tables, state capitals…).',
      '• The set opens ready to study. Tap Cards (the number of cards) to list them with your ✓ / ✗, and Edit there to add cards, import a set, export, or change the list.',
      '• Add a card with its front (the question) and back (the answer), or “Import a set of cards…”: paste lines like “Paris | Capital of France” (or Q: / A: lines), or choose a YAML file with front: / back: for each card.',
      '• Study: pick In order, Shuffled, or Only ones not known yet, then Start. Think, tap Show answer, and say Got it or Not yet; at the end you can go over the ones you missed.',
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
      '• To share: under Your location, tap Set up my phone, install OwnTracks (iPhone or Android), tap Set up OwnTracks on the phone, and allow location Always. It reports in the background and saves battery by only reporting real moves.',
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
    tip: 'Your own settings (tap your initial at the top right): sign out, who sees new things by default, your phone number, the Parents group, your password, the blog token, icons, theme and colors.',
    body: [
      'Tap your initial (top right) for Settings.',
      '• Who can see new things: your default for new lists and quick adds.',
      '• New tasks without a date: due the day you add them (so they show on Today), or no date.',
      '• Your mobile number: so others can text you from Align.',
      '• Parents: who “Parents” means. Once set, only a parent can change it.',
      '• Password: change it here; forgot it? Use “Forgot password?” on the sign-in screen.',
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
