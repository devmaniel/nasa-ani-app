import { MON, mName, type Span } from '../dates'
import type { Kind } from '../climateLayer'
import { barsEnd } from '../hooks/useWeather'
import { RainStackChart, type RainMonth } from './RainStackChart'

const CHART_H = 180
const KIND_TIP: Record<Kind, string> = { past: ' · measured by NASA', forecast: ' · forecast', estimate: ' · forecast', usual: ' · no data yet' }

/* a month's rain (null with no forecast or measurement), NASA's usual, and where it comes from */
export type RainRow = { m: number; rain: number | null; usual: number; kind: Kind }

/* rain by month from the start of the dates (at least a year): a usual year and the month's measured or forecast rain in one bar */
export function RainBars({ rows, w }: { rows: RainRow[]; w: Span }) {
  const months: RainMonth[] = rows.map((r) => ({ key: String(r.m), m: r.m, rain: r.rain === null ? null : Math.round(r.rain), usual: Math.round(r.usual) }))
  const kinds = new Map(rows.map((r) => [r.m, r.kind]))
  const wet = months.reduce<RainMonth | null>((x, y) => (y.rain !== null && (!x || x.rain === null || y.rain > x.rain) ? y : x), null)
  const tick = (key: string) => MON[Number(key) % 12]
  const b = barsEnd(w)
  return (
    <div className="mb">
      <p className="kick">Rain by month</p>
      <div className="mt-[10px]">
        <RainStackChart
          months={months}
          hoverShade={false}
          height={CHART_H}
          tick={tick}
          title={(m) => mName(m) + KIND_TIP[kinds.get(m) ?? 'usual']}
          label={'Rain by month, ' + mName(w.a) + ' to ' + mName(b) + ', against a usual year. '
            + (wet ? 'Wettest: ' + mName(wet.m) + ', about ' + wet.rain + ' mm.' : 'No forecast or measurement for these months yet.')}
        />
      </div>
    </div>
  )
}
