import { describe, expect, it } from 'vitest'
import { bookmarksHtmlToLinks, fileNameFor, linksToBookmarksHtml, linksToMarkdown, markdownToLinks, markdownToNotes, markdownToTasks, notesToMarkdown, tasksToMarkdown } from './transfer'

describe('notes', () => {
  it('round-trips through Markdown', () => {
    const notes = [{ title: 'Wi-Fi', notes: 'Network: home\nPassword: in the drawer' }, { title: 'Shoe sizes' }]
    const md = notesToMarkdown('House notes', notes)
    expect(md).toContain('## Wi-Fi')
    expect(markdownToNotes(md)).toEqual(notes)
  })
  it('reads # headings when there are no ##, and a plain file as one note', () => {
    expect(markdownToNotes('# A\nfirst\n# B\nsecond')).toEqual([{ title: 'A', notes: 'first' }, { title: 'B', notes: 'second' }])
    expect(markdownToNotes('just some text', 'recipe')).toEqual([{ title: 'recipe', notes: 'just some text' }])
  })
  it('reads title / note blocks and JSON', () => {
    expect(markdownToNotes('- title: Garage code\n  note: 4821\n- title: Pediatrician\n  note: |\n    Dr. Lee\n    555-0100')).toEqual([
      { title: 'Garage code', notes: '4821' },
      { title: 'Pediatrician', notes: 'Dr. Lee\n555-0100' },
    ])
    expect(markdownToNotes('[{"title":"A","note":"x"},{"name":"B"}]')).toEqual([{ title: 'A', notes: 'x' }, { title: 'B' }])
  })
})

describe('links', () => {
  const links = [
    { title: 'GitHub', url: 'https://github.com/' },
    { title: 'Electric', url: 'https://power.example.com/', category: 'Home/Utilities', notes: 'Account 123' },
    { title: 'Water', url: 'https://water.example.com/', category: 'Home/Utilities' },
    { title: 'Hardware store', url: 'https://hw.example.com/', category: 'Home' },
  ]
  it('round-trips through Markdown with categories as headings', () => {
    const md = linksToMarkdown('Bookmarks', links)
    expect(md).toContain('## Home\n')
    expect(md).toContain('### Utilities')
    const back = markdownToLinks(md)
    expect(back).toHaveLength(4)
    expect(back.find((l) => l.title === 'Electric')).toEqual(links[1])
    expect(back.find((l) => l.title === 'GitHub')!.category).toBeUndefined()
  })
  it('reads indented bullets, bare addresses and notes', () => {
    const md = '- School\n  - [Portal](https://portal.example.com) — grades\n  - https://lunch.example.com\n- [Top](example.org)'
    expect(markdownToLinks(md)).toEqual([
      { title: 'Portal', url: 'https://portal.example.com/', category: 'School', notes: 'grades' },
      { title: 'lunch.example.com', url: 'https://lunch.example.com/', category: 'School' },
      { title: 'Top', url: 'https://example.org/' },
    ])
  })
  it('round-trips through a browser bookmarks file, leaving out the browser’s own top folder', () => {
    const html = linksToBookmarksHtml('Bookmarks', links)
    expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>')
    const back = bookmarksHtmlToLinks(html)
    // Our file puts everything in a folder named after the list.
    expect(back.find((l) => l.title === 'Electric')).toEqual({ ...links[1], category: 'Bookmarks/Home/Utilities' })
    const chrome = '<DL><p><DT><H3>Bookmarks bar</H3><DL><p><DT><H3>Kids</H3><DL><p><DT><A HREF="https://pbskids.org/" ADD_DATE="1">PBS Kids</A><DD>Shows &amp; games</DL><p></DL><p><DT><A HREF="javascript:void(0)">x</A></DL>'
    expect(bookmarksHtmlToLinks(chrome)).toEqual([{ title: 'PBS Kids', url: 'https://pbskids.org/', category: 'Kids', notes: 'Shows & games' }])
  })
})

describe('tasks', () => {
  it('round-trips a project with dates, dependencies, notes and done items', () => {
    const tasks = [
      { title: 'Buy lumber', done: true, startDate: '2026-11-01', targetDate: '2026-11-02' },
      { title: 'Build frame', notes: 'Use the long screws\nTwo people', startDate: '2026-11-03', durationDays: 2, after: ['Buy lumber'] },
    ]
    const md = tasksToMarkdown('Deck', tasks)
    expect(md).toContain('- [x] Buy lumber {start 2026-11-01, due 2026-11-02}')
    expect(md).toContain('- [ ] Build frame {start 2026-11-03, 2 days, after: Buy lumber}')
    expect(markdownToTasks(md)).toEqual(tasks)
  })
  it('reads simple checklists, numbered lists, "title: note" and plain lines', () => {
    expect(markdownToTasks('* Milk\n1. Eggs: a dozen\n- [X] Bread\nApples')).toEqual([
      { title: 'Milk' },
      { title: 'Eggs', notes: 'a dozen' },
      { title: 'Bread', done: true },
      { title: 'Apples' },
    ])
    expect(fileNameFor('Home & Garden!', 'md')).toBe('home-garden.md')
  })
})
