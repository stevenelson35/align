import type { HouseholdMember } from '../../types'
import { ThemeToggle } from './ThemeToggle'
import { Icon } from '../UI/Icon'

interface Props {
  member: HouseholdMember
  onMenu: () => void
  onChat: () => void
  onSettings: () => void
  onSearch: () => void
}

// The household's name isn't shown (it can identify the family on a shared or borrowed screen).
export function TopBar({ member, onMenu, onChat, onSettings, onSearch }: Props) {
  return (
    <header className="top-bar">
      <div className="brand">
        <button type="button" className="link menu-button" onClick={onMenu} aria-label="Menu">
          <Icon name="menu" />
        </button>
        <strong>Align</strong>
      </div>
      <div className="user">
        <button type="button" className="link search-button" onClick={onChat} title="Chat: ask, or add a task (n opens it ready to add)" aria-label="Chat">
          <Icon name="message" />
        </button>
        <button type="button" className="link search-button" onClick={onSearch} title="Search (/)" aria-label="Search">
          <Icon name="search" />
        </button>
        <ThemeToggle />
        {member.role === 'viewer' && <span className="badge">View only</span>}
        <button type="button" className="avatar" style={{ background: member.color }} onClick={onSettings} title="Settings and sign out" aria-label="Settings and sign out">
          {member.displayName.charAt(0).toUpperCase()}
        </button>
        <span className="hide-mobile">{member.displayName}</span>
      </div>
    </header>
  )
}
