import type { Weather, WeatherPlace, WeatherSettings } from '../../utils/weather'
import { describeWeather, forecastLink, siteTemplate } from '../../utils/weather'
import { Icon } from '../UI/Icon'

const iconFor = (w: Weather) => {
  const { icon } = describeWeather(w.code)
  return w.night && icon === 'sun' ? 'moon' : icon
}

/** In Today's header: the weather now (icon and °F); tapping opens a row with more. */
export function WeatherButton({ weather, place, open, onToggle }: { weather: Weather | null; place: WeatherPlace | null; open: boolean; onToggle: () => void }) {
  if (!weather || !place) return null
  const now = describeWeather(weather.code)
  return (
    <button type="button" className="link weather-button" onClick={onToggle} aria-expanded={open} title={`${now.text}, ${weather.temp}°F (${place.name}). Tap for more.`} aria-label={`Weather: ${now.text}, ${weather.temp} degrees. ${open ? 'Hide' : 'Show'} details`}>
      <Icon name={iconFor(weather)} /> <span className="small">{weather.temp}°</span>
    </button>
  )
}

/** The one row under the header: now (and what's coming), today's high / low, chance of rain, and the place, which opens the full forecast on your chosen site. */
export function WeatherRow({ weather, error, place, settings }: { weather: Weather | null; error: boolean; place: WeatherPlace | null; settings: WeatherSettings }) {
  if (!weather || !place) return error ? <p className="muted small weather-row">The weather isn't available right now.</p> : null
  const now = describeWeather(weather.code)
  const day = describeWeather(weather.dayCode)
  const time = new Date(weather.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const link = forecastLink(siteTemplate(settings), place)
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
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer" title={`The full forecast (${new URL(link).hostname.replace(/^www\./, '')}). Settings → Weather picks the place and the site.`}>
          {place.name} <Icon name="external" />
        </a>
      ) : (
        <span className="muted">{place.name}</span>
      )}
      {/* Open-Meteo's licence (CC BY 4.0) asks for a link beside its data: kept to a small ©. */}
      <a className="muted weather-credit" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" title="Weather data by Open-Meteo.com (CC BY 4.0)" aria-label="Weather data by Open-Meteo.com">
        ©
      </a>
    </p>
  )
}
