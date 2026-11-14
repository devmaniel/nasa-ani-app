import { ChevronRight, X } from 'lucide-react'
import { Fragment, type MouseEvent } from 'react'
import { spanOf, type Dates } from '../dates'
import { cropMonths } from '../crops'
import { cropWeather, useWeather, weatherMonths } from '../hooks/useWeather'
import { REGIONS, type Place } from '../places'
import type { LayerKey, SideTab } from '../types'
import { CountryCrops, PlaceCrops, type CropFilter, type OpenGuide } from './CropsPanel'
import { LoadingStatus, Sk } from './Parts'
import { CountryWeather, PlaceWeather } from './WeatherPanel'

type Props = {
  tab: SideTab
  place: Place | null
  dates: Dates
  loading: boolean
  layer: LayerKey | null
  filter: CropFilter | null
  onTile: (l: LayerKey) => void
  onFilter: (f: CropFilter) => void
  onOpenGuide: OpenGuide
  onOpenReport: (from: HTMLElement) => void
  onClose: () => void
  inert: boolean
}

function SkeletonHead() {
  return <><Sk w="34%" h={12} /><Sk w="62%" h={26} /><Sk w="40%" h={12} /></>
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
export function Sidebar({ tab, place, dates, loading: waiting, layer, filter, onTile, onFilter, onOpenGuide, onOpenReport, onClose, inert }: Props) {
  const w = spanOf(dates)
  const weather = tab === 'weather'
  /* both tabs' numbers: the same NASA and forecast data as the map, at the place or across the regions
     (Crops needs the months up to the longest crop's harvest) */
  const wx = useWeather(place ? [place] : REGIONS, weather ? weatherMonths(w) : cropMonths(w))
  const loading = waiting || wx.status === 'loading'
  /* the template redraws the whole body on these changes: open folds close and pressed states snap */
  const redraw = weather ? 'weather:' + layer : 'crops:' + filter
  return (
    <aside className="sb" id="sb" aria-labelledby="sb-t" inert={inert}>
      <div className="sb-h">
        <div className="sb-hd" id="sb-hd">
          {loading ? <SkeletonHead /> : (
            <>
              <p className="kick">{weather ? 'Weather' : 'Crops'} · your dates</p>
              <h2 id="sb-t">{place ? place.name : 'Philippines'}</h2>
              <p className="k">{place ? place.sub : 'The whole country · pick a place for more'}</p>
            </>
          )}
        </div>
        <button className="x sb-x" id="sb-x" type="button" aria-label="Close sidebar" onClick={onClose}><X className="i" /></button>
      </div>
      <div className="sb-s">
        <div id="sb-body" aria-busy={loading || undefined}>
          {loading ? <><LoadingStatus /><SkeletonBody /></>
            : wx.status === 'error' ? <section><p className="k" role="alert">Couldn&rsquo;t load NASA&rsquo;s numbers. Check the connection, then close and reopen the sidebar.</p></section>
            : <Fragment key={redraw}>{weather ? (place ? <PlaceWeather place={place} wx={wx} w={w} dates={dates} layer={layer} onTile={onTile} /> : <CountryWeather wx={wx} w={w} dates={dates} layer={layer} onTile={onTile} />)
            : <section className="crops">{place ? <PlaceCrops place={place} wx={cropWeather(wx)} w={w} filter={filter} onFilter={onFilter} onOpen={onOpenGuide} /> : <CountryCrops wx={cropWeather(wx)} w={w} onOpen={onOpenGuide} />}</section>}</Fragment>}
        </div>
        <p className="src">{loading ? <Sk w="70%" h={12} /> : 'NASA POWER (measured and usual) · Open-Meteo seasonal forecast' + (weather ? '' : ' · Crop needs: FAO ECOCROP')}</p>
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
