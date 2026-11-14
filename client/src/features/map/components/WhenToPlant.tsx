import { CalendarCheck, ChevronDown, CloudRain, Mountain, Thermometer } from 'lucide-react'
import type { ReactNode } from 'react'
import { BAND, band, harvestMonth, type CropWeather, type Fit } from '../crops'
import { MONTH_FULL, yearOf, type Span } from '../dates'
import { growingMonths, type Month } from '../growing'
import type { Place } from '../places'
import { briefFor, type Check, type CheckKey } from '../plantBrief'
import type { IconType } from '../types'
import { Axis, CalendarKey, Gantt } from './Parts'
import { PlantDetails } from './PlantDetails'

const CAL_MIN_MONTHS = 6

const monthFull = (m: number) => MONTH_FULL[m % 12] + ' ' + yearOf(m)

const CHECK_ICON: Record<CheckKey, IconType> = { heat: Thermometer, rain: CloudRain, land: Mountain, backup: CalendarCheck }

/* one check: an icon tinted by how it went, the label, the verdict, and a line on why */
function CheckRow({ x }: { x: Check }) {
  const Ic = CHECK_ICON[x.k]
  return (
    <li className="wtp-check" data-s={x.status}>
      <span className="wtp-ci"><Ic className="i" aria-hidden /></span>
      <span className="wtp-ct">
        <span className="wtp-cl">{x.label}</span>
        <b>{x.verdict}</b>
        <span className="wtp-cd">{x.detail}</span>
      </span>
    </li>
  )
}

/* the overview: the calendar first, then the date to plant and the verdict, one lead sentence, then the checks */
function Overview({ wx, place, r, w, months }: { wx: CropWeather; place: Place; r: Fit; w: Span; months: Month[] }) {
  const bd = band(r.score)
  const a = w.a
  const b = Math.max(a + CAL_MIN_MONTHS - 1, harvestMonth(r))
  const brief = briefFor(wx, place, r, w, months)
  const name = r.c.n.toLowerCase()
  return (
    <div className="wtp">
      <div className="wtp-cal">
        <Axis a={a} b={b} className="cax" />
        <Gantt r={r} w={w} a={a} b={b} />
        <CalendarKey />
      </div>
      <div className="wtp-top">
        <div>
          <p className="wtp-h">{bd === 'poor' ? 'Least risky for ' + name + ': ' : 'Plant ' + name + ' in '}<b className="num">{monthFull(r.pm)}</b></p>
          <p className="wtp-sub num">Harvest around {monthFull(harvestMonth(r))} · about {r.c.months} {r.c.months === 1 ? 'month' : 'months'} in the ground</p>
        </div>
        <span className="wtp-badge">{BAND[bd]}</span>
      </div>
      <p className="wtp-lead">{brief.lead}</p>
      <ul className="wtp-checks">{brief.checks.map((x) => <CheckRow key={x.k} x={x} />)}</ul>
      <p className="wtp-src">Weather from NASA, over the growing months. Land from FAO.</p>
    </div>
  )
}

/* "More details": the fuller read, folded under the overview */
export function LearnMore({ children }: { children: ReactNode }) {
  return (
    <details className="wtp-more">
      <summary>More details<ChevronDown className="i" aria-hidden /></summary>
      <div className="wtp-body">{children}</div>
    </details>
  )
}

/* "When to plant" for a place: the calendar and a short read first, the deep read under "More details" */
export function PlanPlace({ wx, place, r, w, slope }: { wx: CropWeather; place: Place; r: Fit; w: Span; slope: number | null }) {
  const months = growingMonths(wx, place, r)
  return (
    <>
      <Overview wx={wx} place={place} r={r} w={w} months={months} />
      <LearnMore><PlantDetails wx={wx} place={place} r={r} w={w} months={months} slope={slope} /></LearnMore>
    </>
  )
}
