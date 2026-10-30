import { describe, expect, it } from 'vitest'
import { cleanWeatherSettings, DEFAULT_PLACE, describeWeather, forecastLink, parsePlaces, parseWeather, sharedPlace, siteTemplate, weatherUrl } from './weather'

describe('weather', () => {
  it('reads an Open-Meteo answer', () => {
    const w = parseWeather(
      { current: { temperature_2m: 78.4, weather_code: 2 }, daily: { weather_code: [95], temperature_2m_max: [86.6], temperature_2m_min: [70.2], precipitation_probability_max: [60] } },
      5,
    )
    expect(w).toEqual({ temp: 78, high: 87, low: 70, code: 2, dayCode: 95, rain: 60, at: 5 })
  })

  it('gives up on a broken answer', () => {
    expect(parseWeather({ error: true })).toBeNull()
    expect(parseWeather(null)).toBeNull()
    expect(parseWeather({ current: { temperature_2m: 'hot', weather_code: 0 }, daily: { temperature_2m_max: [1], temperature_2m_min: [0] } })).toBeNull()
  })

  it('names the weather codes', () => {
    expect(describeWeather(0)).toEqual({ text: 'Clear', icon: 'sun' })
    expect(describeWeather(3).icon).toBe('cloud')
    expect(describeWeather(63).icon).toBe('rain')
    expect(describeWeather(81).text).toBe('Showers')
    expect(describeWeather(96).icon).toBe('storm')
    expect(describeWeather(45).icon).toBe('fog')
  })

  it('asks for Fahrenheit for one day', () => {
    expect(weatherUrl(DEFAULT_PLACE)).toContain('temperature_unit=fahrenheit')
    expect(weatherUrl(DEFAULT_PLACE)).toContain('latitude=28.5383&longitude=-81.3792&timezone=auto')
  })

  it('fills the place into a forecast site, refusing anything but http(s)', () => {
    expect(forecastLink('https://weather.com/weather/today/l/{lat},{lon}', DEFAULT_PLACE)).toBe('https://weather.com/weather/today/l/28.5383,-81.3792')
    expect(forecastLink('https://www.google.com/search?q=weather+{name}', { name: 'Winter Park, Florida', lat: 1, lon: 2 })).toBe('https://www.google.com/search?q=weather+Winter%20Park%2C%20Florida')
    expect(forecastLink('javascript:alert({lat})', DEFAULT_PLACE)).toBeNull()
    expect(forecastLink('not a url', DEFAULT_PLACE)).toBeNull()
  })

  it('picks the link pattern, falling back from a bad custom one', () => {
    expect(siteTemplate({ place: 'auto', site: 'windy' })).toContain('windy.com')
    expect(siteTemplate({ place: 'auto', site: 'custom', custom: 'https://example.org/w?ll={lat},{lon}' })).toBe('https://example.org/w?ll={lat},{lon}')
    expect(siteTemplate({ place: 'auto', site: 'custom', custom: 'javascript:x' })).toContain('weather.gov')
  })

  it('cleans saved settings', () => {
    expect(cleanWeatherSettings(null)).toEqual({ place: 'auto', site: 'nws' })
    expect(cleanWeatherSettings({ place: { name: 'Tampa', lat: 27.9, lon: -82.4 }, site: 'google' })).toEqual({ place: { name: 'Tampa', lat: 27.9, lon: -82.4 }, site: 'google' })
    expect(cleanWeatherSettings({ place: { name: 'x', lat: 'a' }, site: 'evil' })).toEqual({ place: 'auto', site: 'nws' })
  })

  it('reads place search results', () => {
    expect(
      parsePlaces({ results: [{ name: 'Winter Park', latitude: 28.6, longitude: -81.34, admin1: 'Florida', country: 'United States', country_code: 'US' }, { name: 'Paris', latitude: 48.85, longitude: 2.35, admin1: 'Île-de-France', country: 'France', country_code: 'FR' }, { name: 'bad' }] }),
    ).toEqual([
      { name: 'Winter Park, Florida', lat: 28.6, lon: -81.34 },
      { name: 'Paris, Île-de-France, France', lat: 48.85, lon: 2.35 },
    ])
    expect(parsePlaces({})).toEqual([])
  })

  it('uses a recent shared map position as the current location, rounded', () => {
    const now = 10 * 86400000
    expect(sharedPlace({ lat: 28.61234, lon: -81.34567, tst: now - 3600000, off: false }, now)).toEqual({ name: 'Current location', lat: 28.61, lon: -81.35 })
    expect(sharedPlace({ lat: 28.6, lon: -81.3, tst: now - 2 * 86400000, off: false }, now)).toBeNull()
    expect(sharedPlace({ lat: 28.6, lon: -81.3, tst: now, off: true }, now)).toBeNull()
    expect(sharedPlace(null, now)).toBeNull()
  })
})
