import type { ReactNode } from 'react'
import type { HelpTopicId } from '../../help/topics'
import { HelpTip } from './HelpTip'
import { Icon, type IconName } from './Icon'

/**
 * A section heading on a page (the day view's Goals, On this day, To do, Done…): icon, title, count, then any
 * actions on the right. One look for every section.
 */
export function SectionHeader({
  icon,
  title,
  count,
  beside,
  onTitleClick,
  expanded,
  help,
  children,
}: {
  icon: IconName
  title: ReactNode
  count?: ReactNode
  /** Something small right after the count (e.g. the color key toggle). */
  beside?: ReactNode
  /** Makes the icon and title a button (e.g. the same as Show / Hide). */
  onTitleClick?: () => void
  /** With onTitleClick: whether the section is open (for screen readers). */
  expanded?: boolean
  /** A help topic: adds the small ⓘ after the title. */
  help?: HelpTopicId
  children?: ReactNode
}) {
  return (
    <h3 className="section-header">
      {onTitleClick ? (
        <button type="button" className="section-toggle" onClick={onTitleClick} aria-expanded={expanded}>
          <span className="section-icon">
            <Icon name={icon} />
          </span>
          <span className="section-title">{title}</span>
        </button>
      ) : (
        <>
          <span className="section-icon">
            <Icon name={icon} />
          </span>
          <span className="section-title">{title}</span>
        </>
      )}
      {count !== undefined && <span className="section-count">{count}</span>}
      {help && <HelpTip topic={help} />}
      {beside}
      {children && <span className="section-actions">{children}</span>}
    </h3>
  )
}
