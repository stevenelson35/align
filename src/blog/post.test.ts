import { describe, expect, it } from 'vitest'
import { dispatchBody, hasContent, postFilename, postUrl, slugify, splitList, type PostForm } from './post'

const form = (over: Partial<PostForm> = {}): PostForm => ({
  title: 'Pumpkin Patch!', author: 'steve', categories: ['farraginous'], tags: ['2026', 'fall'],
  images: [{ textBefore: 'We went.', imageUrl: 'https://res.cloudinary.com/x/a.jpg', alt: 'pumpkins', fileName: 'a.jpg' }, { textBefore: '', imageUrl: '', alt: '', fileName: '' }],
  youtubeId: '', bottomText: 'Fun day.', quote: '', quoteAttribution: '', ...over,
})

describe('blog posts', () => {
  it('names and addresses a post like the blog does', () => {
    expect(slugify('  Pumpkin Patch! 2026 ')).toBe('pumpkin-patch-2026')
    expect(postFilename('Pumpkin Patch!', '2026-10-20')).toBe('2026-10-20-pumpkin-patch.md')
    expect(postUrl('2026-07-08-des-moines-day.md', ['summer vacation 2026'])).toBe('https://blog.itsallonesong.com/summer%20vacation%202026/2026/07/08/des-moines-day.html')
    expect(postUrl('2026-10-20-x.md', [])).toBe('https://blog.itsallonesong.com/2026/10/20/x.html')
    expect(splitList(' a, b ,, c ')).toEqual(['a', 'b', 'c'])
  })

  it('sends the same dispatch body as blogupdate.html', () => {
    const body = dispatchBody(form(), '2026-10-20-pumpkin-patch.md')
    expect(body.event_type).toBe('new-post')
    expect(body.client_payload).toMatchObject({ image_url: 'https://res.cloudinary.com/x/a.jpg', filename: '2026-10-20-pumpkin-patch.md' })
    expect(JSON.parse(body.client_payload.post_data)).toEqual({
      title: 'Pumpkin Patch!', author: 'steve', top_text: 'We went.', bottom_text: 'Fun day.', quote: '', quote_attribution: '', youtube_id: '',
      images: [{ text_before: 'We went.', image_url: 'https://res.cloudinary.com/x/a.jpg', alt: 'pumpkins', file_name: 'a.jpg', order: 1 }],
      categories: 'farraginous', tags: '2026,fall',
    })
  })

  it('needs some content', () => {
    expect(hasContent(form())).toBe(true)
    expect(hasContent(form({ images: [{ textBefore: ' ', imageUrl: '', alt: 'x', fileName: '' }], bottomText: '' }))).toBe(false)
    expect(hasContent(form({ images: [], bottomText: '', youtubeId: 'abc' }))).toBe(true)
  })
})
