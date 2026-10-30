// Today's weather (DESIGN.md §5): Open-Meteo's free forecast API (no key, no account; free for non-commercial use,
// with attribution). Pure helpers, unit-tested; useWeather fetches and caches.
import type { IconName } from '../components/UI/Icon'

/** Where the weather is for. */
export const WEATHER_PLACE = { name: 'Orlando', lat: 28.5383, lon: -81.3792, timezone: 'America/New_York' }

export const weatherUrl = (p = WEATHER_PLACE) =>
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${p.lat}&longitude=${p.lon}&timezone=${encodeURIComponent(p.timezone)}` +
  '&current=temperature_2m,weather_code,is_day' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
  '&temperature_unit=fahrenheit&forecast_days=1'

/** The full forecast for a person to read (the National Weather Service's page for the spot). */
export const forecastUrl = (p = WEATHER_PLACE) => `https://forecast.weather.gov/MapClick.php?lat=${p.lat}&lon=${p.lon}`

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
