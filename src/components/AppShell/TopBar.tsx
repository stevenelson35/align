import { signOut } from '../../firebase/auth'
import { useApp } from '../../hooks/useApp'
import type { HouseholdMember } from '../../types'

interface Props {
  householdName: string
  member: HouseholdMember
  onMenu: () => void
  onChat: () => void
}

export function TopBar({ householdName, member, onMenu, onChat }: Props) {
  const { isMember, openChat } = useApp()
  return (
    <header className="top-bar">
      <div className="brand">
        <button type="button" className="link menu-button" onClick={onMenu} aria-label="Menu">
          ☰
        </button>
        <strong>Align</strong>
        <span className="muted hide-mobile">{householdName}</span>
      </div>
      <div className="user">
        {isMember && (
          <button type="button" className="small" onClick={() => openChat('add task ')}>
            + Quick add
          </button>
        )}
        <button type="button" className="link hide-mobile" onClick={onChat}>
          Chat
        </button>
        {member.role === 'viewer' && <span className="badge">View only</span>}
        <span className="avatar" style={{ background: member.color }} aria-hidden="true">
          {member.displayName.charAt(0).toUpperCase()}
        </span>
        <span className="hide-mobile">{member.displayName}</span>
        <button type="button" className="link" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </header>
  )
}
