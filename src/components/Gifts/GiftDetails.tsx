import { useGiftClaims } from '../../firebase/gifts'
import { useApp } from '../../hooks/useApp'
import type { List, Task } from '../../types'
import { isRecipient, recipientKey } from '../../utils/gifts'
import { ClaimControls } from './GiftsView'

/** In a gift idea's panel, for everyone but the recipient: who's getting it, and your own claim (how many, a note). */
export function GiftClaimPanel({ item, list }: { item: Task; list: List }) {
  const app = useApp()
  const hidden = isRecipient(list, app.uid) || !app.isMember
  const { claims } = useGiftClaims(hidden ? [] : [recipientKey(list)])
  if (hidden) return null
  return (
    <div className="entry-section">
      <h4>Who’s getting it</h4>
      <ClaimControls item={item} list={list} claims={claims} full />
    </div>
  )
}
