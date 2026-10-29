import type { ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import type { List } from '../../types'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { sharedNames } from '../../utils/tasks'
import { Icon } from '../UI/Icon'
import { HelpTip } from '../UI/HelpTip'
import type { HelpTopicId } from '../../help/topics'
import { menuSectionOf } from '../../utils/menu'
import { ListTransfer } from './ListTransfer'
import { PageBar } from '../UI/PageBar'

const HELP_FOR_KIND: Record<List['kind'], HelpTopicId> = {
  list: 'tasks',
  project: 'projects',
  checklist: 'checklists',
  notes: 'notes',
  links: 'links',
  picks: 'picks',
  cards: 'cards',
  contacts: 'contacts',
  gifts: 'gifts',
}
const KIND_NAME: Record<List['kind'], string> = {
  list: 'task lists',
  project: 'projects',
  checklist: 'checklists',
  notes: 'notes',
  links: 'links',
  picks: 'pick lists',
  cards: 'flashcards',
  contacts: 'contacts',
  gifts: 'gift lists',
}
const KIND_LABEL: Record<List['kind'], string> = {
  list: '',
  project: ' project',
  checklist: ' checklist',
  notes: ' notes',
  links: ' links',
  picks: ' pick list',
  cards: ' flashcards',
  contacts: ' contacts',
  gifts: ' gift list',
}

/** Name, who can see it, and Edit list; `children` adds view-specific buttons. `tools={false}` leaves out Import /
 * Export and Edit list (flashcards keep them behind their own Edit). */
export function ListHeader({ list, children, tools = true }: { list: List; children?: ReactNode; tools?: boolean }) {
  const app = useApp()
  return (
    <>
      <PageBar
        crumbs={
          <>
            <button type="button" className="link" onClick={() => app.openMenu(menuSectionOf(list))} title="Show this section of the menu">
              {menuSectionOf(list)}
            </button>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{list.name}</span>
          </>
        }
      />
      <header className="view-header">
        <h2>{list.name}</h2>
        <HelpTip topic={HELP_FOR_KIND[list.kind]} label={KIND_NAME[list.kind]} />
        <span className={`badge ${list.kind === 'project' ? 'color-project' : `color-${list.visibility}`}`}>
          <Icon name={AUDIENCE_ICON[audienceOf(list)]} /> {audienceLabel(audienceOf(list))}
          {KIND_LABEL[list.kind]}
        </span>
        {list.visibility === 'shared' && <span className="muted small">with {sharedNames(list.sharedWith ?? [], app.household, app.uid)}</span>}
        {list.defaultContext === 'work' && (list.kind === 'list' || list.kind === 'project') && <span className="badge work">Work</span>}
        <span className="grow" />
        {children}
        {tools && <ListTransfer list={list} />}
        {tools && app.canEdit(list) && (
          <button type="button" className="secondary small" onClick={() => app.editList(list)}>
            Edit list
          </button>
        )}
      </header>
    </>
  )
}
