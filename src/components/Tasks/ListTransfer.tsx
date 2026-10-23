import { useState } from 'react'
import { addTaskNow, updateTask, type TaskInput } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { cleanCategory } from '../../utils/links'
import {
  bookmarksHtmlToLinks,
  fileNameFor,
  linksToBookmarksHtml,
  linksToMarkdown,
  looksLikeBookmarks,
  markdownToLinks,
  markdownToNotes,
  markdownToTasks,
  notesToMarkdown,
  tasksToMarkdown,
  type LinkIn,
  type NoteIn,
  type TaskIn,
} from '../../utils/transfer'
import { Icon } from '../UI/Icon'

/** Saves text as a file (the browser's download). */
function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const added = (t: Task) => (t.createdAt ? t.createdAt.seconds + t.createdAt.nanoseconds / 1e9 : Infinity)

type Parsed = { kind: 'notes'; items: NoteIn[] } | { kind: 'links'; items: LinkIn[]; skipped: number } | { kind: 'tasks'; items: TaskIn[] }

/**
 * Import / Export for a list (DESIGN.md §10.6): notes, links (Markdown or a browser bookmarks file), checklists, task
 * lists and projects (Markdown checklists, with dates and dependencies for projects), flashcards (YAML).
 */
export function ListTransfer({ list }: { list: List }) {
  const app = useApp()
  const { tasks, listItems } = useData()
  const [open, setOpen] = useState<'export' | 'import' | null>(null)
  const items = [...tasks, ...listItems].filter((t) => t.listId === list.id).sort((a, b) => added(a) - added(b))
  const isTasks = list.kind === 'list' || list.kind === 'project'
  if (list.kind === 'picks') return null

  function exportAs(format: 'md' | 'html' | 'yaml') {
    setOpen(null)
    if (list.kind === 'notes') return download(fileNameFor(list.name, 'md'), notesToMarkdown(list.name, items.map((n) => ({ title: n.title, notes: n.notes }))), 'text/markdown')
    if (list.kind === 'links') {
      const links = items.filter((l) => l.url).map((l) => ({ title: l.title, url: l.url!, category: l.category, notes: l.notes }))
      return format === 'html'
        ? download(fileNameFor(list.name, 'html'), linksToBookmarksHtml(list.name, links), 'text/html')
        : download(fileNameFor(list.name, 'md'), linksToMarkdown(list.name, links), 'text/markdown')
    }
    if (list.kind === 'cards') {
      const yaml = [`# ${list.name} (${items.length} cards). Import in Align: a Flashcards list → "Import a set of cards…".`]
      for (const c of items) yaml.push(`- front: ${JSON.stringify(c.title)}`, `  back: ${JSON.stringify(c.notes ?? '')}`)
      return download(fileNameFor(list.name, 'yaml'), yaml.join('\n') + '\n', 'text/yaml')
    }
    const title = new Map(tasks.map((t) => [t.id, t.title]))
    const rows: TaskIn[] = items.map((t) => ({
      title: t.title,
      notes: t.notes,
      done: t.status === 'done',
      startDate: t.startDate,
      durationDays: t.durationDays,
      targetDate: t.targetDate,
      after: t.dependsOn?.map((d) => title.get(d.taskId)).filter((x): x is string => !!x),
    }))
    download(fileNameFor(list.name, 'md'), tasksToMarkdown(list.name, rows, isTasks), 'text/markdown')
  }

  return (
    <span className="list-transfer">
      <button type="button" className="link small" onClick={() => (list.kind === 'links' ? setOpen(open === 'export' ? null : 'export') : exportAs('md'))} title="Save this list as a file">
        Export
      </button>
      {list.kind === 'links' && open === 'export' && (
        <span className="transfer-choices">
          <button type="button" className="link small" onClick={() => exportAs('md')}>
            Markdown
          </button>
          <button type="button" className="link small" onClick={() => exportAs('html')} title="A bookmarks file Chrome, Edge, Firefox or Safari can import">
            Bookmarks file
          </button>
        </span>
      )}
      {app.canEdit(list) && list.kind !== 'cards' && (
        <button type="button" className="link small" onClick={() => setOpen('import')} title="Add items from a file or pasted text">
          Import
        </button>
      )}
      {open === 'import' && <ImportDialog list={list} items={items} onClose={() => setOpen(null)} />}
    </span>
  )
}

const HELP: Record<string, string> = {
  notes: 'A Markdown file where each note starts with “## Title” and its text follows (a file with no headings becomes one note named after the file). YAML/JSON lists of title / note work too.',
  links: 'Markdown links “- [Name](address) — note” under headings for categories (“## Home”, “### Utilities” → Home/Utilities), indented bullets, plain addresses, or a bookmarks file exported from your browser (its folders become categories).',
  checklist: 'One item per line: “- [ ] Milk”, “- [x] Bread” (already checked), or just “Milk”. “Item: details” or indented lines add details.',
  list: 'One task per line: “- [ ] Call the vet”, “- [x] Done already”, or plain lines. “Title: note” or indented lines add a note; “{due 2026-11-05}” sets a due date.',
  project: 'A Markdown checklist like Align’s own export: “- [ ] Build frame {start 2026-11-03, 2 days, after: Buy lumber}” keeps dates and what each task waits on.',
}

function ImportDialog({ list, items, onClose }: { list: List; items: Task[]; onClose: () => void }) {
  const app = useApp()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [under, setUnder] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parse = (): Parsed | null => {
    if (!text.trim()) return null
    if (list.kind === 'notes') return { kind: 'notes', items: markdownToNotes(text, fileName.replace(/\.[^.]+$/, '') || 'Imported note') }
    if (list.kind === 'links') {
      const all = looksLikeBookmarks(text) ? bookmarksHtmlToLinks(text) : markdownToLinks(text)
      const have = new Set(items.map((l) => l.url))
      const fresh = all.filter((l, i) => !have.has(l.url) && all.findIndex((x) => x.url === l.url) === i)
      const prefix = cleanCategory(under)
      return { kind: 'links', items: fresh.map((l) => (prefix ? { ...l, category: cleanCategory(`${prefix}/${l.category ?? ''}`) } : l)), skipped: all.length - fresh.length }
    }
    return { kind: 'tasks', items: markdownToTasks(text) }
  }
  const parsed = parse()

  async function addAll() {
    if (!parsed?.items.length) return
    setBusy(true)
    setError(null)
    const base = { priority: 2 as const, context: list.defaultContext, durationDays: 1, dependsOn: [] }
    try {
      if (parsed.kind === 'notes') {
        for (const n of parsed.items) await addTaskNow(list, { ...base, status: 'todo', title: n.title.slice(0, 500), notes: n.notes }, app.uid).written
      } else if (parsed.kind === 'links') {
        for (const l of parsed.items) await addTaskNow(list, { ...base, status: 'todo', title: l.title.slice(0, 500), url: l.url, category: l.category, notes: l.notes }, app.uid).written
      } else {
        // Create the tasks, then link "after:" dependencies by title (new tasks first, then ones already in the list).
        const ids = new Map<string, string>()
        const made: { id: string; t: TaskIn }[] = []
        for (const t of parsed.items) {
          const input: TaskInput = {
            ...base,
            title: t.title.slice(0, 500),
            notes: t.notes,
            status: t.done ? 'done' : 'todo',
            startDate: t.startDate,
            targetDate: t.targetDate,
            durationDays: t.durationDays ?? 1,
          }
          const { id, written } = addTaskNow(list, input, app.uid)
          await written
          ids.set(t.title.toLowerCase(), id)
          made.push({ id, t })
        }
        for (const t of items) if (!ids.has(t.title.toLowerCase())) ids.set(t.title.toLowerCase(), t.id)
        for (const { id, t } of made) {
          const deps = (t.after ?? []).map((name) => ids.get(name.toLowerCase())).filter((x): x is string => !!x && x !== id)
          if (deps.length) await updateTask(id, { dependsOn: deps.map((taskId) => ({ taskId, offsetDays: 0 })) })
        }
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const noun = list.kind === 'notes' ? 'note' : list.kind === 'links' ? 'link' : list.kind === 'checklist' ? 'item' : 'task'
  const count = parsed?.items.length ?? 0
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card form modal" role="dialog" aria-label={`Import into ${list.name}`} onClick={(e) => e.stopPropagation()}>
        <header className="row">
          <h2 className="grow">Import into {list.name}</h2>
          <button type="button" className="link" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <p className="muted small">{HELP[list.kind] ?? HELP.list}</p>
        <input
          type="file"
          accept={list.kind === 'links' ? '.md,.markdown,.txt,.html,.htm' : '.md,.markdown,.txt,.yaml,.yml,.json'}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              setFileName(f.name)
              f.text().then(setText).catch((err) => setError(String(err)))
            }
            e.target.value = ''
          }}
          aria-label="File to import"
        />
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="…or paste here" aria-label="Text to import" />
        {list.kind === 'links' && (
          <label>
            Put them under a category (optional)
            <input value={under} onChange={(e) => setUnder(e.target.value)} placeholder="e.g. Imported/Work" />
          </label>
        )}
        {parsed && (
          <p className="small">
            {count ? `${count} ${noun}${count > 1 ? 's' : ''} found, e.g. “${parsed.items[0].title}”.` : `No ${noun}s found in that text.`}
            {parsed.kind === 'links' && parsed.skipped > 0 && ` ${parsed.skipped} already in this list (skipped).`}
          </p>
        )}
        {error && <p className="error small">{error}</p>}
        <div className="row">
          <button type="button" className="small" onClick={() => void addAll()} disabled={!count || busy}>
            <Icon name="plus" /> {busy ? 'Adding…' : `Add ${count || ''}`}
          </button>
          <button type="button" className="secondary small" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
