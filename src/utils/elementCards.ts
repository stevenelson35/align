// Flashcards for the elements (DESIGN.md §5.15): five sets made from the periodic table data, as ordinary cards
// (front / back text), so they work like any set (review, multiple choice, Challenge, export). A card is recognized as
// an element card by its wording, which gives it the element picture on the answer side and plausible wrong answers.
// Pure logic, unit-tested.
import type { Card } from './flashcards'
import { FAMILIES, familyOf, type Element, type FamilyId } from './elements'

export type Series = 'symbol' | 'family' | 'number' | 'traits' | 'member'

/** The sets, in the order to study them: each one a flashcard list. */
export const SERIES: { id: Series; name: string; about: string }[] = [
  { id: 'symbol', name: 'Elements 1: Symbols', about: 'What is the symbol for Copper? → Cu' },
  { id: 'family', name: 'Elements 2: Families', about: 'Which family is Copper in? → Transition metals' },
  { id: 'number', name: 'Elements 3: Atomic numbers', about: 'What is the atomic number of Copper? → 29' },
  { id: 'traits', name: 'Elements 4: Family traits', about: 'Which family: seven outer electrons…? → Halogens' },
  { id: 'member', name: 'Elements 5: Which is which', about: 'Which of these is a halogen? → Chlorine' },
]

/** The column families a class starts with (the ones whose members behave so alike). */
export const STARTER_FAMILIES = ['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'F', 'Cl', 'Br', 'I', 'Li', 'Na', 'K', 'Rb', 'Cs', 'Be', 'Mg', 'Ca', 'Sr']
/** Elements people meet every day. */
export const EVERYDAY = ['H', 'C', 'N', 'O', 'S', 'P', 'Si', 'Al', 'Fe', 'Cu', 'Zn', 'Ni', 'Ag', 'Au', 'Pt', 'Sn', 'Pb', 'Hg', 'Ti', 'U']

export const SCOPES: { id: 'families' | 'everyday'; label: string; symbols: string[] }[] = [
  { id: 'families', label: 'The column families (noble gases, halogens, alkali and alkaline earth metals)', symbols: STARTER_FAMILIES },
  { id: 'everyday', label: 'Everyday elements (hydrogen, carbon, iron, copper, gold…)', symbols: EVERYDAY },
]

const traitsFront = (id: FamilyId) => `Which family: ${familyOf(id).traits.map((t) => t.replace(/\.$/, '')).join('; ')}?`

/** A set's cards for these elements (in table order). */
export function seriesCards(series: Series, chosen: Element[]): Card[] {
  const els = [...chosen].sort((a, b) => a.number - b.number)
  switch (series) {
    case 'symbol':
      return els.map((e) => ({ front: `What is the symbol for ${e.name}?`, back: e.symbol }))
    case 'family':
      return els.map((e) => ({ front: `Which family is ${e.name} in?`, back: familyOf(e.family).label }))
    case 'number':
      return els.map((e) => ({ front: `What is the atomic number of ${e.name}?`, back: String(e.number) }))
    case 'traits':
      return [...new Set(els.map((e) => e.family))].map((f) => ({ front: traitsFront(f), back: familyOf(f).label }))
    case 'member':
      return els.map((e) => ({ front: `Which of these is ${familyOf(e.family).one}?`, back: e.name }))
  }
}

export interface ElementCardInfo {
  series: Series
  /** The element the card is about (none for a family-traits card). */
  element?: Element
  family: FamilyId
}

/** What an element card is about, from its words (or null: not an element card). */
export function readElementCard(front: string, back: string, elements: Element[]): ElementCardInfo | null {
  const f = front.trim()
  const byName = (name: string) => elements.find((e) => e.name.toLowerCase() === name.trim().toLowerCase())
  let m = f.match(/^What is the symbol for (.+)\?$/i)
  if (m) {
    const e = byName(m[1])
    return e ? { series: 'symbol', element: e, family: e.family } : null
  }
  m = f.match(/^Which family is (.+) in\?$/i)
  if (m) {
    const e = byName(m[1])
    return e ? { series: 'family', element: e, family: e.family } : null
  }
  m = f.match(/^What is the atomic number of (.+)\?$/i)
  if (m) {
    const e = byName(m[1])
    return e ? { series: 'number', element: e, family: e.family } : null
  }
  if (/^Which family: /i.test(f)) {
    const fam = FAMILIES.find((x) => x.label.toLowerCase() === back.trim().toLowerCase())
    return fam ? { series: 'traits', family: fam.id } : null
  }
  m = f.match(/^Which of these is (an? .+)\?$/i)
  if (m) {
    const fam = FAMILIES.find((x) => x.one.toLowerCase() === m![1].toLowerCase())
    const e = byName(back)
    return fam && e ? { series: 'member', element: e, family: fam.id } : null
  }
  return null
}

const shuffle = <T,>(list: T[], rand: () => number) => list.map((x) => [rand(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x)

/**
 * Wrong answers that make you think (three, plus the right one, mixed): for a symbol, look-alike symbols (Cu: Co, Cr,
 * Ca); for a number, numbers close by; for a family, other families; for "which is a halogen?", elements from other
 * families only (never a second right answer), near it in the table.
 */
export function elementChoices(card: ElementCardInfo, answer: string, elements: Element[], rand: () => number): string[] {
  const e = card.element
  let wrong: string[] = []
  if (card.series === 'symbol' && e) {
    const first = e.symbol[0]
    const alike = elements.filter((x) => x.number !== e.number && x.symbol[0] === first)
    const near = elements.filter((x) => x.number !== e.number && Math.abs(x.number - e.number) <= 3)
    wrong = [...shuffle(alike, rand), ...shuffle(near, rand)].map((x) => x.symbol)
  } else if (card.series === 'number' && e) {
    const steps = shuffle([-3, -2, -1, 1, 2, 3, 8, -8].filter((d) => e.number + d >= 1 && e.number + d <= 118), rand)
    wrong = steps.map((d) => String(e.number + d))
  } else if (card.series === 'family' || card.series === 'traits') {
    wrong = shuffle(FAMILIES.filter((f) => f.id !== card.family).map((f) => f.label), rand)
  } else if (card.series === 'member' && e) {
    const others = elements.filter((x) => x.family !== card.family && x.number <= 86)
    const near = others.filter((x) => Math.abs(x.y - e.y) <= 1)
    wrong = [...shuffle(near, rand), ...shuffle(others, rand)].map((x) => x.name)
  }
  const out = [...new Set(wrong.filter((w) => w.toLowerCase() !== answer.toLowerCase()))].slice(0, 3)
  out.splice(Math.floor(rand() * (out.length + 1)), 0, answer)
  return out
}
