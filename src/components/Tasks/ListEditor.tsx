import { useState, type FormEvent } from 'react'
import { createList, deleteList, updateList, type ListInput } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List } from '../../types'
import { people, sharedNames } from '../../utils/tasks'

/** Create or edit a list/project. Visibility changes rewrite the copied fields on its tasks in the same batch. */
export function ListEditor({ list, onClose }: { list: List | null; onClose: () => void }) {
  const app = useApp()
  // A list's contents are tasks, or checklist items / notes: the batch updates must cover both.
  const { tasks: taskDocs, listItems } = useData()
  const tasks = [...taskDocs, ...listItems]
  const [form, setForm] = useState<ListInput>(
    // New lists start with your own default privacy (Settings).
    list ?? { name: '', kind: 'list', visibility: app.member.defaultVisibility ?? 'private', ownerId: app.uid, viewerVisible: false, defaultContext: 'family' },
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<ListInput>) => setForm((f) => ({ ...f, ...patch }))
  const members = people(app.household, true)
  // Anyone can be chosen for a shared list, viewers (grandparents) included; the owner always stays on it.
  const everyone = people(app.household)
  const owner = form.ownerId || app.uid
  const chosen = new Set([owner, ...(form.sharedWith ?? [])])
  const parents = (app.household.groups?.parents ?? []).filter((id) => app.household.members[id])
  const toggle = (id: string) => {
    if (id === owner) return
    const next = new Set(chosen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    set({ sharedWith: [...next] })
  }
  // Only the owner may hand a list to someone else (rules), and private lists always belong to their owner.
  const canChangeOwner = list !== null && list.ownerId === app.uid && form.visibility === 'family'

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const data = {
      ...form,
      name: form.name.trim(),
      viewerVisible: form.visibility === 'family' && form.viewerVisible,
      sharedWith: form.visibility === 'shared' ? [...chosen] : undefined,
    }
    if (data.visibility === 'shared' && chosen.size < 2) {
      setError('Pick at least one other person to share with, or choose "Just me".')
      setBusy(false)
      return
    }
    try {
      if (list) {
        await updateList(list, data, tasks)
      } else {
        const id = await createList({ ...data, ownerId: app.uid })
        app.navigate({ view: 'list', listId: id, timeline: false })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!list) return
    const count = tasks.filter((t) => t.listId === list.id).length
    if (!window.confirm(`Delete "${list.name}" and its ${count} item(s)?`)) return
    try {
      await deleteList(list.id, tasks)
      app.navigate({ view: 'home' })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="card form modal" onSubmit={save} onClick={(e) => e.stopPropagation()}>
        <h2>{list ? 'Edit list' : 'New list or project'}</h2>
        <label>
          Name
          <input value={form.name} onChange={(e) => set({ name: e.target.value })} required autoFocus />
        </label>
        <div className="grid2">
          <label>
            Kind
            <select value={form.kind} onChange={(e) => set({ kind: e.target.value as List['kind'] })}>
              <option value="list">Task list</option>
              <option value="project">Project (dependencies, timeline)</option>
              <option value="checklist">Checklist (shopping, gifts, people to call…)</option>
              <option value="notes">Notes (reference info)</option>
            </select>
          </label>
          <label>
            Who can see it
            <select
              value={form.visibility}
              onChange={(e) => set({ visibility: e.target.value as List['visibility'], ownerId: list?.ownerId ?? app.uid })}
            >
              <option value="private">🔒 Just me</option>
              <option value="family">👪 Family</option>
              <option value="shared">👥 Chosen people</option>
            </select>
          </label>
          <label>
            Default context
            <select value={form.defaultContext} onChange={(e) => set({ defaultContext: e.target.value as List['defaultContext'] })}>
              <option value="family">Family</option>
              <option value="work">Work</option>
            </select>
          </label>
          {canChangeOwner && (
            <label>
              Owner
              <select value={form.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
                {members.map(([id, m]) => (
                  <option key={id} value={id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {form.visibility === 'shared' && (
          <div className="share-picker">
            <span className="label">Share with</span>
            <div className="chips">
              {parents.length > 0 && (
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => set({ sharedWith: [...new Set([owner, ...parents])] })}
                  title={`Just the parents: ${parents.map((id) => app.household.members[id].displayName).join(', ')}`}
                >
                  Parents
                </button>
              )}
              {everyone.map(([id, m]) => (
                <label key={id} className={`chip-toggle${chosen.has(id) ? ' on' : ''}`} title={id === owner ? 'The owner is always included' : ''}>
                  <input type="checkbox" checked={chosen.has(id)} disabled={id === owner} onChange={() => toggle(id)} />
                  {id === app.uid ? 'You' : m.displayName}
                  {m.role === 'viewer' && ' (viewer)'}
                </label>
              ))}
            </div>
            <p className="muted small">
              👥 {sharedNames([...chosen], app.household, app.uid)} will see this list and everything in it. Only people on it can open it.
              {parents.length === 0 && ' (Set who the parents are in ⚙ Settings for a one-tap "Parents" choice.)'}
            </p>
          </div>
        )}
        {form.visibility === 'family' && (
          <label className="inline">
            <input type="checkbox" checked={form.viewerVisible} onChange={(e) => set({ viewerVisible: e.target.checked })} />
            Visible to viewers (grandparents, etc.)
          </label>
        )}
        {list && list.visibility === 'family' && form.visibility === 'private' && list.ownerId !== app.uid && (
          <p className="error small">Only the list's owner can make it private.</p>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={busy}>
            {list ? 'Save' : 'Create'}
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <span className="grow" />
          {list && (
            <button type="button" className="danger small" onClick={remove}>
              Delete list
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
