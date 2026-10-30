// Today's weather (DESIGN.md §5): Open-Meteo's free forecast and place-search APIs (no key, no account; free for
// non-commercial use, CC BY 4.0, so a credit link sits beside the data). Pure helpers, unit-tested; useWeather fetches.
import type { IconName } from '../components/UI/Icon'

export interface WeatherPlace {
  name: string
  lat: number
  lon: number
}

/** Where the weather is for when there's nothing better: no place chosen, and not sharing a family-map location. */
export const DEFAULT_PLACE: WeatherPlace = { name: 'Orlando', lat: 28.5383, lon: -81.3792 }

export const weatherUrl = (p: WeatherPlace) =>
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${p.lat.toFixed(4)}&longitude=${p.lon.toFixed(4)}&timezone=auto` +
  '&current=temperature_2m,weather_code,is_day' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  '&temperature_unit=fahrenheit&forecast_days=1'

/** Same place (to about 1 km): the cache key, so a new place fetches again. */
export const placeKey = (p: WeatherPlace) => `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`

/** Sites the place's link can open: {lat}, {lon} and {name} are filled in. */
export const FORECAST_SITES = [
  { id: 'nws', label: 'National Weather Service (weather.gov, US only)', url: 'https://forecast.weather.gov/MapClick.php?lat={lat}&lon={lon}' },
  { id: 'weathercom', label: 'Weather.com', url: 'https://weather.com/weather/today/l/{lat},{lon}' },
  { id: 'windy', label: 'Windy (radar and wind map)', url: 'https://www.windy.com/?{lat},{lon},9' },
  { id: 'google', label: 'Google', url: 'https://www.google.com/search?q=weather+{name}' },
] as const

/** A site's address for a place; null if it isn't an http(s) address (a custom one is checked here). */
export function forecastLink(template: string, p: WeatherPlace): string | null {
  const url = template
    .replaceAll('{lat}', p.lat.toFixed(4))
    .replaceAll('{lon}', p.lon.toFixed(4))
    .replaceAll('{name}', encodeURIComponent(p.name))
    .trim()
  if (!/^https?:\/\//i.test(url)) return null
  try {
    return new URL(url).href
  } catch {
    return null
  }
}

/** Open-Meteo's free place search (no key): "Winter Park" → a few matches, "Winter Park, Florida, United States". */
export const geocodeUrl = (q: string) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=6&language=en&format=json`

export function parsePlaces(json: unknown): WeatherPlace[] {
  const results = (json as { results?: unknown[] })?.results
  if (!Array.isArray(results)) return []
  return results.flatMap((r) => {
    const x = r as Record<string, unknown>
    if (typeof x.name !== 'string' || typeof x.latitude !== 'number' || typeof x.longitude !== 'number') return []
    const name = [x.name, x.admin1, x.country_code === 'US' ? undefined : x.country].filter((v) => typeof v === 'string' && v).join(', ')
    return [{ name, lat: x.latitude, lon: x.longitude }]
  })
}

/** Your weather choices on this device. */
export interface WeatherSettings {
  /** 'auto': your family-map location while you share it, else Orlando. Or a place you picked. */
  place: 'auto' | WeatherPlace
  /** One of FORECAST_SITES, or 'custom' with your own address. */
  site: string
  custom?: string
}

export const DEFAULT_WEATHER_SETTINGS: WeatherSettings = { place: 'auto', site: 'nws' }

/** The link's address pattern for these settings (a bad custom one falls back to weather.gov). */
export function siteTemplate(s: WeatherSettings): string {
  if (s.site === 'custom' && s.custom && forecastLink(s.custom, DEFAULT_PLACE)) return s.custom
  return (FORECAST_SITES.find((f) => f.id === s.site) ?? FORECAST_SITES[0]).url
}

/** Saved settings → a sound WeatherSettings (anything odd falls back to the defaults). */
export function cleanWeatherSettings(raw: unknown): WeatherSettings {
  const r = raw as Partial<WeatherSettings> | null
  const p = r?.place
  const place = p && typeof p === 'object' && typeof p.name === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? { name: p.name.slice(0, 80), lat: p.lat, lon: p.lon } : 'auto'
  const site = r?.site === 'custom' || FORECAST_SITES.some((f) => f.id === r?.site) ? (r!.site as string) : 'nws'
  return { place, site, ...(typeof r?.custom === 'string' && r.custom.trim() ? { custom: r.custom.trim().slice(0, 500) } : {}) }
}

/** A shared family-map position recent enough to call "current location" (a day; rounded to about 1 km). */
export function sharedPlace(loc: { lat?: number; lon?: number; tst?: number; off?: boolean } | null | undefined, now = Date.now()): WeatherPlace | null {
  if (!loc || loc.off || typeof loc.lat !== 'number' || typeof loc.lon !== 'number' || typeof loc.tst !== 'number' || now - loc.tst > 86400000) return null
  return { name: 'Current location', lat: Math.round(loc.lat * 100) / 100, lon: Math.round(loc.lon * 100) / 100 }
}

export interface Weather {
  /** °F now, and today's high / low. */
  temp: number
  high: number
  low: number
  /** WMO weather codes: now, and the day's. */
  code: number
  dayCode: number
  /** Chance of rain today, %. */
  rain?: number
  /** When it was fetched (ms). */
  at: number
  /** After sunset (a clear sky shows the moon). */
  night?: boolean
}

/** Open-Meteo's answer → Weather, or null if it isn't the shape we expect. */
export function parseWeather(json: unknown, at = Date.now()): Weather | null {
  const j = json as { current?: Record<string, unknown>; daily?: Record<string, unknown[]> }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  const temp = num(j?.current?.temperature_2m)
  const code = num(j?.current?.weather_code)
  const high = num(j?.daily?.temperature_2m_max?.[0])
  const low = num(j?.daily?.temperature_2m_min?.[0])
  if (temp === undefined || code === undefined || high === undefined || low === undefined) return null
  return { temp: Math.round(temp), high: Math.round(high), low: Math.round(low), code, dayCode: num(j?.daily?.weather_code?.[0]) ?? code, rain: num(j?.daily?.precipitation_probability_max?.[0]), at, ...(num(j?.current?.is_day) === 0 ? { night: true } : {}) }
}

/** A WMO weather code → words and an icon. */
export function describeWeather(code: number): { text: string; icon: IconName } {
  if (code === 0) return { text: 'Clear', icon: 'sun' }
  if (code === 1) return { text: 'Mostly sunny', icon: 'partly' }
  if (code === 2) return { text: 'Partly cloudy', icon: 'partly' }
  if (code === 3) return { text: 'Cloudy', icon: 'cloud' }
  if (code === 45 || code === 48) return { text: 'Fog', icon: 'fog' }
  if (code >= 51 && code <= 57) return { text: 'Drizzle', icon: 'rain' }
  if (code >= 61 && code <= 67) return { text: 'Rain', icon: 'rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { text: 'Snow', icon: 'snow' }
  if (code >= 80 && code <= 82) return { text: 'Showers', icon: 'rain' }
  if (code >= 95) return { text: 'Thunderstorms', icon: 'storm' }
  return { text: 'Weather', icon: 'cloud' }
}
