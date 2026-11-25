import { useApp, useData } from '../../hooks/useApp'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { recipientLabel } from '../../utils/gifts'
import { listSize, listsInSection, SECTIONS } from '../../utils/menu'
import { Icon } from '../UI/Icon'
import { ListRow } from '../UI/ListRow'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import { tile } from '../../utils/tiles'

/**
 * One kind of list on its own page (#/kind/Gifts): just those lists, a line each, and + to make another. A list's
 * breadcrumb ("Gifts ›") comes here, so you can go from one gift list to another without Home or the Library.
 */
export function KindView({ section }: { section: string }) {
  const app = useApp()
  const { lists, tasks, listItems } = useData()
  const today = useTodayTiles()
  const kind = SECTIONS.find((s) => s.title === section)
  if (!kind) return null
  const shown = listsInSection(lists, section, app.uid)
  // View-only family can make gift lists only.
  const canMake = app.isMember || (app.canPlay && kind.kind === 'gifts')
  return (
    <section className="kind-view">
      <header className="view-header">
        <h2>
          <Icon name={kind.icon} /> {section}
        </h2>
        <span className="grow" />
        {canMake && (
          <button type="button" className="secondary small" onClick={() => app.editList(null, kind.kind)}>
            <Icon name="plus" /> New {kind.kind === 'gifts' ? 'gift list' : kind.kind === 'notes' ? 'notes list' : kind.kind === 'list' ? 'list' : section.toLowerCase().replace(/s$/, '')}
          </button>
        )}
      </header>
      {shown.length ? (
        <div className="kind-rows">
          {shown.map((l) => (
            <ListRow
              key={l.id}
              icon={kind.icon}
              name={l.name}
              status={
                <>
                  {l.kind === 'gifts' && (l.recipientId || l.recipientName) ? `for ${recipientLabel(l, app.household)} · ` : ''}
                  {listSize(l, tasks, listItems)} · <Icon name={AUDIENCE_ICON[audienceOf(l)]} /> {audienceLabel(audienceOf(l))}
                </>
              }
              onOpen={() => app.navigate({ view: 'list', listId: l.id, timeline: false })}
              after={
                today.canChange ? (
                  <button
                    type="button"
                    className={`library-pin${today.has(tile('list', l.id)) ? ' on' : ''}`}
                    aria-pressed={today.has(tile('list', l.id))}
                    onClick={() => void today.toggle(tile('list', l.id)).catch(() => undefined)}
                    aria-label={today.has(tile('list', l.id)) ? `Take ${l.name} off Home` : `Pin ${l.name} to Home`}
                    title={today.has(tile('list', l.id)) ? 'On your Home: tap to take it off' : 'Pin to Home'}
                  >
                    <Icon name="pin" />
                  </button>
                ) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p className="muted small">None yet.{canMake ? ' + makes one.' : ''}</p>
      )}
    </section>
  )
}
