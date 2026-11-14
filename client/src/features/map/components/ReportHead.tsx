import { Calendar, ChevronDown, ChevronRight, Info, LandPlot, MapPin, Mountain } from 'lucide-react'
import type { RefObject } from 'react'
import { BAND, band } from '../crops'
import {
  fmtY, isDefaultDates, lengthWord, M0, MONTH_FULL, seasonKey, seasonsIn, SEASON_NAME, yearOf, type Dates, type Span,
} from '../dates'
import { landLine, type Land } from '../land'
import { groundLine, treesLine, type Ground } from '../space'
import type { Place } from '../places'
import { monthLabel, monthsText, type Alert, type Move } from '../report'
import { Sk } from './Parts'

const LABEL_MIN = 2

/* a searched city, province or region gets its kind and where it is; a picked spot already reads as an address */
function addressOf(p: Place) {
  if (!/^(Region|Province|City)$/.test(p.sub)) return p.sub
  return p.sub + ' · Philippines'
}

/* the season bar: one cell per month, the season names over their months, the years under January */
function Ribbon({ w }: { w: Span }) {
  const n = w.b - w.a + 1
  const months: number[] = []
  for (let m = w.a; m <= w.b; m++) months.push(m)
  const segs = seasonsIn(w.a, w.b)
  return (
    <>
      <div className="row sl" style={{ '--n': n }} aria-hidden="true">
        {segs.map((sg) => {
          const k = sg.b - sg.a + 1
          return (
            <span key={sg.a} style={{ gridColumn: 'span ' + k }} title={SEASON_NAME[sg.k] + ', ' + monthsText(sg.a, sg.b)}>
              {k >= LABEL_MIN || n === 1 ? SEASON_NAME[sg.k].replace(' season', '') : ''}
            </span>
          )
        })}
      </div>
      <div className="row ms" style={{ '--n': n }} aria-hidden="true">
        {months.map((m) => <span key={m} className={seasonKey(m) + (m === M0 ? ' now' : '')}>{monthLabel(m, n)}</span>)}
      </div>
      <div className="row ys num" style={{ '--n': n }} aria-hidden="true">
        {months.map((m) => <span key={m}>{m === w.a ? (m === M0 ? 'Today' : String(yearOf(m))) : m % 12 === 0 ? String(yearOf(m)) : ''}</span>)}
      </div>
      <p className="sr">Seasons in your dates: {segs.map((sg) => SEASON_NAME[sg.k] + ', ' + monthsText(sg.a, sg.b)).join('; ')}.</p>
    </>
  )
}

function Answer({ moves, alerts, onGoMoves }: { moves: Move[]; alerts: Alert[]; onGoMoves: () => void }) {
  const m = moves[0]
  const a = alerts[0]
  return (
    <>
      <div className="best">
        <p className="kick">The short answer</p>
        <h2>{m.t}</h2>
        <p className="pl num">{m.r && <span className={'fit ' + band(m.r.score)}>{BAND[band(m.r.score)]}</span>}{m.d}</p>
      </div>
      <div className="wo">
        <span className="ic" data-tone={a.tone}><a.ic className="i" aria-hidden /></span>
        <p className="num"><b>{a.t}{a.when ? ' · ' + a.when : ''}</b>{a.d}</p>
      </div>
      <button className="rp-go" type="button" data-rp-to="rp-s-moves" onClick={onGoMoves}>See all best moves<ChevronDown className="i" /></button>
    </>
  )
}

type Props = {
  place: Place
  dates: Dates
  w: Span
  loading: boolean
  land: Land | null
  /* the exact spot, from NASA SRTM and GEDI; null while it loads */
  ground: Ground | null
  moves: Move[]
  alerts: Alert[]
  headingRef: RefObject<HTMLHeadingElement | null>
  onBack: () => void
  onGoMoves: () => void
}

/* the head: the way back, the place, its address and land, the dates and the season bar; the short answer under it */
export function ReportHead({ place, dates, w, loading, land, ground, moves, alerts, headingRef, onBack, onGoMoves }: Props) {
  const one = w.a === w.b
  const landWords = land ? landLine(land) : ''
  const address = addressOf(place) /* empty when Google has no second line for the place (a province like "Nueva Ecija") */
  return (
    <div className="rp-wrap">
      <div className="rp-head">
        <div className="rp-id">
          <p className="rp-crumb">
            <button className="rp-back" id="rp-back" type="button" onClick={onBack}><ChevronRight className="i" />Map</button>
            <span className="sep" aria-hidden="true">/</span><span>Full report</span>
          </p>
          <h1 id="rp-place" tabIndex={-1} ref={headingRef}>{place.name}</h1>
          {address && <p className="rp-addr" id="rp-addr"><MapPin className="i" /><span>{address}</span></p>}
          {landWords && <p className="rp-addr" id="rp-land"><Mountain className="i" /><span>{landWords} · FAO GAEZ, about 25 km around</span></p>}
          {ground && (
            <p className="rp-addr" id="rp-spot">
              <LandPlot className="i" /><span>{groundLine(ground)} · NASA SRTM{treesLine(ground) ? '. ' + treesLine(ground) + ' · NASA GEDI' : ''}</span>
            </p>
          )}
          <p className="rp-when" id="rp-when">
            <Calendar className="i" />
            <b>{isDefaultDates(dates) ? 'Rest of this season' : lengthWord(dates)}</b>
            <span className="num">{fmtY(dates.from)} – {fmtY(dates.to)}</span>
          </p>
          <div className="rp-rib" id="rp-ribbon"><Ribbon w={w} /></div>
        </div>
      </div>
      <div className="rp-answer" id="rp-answer" aria-live="polite">
        {loading ? (
          <>
            <div className="best"><Sk w="30%" h={12} /><Sk w="70%" h={22} /></div>
            <div><Sk w="80%" h={14} /><Sk w="60%" h={12} /></div>
            <Sk w="150px" h={40} />
          </>
        ) : moves.length > 0 && alerts.length > 0 && <Answer moves={moves} alerts={alerts} onGoMoves={onGoMoves} />}
      </div>
      {one && (
        <p className="rp-notice" id="rp-notice">
          <Info className="i" />
          <span>Your dates are inside {MONTH_FULL[w.a % 12]} {yearOf(w.a)}, so this report shows {MONTH_FULL[w.a % 12]}. Rain and heat are one number per month.</span>
        </p>
      )}
    </div>
  )
}
