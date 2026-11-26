import { useState } from 'react'
import { makeWishList } from '../../firebase/gifts'
import { useApp, useData } from '../../hooks/useApp'
import { Icon } from '../UI/Icon'

/**
 * "Make my wish list" for anyone who doesn't have one yet: one tap makes "Sam’s wish list" (seen by Everyone) and
 * opens it, ready to add the first idea.
 */
export function MakeWishList({ className = 'small' }: { className?: string }) {
  const app = useApp()
  const { lists } = useData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!app.canPlay || lists.some((l) => l.kind === 'gifts' && !l.giftSecret && l.recipientId === app.uid)) return null
  async function make() {
    setBusy(true)
    setError(null)
    try {
      const id = await makeWishList(app.uid, app.member.displayName)
      app.navigate({ view: 'list', listId: id, timeline: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }
  return (
    <>
      <button type="button" className={className} onClick={() => void make()} disabled={busy} title="A wish list for you that the whole family can see">
        <Icon name="gift" /> {busy ? 'Making it…' : 'Make my wish list'}
      </button>
      {error && <span className="error small">{error}</span>}
    </>
  )
}
