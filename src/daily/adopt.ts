// The Daily's adoptable pet near Winter Park / Orlando, from RescueGroups.org's free adoptable-pet API (a non-profit
// service shelters list their animals on). Needs a free API key, kept in config/integrations (household-only), never
// in the app's code. Without one, The Daily shows links to the local shelters instead.

export interface Adoptable {
  name: string
  photo: string
  /** "Young female Labrador Retriever Mix" */
  about: string
  org: string
  place: string
  link: string
  description?: string
}

/** Where to look: Winter Park, FL, and 25 miles around (covers Orlando). */
export const ADOPT_AREA = { postalcode: '32789', miles: 25 }

/** Local shelters and the big searches, for the no-key fallback card. */
export const SHELTER_LINKS = [
  { name: 'Pet Alliance of Greater Orlando', url: 'https://petallianceorlando.org/adopt/' },
  { name: 'Orange County Animal Services', url: 'https://www.ocnetpets.com/' },
  { name: 'Petfinder: pets near Winter Park', url: 'https://www.petfinder.com/search/pets-for-adoption/?location=Winter%20Park%2C%20FL' },
  { name: 'Adopt-a-Pet: pets near Winter Park', url: 'https://www.adoptapet.com/pet-search?location=32789' },
]

interface JsonApiItem {
  id: string
  type: string
  attributes?: Record<string, unknown>
  relationships?: Record<string, { data?: { id: string; type: string }[] }>
}

/** One adoptable animal with a photo near Winter Park, different each day (from up to 100 nearby). */
export async function fetchAdoptable(key: string, dayIndex: number): Promise<Adoptable> {
  const r = await fetch('https://api.rescuegroups.org/v5/public/animals/search/available/haspic/?limit=100&include=orgs,pictures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/vnd.api+json', Authorization: key },
    body: JSON.stringify({ data: { filterRadius: { miles: ADOPT_AREA.miles, postalcode: ADOPT_AREA.postalcode } } }),
  })
  if (!r.ok) throw new Error(r.status === 401 ? 'The RescueGroups key wasn’t accepted.' : `${r.status}`)
  const j = (await r.json()) as { data?: JsonApiItem[]; included?: JsonApiItem[] }
  const animals = (j.data ?? []).filter((a) => a.attributes)
  if (!animals.length) throw new Error('No adoptable pets found nearby.')
  const a = animals[dayIndex % animals.length]
  const at = a.attributes ?? {}
  const included = j.included ?? []
  const orgId = a.relationships?.orgs?.data?.[0]?.id
  const org = included.find((i) => i.type === 'orgs' && i.id === orgId)?.attributes ?? {}
  const picId = a.relationships?.pictures?.data?.[0]?.id
  const pic = included.find((i) => i.type === 'pictures' && i.id === picId)?.attributes as { large?: { url?: string }; original?: { url?: string } } | undefined
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const about = [str(at.ageGroup), str(at.sex).toLowerCase(), str(at.breedString)].filter(Boolean).join(' ')
  return {
    name: str(at.name) || 'A pet looking for a home',
    photo: pic?.large?.url ?? pic?.original?.url ?? str(at.pictureThumbnailUrl),
    about,
    org: str(org.name),
    place: [str(org.city), str(org.state)].filter(Boolean).join(', '),
    link: str(at.url) || str(org.url) || `https://www.rescuegroups.org/`,
    description: str(at.descriptionText).replace(/\s+/g, ' ').slice(0, 500) || undefined,
  }
}
