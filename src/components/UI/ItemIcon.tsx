import { Icon, type IconName } from './Icon'

export const ITEM_ICON_CHOICES: IconName[] = [
  'goal', 'todo', 'star', 'book', 'calendar', 'family', 'photo', 'gift',
  'map', 'check', 'sparkle', 'play', 'pin', 'sun', 'moon', 'note',
  'link', 'camera', 'lock', 'coin',
]

export const ITEM_EMOJI_CHOICES = [
  '⭐', '🌈', '🐾', '🐈', '🌻', '🦋', '🎮', '🍓', '🪴', '🚀',
  '⚽', '🎨', '📚', '🧩', '🐶', '🐱', '🏆', '💡', '🎵', '🍕',
]

export function ItemIcon({ value }: { value?: string }) {
  if (!value) return null
  if (value.startsWith('emoji:')) return <span className="item-custom-emoji" aria-hidden="true">{value.slice(6)}</span>
  if (value.startsWith('icon:') && ITEM_ICON_CHOICES.includes(value.slice(5) as IconName))
    return <Icon name={value.slice(5) as IconName} />
  return null
}

export function ItemIconPicker({ value, onChange, disabled = false }: { value?: string; onChange: (value: string | undefined) => void; disabled?: boolean }) {
  return (
    <fieldset className="item-icon-picker" disabled={disabled}>
      <legend>Item icon</legend>
      <div className="item-icon-options" aria-label="Choose an icon">
        <button type="button" className={`item-icon-choice${!value ? ' selected' : ''}`} onClick={() => onChange(undefined)} aria-pressed={!value} aria-label="Use default icon">
          None
        </button>
        {ITEM_ICON_CHOICES.map((name) => {
          const id = `icon:${name}`
          return (
            <button type="button" key={id} className={`item-icon-choice${value === id ? ' selected' : ''}`} onClick={() => onChange(id)} aria-pressed={value === id} aria-label={`Use ${name} icon`}>
              <Icon name={name} />
            </button>
          )
        })}
        {ITEM_EMOJI_CHOICES.map((emoji) => {
          const id = `emoji:${emoji}`
          return (
            <button type="button" key={id} className={`item-icon-choice${value === id ? ' selected' : ''}`} onClick={() => onChange(id)} aria-pressed={value === id} aria-label={`Use ${emoji} emoji`}>
              {emoji}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
