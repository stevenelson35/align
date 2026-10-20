import { useEffect, useState, type FormEvent } from 'react'
import { chooseImage } from '../../blog/cloudinary'
import { dispatchPost, githubToken, listAuthors, listPosts, listTags } from '../../blog/github'
import { BLOG_CATEGORIES, dispatchBody, hasContent, postFilename, postUrl, splitList, type ImageBlock } from '../../blog/post'
import { formatDay, today } from '../../engine/dates'
import { useApp } from '../../hooks/useApp'
import { TextForm } from '../Tasks/TextAbout'

const MAX_IMAGES = 6
const emptyBlock = (): ImageBlock => ({ textBefore: '', imageUrl: '', alt: '', fileName: '' })

/**
 * ✍ New blog post (DESIGN.md §10.2): the same post the old blogupdate.html made (text blocks with photos, video,
 * quote), sent to the blog's GitHub Action. Then the post's address, ready to open or text to someone.
 */
export function BlogPostView() {
  const app = useApp()
  const [posts, setPosts] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [authors, setAuthors] = useState<string[]>(['steve'])
  const [loadError, setLoadError] = useState<string | null>(githubToken() ? null : 'none')
  const [target, setTarget] = useState('') // '' = new post, else an existing post's filename
  const [title, setTitle] = useState('')
  const [day, setDay] = useState(today())
  const [author, setAuthor] = useState(app.member.displayName.toLowerCase())
  const [categories, setCategories] = useState('')
  const [tagText, setTagText] = useState('')
  const [blocks, setBlocks] = useState<ImageBlock[]>([emptyBlock()])
  const [youtubeId, setYoutubeId] = useState('')
  const [bottomText, setBottomText] = useState('')
  const [quote, setQuote] = useState('')
  const [quoteAttribution, setQuoteAttribution] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [posted, setPosted] = useState<{ title: string; url: string } | null>(null)

  useEffect(() => {
    if (!githubToken()) return
    Promise.all([listPosts(), listTags(), listAuthors()])
      .then(([p, t, a]) => {
        setPosts(p)
        setTags(t)
        if (a.length) setAuthors(a)
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : String(err)))
  }, [])

  const setBlock = (i: number, patch: Partial<ImageBlock>) => setBlocks((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const filename = target || (title.trim() ? postFilename(title, day) : '')
  const cats = splitList(categories)

  async function publish(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const form = { title, author, categories: cats, tags: splitList(tagText), images: blocks, youtubeId, bottomText, quote, quoteAttribution }
    if (!target && !title.trim()) return setError('Give the post a title.')
    if (!hasContent(form)) return setError('Add some text, a photo, a quote or a video.')
    if (!target && posts.includes(filename)) return setError(`${filename} already exists. Pick it under "Add to" or change the title.`)
    if (blocks.some((b) => b.imageUrl && !b.alt.trim()) && !window.confirm('Some photos have no description (alt text). Post anyway?')) return
    setBusy(true)
    try {
      await dispatchPost(dispatchBody(form, filename))
      setPosted({ title: title.trim() || filename, url: postUrl(filename, target ? [] : cats) })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  if (posted) {
    return (
      <section className="blog-post">
        <h2>Posted 🎉</h2>
        <p>
          The blog is building <strong>{posted.title}</strong> now. It's usually live in about 2 minutes at:
        </p>
        <p className="blog-url">
          <a href={posted.url} target="_blank" rel="noopener noreferrer">
            {posted.url} ↗
          </a>
        </p>
        {target && <p className="muted small">Added to an existing post: its address keeps that post's categories, so check the link once it's live.</p>}
        <TextForm subject={{ title: posted.title, when: '', link: posted.url }} startOpen label="Text the link" />
        <div className="row">
          <button type="button" className="secondary" onClick={() => window.location.reload()}>
            Write another
          </button>
          <button type="button" className="secondary" onClick={() => app.navigate({ view: 'today' })}>
            Back to Today
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="blog-post">
      <header className="view-header">
        <h2>✍ New blog post</h2>
        <span className="grow" />
        <a className="button-link small" href="https://blog.itsallonesong.com" target="_blank" rel="noopener noreferrer">
          The blog ↗
        </a>
      </header>
      {loadError === 'none' && (
        <p className="error">
          Posting needs the blog's GitHub token on this device: add it in{' '}
          <button type="button" className="link inline-link" onClick={() => app.openSettings()}>
            ⚙ Settings
          </button>
          , then come back.
        </p>
      )}
      {loadError && loadError !== 'none' && <p className="error">{loadError}</p>}
      <form className="form" onSubmit={publish}>
        <label>
          Post
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">A new post</option>
            {posts.slice(0, 60).map((p) => (
              <option key={p} value={p}>
                Add to: {p.replace(/\.md$/, '')}
              </option>
            ))}
          </select>
        </label>
        {!target && (
          <>
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pumpkin Patch" />
            </label>
            <div className="grid2">
              <label>
                Date
                <input type="date" value={day} onChange={(e) => setDay(e.target.value || today())} />
              </label>
              <label>
                Author
                <select value={authors.includes(author) ? author : authors[0]} onChange={(e) => setAuthor(e.target.value)}>
                  {authors.map((a) => (
                    <option key={a} value={a}>
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Categories (comma-separated)
              <input value={categories} onChange={(e) => setCategories(e.target.value)} list="blog-categories" placeholder="e.g. farraginous" />
              <datalist id="blog-categories">
                {BLOG_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label>
              Tags (comma-separated)
              <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder={tags.slice(-4).join(', ')} />
            </label>
            {filename && (
              <p className="muted small">
                {filename} · {formatDay(day)}
              </p>
            )}
          </>
        )}

        {blocks.map((b, i) => (
          <fieldset key={i} className="blog-block">
            <legend>
              {i === 0 ? 'Opening text and photo' : `Text and photo ${i + 1}`}
              {blocks.length > 1 && (
                <button type="button" className="link small" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </legend>
            <textarea rows={3} value={b.textBefore} onChange={(e) => setBlock(i, { textBefore: e.target.value })} placeholder="Text before the photo (optional)" aria-label={`Text ${i + 1}`} />
            <div className="row">
              <button
                type="button"
                className="secondary small"
                onClick={() => chooseImage(({ url, fileName }) => setBlock(i, { imageUrl: url, fileName })).catch((err) => setError(String(err.message ?? err)))}
              >
                {b.imageUrl ? 'Change photo' : '📷 Choose photo'}
              </button>
              {b.imageUrl && <img src={b.imageUrl} alt="" className="blog-thumb" />}
              {b.imageUrl && <span className="muted small">{b.fileName}</span>}
            </div>
            {b.imageUrl && <input value={b.alt} onChange={(e) => setBlock(i, { alt: e.target.value })} placeholder="Describe the photo (alt text)" aria-label={`Photo ${i + 1} description`} />}
          </fieldset>
        ))}
        {blocks.length < MAX_IMAGES && (
          <button type="button" className="secondary small" onClick={() => setBlocks([...blocks, emptyBlock()])}>
            + Add text and photo
          </button>
        )}
        <label>
          YouTube video ID (optional)
          <input value={youtubeId} onChange={(e) => setYoutubeId(e.target.value)} placeholder="e.g. -Q3bF4w37Hk" />
        </label>
        <label>
          Closing text (optional)
          <textarea rows={3} value={bottomText} onChange={(e) => setBottomText(e.target.value)} />
        </label>
        <div className="grid2">
          <label>
            Quote (optional)
            <textarea rows={2} value={quote} onChange={(e) => setQuote(e.target.value)} />
          </label>
          <label>
            Quote by
            <input value={quoteAttribution} onChange={(e) => setQuoteAttribution(e.target.value)} placeholder="e.g. Dr. Seuss" />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button type="submit" disabled={busy || loadError === 'none'}>
            {busy ? 'Posting…' : target ? 'Add to post' : 'Publish to blog'}
          </button>
        </div>
      </form>
    </section>
  )
}
