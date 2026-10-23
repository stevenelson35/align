// Contacts (DESIGN.md §5.10): a list kind whose items are people (title = name) with phones, emails, addresses and
// a few more fields, plus the usual note / links / pictures / comments. vCard (.vcf) in and out (what Google,
// Samsung, Outlook and iPhone export), the CSV files Google and Outlook export, merging duplicates on import, and the
// links that call / text / email / map. Pure logic, unit-tested.

export type ContactLabel = 'mobile' | 'home' | 'work' | 'other'
export const CONTACT_LABELS: ContactLabel[] = ['mobile', 'home', 'work', 'other']

export interface Labeled {
  label: ContactLabel
  value: string
}

export interface ContactInfo {
  phones?: Labeled[]
  emails?: Labeled[]
  addresses?: Labeled[]
  org?: string
  jobTitle?: string
  /** YYYY-MM-DD, or --MM-DD when the year isn't known. */
  birthday?: string
}

export interface ContactIn extends ContactInfo {
  name: string
  notes?: string
  links?: string[]
}

// ---------- Links that act ----------

export const telUrl = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`
export const mailUrl = (e: string) => `mailto:${e.trim()}`
/** Opens the address in Google Maps (the app on phones, the site elsewhere). */
export const mapUrl = (a: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.replace(/\s*\n\s*/g, ', '))}`

/** Digits only (last 10), to match the same number written differently. */
export const phoneKey = (n: string) => n.replace(/\D/g, '').slice(-10)

// ---------- vCard ----------

function labelFrom(params: string): ContactLabel {
  const p = params.toLowerCase()
  if (/cell|mobile|iphone/.test(p)) return 'mobile'
  if (/work/.test(p)) return 'work'
  if (/home/.test(p)) return 'home'
  return 'other'
}
const vEsc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const vUnesc = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')

/** vCard 3.0, which every contacts app imports. Addresses go in the street part (one formatted text). */
export function contactsToVcf(contacts: ContactIn[]): string {
  const out: string[] = []
  for (const c of contacts) {
    const parts = c.name.trim().split(/\s+/)
    const last = parts.length > 1 ? parts.pop()! : ''
    const type = (l: ContactLabel) => (l === 'mobile' ? 'CELL' : l.toUpperCase())
    out.push('BEGIN:VCARD', 'VERSION:3.0', `FN:${vEsc(c.name)}`, `N:${vEsc(last)};${vEsc(parts.join(' '))};;;`)
    if (c.org) out.push(`ORG:${vEsc(c.org)}`)
    if (c.jobTitle) out.push(`TITLE:${vEsc(c.jobTitle)}`)
    for (const p of c.phones ?? []) out.push(`TEL;TYPE=${type(p.label)}:${p.value}`)
    for (const e of c.emails ?? []) out.push(`EMAIL;TYPE=${e.label === 'mobile' ? 'OTHER' : type(e.label)}:${e.value}`)
    for (const a of c.addresses ?? []) out.push(`ADR;TYPE=${a.label === 'mobile' ? 'OTHER' : type(a.label)}:;;${vEsc(a.value)};;;;`)
    if (c.birthday) out.push(`BDAY:${c.birthday}`)
    for (const u of c.links ?? []) out.push(`URL:${u}`)
    if (c.notes?.trim()) out.push(`NOTE:${vEsc(c.notes.trim())}`)
    out.push('END:VCARD')
  }
  return out.join('\r\n') + '\r\n'
}

/** Contacts from a .vcf file (any number of cards; vCard 2.1, 3.0 or 4.0; folded lines; quoted-printable notes). */
export function vcfToContacts(text: string): ContactIn[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').replace(/=\n/g, '').split('\n')
  const out: ContactIn[] = []
  let c: ContactIn | null = null
  let n = ''
  for (const line of lines) {
    const m = line.match(/^(?:item\d+\.)?([A-Za-z-]+)((?:;[^:]*)?):(.*)$/)
    if (!m) continue
    const key = m[1].toUpperCase()
    const params = m[2]
    let value = m[3]
    if (/ENCODING=QUOTED-PRINTABLE/i.test(params)) value = decodeURIComponent(value.replace(/=([0-9A-F]{2})/gi, '%$1').replace(/%(?![0-9A-F]{2})/gi, '%25'))
    if (key === 'BEGIN') {
      c = { name: '' }
      n = ''
      continue
    }
    if (!c) continue
    switch (key) {
      case 'END':
        if (!c.name) c.name = n.split(';').filter(Boolean).reverse().join(' ').trim() || c.org || c.emails?.[0]?.value || c.phones?.[0]?.value || ''
        if (c.name) out.push(c)
        c = null
        break
      case 'FN':
        c.name = vUnesc(value).trim()
        break
      case 'N':
        n = value
        break
      case 'TEL':
        if (value.trim()) (c.phones ??= []).push({ label: labelFrom(params), value: value.trim() })
        break
      case 'EMAIL':
        if (value.trim()) (c.emails ??= []).push({ label: labelFrom(params), value: value.trim() })
        break
      case 'ADR': {
        const [, , street, city, region, postal, country] = value.split(/(?<!\\);/).map((p) => vUnesc(p).trim())
        const cityLine = [city, [region, postal].filter(Boolean).join(' ')].filter(Boolean).join(', ')
        const text = [street, cityLine, country].filter(Boolean).join('\n')
        if (text) (c.addresses ??= []).push({ label: labelFrom(params), value: text })
        break
      }
      case 'ORG':
        c.org = vUnesc(value.split(/(?<!\\);/)[0]).trim() || undefined
        break
      case 'TITLE':
        c.jobTitle = vUnesc(value).trim() || undefined
        break
      case 'BDAY': {
        const d = value.trim().replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3').slice(0, 10)
        if (/^(\d{4}|--)-?\d{2}-\d{2}$/.test(d)) c.birthday = d.replace(/^---?/, '--')
        break
      }
      case 'URL':
        if (value.trim()) (c.links ??= []).push(value.trim().replace(/\\:/g, ':'))
        break
      case 'NOTE':
        c.notes = vUnesc(value).trim() || undefined
        break
    }
  }
  return out
}

// ---------- CSV (Google Contacts and Outlook exports) ----------

/** Rows of a CSV file (quoted fields, commas and line breaks inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((f) => f.trim()))
}

/**
 * Contacts from a Google Contacts or Outlook CSV export. Columns are found by their header names ("Name" or
 * "First Name" + "Last Name", "E-mail Address", "Phone 1 - Value", "Mobile Phone", "Home Street"…).
 */
export function csvToContacts(text: string): ContactIn[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''))
  if (rows.length < 2) return []
  const head = rows[0].map((h) => h.trim().toLowerCase())
  const col = (re: RegExp) => head.findIndex((h) => re.test(h))
  const out: ContactIn[] = []
  for (const r of rows.slice(1)) {
    const get = (i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')
    const first = get(col(/^(first name|given name)$/))
    const last = get(col(/^(last name|family name)$/))
    const name = get(col(/^(name|display name)$/)) || [first, get(col(/^(middle name|additional name)$/)), last].filter(Boolean).join(' ')
    const c: ContactIn = { name }
    const add = (k: 'phones' | 'emails' | 'addresses', label: ContactLabel, v: string) => {
      for (const one of v.split(/\s*:::\s*/)) if (one.trim()) (c[k] ??= []).push({ label, value: one.trim() })
    }
    head.forEach((h, i) => {
      const v = get(i)
      if (!v) return
      // Google: "Phone 1 - Value" with "Phone 1 - Label"/"Type"; "E-mail 1 - Value"; "Address 1 - Formatted".
      const g = h.match(/^(phone|e-?mail|address) (\d+) - (value|formatted)$/)
      if (g) {
        const typeCol = head.findIndex((x) => x === `${g[1]} ${g[2]} - label` || x === `${g[1]} ${g[2]} - type`)
        const label = labelFrom(get(typeCol))
        add(g[1] === 'phone' ? 'phones' : g[1] === 'address' ? 'addresses' : 'emails', label, v)
        return
      }
      // Outlook: "Mobile Phone", "Home Phone", "Business Phone", "E-mail Address", "E-mail 2 Address".
      if (/^(mobile|home|business|other|primary|car)( phone| fax)?( \d)?$/.test(h) && /phone/.test(h)) add('phones', labelFrom(h.replace('business', 'work').replace('primary', 'other')), v)
      else if (/^e-?mail( \d)? address$/.test(h)) add('emails', 'other', v)
    })
    // Outlook addresses: "Home Street" … "Home Country/Region", same for "Business".
    for (const [prefix, label] of [['home', 'home'], ['business', 'work'], ['other', 'other']] as const) {
      const part = (s: string) => get(col(new RegExp(`^${prefix} ${s}$`)))
      const street = [part('street'), part('street 2')].filter(Boolean).join('\n')
      const cityLine = [part('city'), [part('state'), part('postal code')].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      const text2 = [street, cityLine, part('country/region')].filter(Boolean).join('\n')
      if (text2) (c.addresses ??= []).push({ label, value: text2 })
    }
    c.org = get(col(/^(company|organization name|organization 1 - name)$/)) || undefined
    c.jobTitle = get(col(/^(job title|organization title|organization 1 - title)$/)) || undefined
    c.notes = get(col(/^(notes|note)$/)) || undefined
    const bday = get(col(/^birthday$/))
    if (/^\d{4}-\d{2}-\d{2}$/.test(bday)) c.birthday = bday
    if (!c.name) c.name = c.org || c.emails?.[0]?.value || c.phones?.[0]?.value || ''
    if (c.name) out.push(c)
  }
  return out
}

/** A .vcf file, or a CSV export? */
export const looksLikeVcard = (text: string) => /BEGIN:VCARD/i.test(text)

// ---------- Merging (consolidating several sources) ----------

const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Same person? Same name, or a shared email address or phone number. */
export function samePerson(a: ContactIn, b: ContactIn): boolean {
  if (nameKey(a.name) && nameKey(a.name) === nameKey(b.name)) return true
  const emails = new Set((a.emails ?? []).map((e) => e.value.toLowerCase()))
  if ((b.emails ?? []).some((e) => emails.has(e.value.toLowerCase()))) return true
  const phones = new Set((a.phones ?? []).map((p) => phoneKey(p.value)).filter((k) => k.length >= 7))
  return (b.phones ?? []).some((p) => phones.has(phoneKey(p.value)))
}

/** `a` with everything new from `b` added (numbers / emails / addresses not already there; blanks filled). */
export function mergeContact<T extends ContactIn>(a: T, b: ContactIn): T {
  const union = (x: Labeled[] = [], y: Labeled[] = [], key: (v: string) => string) => {
    const seen = new Set(x.map((v) => key(v.value)))
    return [...x, ...y.filter((v) => !seen.has(key(v.value)) && seen.add(key(v.value)))]
  }
  const notes = a.notes && b.notes && !a.notes.includes(b.notes) ? `${a.notes}\n${b.notes}` : (a.notes ?? b.notes)
  return {
    ...a,
    phones: union(a.phones, b.phones, phoneKey),
    emails: union(a.emails, b.emails, (v) => v.toLowerCase()),
    addresses: union(a.addresses, b.addresses, (v) => v.toLowerCase().replace(/\W+/g, '')),
    org: a.org ?? b.org,
    jobTitle: a.jobTitle ?? b.jobTitle,
    birthday: a.birthday ?? b.birthday,
    notes,
    links: [...new Set([...(a.links ?? []), ...(b.links ?? [])])],
  }
}

/** Incoming contacts folded together (duplicates across files merged), ready to add or merge into a list. */
export function dedupe(contacts: ContactIn[]): ContactIn[] {
  const out: ContactIn[] = []
  for (const c of contacts) {
    const i = out.findIndex((o) => samePerson(o, c))
    if (i >= 0) out[i] = mergeContact(out[i], c)
    else out.push(c)
  }
  return out
}
