import { meanOf, rainAt, usualRain, type Point } from '../climate'
import { isLessSure, MON, mName, type Span } from '../dates'
import { RainStackChart, type RainMonth } from './RainStackChart'

const BARS_MIN_MONTHS = 12
const CHART_H = 180

/* rain by month from the start of the dates (at least a year): a usual year and this year's rain in one bar a month */
export function RainBars({ pts, w }: { pts: Point[]; w: Span }) {
  const a = w.a
  const b = Math.max(w.b, a + BARS_MIN_MONTHS - 1)
  const months: RainMonth[] = []
  for (let m = a; m <= b; m++) {
    months.push({ key: String(m), m, rain: Math.round(meanOf(pts, (p) => rainAt(p, m))), usual: Math.round(meanOf(pts, (p) => usualRain(p, m))) })
  }
  const wet = months.reduce((x, y) => (y.rain > x.rain ? y : x))
  const tick = (key: string) => MON[Number(key) % 12]
  return (
    <div className="mb">
      <p className="kick">Rain by month</p>
      <div className="mt-[10px]">
        <RainStackChart
          months={months}
          hoverShade={false}
          height={CHART_H}
          tick={tick}
          title={(m) => mName(m) + (isLessSure(m) ? ' · less sure' : '')}
          label={'Rain by month, ' + mName(a) + ' to ' + mName(b) + ', against a usual year. Wettest: ' + mName(wet.m) + ', about ' + wet.rain + ' mm.'}
        />
      </div>
    </div>
  )
}
