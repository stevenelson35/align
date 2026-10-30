import { useEffect, useState } from 'react'
import { parseWeather, weatherUrl, type Weather } from '../utils/weather'

const KEY = 'align-weather'
const FRESH_MS = 30 * 60000

function cached(): Weather | null {
  try {
    return parseCached(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return null
  }
}
const parseCached = (w: Weather | null) => (w && typeof w.temp === 'number' && typeof w.at === 'number' ? w : null)

/**
 * Today's weather, kept on this device for 30 minutes (so opening Today doesn't ask every time), refreshed while
 * Today stays open. A failed fetch keeps the last answer; with none, error is set.
 */
export function useWeather(enabled: boolean) {
  const [weather, setWeather] = useState<Weather | null>(cached)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!enabled) return
    let stop = false
    const load = async () => {
      const have = cached()
      if (have && Date.now() - have.at < FRESH_MS) return setWeather(have)
      try {
        const res = await fetch(weatherUrl())
        const w = res.ok ? parseWeather(await res.json()) : null
        if (stop) return
        if (!w) throw new Error('bad answer')
        localStorage.setItem(KEY, JSON.stringify(w))
        setWeather(w)
        setError(false)
      } catch {
        if (!stop) setError(true)
      }
    }
    void load()
    const timer = setInterval(() => void load(), FRESH_MS)
    const onShow = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onShow)
    return () => {
      stop = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [enabled])
  return { weather, error }
}
