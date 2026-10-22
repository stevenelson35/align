import { signOut } from '../../firebase/auth'
import { useApp } from '../../hooks/useApp'
import type { HouseholdMember } from '../../types'
import { ThemeToggle } from './ThemeToggle'
import { Icon } from '../UI/Icon'

interface Props {
  householdName: string
  member: HouseholdMember
  onMenu: () => void
  onChat: () => void
  onSettings: () => void
  onSearch: () => void
}

export function TopBar({ householdName, member, onMenu, onChat, onSettings, onSearch }: Props) {
  const { isMember, openChat } = useApp()
  return (
    <header className="top-bar">
      <div className="brand">
        <button type="button" className="link menu-button" onClick={onMenu} aria-label="Menu">
          <Icon name="menu" />
        </button>
        <strong>Align</strong>
        <span className="muted hide-mobile">{householdName}</span>
      </div>
      <div className="user">
        {isMember && (
          <button type="button" className="link search-button" onClick={() => openChat('add task ')} title="Quick add in chat (n)" aria-label="Quick add">
            <Icon name="quickAdd" />
          </button>
        )}
        <button type="button" className="link hide-mobile" onClick={onChat}>
          Chat
        </button>
        <button type="button" className="link search-button" onClick={onSearch} title="Search (/)" aria-label="Search">
          <Icon name="search" />
        </button>
        <ThemeToggle />
        {member.role === 'viewer' && <span className="badge">View only</span>}
        <button type="button" className="avatar" style={{ background: member.color }} onClick={onSettings} title="Settings" aria-label="Settings">
          {member.displayName.charAt(0).toUpperCase()}
        </button>
        <span className="hide-mobile">{member.displayName}</span>
        <button type="button" className="link" onClick={() => signOut()}>
          Sign out
        </button>
      </div>
    </header>
  )
}
