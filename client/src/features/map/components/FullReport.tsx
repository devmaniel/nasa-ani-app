import { Bean, Calendar, ChevronDown, Clock, Cloud, Info, MapPin, Shovel, Sprout } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LESS_SURE_AFTER, M0, mName, spanOf, TODAY, fmtY, type Dates } from '../dates'
import { coords, type Place } from '../places'
import { alertsFor, movesFor, rainRangeAround } from '../report'
import type { IconType, Tone } from '../types'
import type { OpenGuide } from './CropsPanel'
import { AlertList, CropGroups, Figures, MoveList, NowRow, PlantingMonths, WorkTable } from './ReportCards'
import { ReportChart, ReportMonths } from './ReportChart'
import { ReportHead } from './ReportHead'

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
export function FullReport({ open, place, dates, loading, onBack, onShowOnMap, onOpenGuide, inert }: Props) {
  const rpRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [current, setCurrent] = useState<string | null>(null)
  const [numbersOpen, setNumbersOpen] = useState(false)

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
  const w = spanOf(dates)
  const n = w.b - w.a + 1
  const alerts = alertsFor(place, w)
  const moves = movesFor(place, w)
  const [lo, hi] = rainRangeAround(place, w)
  const goTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' })
  return (
    <div className="rp" id="rp" ref={rpRef} inert={inert} role="region" aria-labelledby="rp-place" data-loading={loading ? '' : undefined} aria-busy={loading || undefined}>
      <ReportHead place={place} dates={dates} w={w} loading={loading} moves={moves} alerts={alerts} headingRef={headingRef} onBack={onBack} onGoMoves={() => goTo('rp-s-moves')} />
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
        {!loading && (
          <>
            <div className="rp-main">
              <Card id="rp-s-now" tone="water" ic={Cloud} title="Right now" sub={<p className="num" id="rp-now-l">Today, {fmtY(TODAY)}</p>}>
                <NowRow p={place} />
              </Card>
              <Card id="rp-s-ahead" tone="pest" ic={Clock} title="Looking ahead" sub={<p>What stands out in your dates.</p>}>
                <AlertList alerts={alerts} />
              </Card>
              <Card id="rp-s-months" tone="feed" ic={Calendar} title="Month by month" sub={<p>Rain and heat, against a usual year.</p>}>
                <ReportChart p={place} w={w} />
                                <details className="rp-rest" id="rp-nums" open={numbersOpen} onToggle={(e) => setNumbersOpen(e.currentTarget.open)}>
                  <summary><span id="rp-nums-t">Show the numbers · {n}{n === 1 ? ' month' : ' months'}</span><ChevronDown className="i" /></summary>
                  <div id="rp-months"><ReportMonths p={place} w={w} /></div>
                </details>
              </Card>
              <Card id="rp-s-moves" tone="grow" ic={Sprout} title="Best moves" sub={<p>Best first. Options to weigh, not orders.</p>}>
                <MoveList moves={moves} onOpen={onOpenGuide} />
              </Card>
              <Card id="rp-s-crops" tone="harvest" ic={Bean} title="What to plant" sub={<p>The best month to plant each crop inside your dates.</p>}>
                <CropGroups p={place} w={w} onOpen={onOpenGuide} />
                <p className="cleg" aria-hidden="true"><span><i className="win" />Your dates</span><span><i className="pl" />Plant</span><span><i className="gr" />Growing</span><span><i className="hv" />Harvest</span></p>
              </Card>
              <Card id="rp-s-work" tone="soil" ic={Shovel} title="Farm work by month" sub={<p>Good months for each job.</p>}>
                <PlantingMonths p={place} w={w} />
                <div className="rp-tw"><WorkTable p={place} w={w} /></div>
                <p className="rp-wkey" aria-hidden="true"><span><i className="rp-dot good" />Good</span><span><i className="rp-dot ok" />Possible</span><span><i className="rp-dot no" />Not a good month</span></p>
              </Card>
              <Card id="rp-s-figs" tone="none" ic={Info} title="Your dates in numbers" sub={<p>Against the same months in a usual year.</p>}>
                <Figures p={place} w={w} />
              </Card>
            </div>
            <aside className="rp-rail" aria-label="The place on the map, and about this report">
              <section className="rp-card rp-mapc" aria-label="On the map">
                {/* the small map drawing is deferred with the map; its box stays */}
                <svg className="rp-mp" id="rp-mp" viewBox="0 0 300 200" role="img" aria-label={'Map around ' + place.name} />
                <div className="foot">
                  <p className="rp-mleg num" id="rp-mleg"><span>Rain a month, your dates</span><span>{Math.round(lo)}</span><i className="lg" /><span>{Math.round(hi)} mm</span></p>
                  <p className="ll num" id="rp-ll">{coords(place.lon, place.lat)}</p>
                  <button className="rp-onmap" id="rp-onmap" type="button" onClick={onShowOnMap}><MapPin className="i" />Show on the map</button>
                </div>
              </section>
              <section className="rp-card rp-about" aria-labelledby="rp-h-about">
                <h2 id="rp-h-about">About this report</h2>
                <ul>
                  <li><Info className="i" /><span>Sample data, not a real forecast.</span></li>
                  <li><Calendar className="i" /><span>One number per month for rain and heat.</span></li>
                  <li><Clock className="i" /><span id="rp-sure">The first {LESS_SURE_AFTER} months are the forecast. After {mName(M0 + LESS_SURE_AFTER)}, an outlook: less sure.</span></li>
                  <li><MapPin className="i" /><span>Place names: PSGC 3Q 2026.</span></li>
                </ul>
              </section>
            </aside>
          </>
        )}
      </div>
      <p className="rp-wrap rp-src">Sample data, not a real forecast · Change the place or the dates in the top bar.</p>
    </div>
  )
}
