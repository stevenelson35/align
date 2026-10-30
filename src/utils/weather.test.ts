import { describe, expect, it } from 'vitest'
import { describeWeather, parseWeather, weatherUrl } from './weather'

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
    expect(weatherUrl()).toContain('temperature_unit=fahrenheit')
    expect(weatherUrl()).toContain('forecast_days=1')
  })
})
