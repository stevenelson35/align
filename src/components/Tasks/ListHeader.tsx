import type { ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import type { List } from '../../types'

const KIND_LABEL: Record<List['kind'], string> = { list: '', project: ' project', checklist: ' checklist', notes: ' notes' }

/** Name, who can see it, and Edit list; `children` adds view-specific buttons. */
export function ListHeader({ list, children }: { list: List; children?: ReactNode }) {
  const app = useApp()
  return (
    <header className="view-header">
      <h2>{list.name}</h2>
      <span className={`badge ${list.kind === 'project' ? 'color-project' : `color-${list.visibility}`}`}>
        {list.visibility === 'private' ? 'Private' : 'Family'}
        {KIND_LABEL[list.kind]}
      </span>
      {list.viewerVisible && <span className="badge">Visible to viewers</span>}
      {list.defaultContext === 'work' && list.kind !== 'checklist' && list.kind !== 'notes' && <span className="badge work">Work</span>}
      <span className="grow" />
      {children}
      {app.canEdit(list) && (
        <button type="button" className="secondary small" onClick={() => app.editList(list)}>
          Edit list
        </button>
      )}
    </header>
  )
}
