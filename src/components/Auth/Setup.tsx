import type { User } from 'firebase/auth'
import { useState, type FormEvent } from 'react'
import { signOut } from '../../firebase/auth'
import { createHousehold } from '../../firebase/db'
import type { HouseholdMember, Pet } from '../../types'

const COLORS = ['#1f6feb', '#bf3989', '#bc4c00', '#1a7f37', '#57606a']
const PET_KINDS: Pet['kind'][] = ['dog', 'cat', 'bird', 'fish']

interface PersonRow {
  uid: string
  displayName: string
  role: HouseholdMember['role']
}

/**
 * One-time household setup, shown only while household/main doesn't exist (DESIGN.md §12).
 * Other people's uids come from Firebase console → Authentication → Users. Later role changes happen in the console.
 */
export function Setup({ user }: { user: User }) {
  const [name, setName] = useState('Nelson Household')
  const [myName, setMyName] = useState(user.displayName ?? 'Steve')
  const [people, setPeople] = useState<PersonRow[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const rows = [{ uid: user.uid, displayName: myName, role: 'member' as const }, ...people.filter((p) => p.uid.trim())]
    try {
      await createHousehold({
        name,
        members: Object.fromEntries(
          rows.map((p, i) => [p.uid.trim(), { role: p.role, displayName: p.displayName || 'Member', color: COLORS[i % COLORS.length] }]),
        ),
        pets: pets.filter((p) => p.name.trim()).map((p, i) => ({ ...p, id: `${p.kind}${i + 1}` })),
        weeklyTokens: 10,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const updatePerson = (i: number, patch: Partial<PersonRow>) =>
    setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const updatePet = (i: number, patch: Partial<Pet>) => setPets((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  return (
    <main className="center">
      <form className="card form setup" onSubmit={handleSubmit}>
        <h1>Set up your household</h1>
        <p className="muted">This appears once, before the household exists. You ({user.email}) become its first member.</p>
        <label>
          Household name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Your name
          <input value={myName} onChange={(e) => setMyName(e.target.value)} required />
        </label>

        <fieldset>
          <legend>Other people</legend>
          <p className="muted small">Create their accounts in Firebase console → Authentication → Users, then paste each User UID here.</p>
          {people.map((p, i) => (
            <div className="row" key={i}>
              <input placeholder="Name" value={p.displayName} onChange={(e) => updatePerson(i, { displayName: e.target.value })} />
              <input placeholder="User UID" value={p.uid} onChange={(e) => updatePerson(i, { uid: e.target.value })} />
              <select value={p.role} onChange={(e) => updatePerson(i, { role: e.target.value as PersonRow['role'] })}>
                <option value="member">member</option>
                <option value="viewer">viewer</option>
              </select>
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => setPeople([...people, { uid: '', displayName: '', role: 'member' }])}>
            Add person
          </button>
        </fieldset>

        <fieldset>
          <legend>Pets</legend>
          {pets.map((p, i) => (
            <div className="row" key={i}>
              <input placeholder="Name" value={p.name} onChange={(e) => updatePet(i, { name: e.target.value })} />
              <select value={p.kind} onChange={(e) => updatePet(i, { kind: e.target.value as Pet['kind'] })}>
                {PET_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
          ))}
          <button type="button" className="secondary" onClick={() => setPets([...pets, { id: '', name: '', kind: 'dog' }])}>
            Add pet
          </button>
        </fieldset>

        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create household'}
          </button>
          <button type="button" className="link" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </form>
    </main>
  )
}
