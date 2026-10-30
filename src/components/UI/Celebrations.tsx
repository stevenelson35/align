import { useEffect, useRef, useState } from 'react'
import { CELEBRATE_EVENT, type Celebration } from '../../utils/celebrate'
import { celebrationSize } from '../../utils/goals'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  star: boolean
  spin: number
  turn: number
  born: number
  life: number
}

const GOLD = '#f2c94c'
const EXTRA = ['#ff7eb6', '#3fb950', '#4493f8']

/**
 * Sparkles when you meet a goal (and a quick one for a flashcard you got): a little burst in your color for the first of several, more (and longer, with the
 * accent) as the day fills up, and for the last one a full burst from the corners with "All done today". Drawn on
 * one canvas over everything that ignores taps. With "reduce motion" on, only the words show.
 */
export function Celebrations() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const particles = useRef<Particle[]>([])
  const frame = useRef(0)
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null)
  const [said, setSaid] = useState('')

  useEffect(() => {
    const draw = () => {
      const c = canvas.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return
      const now = performance.now()
      ctx.clearRect(0, 0, c.width, c.height)
      const dpr = window.devicePixelRatio || 1
      particles.current = particles.current.filter((p) => now - p.born < p.life)
      for (const p of particles.current) {
        if (now < p.born) continue // staggered: not out yet
        const t = (now - p.born) / 16.7
        const x = p.x + p.vx * t
        const y = p.y + p.vy * t + 0.09 * t * t
        const fade = 1 - (now - p.born) / p.life
        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, fade * 1.6))
        ctx.fillStyle = p.color
        ctx.translate(x * dpr, y * dpr)
        ctx.rotate(p.spin + p.turn * t)
        const s = p.size * dpr * (0.6 + 0.4 * fade)
        if (p.star) {
          // A four-pointed sparkle.
          ctx.beginPath()
          for (let i = 0; i < 8; i++) {
            const r = i % 2 ? s * 0.28 : s
            const a = (i * Math.PI) / 4
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
          }
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.fillRect(-s / 2, -s / 4, s, s / 2)
        }
        ctx.restore()
      }
      frame.current = particles.current.length ? requestAnimationFrame(draw) : 0
    }

    const burst = (x: number, y: number, n: number, colors: string[], life: number, up = false, spread = Math.PI * 2) => {
      const now = performance.now()
      for (let i = 0; i < n; i++) {
        const a = up ? -Math.PI / 2 + (Math.random() - 0.5) * spread : Math.random() * Math.PI * 2
        const speed = (up ? 9 : 2.5) + Math.random() * (up ? 6 : 4)
        particles.current.push({
          x,
          y,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - (up ? 0 : 2),
          size: 4 + Math.random() * 6,
          color: colors[i % colors.length],
          star: Math.random() < 0.6,
          spin: Math.random() * Math.PI,
          turn: (Math.random() - 0.5) * 0.3,
          born: now + Math.random() * (life / 4),
          life: life * (0.6 + Math.random() * 0.4),
        })
      }
    }

    const on = (e: Event) => {
      const c = (e as CustomEvent<Celebration>).detail
      if (c.small) {
        // A quick sparkle at the button: a little more for each right answer in a row.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !canvas.current) return
        const root = getComputedStyle(document.documentElement)
        const el = canvas.current
        const dpr = window.devicePixelRatio || 1
        if (!particles.current.length) {
          el.width = window.innerWidth * dpr
          el.height = window.innerHeight * dpr
        }
        const run = Math.max(1, c.small.run)
        burst(c.x ?? window.innerWidth / 2, c.y ?? window.innerHeight / 2, Math.min(44, 12 + 4 * run), [root.getPropertyValue('--brand').trim() || '#8250df', GOLD, ...(run >= 3 ? [EXTRA[0]] : [])], 650 + Math.min(500, 60 * run))
        if (!frame.current) frame.current = requestAnimationFrame(draw)
        return
      }
      const size = celebrationSize(c.done, c.total)
      const root = getComputedStyle(document.documentElement)
      const mine = c.color || root.getPropertyValue('--brand').trim() || '#8250df'
      const colors = [mine, root.getPropertyValue('--brand').trim() || GOLD, GOLD, ...EXTRA].slice(0, size.colors)
      setSaid(c.message ?? (size.final ? `All done today: ${c.total} of ${c.total} goals.` : `${c.done} of ${c.total} goals done today.`))
      if (size.final && !c.quiet) setBanner({ text: c.message ?? (c.total > 1 ? `All ${c.total} done today` : 'Done for today'), key: Date.now() })
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const el = canvas.current
      if (!el) return
      const dpr = window.devicePixelRatio || 1
      el.width = window.innerWidth * dpr
      el.height = window.innerHeight * dpr
      const x = c.x ?? window.innerWidth / 2
      const y = c.y ?? window.innerHeight / 3
      if (size.final) {
        burst(x, y, 50, colors, size.ms)
        burst(0, window.innerHeight, 55, colors, size.ms, true, 0.9)
        burst(window.innerWidth, window.innerHeight, 55, colors, size.ms, true, 0.9)
      } else burst(x, y, size.particles, colors, size.ms)
      if (!frame.current) frame.current = requestAnimationFrame(draw)
    }
    window.addEventListener(CELEBRATE_EVENT, on)
    return () => {
      window.removeEventListener(CELEBRATE_EVENT, on)
      cancelAnimationFrame(frame.current)
    }
  }, [])

  useEffect(() => {
    if (!banner) return
    const t = setTimeout(() => setBanner(null), 3200)
    return () => clearTimeout(t)
  }, [banner])

  return (
    <>
      <canvas ref={canvas} className="celebrate-canvas" aria-hidden="true" />
      {banner && (
        <div key={banner.key} className="celebrate-banner" aria-hidden="true">
          <span>✨</span> {banner.text} <span>✨</span>
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">
        {said}
      </span>
    </>
  )
}
