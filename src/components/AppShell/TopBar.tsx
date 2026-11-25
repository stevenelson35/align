import { useEffect, useRef } from 'react'
import type { HouseholdMember } from '../../types'
import { ThemeToggle } from './ThemeToggle'
import { useInbox } from '../../hooks/useInbox'
import { Icon } from '../UI/Icon'

interface Props {
  member: HouseholdMember
  onMenu: () => void
  onChat: () => void
  onSettings: () => void
  onSearch: () => void
  onInbox: () => void
  /** Tapping "Align": Home. */
  onHome: () => void
}

// The household's name isn't shown (it can identify the family on a shared or borrowed screen).
export function TopBar({ member, onMenu, onChat, onSettings, onSearch, onInbox, onHome }: Props) {
  const { unread } = useInbox()
  // Its height, for headers that stay just below it while the page scrolls (the Library's): --top-bar-h.
  const bar = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = bar.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--top-bar-h', `${el.offsetHeight}px`)
    set()
    const watch = new ResizeObserver(set)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  return (
    <header className="top-bar" ref={bar}>
      <div className="brand">
        <button type="button" className="link menu-button" onClick={onMenu} aria-label="Menu">
          <Icon name="menu" />
        </button>
        <button type="button" className="link brand-home" onClick={onHome} title="Home" aria-label="Align: go Home">
          <strong>Align</strong>
        </button>
      </div>
      <div className="user">
        <button type="button" className="link search-button inbox-button" onClick={onInbox} title={unread ? `Inbox: ${unread} new` : 'Inbox'} aria-label={unread ? `Inbox, ${unread} new` : 'Inbox'}>
          <Icon name="mail" />
          {unread > 0 && <span className="inbox-badge">{unread > 99 ? '99+' : unread}</span>}
        </button>
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
