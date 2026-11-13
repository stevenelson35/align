import { useState, type FormEvent } from 'react'
import { addReadingTask, addTaskNow, READING_LIST, readingListFor, setPinnedLink } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { allCategories, cleanCategory, defaultName, linkTree, safeUrl, type LinkNode } from '../../utils/links'
import { ListHeader } from './ListHeader'
import { Icon } from '../UI/Icon'
import { parentsOf } from '../../utils/audience'
import { EntryRow } from '../Entries/EntryRow'
import { EntrySizeSwitch } from '../Entries/EntrySizeSwitch'
import { useEntrySize } from '../../hooks/useEntrySize'
import { ItemIcon } from '../UI/ItemIcon'

/** Links (bookmarks) in a collapsible category tree. Tapping a name opens it in a new tab; 💬 texts the address. */
export function LinksView({ list }: { list: List }) {
  const app = useApp()
  const { listItems, lists, tasks } = useData()
  const editable = app.canEdit(list)
  const links = listItems.filter((t) => t.listId === list.id)
  const [size, setSize] = useEntrySize(list)
  const closedKey = `align-links-closed:${list.id}`
  const [closed, setClosed] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(closedKey) ?? '[]') as string[]))
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [pin, setPin] = useState(false)
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
    if (pin) {
      setPin(false)
      setPinnedLink(app.uid, app.member.pinnedLinks, id, true).catch((err) => setError(`The link was added, but not pinned: ${err instanceof Error ? err.message : String(err)}`))
    }
    if (toRead) {
      const chosen = taskLists.find((l) => l.id === readList)
      ;(chosen ? Promise.resolve(chosen) : readingListFor(app.uid, app.member.defaultVisibility, taskLists, parentsOf(app.household)))
        .then((target) => addReadingTask(target, { id, title, url: href }, app.uid).written)
        .catch((err) => setError(`The link was added, but not to the reading list: ${err instanceof Error ? err.message : String(err)}`))
    }
  }

  // One entry row per link (simple: the name; medium: + its address and reading badge; detail: + its note and
  // the rest). The name opens the site; ⋯ has the rest.
  const row = (l: Task) => {
    const href = safeUrl(l.url)
    const reading = readingTask.get(l.id)
    return (
      <EntryRow
        key={l.id}
        entry={l}
        size={size}
        title={
          href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="entry-title link-name">
              <ItemIcon value={l.customIcon} /> <span className="entry-title-text">{l.title}</span> <Icon name="external" />
            </a>
          ) : undefined
        }
        chips={
          <>
            {l.url && <span className="link-url">{l.url}</span>}
            {reading && (
              <button type="button" className={`badge reading${reading.status === 'done' ? ' read' : ''}`} onClick={() => app.navigate({ view: 'task', taskId: reading.id })} title="Open its reading-list task">
                {reading.status === 'done' ? '✓ read' : <><Icon name="book" /> to read</>}
              </button>
            )}
          </>
        }
      />
    )
  }
  const node = (n: LinkNode, depth: number) => (
    <div key={n.path} className="link-group" style={{ marginLeft: depth ? '0.9rem' : 0 }}>
      <button type="button" className="link-group-title" onClick={() => toggle(n.path)} aria-expanded={!closed.has(n.path)}>
        {closed.has(n.path) ? '▸' : '▾'} {n.name} <span className="muted small">{count(n)}</span>
      </button>
      {!closed.has(n.path) && (
        <>
          <ul className="entry-list link-list">{n.links.map(row)}</ul>
          {n.children.map((c) => node(c, depth + 1))}
        </>
      )}
    </div>
  )
  const tree = linkTree(links)

  return (
    <section>
      <ListHeader list={list}>
        <EntrySizeSwitch value={size} onChange={setSize} />
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
<button type="submit" className="icon-button" aria-label="Add link" title="Add link">
              <Icon name="plus" />
            </button>
          </div>
          <div className="row reading-option">
            {app.isMember && (
              <label className="inline small" title="A shortcut in your Align menu that opens this site in a new tab">
                <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} /> <Icon name="pin" /> Pin to my menu (only you see it)
              </label>
            )}
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
      <ul className="entry-list link-list">{tree.links.map(row)}</ul>
      {tree.children.map((c) => node(c, 0))}
      {links.length === 0 && <p className="muted">No links yet. Paste an address above; add a category like "Home/Utilities" to group them.</p>}
    </section>
  )
}

function count(n: LinkNode): number {
  return n.links.length + n.children.reduce((s, c) => s + count(c), 0)
}
