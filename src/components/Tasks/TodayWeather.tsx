import type { Weather } from '../../utils/weather'
import { describeWeather, forecastLink, siteTemplate, weatherLine } from '../../utils/weather'
import { useApp } from '../../hooks/useApp'
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
 * Weather as a Home row like the others: the icon for now, "Weather", the day in one line, and Show, which opens the
 * place (Change: Settings → Weather) and the forecast on your chosen site. Today only.
 */
export function WeatherPanel() {
  const { openSettings } = useApp()
  // Closed until opened (a new name: the old header button's open setting no longer applies).
  const [open, saveOpen] = useStoredFlag('align-weather-tile-open', false)
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
            {settings.place === 'auto' ? 'Current location' : 'Location'}: {place.name}{' '}
            <button type="button" className="link small" onClick={openSettings}>
              Change
            </button>
          </p>
          {link && (
            <p>
              <a href={link} target="_blank" rel="noopener noreferrer">
                Forecast on {site} <Icon name="external" />
              </a>
              {/* Open-Meteo's licence (CC BY 4.0) asks for a link beside its data: kept to a small ©. */}{' '}
              <a className="muted weather-credit" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" title="Weather data by Open-Meteo.com (CC BY 4.0)" aria-label="Weather data by Open-Meteo.com">
                ©
              </a>
            </p>
          )}
        </div>
      )}
    </section>
  )
}
