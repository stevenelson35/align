import { useIconStyle, type IconStyle } from '../../utils/iconStyle'

/**
 * One icon in the chosen style (⚙ Settings → Icons). Each drawing has up to three layers on a 24×24 grid:
 * `fill` (closed shapes: filled in Solid, tinted in Duotone, outlined in Outline), `line` (strokes that always
 * stay lines) and `detail` (inner marks: knocked out of the fill in Solid). Emoji styles use the emoji instead.
 */
const ICONS = {
  compose: { emoji: '✍️', fill: 'M17.5 3.5l3 3L13 14h-3v-3z', line: 'M11 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6' },
  edit: { emoji: '✏️', fill: 'M16 3l5 5L9 20H4v-5z', detail: 'M13.5 5.5l5 5' },
  goal: { emoji: '🎯', fill: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', detail: 'M12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9zM12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2z' },
  message: { emoji: '💬', fill: 'M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', detail: 'M8 9h8M8 12.5h5' },
  phone: { emoji: '📱', fill: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z', detail: 'M11 18.5h2' },
  lock: { emoji: '🔒', fill: 'M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z', line: 'M8 11V7.5a4 4 0 0 1 8 0V11', detail: 'M12 15v2.5' },
  family: {
    emoji: '👪',
    fill: 'M6.5 3.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4zM17.5 3.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4zM12 8.6a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2zM3 20v-4.5a3.5 3.5 0 0 1 7 0V20zM14 20v-4.5a3.5 3.5 0 0 1 7 0V20zM9.5 20v-3a2.5 2.5 0 0 1 5 0v3z',
  },
  shared: {
    emoji: '👥',
    fill: 'M9 4a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM17 6a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5zM3 20v-1.5a6 6 0 0 1 12 0V20zM16 20v-2a5 5 0 0 0-1.2-3.3A4.5 4.5 0 0 1 21.5 18.5V20z',
  },
  parents: {
    emoji: '🧑‍🤝‍🧑',
    fill: 'M8 3.5a2.6 2.6 0 1 0 0 5.2a2.6 2.6 0 1 0 0-5.2zM16 3.5a2.6 2.6 0 1 0 0 5.2a2.6 2.6 0 1 0 0-5.2zM3.5 20v-4a4.5 4.5 0 0 1 9 0v4zM11.5 20v-4a4.5 4.5 0 0 1 9 0v4z',
  },
  everyone: {
    emoji: '🌐',
    fill: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z',
    detail: 'M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9M12 3c-2.5 2.5-3.8 5.5-3.8 9s1.3 6.5 3.8 9',
  },
  photo: {
    emoji: '🖼️',
    fill: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    detail: 'M3.5 16.5l5-5 4 4 3-3 5 5M15.5 8.5a1.2 1.2 0 1 0 0 0.1z',
  },
  blog: {
    emoji: '📰',
    fill: 'M4 5h13a1 1 0 0 1 1 1v12a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2z',
    line: 'M18 9h2.5v9a2 2 0 0 1-2 2',
    detail: 'M7 8.5h8M7 12h3.5M7 15.5h3.5M12.5 12h2.5v3.5h-2.5z',
  },
  todo: {
    emoji: '☑️',
    fill: 'M4 4h4v4H4zM4 10h4v4H4zM4 16h4v4H4z',
    line: 'M11 6h9M11 12h9M11 18h9',
  },
  check: { emoji: '✅', fill: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', detail: 'M7.5 12.5l3 3 6-6.5' },
  person: { emoji: '👤', fill: 'M12 3.5a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM4.5 20.5v-1a7.5 7.5 0 0 1 15 0v1z' },
  clock: { emoji: '🕒', fill: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', detail: 'M12 7v5l3.5 2' },
  list: { emoji: '📋', fill: 'M7 4h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', line: 'M9.5 2.5h5v3h-5z', detail: 'M8.5 10h7M8.5 13.5h7M8.5 17h4' },
  plus: { emoji: '➕', line: 'M12 5v14M5 12h14' },
  quickAdd: {
    emoji: '💬',
    fill: 'M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    detail: 'M12 7.5v6M9 10.5h6',
  },
  swatch: { emoji: '🎨', fill: 'M6 4.5a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM18 4.5a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 13.5a3 3 0 1 0 0 6a3 3 0 1 0 0-6z' },
  timer: { emoji: '⏱️', fill: 'M12 5a8 8 0 1 0 0 16a8 8 0 1 0 0-16z', line: 'M10 2h4M18.5 5.5l1.5-1.5', detail: 'M12 9v4.5' },
  play: { emoji: '▶️', fill: 'M7 4.5v15l12-7.5z' },
  pause: { emoji: '⏸️', fill: 'M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z' },
  send: { emoji: '📨', fill: 'M3.5 11.5l17-8-6 17-3-7z', detail: 'M11.5 13.5l9-10' },
  help: { emoji: 'ℹ️', fill: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', detail: 'M12 11v5.5M12 7.5v0.5' },
  star: { emoji: '⭐', fill: 'M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z' },
  pin: { emoji: '📌', fill: 'M9 3h6l-1 6 3 3v2H7v-2l3-3z', line: 'M12 14v7' },
  mail: { emoji: '✉️', fill: 'M4 5h16a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 4 5z', detail: 'M3 6.5l9 6.5 9-6.5' },
  map: { emoji: '📍', fill: 'M12 2.5a6.5 6.5 0 0 0-6.5 6.5c0 4.9 6.5 12.5 6.5 12.5s6.5-7.6 6.5-12.5A6.5 6.5 0 0 0 12 2.5z', detail: 'M12 6.8a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4z' },
  book: { emoji: '📖', fill: 'M3 5h5.5A3.5 3.5 0 0 1 12 8.5V20a2.5 2.5 0 0 0-2.5-2.5H3zM21 5h-5.5A3.5 3.5 0 0 0 12 8.5V20a2.5 2.5 0 0 1 2.5-2.5H21z' },
  search: { emoji: '🔍', fill: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z', line: 'M15.5 15.5L20.5 20.5' },
  calendar: {
    emoji: '📅',
    fill: 'M5 5h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 5z',
    line: 'M8 3v4M16 3v4',
    detail: 'M3.5 10h17M8 14h2M12 14h2M16 14h0.5M8 17h2M12 17h2',
  },
  refresh: { emoji: '🔄', line: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5' },
  settings: {
    emoji: '⚙️',
    fill: 'M19.38 10.19 L22.07 10.37 L22.07 13.63 L19.38 13.81 L18.50 15.94 L20.27 17.97 L17.97 20.27 L15.94 18.50 L13.81 19.38 L13.63 22.07 L10.37 22.07 L10.19 19.38 L8.06 18.50 L6.03 20.27 L3.73 17.97 L5.50 15.94 L4.62 13.81 L1.93 13.63 L1.93 10.37 L4.62 10.19 L5.50 8.06 L3.73 6.03 L6.03 3.73 L8.06 5.50 L10.19 4.62 L10.37 1.93 L13.63 1.93 L13.81 4.62 L15.94 5.50 L17.97 3.73 L20.27 6.03 L18.50 8.06Z',
    detail: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
  },
  skip: { emoji: '⏭️', fill: 'M4 6l7 6-7 6zM11 6l7 6-7 6z', line: 'M20.5 6v12' },
  close: { emoji: '✖️', line: 'M6 6l12 12M18 6L6 18' },
  external: { emoji: '↗️', line: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' },
  camera: {
    emoji: '📷',
    fill: 'M4 8h3l2-3h6l2 3h3a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 8z',
    detail: 'M12 10.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z',
  },
  link: { emoji: '🔗', line: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' },
  note: { emoji: '📝', fill: 'M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', detail: 'M8.5 11h7M8.5 14.5h7M8.5 7.5h3' },
  waiting: { emoji: '⏳', fill: 'M7 3h10v3.5l-5 5.5 5 5.5V21H7v-3.5l5-5.5-5-5.5z', line: 'M5.5 3h13M5.5 21h13' },
  gift: { emoji: '🎁', fill: 'M4 11h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 7.5h18V11H3z', line: 'M12 7.5C10.5 3.5 6.5 3.8 7.4 6.3C8 7.5 12 7.5 12 7.5zM12 7.5c1.5-4 5.5-3.7 4.6-1.2C16 7.5 12 7.5 12 7.5z', detail: 'M12 7.5V21' },
  coin: { emoji: '🪙', fill: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', detail: 'M12 7.5v9M14.5 9.5h-3.5a1.75 1.75 0 0 0 0 3.5h2a1.75 1.75 0 0 1 0 3.5H9.5' },
  chain: { emoji: '⛓️', line: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' },
  warning: { emoji: '⚠️', fill: 'M12 3l10 18H2z', detail: 'M12 10v4.5M12 17.5v0.5' },
  menu: { emoji: '☰', line: 'M4 7h16M4 12h16M4 17h16' },
  sun: {
    emoji: '☀️',
    fill: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z',
    line: 'M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
  },
  moon: { emoji: '🌙', fill: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z' },
  auto: { emoji: '◐', fill: 'M12 3.5a8.5 8.5 0 0 0 0 17z', line: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17z' },
} satisfies Record<string, { emoji: string; fill?: string; line?: string; detail?: string }>

export type IconName = keyof typeof ICONS

export function Icon({ name, label, style }: { name: IconName; label?: string; style?: IconStyle }) {
  const current = useIconStyle()
  const s = style ?? current
  const icon: { emoji: string; fill?: string; line?: string; detail?: string } = ICONS[name]
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  if (s === 'emoji' || s === 'mono') {
    return (
      <span className={`icon icon-emoji i-${name}${s === 'mono' ? ' mono' : ''}`} {...a11y}>
        {icon.emoji}
      </span>
    )
  }
  return (
    <span className={`icon icon-${s} i-${name}`} {...a11y}>
      <svg viewBox="0 0 24 24" width="1em" height="1em" focusable="false">
        {icon.fill && <path className="i-fill" d={icon.fill} />}
        {icon.line && <path className="i-line" d={icon.line} />}
        {icon.detail && <path className="i-detail" d={icon.detail} />}
      </svg>
    </span>
  )
}
