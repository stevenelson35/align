import { describe, expect, it } from 'vitest'
import { splitTitleNote } from './quickAdd'

describe('splitTitleNote', () => {
  it('puts what follows the first ": " in the note', () => {
    expect(splitTitleNote('Call the vet: ask about Max’s shots, and the flea meds')).toEqual({ title: 'Call the vet', notes: 'ask about Max’s shots, and the flea meds' })
    expect(splitTitleNote('Buy paint note: satin finish, 2 gallons')).toEqual({ title: 'Buy paint', notes: 'satin finish, 2 gallons' })
  })
  it('leaves plain titles and times alone', () => {
    expect(splitTitleNote('Dentist at 3:30')).toEqual({ title: 'Dentist at 3:30' })
    expect(splitTitleNote('  Mow the lawn ')).toEqual({ title: 'Mow the lawn' })
    expect(splitTitleNote('Trailing colon: ')).toEqual({ title: 'Trailing colon:' })
  })
})
