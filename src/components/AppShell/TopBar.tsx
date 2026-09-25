import { signOut } from '../../firebase/auth'
import type { HouseholdMember } from '../../types'

export function TopBar({ householdName, member }: { householdName: string; member: HouseholdMember }) {
  return (
    <header className="top-bar">
      <div className="brand">
        <strong>Align</strong>
        <span className="muted">{householdName}</span>
      </div>
      <div className="user">
        {member.role === 'viewer' && <span className="badge">View only</span>}
        <span className="avatar" style={{ background: member.color }} aria-hidden="true">
          {member.displayName.charAt(0).toUpperCase()}
        </span>
        <span>{member.displayName}</span>
        <button type="button" className="link" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </header>
  )
}
