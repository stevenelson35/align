import { describe, expect, it } from 'vitest'
import type { Task } from '../types'
import { cleanTags, contactsToCsv, contactsToVcf, csvToContacts, dedupe, hasAnyTag, mapUrl, mergeContact, NO_TAG, parseCsv, samePerson, tagsIn, telUrl, vcfToContacts } from './contacts'

const sam = {
  name: 'Sam Lee',
  org: 'Lee Vet Clinic',
  jobTitle: 'Office manager',
  phones: [{ label: 'mobile' as const, value: '(407) 555-0100' }, { label: 'work' as const, value: '407-555-0199' }],
  emails: [{ label: 'home' as const, value: 'sam@example.com' }],
  addresses: [{ label: 'home' as const, value: '12 Park Ave\nWinter Park, FL 32789' }],
  birthday: '1985-04-12',
  notes: 'Prefers texts; line two',
  links: ['https://example.com/sam'],
}

describe('contacts', () => {
  it('round-trips through vCard', () => {
    const vcf = contactsToVcf([sam])
    expect(vcf).toContain('TEL;TYPE=CELL:(407) 555-0100')
    expect(vcfToContacts(vcf)).toEqual([sam])
  })
  it('reads Google-style vCards (item groups, folded lines, N only)', () => {
    const vcf = 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Doe;Jane;;;\r\nitem1.EMAIL;TYPE=INTERNET:jane@example.com\r\nTEL;TYPE=CELL:+1 407 555 0123\r\nADR;TYPE=WORK:;;1 Main St;Orlando;FL;32801;USA\r\nNOTE:Met at the\r\n  dog park\r\nEND:VCARD\r\n'
    expect(vcfToContacts(vcf)).toEqual([
      { name: 'Jane Doe', emails: [{ label: 'other', value: 'jane@example.com' }], phones: [{ label: 'mobile', value: '+1 407 555 0123' }], addresses: [{ label: 'work', value: '1 Main St\nOrlando, FL 32801\nUSA' }], notes: 'Met at the dog park' },
    ])
  })
  it('reads Google and Outlook CSV exports', () => {
    const google = 'Name,Given Name,Family Name,E-mail 1 - Type,E-mail 1 - Value,Phone 1 - Type,Phone 1 - Value,Address 1 - Type,Address 1 - Formatted\n"Jane Doe",Jane,Doe,* Home,jane@example.com,Mobile,407-555-0123 ::: 407-555-0124,Home,"1 Main St\nOrlando, FL"\n'
    expect(csvToContacts(google)).toEqual([
      { name: 'Jane Doe', emails: [{ label: 'home', value: 'jane@example.com' }], phones: [{ label: 'mobile', value: '407-555-0123' }, { label: 'mobile', value: '407-555-0124' }], addresses: [{ label: 'home', value: '1 Main St\nOrlando, FL' }] },
    ])
    const outlook = 'First Name,Last Name,Company,E-mail Address,Mobile Phone,Business Phone,Business Street,Business City,Business State,Business Postal Code\nBob,Ray,Acme,bob@acme.com,407 555 0001,407 555 0002,9 Oak Rd,Orlando,FL,32803\n'
    const [bob] = csvToContacts(outlook)
    expect(bob.name).toBe('Bob Ray')
    expect(bob.org).toBe('Acme')
    expect(bob.phones).toEqual([{ label: 'mobile', value: '407 555 0001' }, { label: 'work', value: '407 555 0002' }])
    expect(bob.addresses).toEqual([{ label: 'work', value: '9 Oak Rd\nOrlando, FL 32803' }])
  })
  it('merges the same person from different sources', () => {
    const fromPhone = { name: 'Sam Lee', phones: [{ label: 'mobile' as const, value: '+1 (407) 555-0100' }] }
    const fromGmail = { name: 'Samuel Lee', emails: [{ label: 'other' as const, value: 'SAM@example.com' }], phones: [{ label: 'mobile' as const, value: '4075550100' }] }
    expect(samePerson(fromPhone, fromGmail)).toBe(true) // same number
    expect(mergeContact(fromPhone, fromGmail).phones).toHaveLength(1)
    expect(dedupe([fromPhone, fromGmail, { name: 'Pat' }]).map((c) => c.name)).toEqual(['Sam Lee', 'Pat'])
  })
  it('makes call and map links', () => {
    expect(telUrl('(407) 555-0100')).toBe('tel:4075550100')
    expect(mapUrl('12 Park Ave\nWinter Park, FL')).toBe('https://www.google.com/maps/search/?api=1&query=12%20Park%20Ave%2C%20Winter%20Park%2C%20FL')
  })
})

describe('contact tags', () => {
  const person = (title: string, tags?: string[]) => ({ title, contact: tags ? { tags } : {} }) as Task
  it('tidies tags: trims, drops repeats ignoring case, keeps the first spelling', () => {
    expect(cleanTags(['  Family ', 'family', 'Christmas   List', '', 'x'.repeat(50)])).toEqual(['Family', 'Christmas List', 'x'.repeat(40)])
  })
  it('lists the tags in use, A–Z', () => {
    expect(tagsIn([person('A', ['School', 'Ballet']), person('B', ['ballet', 'Family']), person('C')])).toEqual(['Ballet', 'Family', 'School'])
  })
  it('filters by any chosen tag, or no tag', () => {
    const ann = person('Ann', ['Ballet', 'Christmas List'])
    const bob = person('Bob')
    expect(hasAnyTag(ann, new Set())).toBe(true)
    expect(hasAnyTag(ann, new Set(['christmas list']))).toBe(true)
    expect(hasAnyTag(ann, new Set(['school']))).toBe(false)
    expect(hasAnyTag(bob, new Set([NO_TAG]))).toBe(true)
    expect(hasAnyTag(ann, new Set([NO_TAG]))).toBe(false)
  })
  it('keeps tags through vCard CATEGORIES, both ways', () => {
    const vcf = contactsToVcf([{ name: 'Ann Lee', tags: ['Ballet', 'Christmas List'] }])
    expect(vcf).toContain('CATEGORIES:Ballet,Christmas List')
    expect(vcfToContacts(vcf)[0].tags).toEqual(['Ballet', 'Christmas List'])
    expect(vcfToContacts('BEGIN:VCARD\nFN:Bo\nCATEGORIES:myContacts,Family\nEND:VCARD')[0].tags).toEqual(['Family'])
  })
  it('reads Google labels and Outlook categories from CSV', () => {
    expect(csvToContacts('Name,Labels\nAnn,* myContacts ::: Family ::: School\n')[0].tags).toEqual(['Family', 'School'])
    expect(csvToContacts('First Name,Last Name,Categories\nBo,Ray,Services;Christmas List\n')[0].tags).toEqual(['Services', 'Christmas List'])
  })
  it('merges tags when the same person is imported again', () => {
    expect(mergeContact({ name: 'Ann', tags: ['Family'] }, { name: 'Ann', tags: ['family', 'School'] }).tags).toEqual(['Family', 'School'])
  })
  it('exports a CSV for a spreadsheet or mailing labels', () => {
    const csv = contactsToCsv([{ name: 'Ann Lee', addresses: [{ label: 'home', value: '1 Elm St\nWinter Park, FL 32789' }], tags: ['Christmas List'], phones: [{ label: 'mobile', value: '407 555 0100' }] }])
    const rows = parseCsv(csv)
    expect(rows[0]).toEqual(['Name', 'Company', 'Job Title', 'Phone', 'Email', 'Address', 'Birthday', 'Tags', 'Notes'])
    expect(rows[1]).toEqual(['Ann Lee', '', '', '407 555 0100', '', '1 Elm St\nWinter Park, FL 32789', '', 'Christmas List', ''])
  })
})
