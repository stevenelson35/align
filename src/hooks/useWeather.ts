import { useEffect, useState } from 'react'
import { getMyLocation } from '../firebase/location'
import { cleanWeatherSettings, DEFAULT_PLACE, parseWeather, placeKey, sharedPlace, weatherUrl, type Weather, type WeatherPlace, type WeatherSettings } from '../utils/weather'
import { useApp } from './useApp'

const KEY = 'align-weather'
const SETTINGS_KEY = 'align-weather-settings'
const CHANGED = 'align-weather-settings-changed'
const FRESH_MS = 30 * 60000

export const loadWeatherSettings = (): WeatherSettings => {
  try {
    return cleanWeatherSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null'))
  } catch {
    return cleanWeatherSettings(null)
  }
}

export function saveWeatherSettings(s: WeatherSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  window.dispatchEvent(new Event(CHANGED)) // Today updates at once
}

/** The weather settings, kept in step with Settings. */
export function useWeatherSettings(): WeatherSettings {
  const [s, setS] = useState(loadWeatherSettings)
  useEffect(() => {
    const on = () => setS(loadWeatherSettings())
    window.addEventListener(CHANGED, on)
    return () => window.removeEventListener(CHANGED, on)
  }, [])
  return s
}

function cached(place: WeatherPlace): Weather | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { key?: string; weather?: Weather } | null
    return c?.key === placeKey(place) && typeof c.weather?.temp === 'number' && typeof c.weather.at === 'number' ? c.weather : null
  } catch {
    return null
  }
}

/**
 * Today's weather for your place (one you picked in Settings, or your family-map location while you share it, or
 * Orlando), kept on this device for 30 minutes and refreshed while Today stays open. A failed fetch keeps the last
 * answer; with none, error is set.
 */
export function useWeather(enabled: boolean) {
  const { uid, isMember } = useApp()
  const settings = useWeatherSettings()
  const [autoPlace, setAutoPlace] = useState<WeatherPlace | null>(null)
  // The latest answer (or failure) for a place, by its key; a different place starts from its cached answer.
  const [got, setGot] = useState<{ key: string; weather: Weather | null; error: boolean } | null>(null)
  const auto = settings.place === 'auto'
  const place = settings.place === 'auto' ? autoPlace : settings.place
  const key = place ? placeKey(place) : ''

  // Automatic: your shared family-map position (checked again each time Today opens), else Orlando.
  useEffect(() => {
    if (!enabled || !auto) return
    let stop = false
    void (isMember ? getMyLocation(uid) : Promise.resolve(null)).then((loc) => !stop && setAutoPlace(sharedPlace(loc) ?? DEFAULT_PLACE))
    return () => {
      stop = true
    }
  }, [enabled, auto, uid, isMember])

  useEffect(() => {
    if (!enabled || !place) return
    let stop = false
    const load = async () => {
      const have = cached(place)
      if (have && Date.now() - have.at < FRESH_MS) return
      try {
        const res = await fetch(weatherUrl(place))
        const w = res.ok ? parseWeather(await res.json()) : null
        if (stop) return
        if (!w) throw new Error('bad answer')
        localStorage.setItem(KEY, JSON.stringify({ key: placeKey(place), weather: w }))
        setGot({ key: placeKey(place), weather: w, error: false })
      } catch {
        if (!stop) setGot({ key: placeKey(place), weather: cached(place), error: true })
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
    // key stands for place (a new object with the same spot needn't fetch again)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key])

  const mine = got?.key === key ? got : null
  return { weather: mine?.weather ?? (place ? cached(place) : null), error: mine?.error ?? false, place, settings }
}
