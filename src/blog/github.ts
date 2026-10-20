// The blog repository on GitHub (stevenelson35/stevenelson35.github.io): read posts / tags / authors and send the
// "new-post" event. The token is a fine-grained one (only that repo, Contents: read and write) entered once in
// ⚙ Settings and kept in this browser's localStorage, never in the app's code.
const REPO = 'https://api.github.com/repos/stevenelson35/stevenelson35.github.io'
const TOKEN_KEY = 'align-github-token'

export function githubToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function setGithubToken(token: string) {
  if (token.trim()) localStorage.setItem(TOKEN_KEY, token.trim())
  else localStorage.removeItem(TOKEN_KEY)
}

export class GithubError extends Error {}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = githubToken()
  if (!token) throw new GithubError('Add the blog’s GitHub token in ⚙ Settings first (only this device keeps it).')
  const res = await fetch(`${REPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', ...(init.headers ?? {}) },
  })
  if (res.status === 401 || res.status === 403) throw new GithubError(`GitHub refused the token (${res.status}). Check or replace it in ⚙ Settings.`)
  if (!res.ok && res.status !== 204) throw new GithubError(`GitHub said ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res
}

async function names(path: string): Promise<string[]> {
  const files = (await (await api(`/contents/${path}`)).json()) as { name: string }[]
  return files.map((f) => f.name)
}

/** Existing posts, newest first (filenames start with the date). */
export async function listPosts(): Promise<string[]> {
  return (await names('all_collections/_posts')).filter((n) => n.endsWith('.md')).sort().reverse()
}

export async function listTags(): Promise<string[]> {
  return (await names('all_collections/_tags')).map((n) => n.replace(/\.md$/i, '')).sort()
}

export async function listAuthors(): Promise<string[]> {
  return (await names('all_collections/_authors')).map((n) => n.replace(/\.md$/i, '')).sort()
}

/** Sends the event; the blog's Action builds the post, uploads image sizes to Turbify and commits (about 2 minutes). */
export async function dispatchPost(body: unknown): Promise<void> {
  await api('/dispatches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

/** Checks the token without changing anything (Settings "Test"). */
export async function testToken(): Promise<void> {
  await api('')
}
