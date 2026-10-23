// Blog posts (DESIGN.md §10.2): what the blog's "new-post" GitHub Action expects, the post's filename and address.
// Mirrors blogupdate.html and .github/workflows/process-blog-post.yml in the blog repo (stevenelson35.github.io).

export const BLOG_URL = 'https://blog.itsallonesong.com'
/** Categories the blog has pages for (same list as blogupdate.html); a new one can be typed. */
export const BLOG_CATEGORIES = [
  'alex-ba-dilla-videos',
  'farraginous',
  'spring break 2024',
  'summer vacation 2021',
  'summer vacation 2022',
  'summer vacation 2023',
  'summer vacation 2024',
  'summer vacation 2025',
  'summer vacation 2026',
  'vet 2023',
  'winter vacation 2023',
]

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** "2026-10-20-pumpkin-patch.md" for a new post. */
export function postFilename(title: string, day: string): string {
  return `${day}-${slugify(title)}.md`
}

/** Jekyll's default permalink, as the blog uses it: /<categories>/YYYY/MM/DD/<slug>.html (categories as written). */
export function postUrl(filename: string, categories: string[]): string {
  const m = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/)
  if (!m) return BLOG_URL
  return `${BLOG_URL}/${[...categories.map((c) => encodeURIComponent(c)), m[1], m[2], m[3], `${m[4]}.html`].join('/')}`
}

/** "a, b ,c" → ["a", "b", "c"] */
export function splitList(text: string): string[] {
  return text.split(',').map((s) => s.trim()).filter(Boolean)
}

export interface ImageBlock {
  textBefore: string
  imageUrl: string
  alt: string
  fileName: string
}

export interface PostForm {
  title: string
  author: string
  categories: string[]
  tags: string[]
  images: ImageBlock[]
  youtubeId: string
  bottomText: string
  quote: string
  quoteAttribution: string
}

/** The repository_dispatch body for event "new-post", exactly as blogupdate.html sends it. */
export function dispatchBody(form: PostForm, filename: string) {
  const images = form.images
    .map((b, i) => ({ text_before: b.textBefore.trim(), image_url: b.imageUrl, alt: b.alt.trim(), file_name: b.fileName.trim(), order: i + 1 }))
    .filter((b) => b.text_before || b.image_url || b.alt)
  const postData = {
    title: form.title.trim(),
    author: form.author || 'steve',
    top_text: images[0]?.text_before ?? '',
    bottom_text: form.bottomText,
    quote: form.quote,
    quote_attribution: form.quoteAttribution,
    youtube_id: form.youtubeId.trim(),
    images,
    categories: form.categories.join(','),
    tags: form.tags.join(','),
  }
  return {
    event_type: 'new-post',
    client_payload: { image_url: images.find((b) => b.image_url)?.image_url ?? '', filename, post_data: JSON.stringify(postData) },
  }
}

/** Something to post: text, an image, a quote, or a video. */
export function hasContent(form: PostForm): boolean {
  return !!(form.images.some((b) => b.textBefore.trim() || b.imageUrl) || form.bottomText.trim() || form.quote.trim() || form.youtubeId.trim())
}
