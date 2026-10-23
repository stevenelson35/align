#!/usr/bin/env node
// Refreshes The Daily's list of Jonny Thomson's "Mini Philosophy" short videos (YouTube @philosophyminis) in
// src/daily/miniPhilosophy.json. YouTube doesn't let a browser read the channel directly, so the list ships with
// Align and The Daily picks one each day. New videos are added; older ones are kept (for variety). Run any time:
//   node scripts/update-mini-philosophy.mjs     (then build / deploy as usual)
import { readFileSync, writeFileSync } from 'node:fs'

const CHANNEL = 'UCD2eYNCY8wWVpR0ps6O22aA' // Jonny Thomson (@philosophyminis)
const OUT = new URL('../src/daily/miniPhilosophy.json', import.meta.url)
const UA = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' }

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

async function fromFeed() {
  const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL}`, { headers: UA })).text()
  return [...xml.matchAll(/<entry>[\s\S]*?<yt:videoId>([\w-]{11})<\/yt:videoId>[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?<published>([^<]*)<\/published>/g)].map((m) => ({
    id: m[1],
    title: decode(m[2]).trim(),
    date: m[3].slice(0, 10),
  }))
}

async function fromShorts() {
  const html = await (await fetch('https://www.youtube.com/@philosophyminis/shorts', { headers: UA })).text()
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)
  if (!m) return []
  const out = []
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk)
    if (!o || typeof o !== 'object') return
    const v = o.shortsLockupViewModel
    if (v) {
      const id = v.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId
      const title = v.overlayMetadata?.primaryText?.content
      if (id && title) out.push({ id, title: title.trim() })
    }
    Object.values(o).forEach(walk)
  }
  walk(JSON.parse(m[1]))
  return out
}

let existing = []
try {
  existing = JSON.parse(readFileSync(OUT, 'utf8')).videos ?? []
} catch {
  // first run
}
const byId = new Map(existing.map((v) => [v.id, v]))
for (const v of [...(await fromShorts()), ...(await fromFeed())]) byId.set(v.id, { ...byId.get(v.id), ...v })
const videos = [...byId.values()].filter((v) => v.title).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
writeFileSync(OUT, JSON.stringify({ channel: 'Jonny Thomson (Mini Philosophy)', updated: new Date().toISOString().slice(0, 10), videos }, null, 1) + '\n')
console.log(`${videos.length} videos (${videos.length - existing.length} new)`)
