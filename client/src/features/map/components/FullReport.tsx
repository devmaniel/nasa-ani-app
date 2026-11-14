import { Bean, Calendar, ChevronDown, Clock, Cloud, CloudSun, Info, LandPlot, MapPin, Mountain, Satellite, Shovel, Sprout } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { spanOf, TODAY, fmtY, type Dates } from '../dates'
import { useAir } from '../hooks/useAir'
import { useSpace } from '../hooks/useSpace'
import { useWeather } from '../hooks/useWeather'
import { coords, type Place } from '../places'
import { alertsFor, areaAround, movesFor, placeWeather, rainRangeAround, reportMonths } from '../report'
import type { IconType, Tone } from '../types'
import type { OpenGuide } from './CropsPanel'
import { AlertList, CropGroups, Figures, LatelyList, MoveList, NowRow, PlantingMonths, WorkTable } from './ReportCards'
import { ReportChart, ReportMonths } from './ReportChart'
import { ReportHead } from './ReportHead'
import { ReportMap } from './ReportMap'

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SECTIONS = [
  ['rp-s-now', 'Right now'], ['rp-s-ahead', 'Looking ahead'], ['rp-s-months', 'Month by month'], ['rp-s-moves', 'Best moves'],
  ['rp-s-crops', 'What to plant'], ['rp-s-work', 'Farm work'], ['rp-s-figs', 'In numbers'],
]

function Card({ id, tone, ic: Ic, title, sub, children }: { id: string; tone: Tone; ic: IconType; title: string; sub: ReactNode; children: ReactNode }) {
  const h = 'rp-h-' + id.replace('rp-s-', '')
  return (
    <section className="rp-card" id={id} aria-labelledby={h}>
      <div className="rp-h"><span className="ic" data-tone={tone}><Ic className="i" aria-hidden /></span><h2 id={h}>{title}</h2>{sub}</div>
      {children}
    </section>
  )
}

type Props = { open: boolean; place: Place; dates: Dates; loading: boolean; onBack: () => void; onShowOnMap: () => void; onOpenGuide: OpenGuide; inert: boolean }

/* the full report: the chosen place and the map's dates, as one long page over the map */
export function FullReport({ open, place, dates, loading: waiting, onBack, onShowOnMap, onOpenGuide, inert }: Props) {
  const rpRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [current, setCurrent] = useState<string | null>(null)
  const [numbersOpen, setNumbersOpen] = useState(false)
  const w = spanOf(dates)
  /* the same NASA and forecast data as the map and the sidebar: at the place, and across the small map's area */
  const wx = useWeather(open ? [place, ...areaAround(place)] : [], reportMonths(w), open ? [place] : [])
  /* NASA POWER's usual humidity and sunlight at the place, for the "Looking ahead" warnings */
  const air = useAir(open ? place : null)
  /* the last days and the exact spot, from space (NASA IMERG, SMAP, VIIRS, GLDAS, SRTM, GEDI; ERA5) */
  const space = useSpace(open ? place : null)
  const loading = waiting || wx.status === 'loading'
  /* worked out once the data is in, not again on every redraw (the section links redraw it while scrolling) */
  const data = useMemo(() => {
    const span = spanOf(dates)
    const pw = wx.status === 'ready' ? placeWeather(wx, place, span) : null
    return pw && { pw, alerts: alertsFor(pw, span, air), moves: movesFor(pw, span), range: rainRangeAround(wx, place, span) }
  }, [wx, place, dates, air])

  /* opening: back to the top, focus on the place name */
  useEffect(() => {
    if (!open) return
    if (rpRef.current) rpRef.current.scrollTop = 0
    headingRef.current?.focus({ preventScroll: true })
  }, [open])
  /* the section links follow the scroll */
  useEffect(() => {
    const root = rpRef.current
    if (!open || loading || !root || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) setCurrent(e.target.id)
      })
    }, { root, rootMargin: '-35% 0px -60% 0px' })
    SECTIONS.forEach(([id]) => {
      const t = document.getElementById(id)
      if (t) io.observe(t)
    })
    return () => io.disconnect()
  }, [open, loading])

  if (!open) return <div className="rp" id="rp" ref={rpRef} role="region" aria-labelledby="rp-place" hidden />
  const n = w.b - w.a + 1
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' })
  return (
    <div className="rp" id="rp" ref={rpRef} inert={inert} role="region" aria-labelledby="rp-place" data-loading={loading ? '' : undefined} aria-busy={loading || undefined}>
      <ReportHead place={place} dates={dates} w={w} loading={loading} land={loading ? null : wx.land(place)} ground={loading ? null : space.ground} moves={data?.moves ?? []} alerts={data?.alerts ?? []} headingRef={headingRef} onBack={onBack} onGoMoves={() => goTo('rp-s-moves')} />
      <nav className="rp-nav" aria-label="On this page">
        <div className="rp-wrap">
          <ul>
            {SECTIONS.map(([id, label]) => (
              <li key={id}><button type="button" data-rp-to={id} aria-current={current === null ? undefined : current === id} onClick={() => goTo(id)}>{label}</button></li>
            ))}
          </ul>
        </div>
      </nav>
      <div className="rp-wrap rp-skel" aria-hidden="true"><i className="sk" style={{ height: 150 }} /><i className="sk" style={{ height: 160 }} /><i className="sk" style={{ height: 360 }} /></div>
      <div className="rp-wrap rp-layout">
        {!loading && !data && (
          <p className="rp-notice" role="alert"><Info className="i" /><span>Couldn&rsquo;t load NASA&rsquo;s numbers. Check the connection, then go back to the map and open the report again.</span></p>
        )}
        {!loading && data && (
          <>
            <div className="rp-main">
              <Card id="rp-s-now" tone="water" ic={Cloud} title="Right now" sub={<p className="num" id="rp-now-l">Today, {fmtY(TODAY)}</p>}>
                <NowRow pw={data.pw} />
                <LatelyList lately={space.lately} />
              </Card>
              <Card id="rp-s-ahead" tone="pest" ic={Clock} title="Looking ahead" sub={<p>What stands out in your dates.</p>}>
                <AlertList alerts={data.alerts} />
              </Card>
              <Card id="rp-s-months" tone="feed" ic={Calendar} title="Month by month" sub={<p>Rain and heat, against a usual year.</p>}>
                <ReportChart pw={data.pw} w={w} />
                                <details className="rp-rest" id="rp-nums" open={numbersOpen} onToggle={(e) => setNumbersOpen(e.currentTarget.open)}>
                  <summary><span id="rp-nums-t">Show the numbers · {n}{n === 1 ? ' month' : ' months'}</span><ChevronDown className="i" /></summary>
                  <div id="rp-months"><ReportMonths pw={data.pw} w={w} /></div>
                </details>
              </Card>
              <Card id="rp-s-moves" tone="grow" ic={Sprout} title="Best moves" sub={<p>Best first. Options to weigh, not orders.</p>}>
                <MoveList moves={data.moves} onOpen={onOpenGuide} />
              </Card>
              <Card id="rp-s-crops" tone="harvest" ic={Bean} title="What to plant" sub={<p>The best month to plant each crop inside your dates.</p>}>
                <CropGroups pw={data.pw} w={w} onOpen={onOpenGuide} />
                <p className="cleg" aria-hidden="true"><span><i className="win" />Your dates</span><span><i className="pl" />Plant</span><span><i className="gr" />Growing</span><span><i className="hv" />Harvest</span></p>
              </Card>
              <Card id="rp-s-work" tone="soil" ic={Shovel} title="Farm work by month" sub={<p>Good months for each job.</p>}>
                <PlantingMonths pw={data.pw} w={w} />
                <div className="rp-tw"><WorkTable pw={data.pw} w={w} /></div>
                <p className="rp-wkey" aria-hidden="true"><span><i className="rp-dot good" />Good</span><span><i className="rp-dot ok" />Possible</span><span><i className="rp-dot no" />Not a good month</span></p>
              </Card>
              <Card id="rp-s-figs" tone="none" ic={Info} title="Your dates in numbers" sub={<p>Against the same months in a usual year.</p>}>
                <Figures pw={data.pw} w={w} />
              </Card>
            </div>
            <aside className="rp-rail" aria-label="The place on the map, and about this report">
              <section className="rp-card rp-mapc" aria-label="On the map">
                <ReportMap place={place} />
                <div className="foot">
                  <p className="rp-mleg num" id="rp-mleg"><span>Rain a month, your dates</span><span>{data.range ? Math.round(data.range[0]) : '–'}</span><i className="lg" /><span>{data.range ? Math.round(data.range[1]) : '–'} mm</span></p>
                  <p className="ll num" id="rp-ll">{coords(place.lon, place.lat)}</p>
                  <button className="rp-onmap" id="rp-onmap" type="button" onClick={onShowOnMap}><MapPin className="i" />Show on the map</button>
                </div>
              </section>
              <section className="rp-card rp-about" aria-labelledby="rp-h-about">
                <h2 id="rp-h-about">About this report</h2>
                <ul>
                  <li><Info className="i" /><span>Rain, heat and soil: NASA POWER (measured and usual), with the Open-Meteo seasonal forecast.</span></li>
                  <li><Sprout className="i" /><span>Crop needs: FAO ECOCROP. Farm work: simple rules of thumb from the rain.</span></li>
                  <li><Mountain className="i" /><span>The land, and how well it suits each crop: FAO GAEZ (1981–2010, rain-fed, low inputs), averaged over about 25 km around the place. It counts for part of a crop&rsquo;s rating; the weather in your dates for the rest.</span></li>
                  <li><CloudSun className="i" /><span>Humidity and sunlight: NASA POWER, the usual for each month. Humid and less-sun warnings are rules of thumb.</span></li>
                  <li><Satellite className="i" /><span>Lately: rain over the last 7 days from NASA GPM IMERG; soil water now from NASA SMAP; plant greenness from NASA VIIRS; the ground&rsquo;s water from NASA GLDAS; the last 30 days from ERA5, each against the same days or month in the 10 years before. NASA&rsquo;s numbers are read off its map pictures, so they&rsquo;re rounded.</span></li>
                  <li><LandPlot className="i" /><span>The exact spot: slope and height from NASA SRTM; tree height around it from NASA GEDI (2019–2023). The map&rsquo;s Fields photo: Landsat and Sentinel-2, as NASA HLS.</span></li>
                  <li><Calendar className="i" /><span>One number per month for rain and heat.</span></li>
                  <li><Clock className="i" /><span id="rp-sure">The forecast covers about 6 months. Later months show NASA&rsquo;s usual for that month.</span></li>
                  <li><MapPin className="i" /><span>Place names: PSGC 3Q 2026.</span></li>
                </ul>
              </section>
            </aside>
          </>
        )}
      </div>
      <p className="rp-wrap rp-src">NASA POWER · NASA IMERG, SMAP, VIIRS, GLDAS, SRTM, GEDI · ERA5 · Open-Meteo seasonal forecast · FAO ECOCROP · FAO GAEZ · Change the place or the dates in the top bar.</p>
    </div>
  )
}
