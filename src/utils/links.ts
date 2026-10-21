// Links lists (DESIGN.md §5.2): bookmarks grouped by a "Home/Utilities" style category path.
import type { Task } from '../types'

const SAFE = /^(https?:|mailto:|tel:)/i

/**
 * A clickable address, or null. Adds https:// when there's no scheme ("example.com"). Anything other than
 * http(s)/mailto/tel is refused, so a pasted "javascript:" address can never run.
 */
export function safeUrl(raw: string | undefined): string | null {
  const t = (raw ?? '').trim()
  if (!t) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  if (!SAFE.test(withScheme)) return null
  try {
    return new URL(withScheme).href
  } catch {
    return null
  }
}

/** A name to show when none was typed: the host ("example.com") or the address itself. */
export function defaultName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || url
  } catch {
    return url
  }
}

/** "Home / Utilities " → "Home/Utilities" (empty for none). */
export function cleanCategory(c: string | undefined): string {
  return (c ?? '').split('/').map((p) => p.trim()).filter(Boolean).join('/')
}

export interface LinkNode {
  name: string
  path: string
  links: Task[]
  children: LinkNode[]
}

/** Links grouped into a category tree, names sorted; uncategorized links sit at the root. */
export function linkTree(links: Task[]): LinkNode {
  const root: LinkNode = { name: '', path: '', links: [], children: [] }
  for (const l of links) {
    let node = root
    for (const part of cleanCategory(l.category).split('/').filter(Boolean)) {
      const path = node.path ? `${node.path}/${part}` : part
      let child = node.children.find((c) => c.name.toLowerCase() === part.toLowerCase())
      if (!child) node.children.push((child = { name: part, path, links: [], children: [] }))
      node = child
    }
    node.links.push(l)
  }
  const sort = (n: LinkNode) => {
    n.links.sort((a, b) => a.title.localeCompare(b.title))
    n.children.sort((a, b) => a.name.localeCompare(b.name))
    n.children.forEach(sort)
  }
  sort(root)
  return root
}

/** Every category path in use, for the "category" suggestions. */
export function allCategories(links: Task[]): string[] {
  const out = new Set<string>()
  for (const l of links) {
    const parts = cleanCategory(l.category).split('/').filter(Boolean)
    parts.forEach((_, i) => out.add(parts.slice(0, i + 1).join('/')))
  }
  return [...out].sort()
}

/** A short label for a link in a list of them: "example.com/menu" (long ones trimmed). */
export function linkLabel(url: string): string {
  try {
    const u = new URL(safeUrl(url) ?? url)
    const label = `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`
    return label.length > 48 ? `${label.slice(0, 47)}…` : label
  } catch {
    return url
  }
}
