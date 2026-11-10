import type { CSSProperties } from 'react'
import type { TodayPanelStyle } from '../types'
import { photoUrl } from '../photos/favorites'

export function panelBackground(style?: TodayPanelStyle, base = 'var(--bg)'): CSSProperties {
  const color = style?.color ? `color-mix(in srgb, ${style.color} 20%, ${base})` : undefined
  const image = style?.image
  return {
    backgroundColor: color,
    backgroundImage: image
      ? `linear-gradient(color-mix(in srgb, ${base} 72%, transparent), color-mix(in srgb, ${base} 72%, transparent)), url("${photoUrl(image, 640)}")`
      : undefined,
    backgroundSize: image ? 'cover' : undefined,
    backgroundPosition: image ? 'center' : undefined,
  }
}
