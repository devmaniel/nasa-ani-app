import { Cloud, Sprout, type LucideIcon } from 'lucide-react'
import type { MapLibreMap } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { CropWindow } from '../components/CropWindow'
import type { CropFilter } from '../components/CropsPanel'
import { DatesPanel } from '../components/DatesPanel'
import { FullReport } from '../components/FullReport'
import { MapControls, type Hint } from '../components/MapControls'
import { MapStage } from '../components/MapStage'
import { Sidebar } from '../components/Sidebar'
import { TimeBar } from '../components/TimeBar'
import { TopBar } from '../components/TopBar'
import { DEFAULT_MONTHS, lengthEnd, spanOf, TODAY, type Dates } from '../dates'
import { useClimateLayer } from '../hooks/useClimateLayer'
import { useLoading } from '../hooks/useLoading'
import { coords, SPOT_W, type Place } from '../places'
import type { LayerKey, SideTab } from '../types'
import './map.css'
import './map-changes.css'

const PHONE_QUERY = '(max-width: 720px)'
const RECENT_MAX = 3
const HINT_MS = 4000
const MAPLOAD_MS = 700
const STEP_MS = 1000
const LOC_TIMEOUT_MS = 10000
const LOC_MAX_AGE_MS = 600000
const TABS: [SideTab, LucideIcon, string][] = [['weather', Cloud, 'Weather'], ['crops', Sprout, 'Crops']]

const isPhone = () => window.matchMedia(PHONE_QUERY).matches
/* focus goes back to what opened a window, once the page is no longer inert */
function focusBack(ref: { current: HTMLElement | null }) {
  const el = ref.current
  ref.current = null
  if (el && document.contains(el)) el.focus()
}

/* The crop map page (from artifacts/master-template-v2.html). The map is a MapLibre map (flat 2D
   first, or a 3D globe) that flies to and pins the picked place; tapping a spot comes later. */
export function MapPage() {
  const [place, setPlace] = useState<Place | null>(null)
  const [dates, setDates] = useState<Dates>(() => ({ from: TODAY, to: lengthEnd(TODAY, DEFAULT_MONTHS) }))
  const [layer, setLayer] = useState<LayerKey | null>(null)
  const [recent, setRecent] = useState<Place[]>([])
  const [tab, setTab] = useState<SideTab>('weather')
  const [sideOpen, setSideOpen] = useState(() => !isPhone()) /* on phones the map comes first */
  const [filter, setFilter] = useState<CropFilter | null>(null)
  const [datesOpen, setDatesOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [guide, setGuide] = useState<string | null>(null)
  const [frame, setFrame] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [hint, setHint] = useState<Hint | null>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)
  const [is3d, setIs3d] = useState(false) /* the flat map first; 3D on request */
  const [locating, setLocating] = useState(false)
  const [sideToken, setSideToken] = useState(0)
  const [reportToken, setReportToken] = useState(0)
  const [guideToken, setGuideToken] = useState(0)
  const sideLoading = useLoading(sideToken)
  const reportLoading = useLoading(reportToken)
  const guideLoading = useLoading(guideToken)
  const mapLoading = useLoading(0, MAPLOAD_MS)
  const datesButtonRef = useRef<HTMLButtonElement>(null)
  const guideFrom = useRef<HTMLElement | null>(null)
  const reportFrom = useRef<HTMLElement | null>(null)
  const w = spanOf(dates)
  const last = w.b - w.a
  const layerView = useClimateLayer(map, layer, w.a + (frame ?? 0), w) /* the month on the time bar, or the first of the dates */

  const openSide = (open: boolean, t?: SideTab) => {
    if (t) setTab(t)
    setSideOpen(open)
    if (open) setSideToken((n) => n + 1)
  }
  /* remember: false keeps a place out of the recent list (the person's own location: "Use my location" finds it fresh) */
  const choose = (p: Place, remember = true) => {
    setHint(null)
    setPlace(p)
    setFilter(null)
    if (remember) setRecent((r) => [p, ...r.filter((x) => x.name !== p.name)].slice(0, RECENT_MAX))
    openSide(true)
    setReportToken((n) => n + 1)
  }
  const applyDates = (d: Dates) => {
    setDates(d)
    setFrame(null)
    setPlaying(false)
    setSideToken((n) => n + 1)
    setReportToken((n) => n + 1)
  }
  const toggleLayer = (l: LayerKey) => setLayer((cur) => (cur === l ? null : l))
  /* show month k of the dates; with no layer on, Rain comes on so there's something to watch */
  const showFrame = (k: number) => {
    setFrame(k)
    if (!layer) setLayer('rain')
  }
  const play = () => {
    if (playing) return setPlaying(false)
    showFrame(frame === null || frame >= last ? 0 : frame)
    setPlaying(true)
  }
  const openGuide = (crop: string, from: HTMLElement) => {
    guideFrom.current = from
    setPlaying(false)
    setGuide(crop)
    setGuideToken((n) => n + 1)
  }
  const openReport = (from: HTMLElement) => {
    reportFrom.current = from
    setDatesOpen(false)
    setPlaying(false)
    setReportOpen(true)
    setReportToken((n) => n + 1)
  }
  const locate = () => {
    if (locating) return
    if (!navigator.geolocation) return setHint({ msg: 'This browser can\'t share your location. Search a city or tap the map.', warn: true })
    setLocating(true)
    setHint({ msg: 'Finding you…', warn: false })
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocating(false)
      const { longitude: lon, latitude: lat } = pos.coords
      /* exactly 0, 0 (open sea off Africa) is what a browser reports when it has no real position */
      if (lon === 0 && lat === 0) return setHint({ msg: 'Couldn\'t find your location. Search a city or tap the map.', warn: true })
      choose({ name: 'Your location', sub: coords(lon, lat), lon, lat, w: SPOT_W }, false)
    }, (err) => {
      setLocating(false)
      setHint({ msg: err.code === 1 ? 'Location is blocked. Allow it in the browser, or search a city.' : 'Couldn\'t find your location. Search a city or tap the map.', warn: true })
    }, { timeout: LOC_TIMEOUT_MS, maximumAge: LOC_MAX_AGE_MS })
  }

  /* the hint shows only for a moment */
  useEffect(() => {
    if (!hint) return
    const t = setTimeout(() => setHint(null), HINT_MS)
    return () => clearTimeout(t)
  }, [hint])
  /* the time bar steps a month at a time while it plays */
  useEffect(() => {
    if (!playing || frame === null) return
    const t = setTimeout(() => {
      setFrame(frame + 1)
      if (!layer) setLayer('rain')
      if (frame + 1 >= last) setPlaying(false)
    }, STEP_MS)
    return () => clearTimeout(t)
  }, [playing, frame, last, layer])
  useEffect(() => {
    if (!guide) focusBack(guideFrom)
  }, [guide])
  useEffect(() => {
    if (!reportOpen) focusBack(reportFrom)
  }, [reportOpen])
  /* the dates box closes on a click outside it */
  useEffect(() => {
    if (!datesOpen) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Element && !e.target.closest('#dp') && !e.target.closest('#dbtn')) setDatesOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [datesOpen])
  /* Escape closes the top-most thing: the crop window, the dates box, the report, then the sidebar on phones */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (guide) return setGuide(null)
      if (e.target instanceof Element && e.target.id === 'q') return
      if (datesOpen) {
        setDatesOpen(false)
        datesButtonRef.current?.focus()
      } else if (reportOpen) setReportOpen(false)
      else if (sideOpen && isPhone()) setSideOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [guide, datesOpen, reportOpen, sideOpen])

  const behind = guide !== null /* the page under the crop window */
  return (
    <section data-name="Map" data-sb={sideOpen ? '' : undefined} data-rp={reportOpen ? '' : undefined}>
      <TopBar
        dates={dates} datesOpen={datesOpen} datesButtonRef={datesButtonRef} onToggleDates={() => setDatesOpen((o) => !o)}
        recent={recent} onGo={choose} onLocate={locate} inert={behind}
      />
      <DatesPanel dates={dates} open={datesOpen} inert={behind} onApply={applyDates} />
      <nav className="rl" aria-label="Sidebar" inert={behind}>
        {TABS.map(([t, Ic, label]) => {
          const lit = sideOpen && tab === t
          return (
            <button key={t} className="tabb" type="button" data-tab={t} data-tip={lit ? 'Collapse' : label} aria-label={label} aria-controls="sb" aria-pressed={lit} onClick={() => openSide(!sideOpen || tab !== t, t)}>
              <Ic className="i" />
            </button>
          )
        })}
      </nav>
      {sideOpen && (
        <Sidebar
          tab={tab} place={place} dates={dates} loading={sideLoading} layer={layer} filter={filter}
          onTile={toggleLayer} onFilter={setFilter} onOpenGuide={openGuide} onOpenReport={openReport} onClose={() => openSide(false)} inert={behind}
        />
      )}
      <MapStage place={place} is3d={is3d} onMap={setMap} inert={behind} />
      <div className="mapload" id="mapload" aria-hidden="true" data-done={mapLoading ? undefined : ''} />
      <MapControls
        layer={layer} onLayer={toggleLayer} locating={locating} onLocate={locate} hint={hint} inert={behind}
        map={map} is3d={is3d} onToggle3d={() => setIs3d((v) => !v)} layerView={layerView}
      >
        {last >= 1 && (
          <TimeBar dates={dates} w={w} frame={frame} playing={playing} strip={layerView?.strip ?? null} onPlay={play} onScrub={(k) => {
            showFrame(k)
            setPlaying(false)
          }} />
        )}
      </MapControls>
      {place && (
        <FullReport open={reportOpen} place={place} dates={dates} loading={reportLoading} onBack={() => setReportOpen(false)} onShowOnMap={() => setReportOpen(false)} onOpenGuide={openGuide} inert={behind} />
      )}
      {guide && <CropWindow key={guideToken} crop={guide} place={place} dates={dates} loading={guideLoading} onClose={() => setGuide(null)} />}
    </section>
  )
}
