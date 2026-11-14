import { Cloud, Sprout, type LucideIcon } from 'lucide-react'
import type { MapLibreMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CROPS } from '../crops'
import { CropWindow } from '../components/CropWindow'
import { FullReport } from '../components/FullReport'
import { MapControls, type Hint } from '../components/MapControls'
import { MapStage } from '../components/MapStage'
import { Sidebar } from '../components/Sidebar'
import { TimeBar } from '../components/TimeBar'
import { TopBar } from '../components/TopBar'
import { AHEAD_MONTHS, defaultDates, M0, spanOf, type Dates } from '../dates'
import { useClimateLayer } from '../hooks/useClimateLayer'
import { useLoading } from '../hooks/useLoading'
import { usePlaceName } from '../hooks/usePlaceName'
import { coords, MY_PLACE, SPOT_W, type Place } from '../places'
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
const MORE_MONTHS = 12
const TABS: [SideTab, LucideIcon, string][] = [['crops', Sprout, 'Crops'], ['weather', Cloud, 'Weather']]
const LAST_MONTH = M0 + AHEAD_MONTHS /* the furthest the forecast and NASA's usual are shown */

const isPhone = () => window.matchMedia(PHONE_QUERY).matches
const onPhoneChange = (cb: () => void) => {
  const mq = window.matchMedia(PHONE_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
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
  /* the dates everything is worked out for (today to the end of this season at first); the rain chart and the time bar can show more months on demand */
  const [dates, setDates] = useState<Dates>(defaultDates)
  const [layer, setLayer] = useState<LayerKey | null>(null)
  const [recent, setRecent] = useState<Place[]>([])
  const [tab, setTab] = useState<SideTab>('crops')
  const [sideOpen, setSideOpen] = useState(() => !isPhone()) /* on phones the map comes first */
  const phone = useSyncExternalStore(onPhoneChange, isPhone) /* follows the screen size */
  const [leaving, setLeaving] = useState(false) /* the panel slides out before it closes */
  const [more, setMore] = useState(0) /* extra months the rain chart and the time bar show, after the dates */
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
  const guideFrom = useRef<HTMLElement | null>(null)
  const reportFrom = useRef<HTMLElement | null>(null)
  /* the person's own location reads as its town ("Carmona, Cavite") once OpenStreetMap answers, in the report and the crop window too */
  const ownName = usePlaceName(place?.name === MY_PLACE ? place : null)
  const named = useMemo(() => (place && place.name === MY_PLACE && ownName ? { ...place, name: ownName } : place), [place, ownName])
  const w = spanOf(dates)
  const wv = { a: w.a, b: Math.min(w.b + more, LAST_MONTH) } /* the months the time bar and the rain chart show */
  const onMore = wv.b < LAST_MONTH ? () => setMore((n) => n + MORE_MONTHS) : undefined
  const last = wv.b - wv.a
  const layerView = useClimateLayer(map, layer, wv.a + (frame ?? 0), wv) /* the month on the time bar, or the first of the dates */
  const isPanelOpen = sideOpen && !leaving
  /* the layer chips and the time bar: on Weather only, not on Crops. They show with the panel; on phones the panel covers the
     map, so they stay on the map after it closes when Weather was the last tab open */
  const showMapTools = tab === 'weather' && (isPanelOpen || phone)
  /* the month the crops are rated for planting in: the time bar's month, else the first month of the dates */
  const pm = frame === null ? w.a : wv.a + frame
  /* the panel slides out: stop the time bar too, it hides with the panel */
  const closeSide = () => {
    setPlaying(false)
    setLeaving(true)
  }

  const openSide = (open: boolean, t?: SideTab) => {
    if (!open || t === 'crops') setPlaying(false) /* closing, or Crops, hides the time bar: stop it playing out of sight */
    if (t) setTab(t)
    setSideOpen(open)
    setLeaving(false)
    if (open) setSideToken((n) => n + 1)
  }
  /* a picked place: the map flies there and the panel stays as it is (closed stays closed), so the map is what you see.
     remember: false keeps a place out of the recent list (the person's own location: "Use my location" finds it fresh) */
  const choose = (p: Place, remember = true) => {
    setHint(null)
    setPlace(p)
    if (remember) setRecent((r) => [p, ...r.filter((x) => x.name !== p.name)].slice(0, RECENT_MAX))
    setReportToken((n) => n + 1)
  }
  /* new dates: the time bar starts over on them */
  const changeDates = (d: Dates) => {
    setDates(d)
    setFrame(null)
    setPlaying(false)
    setMore(0)
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
      choose({ name: MY_PLACE, sub: coords(lon, lat), lon, lat, w: SPOT_W }, false)
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
  /* Escape closes the top-most thing: the crop window, the report, then the sidebar on phones */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (guide) return setGuide(null)
      if (e.target instanceof Element && e.target.id === 'q') return
      if (reportOpen) setReportOpen(false)
      else if (sideOpen && isPhone()) closeSide()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [guide, reportOpen, sideOpen])

  const behind = guide !== null /* the page under the crop window */
  return (
    /* data-sb: the panel is (staying) open, so the menu button and the map tools glide left of it */
    <section data-name="Map" data-sb={sideOpen && !leaving ? '' : undefined} data-rp={reportOpen ? '' : undefined}>
      <TopBar recent={recent} onGo={choose} onLocate={locate} inert={behind} />
      {/* opens and closes the panel; it floats on the map, left of the panel while it's open */}
      {/* Crops and Weather: each opens the panel on its view; the one showing closes it */}
      <nav className="tabsf" aria-label="Panel" inert={behind}>
        {TABS.map(([t, Ic, label]) => {
          const lit = sideOpen && !leaving && tab === t
          return (
            <button key={t} className="mbtn" type="button" aria-controls="sb" aria-pressed={lit} aria-label={lit ? 'Close ' + label : label} onClick={() => (lit ? closeSide() : openSide(true, t))}>
              <Ic className="i" /><span className="tip" aria-hidden="true">{label}</span>
              {t === 'crops' && <span className="badge" aria-hidden="true">{CROPS.length}</span>}
            </button>
          )
        })}
      </nav>
      {sideOpen && (
        <Sidebar
          tab={tab} place={place} dates={dates} onDates={changeDates} pm={pm} wv={wv} onMore={onMore} loading={sideLoading}
          onOpenGuide={openGuide} onOpenReport={openReport} onClose={closeSide} inert={behind}
          leaving={leaving} onLeft={() => openSide(false)}
        />
      )}
      <MapStage place={place} is3d={is3d} onMap={setMap} inert={behind} />
      <div className="mapload" id="mapload" aria-hidden="true" data-done={mapLoading ? undefined : ''} />
      <MapControls
        layer={layer} onLayer={toggleLayer} locating={locating} onLocate={locate} hint={hint} inert={behind}
        map={map} is3d={is3d} onToggle3d={() => setIs3d((v) => !v)} layerView={layerView} showLayers={showMapTools}
      >
        {showMapTools && last >= 1 && (
          <TimeBar dates={dates} w={wv} frame={frame} playing={playing} strip={layerView?.strip ?? null} onPlay={play} onScrub={(k) => {
            showFrame(k)
            setPlaying(false)
          }} />
        )}
      </MapControls>
      {named && (
        <FullReport open={reportOpen} place={named} dates={dates} loading={reportLoading} onBack={() => setReportOpen(false)} onShowOnMap={() => setReportOpen(false)} onOpenGuide={openGuide} inert={behind} />
      )}
      {guide && <CropWindow key={guideToken} crop={guide} place={named} dates={dates} loading={guideLoading} onClose={() => setGuide(null)} />}
    </section>
  )
}
