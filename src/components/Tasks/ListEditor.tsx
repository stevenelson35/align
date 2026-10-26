import { useState, type FormEvent } from 'react'
import { createList, deleteList, updateList, type ListInput } from '../../firebase/db'
import { useApp, useData } from '../../hooks/useApp'
import type { List } from '../../types'
import { audienceOf, parentsOf, privacyFields, viewCoveringEditors, type Audience } from '../../utils/audience'
import { people } from '../../utils/tasks'
import { AudiencePicker } from '../UI/AudiencePicker'
import { PICK_KINDS } from '../../utils/picks'

/** Create or edit a list/project. Visibility changes rewrite the copied fields on its tasks in the same batch. */
export function ListEditor({ list, onClose }: { list: List | null; onClose: () => void }) {
  const app = useApp()
  // A list's contents are tasks, or checklist items / notes: the batch updates must cover both.
  const { tasks: taskDocs, listItems } = useData()
  const tasks = [...taskDocs, ...listItems]
  const [form, setForm] = useState<ListInput>(
    // New lists start with your own default privacy (Settings).
    list ?? { name: '', kind: 'list', visibility: 'private', ownerId: app.uid, viewerVisible: false, defaultContext: 'family' },
  )
  // New lists start with your own default (Settings), which is Everyone unless you changed it.
  const [audience, setAudience] = useState<Audience>(list ? audienceOf(list) : (app.member.defaultVisibility ?? 'everyone'))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<ListInput>) => setForm((f) => ({ ...f, ...patch }))
  const members = people(app.household, true)
  const owner = form.ownerId || app.uid
  const chosen = new Set([owner, ...(form.sharedWith ?? [])])
  const parents = parentsOf(app.household)
  // Who can edit it: "same" (anyone who can see it, as lists always were) until the owner picks something narrower.
  const isOwner = !list || list.ownerId === app.uid
  const [edit, setEdit] = useState<Audience | 'same'>(list?.editAudience ?? 'same')
  const [editChosen, setEditChosen] = useState<string[]>((list?.editors ?? []).filter((id) => id !== (list?.ownerId ?? app.uid)))
  const shownEdit: Audience = edit === 'same' ? (audience === 'everyone' ? 'family' : audience) : edit
  const effective = edit === 'same' ? { view: audience, viewChosen: [...chosen], widened: false } : viewCoveringEditors(audience, [...chosen].filter((id) => id !== owner), edit, editChosen, owner, parents)
  // Only the owner may hand a list to someone else (rules), and only Family / Everyone lists can change hands.
  const canChangeOwner = list !== null && list.ownerId === app.uid && (audience === 'family' || audience === 'everyone')

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const ownerId = canChangeOwner ? owner : (list?.ownerId ?? app.uid)
    const data: ListInput = {
      ...form,
      name: form.name.trim(),
      ownerId,
      pickKind: form.kind === 'picks' ? (form.pickKind ?? 'movies') : undefined,
      recipientId: form.kind === 'gifts' ? form.recipientId : undefined,
      recipientName: form.kind === 'gifts' && !form.recipientId ? form.recipientName?.trim() : undefined,
      sharedWith: undefined,
      audience: undefined,
      ...privacyFields(effective.view, ownerId, effective.viewChosen, parents),
      // Only the owner changes who can edit; anyone else saves it exactly as it was (the rules check).
      editAudience: !isOwner ? list?.editAudience : edit === 'same' ? undefined : edit,
      editors: !isOwner ? list?.editors : edit === 'parents' || edit === 'shared' ? privacyFields(edit, ownerId, editChosen, parents).sharedWith : undefined,
    }
    const problem =
      form.kind === 'gifts' && !form.recipientId && !form.recipientName?.trim()
        ? 'Choose who the gifts are for.'
        : edit === 'shared' && !editChosen.length
        ? 'Pick at least one other person who can edit, or choose another option.'
        : edit === 'parents' && !parents.length
          ? 'Nobody is set as a parent yet: tick the parents in ⚙ Settings → Parents first.'
          : audience === 'shared' && chosen.size < 2
        ? 'Pick at least one other person to share with, or choose "Only me".'
        : audience === 'parents' && !parents.length
          ? 'Nobody is set as a parent yet: tick the parents in ⚙ Settings → Parents first.'
          : null
    if (problem) {
      setError(problem)
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
              <option value="links">Links (bookmarks by category)</option>
              <option value="picks">Pick list (rate and pick: shows, movies, music…)</option>
              <option value="cards">Flashcards (study a set: question and answer)</option>
              <option value="contacts">Contacts (people: phones, emails, addresses)</option>
              <option value="gifts">Gift list (ideas for someone; others quietly claim them)</option>
            </select>
          </label>
          {form.kind === 'gifts' &&
            (list ? (
              <p className="small">
                For <strong>{list.recipientId ? (app.household.members[list.recipientId]?.displayName ?? 'someone') : list.recipientName}</strong>
              </p>
            ) : (
              <label>
                For
                <select
                  value={form.recipientId ?? (form.recipientName !== undefined ? '__name' : '')}
                  onChange={(e) => set(e.target.value === '__name' ? { recipientId: undefined, recipientName: '' } : { recipientId: e.target.value || undefined, recipientName: undefined })}
                  required
                >
                  <option value="">Who is it for?</option>
                  {people(app.household).map(([id, m]) => (
                    <option key={id} value={id}>
                      {m.displayName}
                      {id === app.uid ? ' (me: my wish list)' : ''}
                    </option>
                  ))}
                  <option value="__name">Someone else…</option>
                </select>
              </label>
            ))}
          {form.kind === 'gifts' && !list && form.recipientName !== undefined && (
            <label>
              Their name
              <input value={form.recipientName} onChange={(e) => set({ recipientName: e.target.value })} placeholder="Grandma Rose" required maxLength={100} />
            </label>
          )}
          {form.kind === 'picks' && (
            <label>
              What’s on it
              <select value={form.pickKind ?? 'movies'} onChange={(e) => set({ pickKind: e.target.value as List['pickKind'] })}>
                {PICK_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
          )}
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
        <AudiencePicker
          label="Who can see it"
          value={audience}
          onChange={(a) => {
            setAudience(a)
            if (a !== 'family' && a !== 'everyone') set({ ownerId: list?.ownerId ?? app.uid })
          }}
          ownerId={owner}
          chosen={[...chosen]}
          onChosen={(uids) => set({ sharedWith: uids })}
          noun="list and everything in it"
        />
        {isOwner && (
          <AudiencePicker
            label="Who can edit it"
            value={shownEdit}
            onChange={setEdit}
            ownerId={owner}
            chosen={editChosen}
            onChosen={(ids) => setEditChosen(ids.filter((id) => id !== owner))}
            noun="list"
            everyoneHint="Everyone with a household account (view-only accounts can't edit)."
            forLogging
          />
        )}
        {isOwner && edit !== 'same' && (
          <p className="muted small">
            {effective.widened ? 'Everyone who can edit it can also see it, so who can see it was widened to include them. ' : ''}
            Others who can see it get a read-only view. Only you can change who edits.
            <br />
            <button type="button" className="link small" onClick={() => setEdit('same')}>
              ↺ Let anyone who can see it edit
            </button>
          </p>
        )}
        {!isOwner && list?.editAudience && <p className="muted small">Only the list’s owner can change who can edit it.</p>}
        {list && list.visibility === 'family' && audience === 'private' && list.ownerId !== app.uid && (
          <p className="error small">Only the list's owner can make it private.</p>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" className="small" disabled={busy}>
            {list ? 'Save' : 'Create'}
          </button>
          <button type="button" className="secondary small" onClick={onClose}>
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
