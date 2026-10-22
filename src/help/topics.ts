// Help (DESIGN.md §10.4): one short entry per part of Align, shown two ways from this one place: a small ⓘ beside
// a heading (the `tip`), and the Help page (#/help, every topic's `body`). Keep the wording plain and short, and
// update a topic whenever the feature it describes changes.

export type HelpTopicId =
  | 'start'
  | 'today'
  | 'tasks'
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
      '• Today: what’s on for the day, your goals, and photos from this day in other years.',
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
      '• On this day: favorite photos taken on this date in earlier years (or near it, or a few from the archive). Tap one to see it larger or text it.',
      '• To do: tasks for the day, overdue ones, and what’s in progress. The buttons on each card move it to the next day, mark it won’t do, or text someone about it.',
      '• + Add: type a to do for this day (it goes to your Inbox list). Push rest: the end-of-day sweep to tomorrow.',
      '• The color swatch next to the count shows what the card colors mean (who can see each task).',
    ],
  },
  {
    id: 'tasks',
    title: 'Lists and tasks',
    tip: 'Lists hold tasks (with dates and priorities), checklist items, notes, or links. Tap an item to see it; Edit to change it.',
    body: [
      'Make a list with “+ New list” in the menu, or “+ New list…” when choosing a task’s list. Kinds:',
      '• Task list: to dos with dates, priority, who it’s for and who’s doing it.',
      '• Project: tasks that depend on each other (“can’t start until…”), with a timeline; moving one offers to move the ones after it.',
      '• Checklist: things to tick off (shopping, packing); finished items stay crossed off until you hide them.',
      '• Notes: reference info (sizes, numbers, instructions).',
      '• Links: bookmarks grouped by category; a link can also go on your Reading list as a task.',
      'A task can be To do, Doing, Done or Canceled. Calendar events show up as tasks too (see Google Calendar).',
    ],
  },
  {
    id: 'privacy',
    title: 'Who can see it',
    tip: 'Only me · Parents · Family (household accounts) · Chosen people · Everyone (family plus view-only accounts). New things start at your default in Settings.',
    body: [
      'Every list and goal has one of five choices, and everything in a list follows its list:',
      '• Only me: just you.',
      '• Parents: the people ticked under Settings → Parents.',
      '• Family: everyone with a household account.',
      '• Chosen people: the names you pick.',
      '• Everyone: the family plus anyone with view-only access.',
      'Family and chosen members can change what they can see; view-only accounts only look. Goals also have a separate “who can log it”. Your default for new lists and quick adds is in Settings.',
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
      '• In chat: “text Linda I picked up milk”, or “text Linda about pick up Camilla: are you getting her?”.',
    ],
  },
  {
    id: 'goals',
    title: 'Goals',
    tip: 'Daily goals you log: done or not, a tally, a number that moves toward a goal, a measurement, or a running total. Others can see them without logging unless you allow it.',
    body: [
      'Kinds of goal:',
      '• Check: done or not each day. Tally: tap once each time (water glasses).',
      '• Progressive: a suggestion that changes on a schedule toward a goal (weight from 200 down 1 every 2 days to 169).',
      '• Measure: a fixed target. Running total: amounts add up toward a target (vacation savings).',
      'Each goal has “who can view” and “who can log” (only you, by default). The Goals page groups them: yours, shared ones (with who else logs them), and other people’s.',
      'Turn on “Show a timer” for number goals to time a walk and put the minutes in with “Use”. Each day can also have a note, links and pictures; the goal page has a chart, a table and comments.',
    ],
  },
  {
    id: 'photos',
    title: 'Photos',
    tip: 'The family’s favorite photos, published from the photo library. Search by name, year or event; tap one to see it larger or text it.',
    body: [
      'Favorites come from the family photo library (psort): starred photos that aren’t marked private are published for the blog’s photo browser, and Align shows the same ones.',
      '• Photos page: search names, years, months or events; Top picks; tap to see larger, open full size, or text it.',
      '• On this day (Today): favorites from this date in earlier years.',
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
      'Align was built for the Nelson family. It runs on free services: the app is hosted with the family website, the data lives in the family’s own Firebase project (Google), and the calendar sync is a Google Apps Script.',
      '• Only accounts added to the household can sign in, and each list’s “who can see it” is enforced by the database itself, not just the screen.',
      '• Pictures added in Align are stored with the family data; texts go through your own phone.',
    ],
  },
]

export const helpTopic = (id: HelpTopicId) => HELP_TOPICS.find((t) => t.id === id)!
