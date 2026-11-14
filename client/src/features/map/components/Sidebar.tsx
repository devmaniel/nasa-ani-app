import { ChevronRight, Info, X } from 'lucide-react'
import { Fragment, type MouseEvent } from 'react'
import { spanOf, type Dates, type Span } from '../dates'
import { cropMonths } from '../crops'
import { cropWeather, useWeather, WEATHER_LAYERS, weatherMonths } from '../hooks/useWeather'
import { usePlaceName } from '../hooks/usePlaceName'
import { MY_PLACE, placeTitle, REGIONS, type Place } from '../places'
import type { SideTab } from '../types'
import { CountryCrops, PHOTO_CREDITS, PlaceCrops, type OpenGuide } from './CropsPanel'
import { LoadingStatus, Sk } from './Parts'
import { CountryWeather, PlaceWeather } from './WeatherPanel'

type Props = {
  tab: SideTab
  place: Place | null
  dates: Dates
  wv: Span /* the months the rain chart shows: the dates, and more on demand */
  onMore?: () => void /* shows more months; missing at the furthest month */
  loading: boolean
  onOpenGuide: OpenGuide
  onOpenReport: (from: HTMLElement) => void
  onClose: () => void
  inert: boolean
  leaving: boolean /* on phones: sliding out to the right; onLeft once it's gone */
  onLeft: () => void
}

/* the loading shapes: the same for Weather and Crops, so switching tabs doesn't jump */
function SkeletonBody() {
  return (
    <>
      <section><Sk w="100%" h={118} /></section>
      <section>
        <Sk w="28%" h={12} />
        <div className="sk-tiles">{[0, 1, 2, 3].map((i) => <Sk key={i} w="100%" h={116} />)}</div>
        <Sk w="30%" h={12} /><Sk w="100%" h={76} />
      </section>
    </>
  )
}

/* the sidebar: Weather or Crops, for the chosen place or the whole country */
export function Sidebar({ tab, place, dates, wv, onMore, loading: waiting, onOpenGuide, onOpenReport, onClose, inert, leaving, onLeft }: Props) {
  const w = spanOf(dates)
  const weather = tab === 'weather'
  /* both tabs' numbers: the same NASA and forecast data as the map, at the place or across the regions
     (Crops needs the months up to the longest crop's harvest) */
  const pts = place ? [place] : REGIONS
  const wx = useWeather(pts, weather ? weatherMonths(wv) : cropMonths(w), pts, weather ? WEATHER_LAYERS : undefined)
  /* the person's own location is named by its town once OpenStreetMap answers; until then, its coordinates */
  const ownName = usePlaceName(place?.name === MY_PLACE ? place : null)
  const title = !place ? 'Philippines' : place.name === MY_PLACE ? ownName ?? place.sub : placeTitle(place)
  const loading = waiting || wx.status === 'loading'
  /* the template redraws the whole body on a tab change: open folds close */
  const redraw = weather ? 'weather' : 'crops'
  return (
    <aside className="sb" id="sb" aria-labelledby="sb-t" inert={inert} data-leaving={leaving ? '' : undefined} onAnimationEnd={(e) => {
      if (leaving && e.target === e.currentTarget) onLeft()
    }}>
      {/* Crops or Weather, the place's name beside it; the data's sources behind ⓘ */}
      <div className="sb-h">
        <div className="sb-hd" id="sb-hd">
          <h2 id="sb-t">{weather ? 'Weather' : 'Crops'}</h2>
          <p className="k">{title}</p>
        </div>
        <details className="srcs">
          <summary className="x" aria-label="Sources"><Info className="i" /></summary>
          <p className="srcs-p">
            <b>Sources</b>
            {'NASA POWER (measured and usual) · Open-Meteo seasonal forecast' + (weather ? ' · Lately: NASA IMERG, SMAP, VIIRS, GLDAS, ERA5 · Land: FAO GAEZ, NASA SRTM, GEDI' : ' · Crop needs: FAO ECOCROP · Land: FAO GAEZ, NASA SRTM')}
            {!weather && <span className="srcs-ph">{PHOTO_CREDITS}</span>}
          </p>
        </details>
        <button className="x sb-x" id="sb-x" type="button" aria-label="Close sidebar" onClick={onClose}><X className="i" /></button>
      </div>
      <div className="sb-s">
        <div id="sb-body" aria-busy={loading || undefined}>
          {loading ? <><LoadingStatus /><SkeletonBody /></>
            : wx.status === 'error' ? <section><p className="k" role="alert">Couldn&rsquo;t load NASA&rsquo;s numbers. Check the connection, then close and reopen the sidebar.</p></section>
            : <Fragment key={redraw}>{weather ? (place ? <PlaceWeather place={place} wx={wx} w={w} wv={wv} onMore={onMore} dates={dates} /> : <CountryWeather wx={wx} w={w} wv={wv} onMore={onMore} dates={dates} />)
            : <section className="crops">{place ? <PlaceCrops place={place} wx={cropWeather(wx)} w={w} onOpen={onOpenGuide} /> : <CountryCrops wx={cropWeather(wx)} onOpen={onOpenGuide} />}</section>}</Fragment>}
        </div>
      </div>
      {place && !loading && (
        <div className="sb-f" id="sb-f">
          <button className="rp-open" id="rp-open" type="button" onClick={(e: MouseEvent<HTMLButtonElement>) => onOpenReport(e.currentTarget)}>
            See full report<ChevronRight className="i" />
          </button>
        </div>
      )}
    </aside>
  )
}
