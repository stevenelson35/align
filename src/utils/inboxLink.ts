/** An Align address from a full link to this app ("https://…/#/task/x" → "#/task/x"); other sites stay as they are. */
export function inboxLink(link: string, origin = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname): string {
  if (link.startsWith('#/')) return link
  if (origin && link.startsWith(origin)) {
    const hash = link.indexOf('#/')
    if (hash >= 0) return link.slice(hash)
  }
  return link.slice(0, 500)
}
