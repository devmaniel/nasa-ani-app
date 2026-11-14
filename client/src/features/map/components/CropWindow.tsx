import { BookOpen, Calendar, ChevronLeft, ChevronRight, Info, MapPin, Sprout, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { BAND, band, bestPlant, countOf, cropMonths, CROPS, readyIn, regionBands, regionsLine, type Band, type Crop, type CropWeather } from '../crops'
import { spanOf, type Dates, type Span } from '../dates'
import { GD_TOPIC_ICON, GD_TOPICS, guideOf } from '../guides'
import { useSpace } from '../hooks/useSpace'
import { cropWeather, useWeather } from '../hooks/useWeather'
import { SLOPE_FROM } from '../land'
import { REGIONS, type Place } from '../places'
import type { IconType, Tone } from '../types'
import { Chips, LoadingStatus, Sk, type Chip } from './Parts'
import { LearnMore, PlanPlace } from './WhenToPlant'

type Sec = { t: string; ic: [IconType, Tone]; n?: number; body: ReactNode }

function SecIcon({ ic: [Ic, tone] }: { ic: Sec['ic'] }) {
  return <span className="ti" data-tone={tone}><Ic className="i" aria-hidden /></span>
}

/* "When to plant" for the whole country: how many regions suit it, then the regions by how good a time it is */
function PlanCountry({ c, bands }: { c: Crop; bands: Band[] }) {
  return (
    <>
      <div className="wtp">
        <p className="wtp-k">Across the country</p>
        <p className="wtp-h">{regionsLine(countOf(bands, 'good'), countOf(bands, 'fair'))}</p>
        <p className="wtp-why">{readyIn(c)} Pick a place to see the best month to plant there.</p>
      </div>
      <LearnMore>
        {(['good', 'fair', 'poor'] as const).map((b) => {
          const names = REGIONS.filter((_, j) => bands[j] === b).map((p) => p.n).join(', ')
          return names ? <p key={b}><b>{BAND[b]}:</b> {names}</p> : null
        })}
      </LearnMore>
    </>
  )
}

/* slope: the ground's slope at the place (%), null without one */
function contentFor(wx: CropWeather, c: Crop, place: Place | null, w: Span, slope: number | null) {
  if (place) {
    const r = bestPlant(wx, place, c, w.a, w.b)
    const bd = band(r.score)
    return {
      chips: [[MapPin, BAND[bd] + ' · ' + place.name]] satisfies Chip[],
      plan: <div className={'gm-plan ' + bd}><PlanPlace wx={wx} place={place} r={r} w={w} slope={slope} /></div>,
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
const GUIDE_TAB = 1
/* px below the top of the guide where a topic counts as being read */
const SPY_TOP = 48
const TOPIC_GAP = 8

function scrollToTopic(body: HTMLElement | null, j: number) {
  const el = document.getElementById('gm-t-' + j)
  if (body && el) body.scrollTop = el.offsetTop - TOPIC_GAP
}

/* the cultivation guide: every topic on one page with its numbered steps */
function GuideTopics({ topics }: { topics: Sec[] }) {
  return (
    <div className="gm-guide">
      {topics.map((s, j) => (
        <div key={s.t} className="gm-topic" id={'gm-t-' + j}>
          <h4><SecIcon ic={s.ic} />{s.t}{s.n ? <span className="tc num">{s.n + (s.n === 1 ? ' step' : ' steps')}</span> : null}</h4>
          {s.body}
        </div>
      ))}
    </div>
  )
}

/* the crop window, two tabs on the left: "When to plant", then the cultivation guide (all its topics on one scrolling page,
   listed under the tab so a topic can be jumped to) */
export function CropWindow({ crop, place, dates, loading: waiting, onClose }: Props) {
  const gmRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const jumpRef = useRef<number | null>(null) /* a topic to scroll to once the guide tab is showing */
  const [tab, setTab] = useState(0)
  const [topic, setTopic] = useState(0)
  const c = CROPS.find((x) => x.n === crop)
  const w = spanOf(dates)
  /* the same NASA and forecast data as the map and the sidebar */
  const wx = useWeather(place ? [place] : REGIONS, cropMonths(w))
  const { ground } = useSpace(place)
  const loading = waiting || wx.status === 'loading'

  useEffect(() => {
    gmRef.current?.focus()
  }, [])
  /* a topic picked from another tab: scroll to it once the guide has rendered */
  useEffect(() => {
    const j = jumpRef.current
    if (j === null) return
    jumpRef.current = null
    scrollToTopic(bodyRef.current, j)
  })
  if (!c) return null

  const steps = guideOf(c.n)
  /* the slope: NASA SRTM's at the exact spot, else the low end of FAO GAEZ's class around the place */
  const cls = place ? wx.land(place)?.slope ?? null : null
  const slope = ground ? ground.slope : cls !== null && Number.isFinite(SLOPE_FROM[cls]) ? SLOPE_FROM[cls] : null
  const content = contentFor(cropWeather(wx), c, place, w, slope)
  const plan: Sec = { t: 'When to plant', ic: [Calendar, 'grow'], body: wx.status === 'error' ? <p role="alert">Couldn&rsquo;t load NASA&rsquo;s numbers. Check the connection, then open the crop again.</p> : content.plan }
  const topics = steps ? GD_TOPICS.map((t, j): Sec => ({ t, ic: GD_TOPIC_ICON[t], n: steps[j].length, body: <ol>{steps[j].map((x) => <li key={x}>{x}</li>)}</ol> })) : []
  const guide: Sec = { t: 'Cultivation guide', ic: [BookOpen, 'grow'], n: topics.length, body: <GuideTopics topics={topics} /> }
  const tabs: Sec[] = steps ? [plan, guide] : [plan]
  const on = Math.min(tab, tabs.length - 1)
  const sec = tabs[on]
  const goTab = (j: number, focus = false) => {
    setTab(j)
    setTopic(0)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    if (focus) document.getElementById('gm-tab-' + j)?.focus()
  }
  const goTopic = (j: number) => {
    setTopic(j)
    if (on === GUIDE_TAB) return scrollToTopic(bodyRef.current, j)
    jumpRef.current = j
    setTab(GUIDE_TAB)
  }
  /* on the guide, the topic being read is marked: the last one whose top has passed near the top, or the last one at the very bottom */
  const spy = () => {
    const body = bodyRef.current
    if (!body || on !== GUIDE_TAB) return
    const top = body.getBoundingClientRect().top + SPY_TOP
    const atEnd = body.scrollHeight - body.clientHeight - body.scrollTop < 2
    let now = 0
    body.querySelectorAll('.gm-topic').forEach((el, j) => {
      if (atEnd || el.getBoundingClientRect().top <= top) now = j
    })
    setTopic(now)
  }
  /* arrow keys move between the tabs, Home and End jump to the first and last */
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const to = { ArrowDown: on + 1, ArrowRight: on + 1, ArrowUp: on - 1, ArrowLeft: on - 1, Home: 0, End: tabs.length - 1 }[e.key]
    if (to === undefined) return
    e.preventDefault()
    goTab((to + tabs.length) % tabs.length, true)
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
            {content.when && <p className="gm-when num" id="gm-when">{content.when}</p>}
            <p className="gd-meta" id="gm-meta"><Chips chips={content.chips} /></p>
          </div>
          <button className="x" type="button" id="gm-x" aria-label="Close" title="Close" onClick={onClose}><X className="i" /></button>
        </header>
        <div className="gm-main">
          <div className="gm-nav" id="gm-nav">
            {loading ? [...tabs, ...topics].map((s) => <Sk key={s.t} w="80%" h={28} />) : (
              <>
                <div className="gm-tabs" role="tablist" aria-label="Crop window" aria-orientation="vertical" onKeyDown={onTabKey}>
                  {tabs.map((s, j) => (
                    <a
                      key={s.t} id={'gm-tab-' + j} role="tab" tabIndex={j === on ? 0 : -1} aria-selected={j === on} aria-controls="gm-panel"
                      aria-current={j === on ? 'true' : undefined} onClick={() => goTab(j)}
                    >
                      <SecIcon ic={s.ic} />{s.t}
                    </a>
                  ))}
                </div>
                {topics.length > 0 && (
                  <nav className="gm-sub" aria-label="Guide topics">
                    {topics.map((s, j) => (
                      <a key={s.t} href={'#gm-t-' + j} aria-current={on === GUIDE_TAB && j === topic ? 'true' : undefined} onClick={(e) => {
                        e.preventDefault()
                        goTopic(j)
                      }}>
                        <SecIcon ic={s.ic} />{s.t}
                      </a>
                    ))}
                  </nav>
                )}
              </>
            )}
          </div>
          <div className="gm-body" id="gm-body" ref={bodyRef} aria-busy={loading || undefined} onScroll={spy}>
            {loading ? (
              <>
                <LoadingStatus />
                {tabs.map((s) => <div key={s.t} className="sk-sec"><Sk w="40%" h={18} /><Sk w="100%" h={12} /><Sk w="92%" h={12} /><Sk w="70%" h={12} /></div>)}
              </>
            ) : (
              <>
                <section className="gm-sec" id="gm-panel" role="tabpanel" aria-labelledby={'gm-tab-' + on}>
                  <h3>
                    <SecIcon ic={sec.ic} />{sec.t}
                    {sec.n ? <span className="tc num">{sec.n + ' topics'}</span> : null}
                  </h3>
                  {sec.body}
                </section>
                {!steps && none}
                {tabs.length > 1 && (
                  <div className="gm-pager">
                    {on > 0 && <button className="gm-pg" type="button" onClick={() => goTab(on - 1)}><ChevronLeft className="i" aria-hidden />{tabs[on - 1].t}</button>}
                    {on < tabs.length - 1 && <button className="gm-pg next" type="button" onClick={() => goTab(on + 1)}>Next: {tabs[on + 1].t}<ChevronRight className="i" aria-hidden /></button>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <p className="gm-foot"><Info className="i" />When to plant: NASA weather, FAO ECOCROP crop needs, FAO GAEZ land suitability and the NASA SRTM slope. Growing guides are sample content, not from an agricultural source.</p>
      </div>
    </>
  )
}
