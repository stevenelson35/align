import { useApp, useData } from '../../hooks/useApp'
import { AUDIENCE_ICON, audienceLabel, audienceOf } from '../../utils/audience'
import { recipientLabel } from '../../utils/gifts'
import { listSize, listsInSection, SECTIONS } from '../../utils/menu'
import { Icon } from '../UI/Icon'
import { ListRow } from '../UI/ListRow'
import { MakeWishList } from '../Gifts/MakeWishList'
import { useTodayTiles } from '../../hooks/useTodayTiles'
import { tile } from '../../utils/tiles'

/** What the Lists page holds: every everyday kind, as Home's Lists tile does. */
const EVERYDAY = ['Lists', 'Checklists', 'Notes', 'Links', 'Pick lists']

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
  // The Lists page has every everyday kind (as Home's Lists tile does), each under its own heading.
  const groups = (section === 'Lists' ? EVERYDAY : [section]).map((title) => ({ ...SECTIONS.find((x) => x.title === title)!, lists: listsInSection(lists, title, app.uid) })).filter((g) => g.lists.length || g.title === section)
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
          <button type="button" className="secondary small" onClick={() => app.editList(null, section === 'Lists' ? undefined : kind.kind)}>
            <Icon name="plus" /> New {kind.kind === 'gifts' ? 'gift list' : kind.kind === 'notes' ? 'notes list' : kind.kind === 'list' ? 'list' : section.toLowerCase().replace(/s$/, '')}
          </button>
        )}
      </header>
      {kind.kind === 'gifts' && (
        <p className="kind-wish">
          <MakeWishList />
        </p>
      )}
      {groups.map((g) => (
        <div key={g.title} className="kind-group">
          {groups.length > 1 && (
            <h3 className="kind-group-title small muted">
              {g.title === 'Lists' ? 'Task lists' : g.title} · {g.lists.length}
            </h3>
          )}
          {g.lists.length ? (
            <div className="kind-rows">
              {g.lists.map((l) => (
                <ListRow
                  key={l.id}
                  icon={g.icon}
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
        </div>
      ))}
    </section>
  )
}
