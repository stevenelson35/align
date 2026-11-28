// A guard for the stylesheet: one bad edit once cut index.css short and silently dropped the Inbox, banner and Send
// styles (DESIGN.md §13). Each feature's key rules must be there, the braces must balance, and the file can't
// suddenly lose a large part of itself.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8')

/** One rule (or more) each feature can't look right without. Add a line when adding a feature's styles. */
const REQUIRED = [
  // Today: tiles, groups, spacing, arranging, the footer, Add to Today
  '.today-tiles', '.tile-group-body', '.entry-row.flat', '.entry-aside-button', '.today-footer', '.today-sheet',
  '.arrange-list', '.drag-handle', '.arrange-more', '.tile-gap-setting', '.add-to-today', '.add-choice', '.add-to-place',
  // Inbox, notifications, Send
  '.inbox-row', '.inbox-line', '.inbox-dot', '.inbox-seen', '.inbox-badge', '.inbox-banner', '.notify-nudge', '.notify-setting',
  '.segmented', '.sent-note', '.text-about .warn',
  // Library
  '.library-pages', '.library-section', '.library-rows', '.library-pin',
  // Rows and sections everywhere
  '.entry-row', '.entry-line', '.entry-detail', '.section-header', '.section-icon', '.day-section',
  // Gift lists
  '.gift-tools', '.gift-rank', '.gift-state', '.gift-pool', '.gift-arrange', '.gift-shopping-panel', '.gift-plan-note',
  // Periodic table
  '.ptable', '.pcell', '.fam-halogen', '.element-detail', '.term-pop', '.family-strip', '.element-answer', '.element-decks',
  // Glider and play time
  '.glider-canvas', '.glider-overlay', '.earn-more', '.flash-earned',
  // Languages
  '.language-card', '.phrase-answer', '.hear',
  // Games
  '.game-invitations-list', '.game-invitation-row', '.balance-colors', '.daily-chip.done',
]

describe('the stylesheet', () => {
  it('has every feature’s key rules', () => {
    const missing = REQUIRED.filter((sel) => !new RegExp(`(^|[\\s,}])${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[,{]`, 'm').test(css))
    expect(missing).toEqual([])
  })
  it('balances its braces (nothing cut off mid-rule)', () => {
    const open = (css.match(/{/g) ?? []).length
    const close = (css.match(/}/g) ?? []).length
    expect(open).toBe(close)
    expect(css.trimEnd().endsWith('}')).toBe(true)
  })
  it('has not suddenly lost a large part of itself', () => {
    // About 6,000 lines today; raise this as it grows. A cut-off edit would fall far below.
    expect(css.split('\n').length).toBeGreaterThan(5500)
  })
})
