// Builds src/data/elements.json for the periodic table (DESIGN.md §5.15): the 118 elements' facts, trimmed to what
// Align shows. Source: Periodic-Table-JSON by Bowserinator (github.com/Bowserinator/Periodic-Table-JSON), CC BY-SA 3.0,
// itself drawn from Wikipedia; the photos are on Wikimedia Commons, each with its own credit (kept with it). Run once,
// when the data should change:
//   curl -L -o /tmp/ptable/pt.json https://raw.githubusercontent.com/Bowserinator/Periodic-Table-JSON/master/PeriodicTableJSON.json
//   node scripts/build-elements.mjs /tmp/ptable/pt.json
import { readFileSync, writeFileSync } from 'node:fs'

const file = process.argv[2] ?? '/tmp/ptable/pt.json'
const { elements } = JSON.parse(readFileSync(file, 'utf8'))

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v))
/** The first two sentences: enough for a card; Wikipedia has the rest. */
const twoSentences = (t) => (t ?? '').replace(/\s+/g, ' ').match(/^(.+?[.!?])\s+(.+?[.!?])(\s|$)/)?.slice(1, 3).join(' ') ?? t ?? ''
const clean = (v) => (typeof v === 'string' && v.trim() && v !== 'None' ? v.trim() : undefined)

/**
 * The family a chemistry class uses (by group first, so the halogens are their own family; the source lumps them with
 * the other "diatomic nonmetals").
 */
function family(e) {
  const c = e.category ?? ''
  if (e.number >= 57 && e.number <= 71) return 'lanthanide'
  if (e.number >= 89 && e.number <= 103) return 'actinide'
  if (e.group === 18) return 'noble-gas'
  if (e.group === 17) return 'halogen'
  if (e.group === 1 && e.number !== 1) return 'alkali-metal'
  if (e.group === 2) return 'alkaline-earth-metal'
  if (/metalloid/.test(c)) return 'metalloid'
  if (/post-transition/.test(c)) return 'post-transition-metal'
  if (/transition/.test(c)) return 'transition-metal'
  return 'nonmetal'
}

const out = elements
  .filter((e) => e.number <= 118)
  .map((e) => {
    const image = e.image && clean(e.image.url) ? { url: e.image.url, title: clean(e.image.title), credit: clean(e.image.attribution) } : undefined
    return {
      number: e.number,
      symbol: e.symbol,
      name: e.name,
      mass: num(e.atomic_mass) !== undefined ? Math.round(num(e.atomic_mass) * 1000) / 1000 : undefined,
      family: family(e),
      group: e.number >= 57 && e.number <= 71 ? undefined : e.number >= 89 && e.number <= 103 ? undefined : e.group,
      period: e.period,
      // Where it sits in the usual table: 18 columns; the lanthanides and actinides in rows 9 and 10 below.
      x: e.xpos,
      y: e.ypos,
      phase: clean(e.phase),
      appearance: clean(e.appearance),
      summary: twoSentences(e.summary),
      discoveredBy: clean(e.discovered_by),
      namedBy: clean(e.named_by),
      density: num(e.density),
      melt: num(e.melt),
      boil: num(e.boil),
      electrons: clean(e.electron_configuration_semantic),
      shells: Array.isArray(e.shells) ? e.shells : undefined,
      electronegativity: num(e.electronegativity_pauling),
      block: clean(e.block),
      image,
      source: clean(e.source),
    }
  })

if (out.length !== 118) throw new Error(`Expected 118 elements, got ${out.length}`)
writeFileSync('src/data/elements.json', JSON.stringify(out))
console.log(`Wrote src/data/elements.json: ${out.length} elements, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`)
