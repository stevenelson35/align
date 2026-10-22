import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

/**
 * A section heading on a page (the day view's Goals, On this day, To do, Done…): icon, title, count, then any
 * actions on the right. One look for every section.
 */
export function SectionHeader({ icon, title, count, children }: { icon: IconName; title: ReactNode; count?: ReactNode; children?: ReactNode }) {
  return (
    <h3 className="section-header">
      <span className="section-icon">
        <Icon name={icon} />
      </span>
      <span className="section-title">{title}</span>
      {count !== undefined && <span className="section-count">{count}</span>}
      {children && <span className="section-actions">{children}</span>}
    </h3>
  )
}
