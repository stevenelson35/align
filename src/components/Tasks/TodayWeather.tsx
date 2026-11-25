import type { Weather } from '../../utils/weather'
import { describeWeather, forecastLink, siteTemplate, weatherLine } from '../../utils/weather'
import { useStoredFlag } from '../../hooks/useStoredFlag'
import { useTodayExpansion } from '../../hooks/useTodaySection'
import { useWeather } from '../../hooks/useWeather'
import { Icon } from '../UI/Icon'
import { SectionHeader } from '../UI/SectionHeader'

const iconFor = (w: Weather) => {
  const { icon } = describeWeather(w.code)
  return w.night && icon === 'sun' ? 'moon' : icon
}

/**
 * Weather as a Home row like the others: the icon for now, "Weather", the day in one line, and Show, which opens
 * the place, when it was checked, and the full forecast on your chosen site (Settings → Weather), saying where it
 * goes. Today only.
 */
export function WeatherPanel() {
  const [open, saveOpen] = useStoredFlag('align-weather-open', false)
  const setOpen = useTodayExpansion(open, saveOpen)
  const { weather, error, place, settings } = useWeather(true)
  const link = place ? forecastLink(siteTemplate(settings), place) : null
  const site = link ? new URL(link).hostname.replace(/^www\./, '') : ''
  return (
    <section className="day-section weather-tile">
      <SectionHeader
        icon={weather ? iconFor(weather) : 'cloud'}
        title="Weather"
        onTitleClick={() => setOpen(!open)}
        expanded={open}
        beside={<span className="muted small tile-status">{weather ? weatherLine(weather) : error ? 'Not available right now' : 'Checking…'}</span>}
      >
        <button type="button" className="link small" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'}
        </button>
      </SectionHeader>
      {open && weather && place && (
        <div className="weather-detail small">
          <p>
            {place.name}
            {settings.place === 'auto' ? ' (where you are, from the family map, or Orlando)' : ''} · as of{' '}
            {new Date(weather.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
          {link && (
            <p>
              <a href={link} target="_blank" rel="noopener noreferrer">
                Full forecast on {site} <Icon name="external" />
              </a>
              <span className="muted"> · opens {site}’s forecast for {place.name} in a new tab. Settings → Weather picks the place and the site.</span>
            </p>
          )}
          {/* Open-Meteo's licence (CC BY 4.0) asks for a link beside its data. */}
          <p className="muted">
            Weather data:{' '}
            <a className="muted" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
              Open-Meteo.com
            </a>{' '}
            (CC BY 4.0)
          </p>
        </div>
      )}
    </section>
  )
}
