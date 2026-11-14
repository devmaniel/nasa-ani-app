import { ChevronRight, X } from 'lucide-react'
import { Fragment, type MouseEvent } from 'react'
import { spanOf, type Dates } from '../dates'
import type { Place } from '../places'
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
function SkeletonBody({ tab }: { tab: SideTab }) {
  if (tab === 'weather') {
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
  return (
    <section>
      <Sk w="46%" h={18} /><Sk w="100%" h={40} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="sk-row"><Sk w={30 + i * 7 + '%'} h={14} /><Sk w="100%" h={10} /><Sk w="64%" h={12} /></div>
      ))}
    </section>
  )
}

/* the sidebar: Weather or Crops, for the chosen place or the whole country */
export function Sidebar({ tab, place, dates, loading, layer, filter, onTile, onFilter, onOpenGuide, onOpenReport, onClose, inert }: Props) {
  const w = spanOf(dates)
  const weather = tab === 'weather'
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
          {loading ? <><LoadingStatus /><SkeletonBody tab={tab} /></>
            : <Fragment key={redraw}>{weather ? (place ? <PlaceWeather place={place} w={w} dates={dates} layer={layer} onTile={onTile} /> : <CountryWeather w={w} dates={dates} layer={layer} onTile={onTile} />)
            : <section className="crops">{place ? <PlaceCrops place={place} w={w} filter={filter} onFilter={onFilter} onOpen={onOpenGuide} /> : <CountryCrops w={w} onOpen={onOpenGuide} />}</section>}</Fragment>}
        </div>
        <p className="src">Sample data, not a real forecast · Source: docs/PRD.md</p>
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
