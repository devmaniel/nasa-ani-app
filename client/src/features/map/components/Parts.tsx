import { harvestMonth, type Fit } from '../crops'
import { mName, type Span } from '../dates'
import type { IconType } from '../types'

export type Chip = [IconType, string]

/* a grey loading shape */
export function Sk({ w, h }: { w: string; h: number }) {
  return <i className="sk" style={{ width: w, height: h }} />
}

export function LoadingStatus() {
  return <p className="sr" role="status">Loading</p>
}

/* three bars, lit up to level n (0–2) */
export function Level({ n }: { n: number }) {
  return (
    <span className="lvl" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <i key={i} className={i <= n ? 'on' : undefined} />
      ))}
    </span>
  )
}

/* a bar filled to v, with a mark at the usual amount u (both CSS lengths in %) */
export function Meter({ v, u }: { v: string; u: string }) {
  return (
    <span className="meter" style={{ '--v': v, '--u': u }} aria-hidden="true">
      <i />
      <b />
    </span>
  )
}

/* the calendar key under a crop calendar */
export function CalendarKey() {
  return (
    <p className="cleg" aria-hidden="true">
      <span><i className="win" />Your dates</span>
      <span><i className="pl" />Plant</span>
      <span><i className="gr" />Growing</span>
      <span><i className="hv" />Harvest</span>
    </p>
  )
}

export function Chips({ chips }: { chips: Chip[] }) {
  return <>{chips.map(([Ic, text]) => <span key={text}><Ic className="i" aria-hidden />{text}</span>)}</>
}

/* a crop's calendar from the start of the dates to its harvest: the dates shaded, plant, growing, harvest */
export function Gantt({ r, w, a, b }: { r: Fit; w: Span; a: number; b: number }) {
  const at = (m: number) => ((m - a + 0.5) / (b - a + 1)) * 100
  const hv = harvestMonth(r)
  return (
    <span className="gantt" aria-hidden="true">
      <i className="win" style={{ left: 0, width: (((Math.min(w.b, b) - a + 1) / (b - a + 1)) * 100).toFixed(2) + '%' }} />
      <i className="gr" style={{ left: at(r.pm).toFixed(2) + '%', width: (at(hv) - at(r.pm)).toFixed(2) + '%' }} />
      <i className="pl" style={{ left: at(r.pm).toFixed(2) + '%' }} />
      <i className="hv" style={{ left: at(hv).toFixed(2) + '%' }} />
    </span>
  )
}
export function Axis({ a, b, className }: { a: number; b: number; className: string }) {
  return <p className={className + ' num'} aria-hidden="true"><span>{mName(a)}</span><span>{mName(Math.round((a + b) / 2))}</span><span>{mName(b)}</span></p>
}
