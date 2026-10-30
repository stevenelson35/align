import type { Weather } from '../../utils/weather'
import { describeWeather, forecastUrl, WEATHER_PLACE } from '../../utils/weather'
import { Icon } from '../UI/Icon'

const iconFor = (w: Weather) => {
  const { icon } = describeWeather(w.code)
  return w.night && icon === 'sun' ? 'moon' : icon
}

/** In Today's header: the weather now (icon and °F); tapping opens a row with more. */
export function WeatherButton({ weather, open, onToggle }: { weather: Weather | null; open: boolean; onToggle: () => void }) {
  if (!weather) return null
  const now = describeWeather(weather.code)
  return (
    <button type="button" className="link weather-button" onClick={onToggle} aria-expanded={open} title={`${now.text}, ${weather.temp}°F in ${WEATHER_PLACE.name}. Tap for more.`} aria-label={`Weather: ${now.text}, ${weather.temp} degrees. ${open ? 'Hide' : 'Show'} details`}>
      <Icon name={iconFor(weather)} /> <span className="small">{weather.temp}°</span>
    </button>
  )
}

/** The one row under the header: now (and what's coming), today's high / low, chance of rain, and the place, which opens the full forecast. */
export function WeatherRow({ weather, error }: { weather: Weather | null; error: boolean }) {
  if (!weather) return error ? <p className="muted small weather-row">The weather isn't available right now.</p> : null
  const now = describeWeather(weather.code)
  const day = describeWeather(weather.dayCode)
  const time = new Date(weather.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const later = day.text !== now.text ? `, ${day.text.toLowerCase()} later` : ''
  return (
    <p className="weather-row small" title={`As of ${time}`}>
      <span>
        <strong>{weather.temp}°</strong> {now.text}
        {later}
      </span>
      <span className="muted">
        {weather.high}° / {weather.low}°
      </span>
      {weather.rain !== undefined && weather.rain > 0 && <span className="muted">{weather.rain}% rain</span>}
      <a href={forecastUrl()} target="_blank" rel="noopener noreferrer" title={`The full ${WEATHER_PLACE.name} forecast (weather.gov)`}>
        {WEATHER_PLACE.name} <Icon name="external" />
      </a>
      <a className="muted weather-credit" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" title="Weather data by Open-Meteo.com (CC BY 4.0)">
        Open-Meteo
      </a>
    </p>
  )
}
