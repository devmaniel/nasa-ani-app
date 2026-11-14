import { Calendar, Info, MapPin, Sprout, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { BAND, band, bestPlant, countOf, cropMonths, CROPS, cropWhy, harvestMonth, planText, readyIn, regionBands, regionsLine, type Band, type Crop, type CropWeather, type Fit } from '../crops'
import { spanOf, type Dates, type Span } from '../dates'
import { GD_TOPIC_ICON, GD_TOPICS, guideOf } from '../guides'
import { cropWeather, useWeather } from '../hooks/useWeather'
import { REGIONS, type Place } from '../places'
import type { IconType, Tone } from '../types'
import { Axis, CalendarKey, Chips, Gantt, LessSureTag, LoadingStatus, Sk, type Chip } from './Parts'

const CAL_MIN_MONTHS = 6
/* px below the top of the topics where a heading counts as being read */
const SPY_TOP = 40
type Sec = { t: string; ic: [IconType, Tone]; n?: number; body: ReactNode }

function SecIcon({ ic: [Ic, tone] }: { ic: Sec['ic'] }) {
  return <span className="ti" data-tone={tone}><Ic className="i" aria-hidden /></span>
}

/* "When to plant" for a place: its calendar from the dates' start to the harvest, then why and how long */
function PlanPlace({ r, w }: { r: Fit; w: Span }) {
  const a = w.a
  const b = Math.max(a + CAL_MIN_MONTHS - 1, harvestMonth(r))
  return (
    <>
      <Axis a={a} b={b} className="cax" />
      <Gantt r={r} w={w} a={a} b={b} />
      <CalendarKey />
      <p>{cropWhy(r)}</p>
      <p>{readyIn(r.c)}</p>
    </>
  )
}
/* "When to plant" for the whole country: the regions by how good a time it is */
function PlanCountry({ c, bands }: { c: Crop; bands: Band[] }) {
  return (
    <>
      {(['good', 'fair', 'poor'] as const).map((b) => {
        const names = REGIONS.filter((_, j) => bands[j] === b).map((p) => p.n).join(', ')
        return names ? <p key={b}><b>{BAND[b]}:</b> {names}</p> : null
      })}
      <p>{readyIn(c)}</p>
      <p>Pick a place to see when to plant and harvest there.</p>
    </>
  )
}

function contentFor(wx: CropWeather, c: Crop, place: Place | null, w: Span) {
  if (place) {
    const r = bestPlant(wx, place, c, w.a, w.b)
    const bd = band(r.score)
    return {
      when: <>{planText(r)}<LessSureTag m={r.pm} /></>,
      chips: [[MapPin, BAND[bd] + ' · ' + place.name]] satisfies Chip[],
      plan: <div className={'gm-plan ' + bd}><PlanPlace r={r} w={w} /></div>,
    }
  }
  const bands = regionBands(wx, c, w)
  return {
    when: <>{regionsLine(countOf(bands, 'good'), countOf(bands, 'fair'))}</>,
    chips: [[MapPin, 'Whole country']] satisfies Chip[],
    plan: <div className="gm-plan"><PlanCountry c={c} bands={bands} /></div>,
  }
}

type Props = { crop: string; place: Place | null; dates: Dates; loading: boolean; onClose: () => void }

/* the crop window: "When to plant", then the crop's growing guide when it has one; topics on the left */
export function CropWindow({ crop, place, dates, loading: waiting, onClose }: Props) {
  const gmRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const clickedRef = useRef(false)
  const c = CROPS.find((x) => x.n === crop)
  const w = spanOf(dates)
  /* the same NASA and forecast data as the map and the sidebar */
  const wx = useWeather(place ? [place] : REGIONS, cropMonths(w))
  const loading = waiting || wx.status === 'loading'

  useEffect(() => {
    gmRef.current?.focus()
  }, [])
  if (!c) return null

  const steps = guideOf(c.n)
  const content = contentFor(cropWeather(wx), c, place, w)
  const plan: Sec = { t: 'When to plant', ic: [Calendar, 'grow'], body: wx.status === 'error' ? <p role="alert">Couldn&rsquo;t load NASA&rsquo;s numbers. Check the connection, then open the crop again.</p> : content.plan }
  const topics = steps ? GD_TOPICS.map((t, j): Sec => ({ t, ic: GD_TOPIC_ICON[t], n: steps[j].length, body: <ol>{steps[j].map((x) => <li key={x}>{x}</li>)}</ol> })) : []
  const secs: Sec[] = [plan, ...topics]
  /* the topic being read is marked in the list: the last one whose heading has passed the reading line.
     The line sits near the top, and over the last screen of scrolling it slides to the bottom, so the short last topics get their turn */
  const spy = () => {
    const body = bodyRef.current
    if (!body || clickedRef.current) return
    const left = body.scrollHeight - body.clientHeight - body.scrollTop
    const line = body.getBoundingClientRect().top + SPY_TOP + (body.clientHeight - SPY_TOP) * Math.max(0, 1 - left / body.clientHeight)
    let on = 0
    body.querySelectorAll('.gm-sec').forEach((sec, j) => {
      if (sec.getBoundingClientRect().top <= line) on = j
    })
    setCurrent(on)
  }
  /* a clicked topic stays marked until the person scrolls themselves */
  const release = () => {
    clickedRef.current = false
  }
  const goTopic = (j: number) => {
    const body = bodyRef.current
    const sec = document.getElementById('gm-s-' + j)
    const h = document.getElementById('gm-h-' + j)
    if (!body || !sec || !h) return
    clickedRef.current = true
    setCurrent(j)
    body.scrollTop = sec.offsetTop - 8
    h.setAttribute('tabindex', '-1')
    h.focus({ preventScroll: true })
  }
  const none = <p className="gd-none"><Info className="i" />No growing guide for {c.n.toLowerCase()} yet.</p>

  return (
    <>
      <div className="gm-scrim" id="gm-scrim" onClick={onClose} />
      <div className="gm" id="gm" ref={gmRef} role="dialog" aria-modal="true" aria-labelledby="gm-t" tabIndex={-1} data-solo={steps ? undefined : ''}>
        <header className="gm-head">
          <span className="ic" data-tone="grow"><Sprout className="i" /></span>
          <div className="tx">
            <div className="tl"><h2 id="gm-t">{c.n} <small>{c.l}</small></h2><span className="gd-tag">Sample</span></div>
            <p className="gm-when num" id="gm-when">{content.when}</p>
            <p className="gd-meta" id="gm-meta"><Chips chips={content.chips} /></p>
          </div>
          <button className="x" type="button" id="gm-x" aria-label="Close" title="Close" onClick={onClose}><X className="i" /></button>
        </header>
        <div className="gm-main">
          <nav className="gm-nav" id="gm-nav" aria-label="Topics">
            {loading ? secs.map((s) => <Sk key={s.t} w="80%" h={28} />) : secs.map((s, j) => (
              <a key={s.t} href={'#gm-s-' + j} data-gm-to={j} aria-current={j === current ? 'true' : undefined} onClick={(e) => {
                e.preventDefault()
                goTopic(j)
              }}>
                <SecIcon ic={s.ic} />{s.t}
              </a>
            ))}
          </nav>
          <div className="gm-body" id="gm-body" ref={bodyRef} aria-busy={loading || undefined} onScroll={spy} onWheel={release} onTouchStart={release} onPointerDown={release} onKeyDown={release}>
            {loading ? (
              <>
                <LoadingStatus />
                {secs.slice(0, 3).map((s) => <div key={s.t} className="sk-sec"><Sk w="40%" h={18} /><Sk w="100%" h={12} /><Sk w="92%" h={12} /><Sk w="70%" h={12} /></div>)}
              </>
            ) : (
              <>
                {secs.map((s, j) => (
                  <section key={s.t} className="gm-sec" id={'gm-s-' + j} aria-labelledby={'gm-h-' + j}>
                    <h3 id={'gm-h-' + j}>
                      <SecIcon ic={s.ic} />{s.t}
                      {s.n ? <span className="tc num">{s.n + (s.n === 1 ? ' step' : ' steps')}</span> : null}
                    </h3>
                    {s.body}
                  </section>
                ))}
                {!steps && none}
              </>
            )}
          </div>
        </div>
        <p className="gm-foot"><Info className="i" />When to plant: NASA weather and FAO ECOCROP crop needs. Growing guides are sample content, not from an agricultural source.</p>
      </div>
    </>
  )
}
