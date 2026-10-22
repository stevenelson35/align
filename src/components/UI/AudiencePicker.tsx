import { useApp } from '../../hooks/useApp'
import { AUDIENCE_ICON, AUDIENCES, parentsOf, type Audience } from '../../utils/audience'
import { sharedNames } from '../../utils/tasks'
import { SharePicker } from '../Tasks/SharePicker'
import { Icon } from './Icon'
import { HelpTip } from './HelpTip'

/**
 * The five-choice "who" picker used everywhere: Only me · Parents · Family · Chosen people · Everyone. Chosen
 * people shows name chips; Parents names who that is (or says to set it up in Settings).
 */
export function AudiencePicker({
  label,
  value,
  onChange,
  ownerId,
  chosen,
  onChosen,
  noun,
  everyoneHint,
  forLogging = false,
}: {
  label: string
  value: Audience
  onChange: (a: Audience) => void
  ownerId: string
  chosen: string[]
  onChosen: (uids: string[]) => void
  noun: string
  everyoneHint?: string
  /** "Who can log": view-only accounts aren't offered as chosen people. */
  forLogging?: boolean
}) {
  const app = useApp()
  const parents = parentsOf(app.household)
  return (
    <div className="audience-picker">
      <label>
        <span>
          {label} <HelpTip topic="privacy" />
        </span>
        <select value={value} onChange={(e) => onChange(e.target.value as Audience)}>
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small audience-note">
        <Icon name={AUDIENCE_ICON[value]} />{' '}
        {value === 'private' && 'Just you.'}
        {value === 'parents' &&
          (parents.length ? `${sharedNames([...new Set([ownerId, ...parents])], app.household, app.uid)}.` : 'Nobody is set as a parent yet: tick the parents in ⚙ Settings → Parents.')}
        {value === 'family' && 'Everyone with a household account.'}
        {value === 'everyone' && (everyoneHint ?? 'The family, and anyone with view-only access.')}
        {value === 'shared' && 'Pick the names below.'}
      </p>
      {value === 'shared' && <SharePicker ownerId={ownerId} sharedWith={chosen} onChange={onChosen} noun={noun} forLogging={forLogging} />}
    </div>
  )
}
