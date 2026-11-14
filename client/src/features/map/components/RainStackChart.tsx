import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from '@/shared/ui/chart'
import { RAIN_COLOR, USUAL_COLOR } from '../chartColors'

/* the mm / °C scale's width: fixed and shared, so the report's two charts put each month at the same spot */
export const AXIS_W = 32
const RADIUS = 4
/* one stacked bar a month, like shadcn's "Stacked + Legend": a usual year (light) under this year's rain (dark) */
const CONFIG = {
  usual: { label: 'Usual', color: USUAL_COLOR },
  rain: { label: 'Rain', color: RAIN_COLOR },
} satisfies ChartConfig

/* rain: null for a month with no forecast or measurement (only the usual bar shows) */
export type RainMonth = { key: string; m: number; rain: number | null; usual: number }

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: color }} />
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}
/* shadcn's tooltip box with the month's real numbers: rain, usual, and the difference */
function RainTip({ x, title }: { x: RainMonth; title: string }) {
  const diff = x.rain === null ? null : x.rain - x.usual
  return (
    <div className="grid min-w-40 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{title}</div>
      {x.rain !== null && <TipRow color={RAIN_COLOR} label="Rain this year" value={x.rain + ' mm'} />}
      <TipRow color={USUAL_COLOR} label="Usual year" value={x.usual + ' mm'} />
      <div className="text-muted-foreground">
        {diff === null ? 'No data for this month yet' : diff === 0 ? 'Same as usual' : Math.abs(diff) + ' mm ' + (diff > 0 ? 'more' : 'less') + ' than usual'}
      </div>
    </div>
  )
}

type Props = { months: RainMonth[]; height: number; tick: (key: string) => string; title: (m: number) => string; yTop?: number; label: string; hoverShade?: boolean }

/* the rain chart of the sidebar and the report: one stacked bar a month, legend under it (the report adds the mm scale) */
export function RainStackChart({ months, height, tick, title, yTop, label, hoverShade = true }: Props) {
  const byKey = (k: string | number | undefined) => months.find((x) => x.key === String(k))
  return (
    <ChartContainer config={CONFIG} className="aspect-auto w-full" style={{ height }} aria-label={label}>
      <BarChart accessibilityLayer data={months} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="key" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" tickFormatter={tick} />
        {yTop !== undefined && <YAxis width={AXIS_W} domain={[0, yTop]} ticks={[0, yTop / 2, yTop]} tickLine={false} axisLine={false} />}
        <ChartTooltip
          cursor={hoverShade}
          content={({ active, label: key }) => {
            const x = active ? byKey(key) : undefined
            return x ? <RainTip x={x} title={title(x.m)} /> : null
          }}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="usual" stackId="a" fill="var(--color-usual)" radius={[0, 0, RADIUS, RADIUS]} isAnimationActive={false} />
        <Bar dataKey="rain" stackId="a" fill="var(--color-rain)" radius={[RADIUS, RADIUS, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  )
}
