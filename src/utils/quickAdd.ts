// Quick-add boxes (Today, task lists, checklists, notes): one line, so "Title: the note" puts everything after the
// first colon-and-space into the note. "Title note: …" works too. A time like "3:30" (no space) stays in the title.

export function splitTitleNote(text: string): { title: string; notes?: string } {
  const t = text.trim()
  const i = t.search(/:\s/)
  if (i <= 0) return { title: t }
  const title = t.slice(0, i).replace(/\s+note$/i, '').trim()
  const notes = t.slice(i + 1).trim()
  return title && notes ? { title, notes } : { title: t }
}
