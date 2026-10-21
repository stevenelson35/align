import { useState, type FormEvent } from 'react'
import { addReadingTask, addTaskNow, READING_LIST, readingListFor } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import type { List, Task } from '../../types'
import { allCategories, cleanCategory, defaultName, linkTree, safeUrl, type LinkNode } from '../../utils/links'
import { ListHeader } from './ListHeader'
import { Icon } from '../UI/Icon'
import { parentsOf } from '../../utils/audience'
import { DetailsMarks } from '../UI/Details'

/** Links (bookmarks) in a collapsible category tree. Tapping a name opens it in a new tab; 💬 texts the address. */
export function LinksView({ list }: { list: List }) {
  const app = useApp()
  const { listItems, lists, tasks } = useData()
  const editable = app.canEdit(list)
  const links = listItems.filter((t) => t.listId === list.id)
  const [showUrls, setShowUrls] = useStoredFlag(`align-links-urls:${list.id}`, false)
  const [showNotes, setShowNotes] = useStoredFlag(`align-links-notes:${list.id}`, true)
  const closedKey = `align-links-closed:${list.id}`
  const [closed, setClosed] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(closedKey) ?? '[]') as string[]))
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  // "📖 Add to a reading list": also make a "Read: …" task, in your Reading list or another task list.
  const [toRead, setToRead] = useState(false)
  const taskLists = lists.filter((l) => (l.kind === 'list' || l.kind === 'project') && app.canEdit(l))
  const [readList, setReadList] = useState('')
  // The reading task for each link, if any (done or not), to show 📖 / ✓ on the row.
  const readingTask = new Map(tasks.filter((t) => t.linkId).map((t) => [t.linkId!, t]))
  const [error, setError] = useState<string | null>(null)

  function toggle(path: string) {
    const next = new Set(closed)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    localStorage.setItem(closedKey, JSON.stringify([...next]))
    setClosed(next)
  }

  function add(e: FormEvent) {
    e.preventDefault()
    const href = safeUrl(url)
    if (!href) {
      setError('That doesn’t look like a web address (http, https, mailto or tel).')
      return
    }
    const existing = links.find((l) => l.url === href)
    if (existing) {
      setError(`That address is already here as "${existing.title}".`)
      return
    }
    setError(null)
    const typed = { url, name }
    // Clear at once (the link shows immediately): a second tap on a slow connection used to add it again.
    setUrl('')
    setName('')
    const title = name.trim() || defaultName(href)
    const { id, written } = addTaskNow(
      list,
      { title, url: href, category: cleanCategory(category) || undefined, priority: 2, status: 'todo', context: list.defaultContext, durationDays: 1, dependsOn: [] },
      app.uid,
    )
    written.catch((err) => {
      setError(err instanceof Error ? err.message : String(err))
      setUrl(typed.url)
      setName(typed.name)
    })
    if (toRead) {
      const chosen = taskLists.find((l) => l.id === readList)
      ;(chosen ? Promise.resolve(chosen) : readingListFor(app.uid, app.member.defaultVisibility, taskLists, parentsOf(app.household)))
        .then((target) => addReadingTask(target, { id, title, url: href }, app.uid).written)
        .catch((err) => setError(`The link was added, but not to the reading list: ${err instanceof Error ? err.message : String(err)}`))
    }
  }

  const row = (l: Task) => {
    const href = safeUrl(l.url)
    return (
      <li key={l.id} className="link-row">
        <div className="grow">
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="link-name">
              {l.title} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className="link-name">{l.title}</span>
          )}
          <DetailsMarks links={l.links} images={l.images} />
          {showUrls && l.url && <div className="muted small link-url">{l.url}</div>}
          {showNotes && l.notes && <div className="small link-note">{l.notes}</div>}
        </div>
        {readingTask.has(l.id) && (
          <button
            type="button"
            className={`badge reading${readingTask.get(l.id)!.status === 'done' ? ' read' : ''}`}
            onClick={() => app.navigate({ view: 'task', taskId: readingTask.get(l.id)!.id })}
            title="Open its reading-list task"
          >
            {readingTask.get(l.id)!.status === 'done' ? '✓ read' : <><Icon name="book" /> to read</>}
          </button>
        )}
        <button type="button" className="row-action" title="Edit" aria-label={`Edit ${l.title}`} onClick={() => app.selectTask(l.id)}>
          <Icon name="edit" />
        </button>
        <button type="button" className="row-action" title="Text someone this link" aria-label={`Text someone ${l.title}`} onClick={() => app.textAbout(l.id)}>
          <Icon name="message" />
        </button>
      </li>
    )
  }
  const node = (n: LinkNode, depth: number) => (
    <div key={n.path} className="link-group" style={{ marginLeft: depth ? '0.9rem' : 0 }}>
      <button type="button" className="link-group-title" onClick={() => toggle(n.path)} aria-expanded={!closed.has(n.path)}>
        {closed.has(n.path) ? '▸' : '▾'} {n.name} <span className="muted small">{count(n)}</span>
      </button>
      {!closed.has(n.path) && (
        <>
          <ul className="link-list">{n.links.map(row)}</ul>
          {n.children.map((c) => node(c, depth + 1))}
        </>
      )}
    </div>
  )
  const tree = linkTree(links)

  return (
    <section>
      <ListHeader list={list}>
        <label className="inline small">
          <input type="checkbox" checked={showUrls} onChange={(e) => setShowUrls(e.target.checked)} /> Addresses
        </label>
        <label className="inline small">
          <input type="checkbox" checked={showNotes} onChange={(e) => setShowNotes(e.target.checked)} /> Notes
        </label>
      </ListHeader>
      {editable && (
        <form className="link-add" onSubmit={add}>
          <input type="text" inputMode="url" autoCapitalize="off" autoCorrect="off" placeholder="Paste a web address…" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Address" required />
          <div className="row">
            <input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
            <input placeholder="Category, e.g. Home/Utilities" value={category} onChange={(e) => setCategory(e.target.value)} list={`cats-${list.id}`} aria-label="Category" />
            <datalist id={`cats-${list.id}`}>
              {allCategories(links).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <button type="submit">Add</button>
          </div>
          <div className="row reading-option">
            <label className="inline small">
              <input type="checkbox" checked={toRead} onChange={(e) => setToRead(e.target.checked)} /> <Icon name="book" /> Add to a reading list
            </label>
            {toRead && (
              <select value={readList} onChange={(e) => setReadList(e.target.value)} aria-label="Reading list">
                <option value="">{taskLists.some((l) => l.name === READING_LIST) ? READING_LIST : `${READING_LIST} (new)`}</option>
                {taskLists
                  .filter((l) => l.name !== READING_LIST)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <ul className="link-list">{tree.links.map(row)}</ul>
      {tree.children.map((c) => node(c, 0))}
      {links.length === 0 && <p className="muted">No links yet. Paste an address above; add a category like "Home/Utilities" to group them.</p>}
    </section>
  )
}

function count(n: LinkNode): number {
  return n.links.length + n.children.reduce((s, c) => s + count(c), 0)
}
