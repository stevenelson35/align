// The periodic table (DESIGN.md §5.15): the elements' facts load from src/data/elements.json (built by
// scripts/build-elements.mjs from Periodic-Table-JSON, CC BY-SA 3.0, from Wikipedia). The families, what they have in
// common, and the glossary below are Align's own short summaries of standard chemistry. Pure helpers, unit-tested.

export type FamilyId =
  | 'alkali-metal'
  | 'alkaline-earth-metal'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide'

export interface Element {
  number: number
  symbol: string
  name: string
  mass?: number
  family: FamilyId
  /** 1–18 (none for the lanthanides and actinides, which sit apart). */
  group?: number
  period: number
  /** Column and row in the usual layout (18 columns; the lanthanides and actinides in rows 9 and 10). */
  x: number
  y: number
  phase?: string
  appearance?: string
  summary: string
  discoveredBy?: string
  namedBy?: string
  /** g/cm³ (g/L for gases). */
  density?: number
  /** Kelvin. */
  melt?: number
  boil?: number
  electrons?: string
  shells?: number[]
  electronegativity?: number
  block?: string
  image?: { url: string; title?: string; credit?: string }
  source?: string
}

export interface Family {
  id: FamilyId
  label: string
  /** One of them, for questions ("a halogen", "an alkali metal"). */
  one: string
  /** One line: who they are. */
  blurb: string
  /** What they have in common (glossary words are linked where they appear). */
  traits: string[]
}

/** The families, in the order a class usually meets them (the column families first). */
export const FAMILIES: Family[] = [
  {
    id: 'alkali-metal',
    one: 'an alkali metal',
    label: 'Alkali metals',
    blurb: 'Group 1 (not hydrogen): the most reactive metals.',
    traits: ['Soft, shiny metals you can cut with a knife', 'One outer electron, so they form +1 ions', 'React strongly with water, giving hydrogen gas', 'Stored under oil to keep air and water away'],
  },
  {
    id: 'alkaline-earth-metal',
    one: 'an alkaline earth metal',
    label: 'Alkaline earth metals',
    blurb: 'Group 2: reactive metals, a little tamer than the alkali metals.',
    traits: ['Shiny, harder than the alkali metals', 'Two outer electrons, so they form +2 ions', 'Found in rocks and minerals such as limestone', 'Calcium and magnesium matter to bones and plants'],
  },
  {
    id: 'transition-metal',
    one: 'a transition metal',
    label: 'Transition metals',
    blurb: 'Groups 3–12: the everyday metals (iron, copper, gold).',
    traits: ['Good conductors of heat and electricity', 'Malleable and ductile', 'Often form colored compounds', 'Can form ions with different charges; many are catalysts'],
  },
  {
    id: 'post-transition-metal',
    one: 'a post-transition metal',
    label: 'Post-transition metals',
    blurb: 'Softer metals to the right of the transition metals (aluminum, tin, lead).',
    traits: ['Softer, with lower melting points than transition metals', 'Still conductors', 'Often used in alloys and solder'],
  },
  {
    id: 'metalloid',
    one: 'a metalloid',
    label: 'Metalloids',
    blurb: 'Along the staircase between metals and nonmetals.',
    traits: ['Some properties of metals, some of nonmetals', 'Many are semiconductors (silicon chips)', 'Brittle solids with a metallic luster'],
  },
  {
    id: 'nonmetal',
    one: 'a nonmetal',
    label: 'Other nonmetals',
    blurb: 'Hydrogen, carbon, nitrogen, oxygen, phosphorus, sulfur, selenium: the stuff of life.',
    traits: ['Poor conductors of heat and electricity', 'Share electrons in molecules (covalent bonds)', 'Many are gases; the solids are brittle', 'Make up most of living things'],
  },
  {
    id: 'halogen',
    one: 'a halogen',
    label: 'Halogens',
    blurb: 'Group 17: "salt-formers", very reactive nonmetals.',
    traits: ['Seven outer electrons, so they form −1 ions', 'Very reactive; combine with metals to make salts', 'Pairs of atoms as gases or liquids (diatomic: F₂, Cl₂)', 'Used to disinfect water (chlorine) and in toothpaste (fluorine)'],
  },
  {
    id: 'noble-gas',
    one: 'a noble gas',
    label: 'Noble gases',
    blurb: 'Group 18: gases that hardly react with anything.',
    traits: ['Colorless, odorless gases', 'A full outer shell, so they are inert', 'Glow in electric signs (neon lights)', 'Helium floats balloons; argon fills light bulbs'],
  },
  {
    id: 'lanthanide',
    one: 'a lanthanide',
    label: 'Lanthanides',
    blurb: 'The first row below the table: the "rare earth" metals.',
    traits: ['Silvery metals with very similar chemistry', 'Make strong magnets (neodymium) and screen colors', 'Not so rare, but hard to separate from each other'],
  },
  {
    id: 'actinide',
    one: 'an actinide',
    label: 'Actinides',
    blurb: 'The second row below the table: all radioactive.',
    traits: ['All radioactive', 'Uranium and plutonium fuel nuclear reactors', 'Most were first made in labs'],
  },
]

export const familyOf = (id: FamilyId) => FAMILIES.find((f) => f.id === id)!

/** Words that may need explaining: tap one for its meaning. Keys are matched as whole words, any case. */
export const GLOSSARY: Record<string, string> = {
  malleable: 'Can be hammered or pressed into thin sheets without breaking.',
  ductile: 'Can be pulled out into a thin wire.',
  conductor: 'Lets heat or electricity flow through it easily.',
  conductors: 'Let heat or electricity flow through them easily.',
  ion: 'An atom that has gained or lost electrons, so it has an electric charge.',
  ions: 'Atoms that have gained or lost electrons, so they have an electric charge.',
  'outer electron': 'An electron in the outermost shell (a valence electron); these take part in reactions.',
  'outer electrons': 'Electrons in the outermost shell (valence electrons); these take part in reactions.',
  'outer shell': 'The outermost ring of electrons around an atom; how full it is decides how the atom reacts.',
  reactive: 'Combines easily with other substances, often quickly or with heat.',
  inert: 'Hardly reacts with anything.',
  semiconductors: 'Materials that conduct electricity only partly, in a controllable way: the basis of computer chips.',
  catalysts: 'Substances that speed up a reaction without being used up.',
  alloys: 'Mixtures of metals (like bronze: copper and tin) that are often stronger than either alone.',
  alloy: 'A mixture of metals (like bronze: copper and tin), often stronger than either alone.',
  solder: 'A metal that melts easily, used to join wires and pipes.',
  luster: 'The shine of a surface that reflects light.',
  diatomic: 'Made of two atoms joined together, like O₂ or Cl₂.',
  radioactive: 'Its atoms break apart over time, giving off radiation.',
  covalent: 'A bond where atoms share electrons.',
  compounds: 'Substances made of two or more elements joined together.',
  'atomic number': 'How many protons are in the nucleus; it decides which element it is.',
  'atomic mass': 'The average mass of an atom of the element, in atomic mass units.',
  group: 'A column of the table; elements in a group behave alike.',
  period: 'A row of the table; elements in a period have the same number of electron shells.',
  brittle: 'Breaks or shatters instead of bending.',
  salts: 'Compounds made of a metal and a nonmetal, like table salt (sodium chloride).',
}

/** Pieces of a text with the glossary words marked (longest first, whole words, the first time each appears). */
export function glossaryParts(text: string): { text: string; term?: string }[] {
  const keys = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length)
  const re = new RegExp(`\\b(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi')
  const seen = new Set<string>()
  const out: { text: string; term?: string }[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const key = m[0].toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    if (m.index! > last) out.push({ text: text.slice(last, m.index) })
    out.push({ text: m[0], term: key })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

let loaded: Promise<Element[]> | null = null
/** The elements (loaded once, when first needed). */
export const loadElements = () => (loaded ??= import('../data/elements.json').then((m) => m.default as unknown as Element[]))

/** The element a word names (its name or symbol, any case for names; symbols as written). */
export function findElement(elements: Element[], word: string): Element | undefined {
  const w = word.trim()
  return elements.find((e) => e.symbol === w) ?? elements.find((e) => e.name.toLowerCase() === w.toLowerCase())
}

/** The other members of an element's family, in table order (for the family strip). */
export const familyMembers = (elements: Element[], family: FamilyId) => elements.filter((e) => e.family === family).sort((a, b) => a.number - b.number)

/** Today's element (the same for everyone that day; the common ones first, the first 56, then all). */
export function elementOfDay(elements: Element[], day: string): Element {
  const n = Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000)
  const pool = n % 3 === 2 ? elements : elements.slice(0, 56)
  return pool[((n * 7) % pool.length + pool.length) % pool.length]
}

/**
 * One sentence worth reading about an element: its summary's first sentence, unless that's only "X is a chemical
 * element with symbol …", then the next one.
 */
export function keySentence(e: Pick<Element, 'summary'>): string {
  const sentences = e.summary.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((x) => x.trim()) ?? [e.summary]
  return (/is a chemical element/i.test(sentences[0]) && sentences[1] ? sentences[1] : sentences[0]) ?? ''
}

/** °C from kelvin, rounded. */
export const celsius = (k: number) => Math.round(k - 273.15)
