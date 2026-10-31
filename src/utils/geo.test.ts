import { describe, expect, it } from 'vitest'
import meta from '../data/geo-meta.json'
import { buildIndex, continentFrame, matchCard, normalize, setPrefers, wikiTitle, type GeoMeta } from './geo'

const geoMeta = meta as unknown as GeoMeta
const index = buildIndex(geoMeta)

describe('flashcard places', () => {
  it('normalizes names', () => {
    expect(normalize("  Côte d'Ivoire ")).toBe('cote d ivoire')
    expect(normalize('The Gambia')).toBe('gambia')
    expect(normalize('Washington, D.C.')).toBe('washington dc')
  })

  it('finds a country and its capital, either way round', () => {
    expect(matchCard('France', 'Paris', index)).toMatchObject({ kind: 'country', name: 'France', showCapital: true, capital: { name: 'Paris' } })
    expect(matchCard('Ottawa', 'Canada', index)).toMatchObject({ name: 'Canada', showCapital: true })
    expect(matchCard('What is the capital of Burkina Faso?', 'Ouagadougou', index)).toMatchObject({ name: 'Burkina Faso', showCapital: true })
  })

  it('knows other names', () => {
    expect(matchCard('Ivory Coast', 'Yamoussoukro', index)).toMatchObject({ name: "Côte d'Ivoire", capital: { name: 'Yamoussoukro' } })
    // A country with two capitals: the one the card names.
    expect(matchCard('Bolivia', 'La Paz', index)?.capital?.name).toBe('La Paz')
    expect(matchCard('Bolivia', 'Sucre', index)?.capital?.name).toBe('Sucre')
    expect(matchCard('Burma', '', index)?.name).toBe('Myanmar')
    expect(matchCard('DRC', 'Kinshasa', index)?.name).toBe('Democratic Republic of the Congo')
    expect(matchCard('Republic of the Congo', 'Brazzaville', index)?.name).toBe('Republic of the Congo')
    expect(matchCard('North Macedonia', 'Skopje', index)?.capital?.name).toBe('Skopje')
  })

  it('finds a state, and settles Georgia by the set', () => {
    expect(matchCard('Florida', 'Tallahassee', index, 'state')).toMatchObject({ kind: 'state', name: 'Florida', showCapital: true })
    expect(matchCard('Georgia', 'Atlanta', index, 'state')).toMatchObject({ kind: 'state', name: 'Georgia' })
    expect(matchCard('Georgia', 'Tbilisi', index, 'country')).toMatchObject({ kind: 'country', name: 'Georgia', showCapital: true })
    // On a states set, Washington is the state; on a countries card naming the US, it's the capital.
    expect(matchCard('Washington', 'Olympia', index, 'state')).toMatchObject({ kind: 'state', name: 'Washington' })
    expect(matchCard('United States', 'Washington, D.C.', index)).toMatchObject({ kind: 'country', showCapital: true })
    const states = [{ front: 'Ohio', back: 'Columbus' }, { front: 'Texas', back: 'Austin' }, { front: 'Georgia', back: 'Atlanta' }]
    expect(setPrefers(states, index)).toBe('state')
  })

  it('leaves cards that are not about a place alone', () => {
    expect(matchCard('Photosynthesis', 'Plants make food from light', index)).toBeNull()
    expect(matchCard('7 × 8', '56', index)).toBeNull()
  })

  it('frames a hint on the continent, and names the right article', () => {
    expect(continentFrame('Africa', [-1.5, 12.3])).toEqual([-19, -36, 53, 38])
    expect(continentFrame('Europe', [-28, 38.5])).toBeNull() // the Azores-ish: shown around itself
    expect(wikiTitle({ kind: 'state', id: '13', name: 'Georgia', showCapital: false }, geoMeta)).toBe('Georgia (U.S. state)')
  })
})
