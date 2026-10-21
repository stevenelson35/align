// Icon style (⚙ Settings → Icons), remembered per device, like the theme.
import { useSyncExternalStore } from 'react'

export type IconStyle = 'emoji' | 'mono' | 'outline' | 'solid' | 'duotone'
export const ICON_STYLES: { value: IconStyle; label: string; hint: string }[] = [
  { value: 'emoji', label: 'Emoji', hint: 'Colorful; looks different on iPhone, Android and computers' },
  { value: 'mono', label: 'Emoji, gray', hint: 'The same emoji without color' },
  { value: 'outline', label: 'Outline', hint: 'Thin line icons (flat)' },
  { value: 'solid', label: 'Solid', hint: 'Filled icons (flat)' },
  { value: 'duotone', label: 'Duotone', hint: 'A line plus a light tinted fill' },
]

const KEY = 'align-icons'
const EVENT = 'align-icons-changed'

export function loadIconStyle(): IconStyle {
  const v = localStorage.getItem(KEY)
  return ICON_STYLES.some((s) => s.value === v) ? (v as IconStyle) : 'emoji'
}

export function saveIconStyle(style: IconStyle) {
  if (style === 'emoji') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, style)
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb) // another tab changed it
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export function useIconStyle(): IconStyle {
  return useSyncExternalStore(subscribe, loadIconStyle, () => 'emoji')
}
