// Import and export for lists (DESIGN.md §10.6), as Markdown (readable, editable anywhere) and, for links, the
// browser bookmarks file every browser can import and export. One file is one whole list: notes as "## Title"
// sections; links with their categories as nested headings; tasks / projects / checklists as "- [ ]" checklists,
// with dates and dependencies in braces so a project comes back with its schedule. Pure functions, unit-tested.
import { cleanCategory, defaultName, safeUrl } from './links'

export interface NoteIn {
  title: string
  notes?: string
}
export interface LinkIn {
  title: string
  url: string
  category?: string
  notes?: string
}
export interface TaskIn {
  title: string
  notes?: string
  done?: boolean
  startDate?: string
  durationDays?: number
  targetDate?: string
  /** Titles of tasks this one waits on ("after: …"), matched to tasks by title on import. */
  after?: string[]
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

// ---------- Notes ----------

export function notesToMarkdown(listName: string, notes: NoteIn[]): string {
  const parts = [`# ${listName}`, '']
  for (const n of notes) parts.push(`## ${n.title}`, '', ...(n.notes?.trim() ? [n.notes.trim(), ''] : []))
  return parts.join('\n').trimEnd() + '\n'
}

/**
 * Notes from Markdown: each "## Title" (or "# Title" when the file has no "##") starts a note; the text under it is
 * the note. A file with no headings is one note, titled from `fallbackTitle` (e.g. the file name).
 */
export function markdownToNotes(text: string, fallbackTitle = 'Imported note'): NoteIn[] {
  const t = text.trim()
  // JSON: [{ "title": …, "note": … }]
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t) as Record<string, unknown>[]
      return arr
        .map((o) => ({ title: String(o.title ?? o.name ?? '').trim(), notes: String(o.note ?? o.notes ?? o.text ?? o.body ?? '').trim() }))
        .filter((n) => n.title)
        .map((n) => (n.notes ? n : { title: n.title }))
    } catch {
      // not JSON after all
    }
  }
  // "title: …" / "note: …" blocks (YAML-ish; a "- " in front is fine; lines after "note:" continue the note).
  if (/^\s*(-\s+)?title\s*:/im.test(t) && !/^#{1,6}\s/m.test(t)) {
    const out: NoteIn[] = []
    let cur: NoteIn | null = null
    let inNote = false
    for (const raw of t.replace(/\r\n?/g, '\n').split('\n')) {
      const title = raw.match(/^\s*(?:-\s+)?title\s*:\s*(.*)$/i)
      const note = raw.match(/^\s*(?:note|notes|text|body)\s*:\s*\|?\s*(.*)$/i)
      if (title) {
        if (cur) out.push(cur)
        cur = { title: title[1].replace(/^["']|["']$/g, '').trim() }
        inNote = false
      } else if (note && cur) {
        cur.notes = note[1].replace(/^["']|["']$/g, '').trim()
        inNote = true
      } else if (inNote && cur && raw.trim()) cur.notes = [cur.notes, raw.trim()].filter(Boolean).join('\n')
    }
    if (cur) out.push(cur)
    return out.filter((n) => n.title).map((n) => (n.notes ? n : { title: n.title }))
  }
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const level = lines.some((l) => /^##\s+\S/.test(l)) ? '##' : lines.filter((l) => /^#\s+\S/.test(l)).length > 1 ? '#' : null
  if (!level) {
    const body = text.trim()
    return body ? [{ title: fallbackTitle, notes: body }] : []
  }
  const out: NoteIn[] = []
  let cur: { title: string; body: string[] } | null = null
  const flush = () => {
    if (cur) out.push({ title: cur.title, ...(cur.body.join('\n').trim() ? { notes: cur.body.join('\n').trim() } : {}) })
  }
  for (const l of lines) {
    const h = l.match(level === '##' ? /^##\s+(.+?)\s*#*$/ : /^#\s+(.+?)\s*#*$/)
    if (h) {
      flush()
      cur = { title: h[1].trim(), body: [] }
    } else if (cur && !(level === '##' && /^#\s/.test(l))) cur.body.push(l)
  }
  flush()
  return out
}

// ---------- Links ----------

/** Links as Markdown: uncategorized first, then "## Home", "### Utilities"… (deeper categories, deeper headings). */
export function linksToMarkdown(listName: string, links: LinkIn[]): string {
  const out = [`# ${listName}`, '']
  const line = (l: LinkIn) => `- [${l.title.replace(/[[\]]/g, '')}](${l.url})${l.notes?.trim() ? ` — ${l.notes.trim().replace(/\n+/g, ' ')}` : ''}`
  const byCat = new Map<string, LinkIn[]>()
  for (const l of links) byCat.set(cleanCategory(l.category), [...(byCat.get(cleanCategory(l.category)) ?? []), l])
  const cats = [...byCat.keys()].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
  let prev: string[] = []
  for (const cat of cats) {
    const path = cat ? cat.split('/') : []
    // Headings for the parts of the path that differ from the previous category.
    let same = 0
    while (same < path.length && same < prev.length && path[same] === prev[same]) same++
    for (let i = same; i < path.length; i++) out.push(`${'#'.repeat(Math.min(6, i + 2))} ${path[i]}`, '')
    out.push(...byCat.get(cat)!.sort((a, b) => a.title.localeCompare(b.title)).map(line), '')
    prev = path
  }
  return out.join('\n').trimEnd() + '\n'
}

/**
 * Links from Markdown or plain text: "[Title](url) — note" items, bare addresses, and categories from headings
 * below the top one ("## Home" → Home, "### Utilities" → Home/Utilities) or from indented bullets without a link.
 */
export function markdownToLinks(text: string): LinkIn[] {
  const out: LinkIn[] = []
  const headings: string[] = [] // headings[0] is "#", [1] is "##", …
  const bullets: { indent: number; name: string }[] = []
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!raw.trim()) continue
    const h = raw.match(/^(#{1,6})\s+(.+?)\s*#*$/)
    if (h) {
      headings.length = h[1].length - 1
      headings[h[1].length - 1] = h[2].trim()
      bullets.length = 0
      continue
    }
    const indent = raw.match(/^\s*/)![0].replace(/\t/g, '  ').length
    const body = raw.trim().replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, '')
    while (bullets.length && bullets.at(-1)!.indent >= indent) bullets.pop()
    const md = body.match(/^\[([^\]]*)\]\(([^)\s]+)\)\s*(?:[—–-]\s*(.*))?$/)
    const bare = body.match(/^(?:<)?((?:https?:\/\/|www\.)\S+?)(?:>)?(?:\s+[—–-]\s*(.*))?$/)
    const url = safeUrl(md ? md[2] : bare ? bare[1] : undefined)
    if (!url) {
      // A bullet with no link names a category for the bullets indented under it.
      if (/^\s*[-*+]\s/.test(raw)) bullets.push({ indent, name: body })
      continue
    }
    const category = cleanCategory([...headings.slice(1), ...bullets.map((b) => b.name)].filter(Boolean).join('/'))
    const notes = (md ? md[3] : bare?.[2])?.trim()
    out.push({ title: (md?.[1] || '').trim() || defaultName(url), url, ...(category ? { category } : {}), ...(notes ? { notes } : {}) })
  }
  return out
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const unesc = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&')

/** The browser bookmarks file (the "Netscape" format Chrome, Edge, Firefox and Safari import), one folder per category. */
export function linksToBookmarksHtml(listName: string, links: LinkIn[]): string {
  interface Folder {
    links: LinkIn[]
    sub: Map<string, Folder>
  }
  const root: Folder = { links: [], sub: new Map() }
  for (const l of links) {
    let f = root
    for (const part of cleanCategory(l.category).split('/').filter(Boolean)) {
      if (!f.sub.has(part)) f.sub.set(part, { links: [], sub: new Map() })
      f = f.sub.get(part)!
    }
    f.links.push(l)
  }
  const lines = ['<!DOCTYPE NETSCAPE-Bookmark-file-1>', '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">', '<TITLE>Bookmarks</TITLE>', '<H1>Bookmarks</H1>', '<DL><p>']
  const write = (name: string, f: Folder, depth: number) => {
    const pad = '    '.repeat(depth)
    lines.push(`${pad}<DT><H3>${esc(name)}</H3>`, `${pad}<DL><p>`)
    for (const l of [...f.links].sort((a, b) => a.title.localeCompare(b.title))) {
      lines.push(`${pad}    <DT><A HREF="${esc(l.url)}">${esc(l.title)}</A>`)
      if (l.notes?.trim()) lines.push(`${pad}    <DD>${esc(l.notes.trim())}`)
    }
    for (const [n, sub] of [...f.sub].sort(([a], [b]) => a.localeCompare(b))) write(n, sub, depth + 1)
    lines.push(`${pad}</DL><p>`)
  }
  write(listName, root, 1)
  lines.push('</DL><p>')
  return lines.join('\n') + '\n'
}

/** The browsers' own top folders, left out of categories (everything would otherwise start with them). */
const BROWSER_ROOTS = /^(bookmarks bar|bookmarks toolbar|favorites bar|favourites bar|other bookmarks|bookmarks menu|mobile bookmarks|favorites)$/i

/** Links from a browser bookmarks file: folders become categories ("Home/Utilities"); descriptions become notes. */
export function bookmarksHtmlToLinks(html: string): LinkIn[] {
  const out: LinkIn[] = []
  const stack: (string | null)[] = []
  let pendingFolder: string | null = null
  let last: LinkIn | null = null
  const re = /<(\/?)(dl|h3|a|dd)\b([^>]*)>([^<]*)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const [, close, tagRaw, attrs, after] = m
    const tag = tagRaw.toLowerCase()
    if (tag === 'dl') {
      if (close) stack.pop()
      else {
        stack.push(pendingFolder)
        pendingFolder = null
      }
    } else if (tag === 'h3' && !close) {
      pendingFolder = unesc(after.trim())
    } else if (tag === 'a' && !close) {
      const href = attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1]
      const url = safeUrl(href ? unesc(href) : undefined)
      if (!url || !/^https?:/.test(url)) {
        last = null
        continue
      }
      const folders = stack.filter((f): f is string => !!f)
      const cat = cleanCategory((folders.length && BROWSER_ROOTS.test(folders[0]) ? folders.slice(1) : folders).join('/'))
      last = { title: unesc(after.trim()) || defaultName(url), url, ...(cat ? { category: cat } : {}) }
      out.push(last)
    } else if (tag === 'dd' && !close && last && after.trim()) {
      last.notes = unesc(after.trim())
    }
  }
  return out
}

/** Bookmarks HTML or Markdown / text? */
export const looksLikeBookmarks = (text: string) => /<!DOCTYPE NETSCAPE-Bookmark-file|<DT>\s*<A\s/i.test(text)

// ---------- Tasks, projects, checklists ----------

/** "{start 2026-11-01, 3 days, due 2026-11-05, after: Pour slab; Frame walls}" for a task's schedule, or "". */
function taskMeta(t: TaskIn, withDates: boolean): string {
  if (!withDates) return ''
  const bits = [
    t.startDate && `start ${t.startDate}`,
    t.startDate && t.durationDays && t.durationDays > 1 && `${t.durationDays} days`,
    t.targetDate && `due ${t.targetDate}`,
    t.after?.length && `after: ${t.after.join('; ')}`,
  ].filter(Boolean)
  return bits.length ? ` {${bits.join(', ')}}` : ''
}

/** A task list, project or checklist as a Markdown checklist; notes are indented under their task. */
export function tasksToMarkdown(listName: string, tasks: TaskIn[], withDates = true): string {
  const out = [`# ${listName}`, '']
  for (const t of tasks) {
    out.push(`- [${t.done ? 'x' : ' '}] ${t.title.replace(/\{/g, '(').replace(/\}/g, ')')}${taskMeta(t, withDates)}`)
    for (const l of (t.notes ?? '').trim().split('\n').filter((l) => l.trim())) out.push(`  ${l}`)
  }
  return out.join('\n') + '\n'
}

/**
 * Tasks from a Markdown checklist (or plain lines): "- [ ] Title", "- [x] Done", "- Title", "1. Title". Indented lines
 * under a task are its note; "Title: note" works too. "{start …, N days, due …, after: A; B}" sets the schedule.
 */
export function markdownToTasks(text: string): TaskIn[] {
  const out: TaskIn[] = []
  let cur: TaskIn | null = null
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!raw.trim() || /^#{1,6}\s/.test(raw)) continue
    const item = raw.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.+)$/)
    if (item && item[1].length < 2) {
      let body = item[3].trim()
      const t: TaskIn = { title: body, ...(item[2] && item[2] !== ' ' ? { done: true } : {}) }
      const meta = body.match(/\s*\{([^}]*)\}\s*$/)
      if (meta) {
        body = body.slice(0, meta.index).trim()
        for (const part of meta[1].split(',').map((p) => p.trim())) {
          const start = part.match(/^start\s+(\S+)$/i)
          const due = part.match(/^due\s+(\S+)$/i)
          const days = part.match(/^(\d+)\s+days?$/i)
          const after = part.match(/^after:\s*(.+)$/i)
          if (start && DATE.test(start[1])) t.startDate = start[1]
          else if (due && DATE.test(due[1])) t.targetDate = due[1]
          else if (days) t.durationDays = Math.max(1, Number(days[1]))
          else if (after) t.after = after[1].split(';').map((s) => s.trim()).filter(Boolean)
        }
      }
      const i = body.search(/:\s/)
      if (i > 0) {
        t.title = body.slice(0, i).trim()
        t.notes = body.slice(i + 1).trim()
      } else t.title = body
      if (t.title) out.push((cur = t))
      continue
    }
    if (cur && /^\s{2,}\S/.test(raw)) cur.notes = [cur.notes, raw.trim()].filter(Boolean).join('\n')
    else if (!item) {
      // A plain line (no bullet) is a task of its own.
      const t: TaskIn = { title: raw.trim() }
      out.push((cur = t))
    }
  }
  return out
}

/** A safe file name from a list name: "Home & Garden" → "home-garden". */
export const fileNameFor = (name: string, ext: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'list'}.${ext}`
