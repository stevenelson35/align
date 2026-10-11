import { describe, expect, it } from 'vitest'
import type { Household } from '../types'
import { phoneDigits, smsUrl, splitAbout, splitRecipient, taskLink, textBody, whenText } from './text'

const household = {
  name: 'H',
  members: {
    steve: { role: 'member', displayName: 'Steve', color: '' },
    linda: { role: 'member', displayName: 'Linda', color: '' },
    gj: { role: 'viewer', displayName: 'Grandma Jo', color: '' },
    bot: { role: 'member', displayName: 'Calendar', color: '', bot: true },
  },
  pets: [],
  weeklyTokens: 10,
} as unknown as Household

describe('texting', () => {
  it('builds an sms: link both phone platforms understand', () => {
    expect(phoneDigits(' +1 (555) 010-0100 ')).toBe('+15550100100')
    expect(smsUrl('555-0100', 'Picked up milk & eggs')).toBe('sms:5550100?&body=Picked%20up%20milk%20%26%20eggs')
  })

  it('finds who the text is for, preferring the longest name', () => {
    expect(splitRecipient('Linda I picked up milk', household)).toEqual({ uid: 'linda', rest: 'I picked up milk' })
    expect(splitRecipient('grandma jo see you sunday', household)).toEqual({ uid: 'gj', rest: 'see you sunday' })
    expect(splitRecipient('Grandma see you', household)).toEqual({ uid: 'gj', rest: 'see you' }) // first name
    expect(splitRecipient('Calendar hi', household)).toBeNull() // the sync bot isn't a person
    expect(splitRecipient('Bob hi', household)).toBeNull()
  })

  it('splits "about <task>: <message>"', () => {
    expect(splitAbout('about pick up camilla: are you getting her?')).toEqual({ about: 'pick up camilla', message: 'are you getting her?' })
    expect(splitAbout('about pick up camilla - are you getting her?')).toEqual({ about: 'pick up camilla', message: 'are you getting her?' })
    expect(splitAbout('about pick up camilla')).toEqual({ about: 'pick up camilla', message: '' })
    expect(splitAbout('I picked up milk')).toEqual({ message: 'I picked up milk' })
  })

  it('writes the message with the title, time and link', () => {
    const link = taskLink('t1', 'https://align.example/')
    expect(link).toBe('https://align.example/#/task/t1')
    const about = { title: 'Pick up Camilla', when: whenText({ startDate: '2026-10-09', calendar: { eventId: 'e', time: '3:00 PM–4:00 PM' } }), link }
    expect(textBody('Are you getting her?', about)).toBe(
      `Are you getting her?\n\nRe: Pick up Camilla (${about.when})\nhttps://align.example/#/task/t1`,
    )
    expect(about.when).toMatch(/Oct 9 · 3:00 PM–4:00 PM$/)
    expect(textBody('', { title: 'Buy paint', when: '', link })).toBe('Re: Buy paint\nhttps://align.example/#/task/t1')
    expect(textBody('Picked up milk')).toBe('Picked up milk')
    expect(whenText({ targetDate: '2026-10-12' })).toMatch(/^due /)
  })
})
