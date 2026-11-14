import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/shared/ui/chart'
import { HEAT_COLOR } from '../chartColors'
import { rainAt, rainWord, tempAt, usualRain, usualTemp, type Point } from '../climate'
import { isLessSure, M0, mName, seasonKey, seasonsIn, SEASON_NAME, type Span } from '../dates'
import { monthLabel, monthsText, niceTop, rainOff, skyOf } from '../report'
import { AXIS_W, RainStackChart } from './RainStackChart'

type Month = { key: string; m: number; rain: number; usual: number; heat: number }

const RAIN_H = 240
const HEAT_H = 150
const CONFIG = { heat: { label: 'Heat', color: HEAT_COLOR } } satisfies ChartConfig

function monthsOf(p: Point, w: Span) {
  const ms: Month[] = []
  for (let m = w.a; m <= w.b; m++) {
    ms.push({ key: String(m), m, rain: Math.round(rainAt(p, m)), usual: Math.round(usualRain(p, m)), heat: Math.round(tempAt(p, m) * 10) / 10 })
  }
  return ms
}
/* the tooltip's first line: the month, its season, and "less sure" a year out */
function tipLabel(key: unknown) {
  const m = Number(key)
  return mName(m) + ' · ' + SEASON_NAME[seasonKey(m)] + (isLessSure(m) ? ' · less sure' : '')
}

/* month by month: rain against a usual year, then heat, on the same months (two charts, never two scales on one).
   Hovering a month shows its numbers in the chart under the pointer only. */
export function ReportChart({ p, w }: { p: Point; w: Span }) {
  const ms = monthsOf(p, w)
  const n = ms.length
  const top = niceTop(Math.max(...ms.map((x) => x.rain + x.usual))) /* the bars stack rain on usual */
  const tLo = Math.floor(Math.min(...ms.map((x) => x.heat)) - 0.3)
  const tHi = Math.max(tLo + 2, Math.ceil(Math.max(...ms.map((x) => x.heat)) + 0.3))
  const tick = (key: string) => monthLabel(Number(key), n)
  return (
    <div id="rp-chart">
      <div className="rp-ch-box">
        <div className="rp-ch">
          <p className="cap"><span>Rain a month (mm)</span></p>
          <div className="mt-4">
            <RainStackChart months={ms} height={RAIN_H} tick={tick} title={tipLabel} yTop={top} label="Rain by month against a usual year" />
          </div>
        </div>
      </div>
      <div className="rp-ch-box">
        <div className="rp-ch">
          <p className="cap"><span>Heat (°C)</span></p>
          <ChartContainer config={CONFIG} className="mt-4 aspect-auto w-full" style={{ height: HEAT_H }} aria-label="Heat by month">
            <LineChart accessibilityLayer data={ms} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="key" scale="band" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" tickFormatter={tick} />
              <YAxis width={AXIS_W} domain={[tLo, tHi]} ticks={[tLo, (tLo + tHi) / 2, tHi]} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={tipLabel} />} />
              <Line dataKey="heat" type="monotone" stroke="var(--color-heat)" strokeWidth={2} isAnimationActive={false}
                dot={{ r: 3, fill: 'var(--color-heat)', stroke: 'var(--background)', strokeWidth: 2 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  )
}

/* the numbers behind the charts, one row per month, grouped by season */
export function ReportMonths({ p, w }: { p: Point; w: Span }) {
  return (
    <>
      {seasonsIn(w.a, w.b).map((sg) => {
        const rows = []
        for (let m = sg.a; m <= sg.b; m++) {
          const r = rainAt(p, m)
          const t = tempAt(p, m)
          const dt = t - usualTemp(p, m)
          const [Ic, word] = skyOf(r)
          rows.push(
            <li key={m} className="rp-mo">
              <span className="m num">{mName(m)}</span>
              <span className="w"><Ic className="i" aria-hidden />{word}{m === M0 && <span className="tag now-t">Now</span>}{isLessSure(m) && <span className="tag">Less sure</span>}</span>
              <span className="r num">{Math.round(r)} mm<small>usual {Math.round(usualRain(p, m))}</small></span>
              <span className="t num">{t.toFixed(1)}°<small>{dt >= 0.2 ? '+' + dt.toFixed(1) : dt <= -0.2 ? '−' + Math.abs(dt).toFixed(1) : 'usual'}</small></span>
            </li>,
          )
        }
        return (
          <div key={sg.a} className={sg.k}>
            <p className="rp-sg"><b>{SEASON_NAME[sg.k]}</b><span className="num">{monthsText(sg.a, sg.b)} · rain likely {rainWord(1 - rainOff(p, sg.a, sg.b))}</span></p>
            <ul>{rows}</ul>
          </div>
        )
      })}
    </>
  )
}
