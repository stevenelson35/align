// Builds src/data/geo-meta.json for flashcard maps (DESIGN.md §5.9): country and US state names (with aliases),
// continents, label points and capitals. Natural Earth (public domain) supplies the facts; the shapes come from the
// world-atlas / us-atlas packages, which are made from the same data. Run once, when the data should change:
//   curl -o /tmp/ne/ne_50m_admin_0_countries.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
//   curl -o /tmp/ne/ne_10m_populated_places_simple.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson
//   node scripts/build-geo.mjs /tmp/ne
import { readFileSync, writeFileSync } from 'node:fs'

const dir = process.argv[2] ?? '/tmp/ne'
const read = (f) => JSON.parse(readFileSync(f, 'utf8'))
const admin0 = read(`${dir}/ne_50m_admin_0_countries.geojson`).features.map((f) => f.properties)
const places = read(`${dir}/ne_10m_populated_places_simple.geojson`).features.map((f) => f.properties)
const world = read('node_modules/world-atlas/countries-50m.json')
const us = read('node_modules/us-atlas/states-10m.json')

const round = (n) => Math.round(n * 100) / 100
const uniq = (list) => [...new Set(list.filter((x) => typeof x === 'string' && x.trim() && x !== '-99').map((x) => x.trim()))]

// Other names people use (Natural Earth already has most official and short forms).
const EXTRA = {
  'United States of America': ['USA', 'US', 'United States', 'America'],
  'United Kingdom': ['UK', 'Britain', 'Great Britain', 'England', 'Scotland', 'Wales'],
  "Côte d'Ivoire": ['Ivory Coast', "Cote d'Ivoire"],
  Myanmar: ['Burma'],
  eSwatini: ['Eswatini', 'Swaziland'],
  'Timor-Leste': ['East Timor'],
  Czechia: ['Czech Republic'],
  'North Macedonia': ['Macedonia'],
  Netherlands: ['Holland', 'The Netherlands'],
  Vatican: ['Vatican City', 'Holy See'],
  'Dem. Rep. Congo': ['DRC', 'DR Congo', 'Congo-Kinshasa', 'Democratic Republic of Congo'],
  Congo: ['Republic of the Congo', 'Congo-Brazzaville', 'Congo Republic'],
  'Cabo Verde': ['Cape Verde'],
  Gambia: ['The Gambia'],
  Bahamas: ['The Bahamas'],
  Turkey: ['Türkiye', 'Turkiye'],
  Palestine: ['State of Palestine'],
  'S. Sudan': ['South Sudan'],
  'Central African Rep.': ['Central African Republic', 'CAR'],
  'Dominican Rep.': ['Dominican Republic'],
  'Eq. Guinea': ['Equatorial Guinea'],
  'Bosnia and Herz.': ['Bosnia', 'Bosnia and Herzegovina'],
  'Solomon Is.': ['Solomon Islands'],
  'Marshall Is.': ['Marshall Islands'],
  Russia: ['Russian Federation'],
  'South Korea': ['Korea', 'Republic of Korea'],
  'North Korea': ["Democratic People's Republic of Korea", 'DPRK'],
  Laos: ["Lao People's Democratic Republic", 'Lao PDR'],
}

// Capitals the places file doesn't mark.
const MANUAL_CAPS = { 'S. Sudan': [['Juba', 4.85, 31.58]], Greenland: [['Nuuk', 64.18, -51.72]] }
// Former or unofficial capitals the places file lists, which a quiz shouldn't accept.
const NOT_CAPITALS = new Set(['Kyoto', 'Baguio', 'Laayoune', 'Lagos', 'Tel Aviv', 'Yangon', 'Johannesburg'])
// The capital usually taught, where a country has more than one.
const TAUGHT = { CIV: 'Yamoussoukro', TZA: 'Dodoma', BEN: 'Porto-Novo', ZAF: 'Pretoria', NLD: 'Amsterdam', BOL: 'Sucre', LKA: 'Sri Jayawardenepura Kotte', MYS: 'Kuala Lumpur', SWZ: 'Mbabane' }

/** Every capital of a country, the taught one first: [name, lat, lon, ...other spellings]. */
function capitalsOf(a3, name) {
  if (MANUAL_CAPS[name]) return MANUAL_CAPS[name]
  const caps = places
    .filter((p) => p.adm0_a3 === a3 && String(p.featurecla).startsWith('Admin-0 capital') && !NOT_CAPITALS.has(p.name))
    .sort((x, y) => (y.name === TAUGHT[a3]) - (x.name === TAUGHT[a3]) || (y.adm0cap ?? 0) - (x.adm0cap ?? 0) || (y.pop_max ?? 0) - (x.pop_max ?? 0))
  if (!caps.length) return undefined
  return caps.map((c) => [c.name.replace(/\s+/g, ' '), round(c.latitude), round(c.longitude), ...uniq([c.namealt, c.nameascii].filter((x) => x && x !== c.name))])
}

const byName = new Map(admin0.map((p) => [p.NAME, p]))
// world-atlas is a little older than the facts file.
const RENAMED = { Macedonia: 'North Macedonia' }
const countries = {}
for (const g of world.objects.countries.geometries) {
  const p = byName.get(g.properties.name) ?? byName.get(RENAMED[g.properties.name])
  if (!p) {
    console.warn('no facts for', g.properties.name)
    continue
  }
  const key = g.id ?? g.properties.name
  countries[key] = {
    n: p.NAME_LONG || p.NAME,
    al: uniq([p.NAME, p.NAME_LONG, p.NAME_EN, p.FORMAL_EN, ...(p.NAME_ALT ? String(p.NAME_ALT).split('|') : []), ...(EXTRA[p.NAME] ?? [])]),
    c: p.CONTINENT,
    s: p.SUBREGION,
    l: [round(p.LABEL_X), round(p.LABEL_Y)],
    caps: capitalsOf(p.ADM0_A3, p.NAME),
    w: p.NAME_EN || p.NAME_LONG || p.NAME,
  }
}

const states = {}
for (const g of us.objects.states.geometries) {
  const name = g.properties.name
  const cap = places.find((p) => p.adm0_a3 === 'USA' && p.featurecla === 'Admin-1 capital' && p.adm1name === name)
  states[g.id] = { n: name, caps: cap ? [[cap.name, round(cap.latitude), round(cap.longitude)]] : undefined }
}

const out = { countries, states }
writeFileSync('src/data/geo-meta.json', JSON.stringify(out))
const sovereign = new Set(admin0.filter((p) => p.TYPE === 'Sovereign country' || p.TYPE === 'Country').map((p) => p.NAME_LONG || p.NAME))
const missingCaps = Object.values(countries).filter((c) => !c.caps && sovereign.has(c.n)).map((c) => c.n)
console.log(Object.keys(countries).length, 'countries;', Object.keys(states).length, 'states;', 'no capital:', missingCaps.length, missingCaps.slice(0, 20).join(', '), '| states without capital:', Object.values(states).filter((s) => !s.caps).map((s) => s.n).join(', '))
