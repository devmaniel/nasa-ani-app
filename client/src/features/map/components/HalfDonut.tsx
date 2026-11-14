import { Label, PolarAngleAxis, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/shared/ui/chart'
import type { Slice } from './LabelPie'

const CHART_H = 150
const CY = 135
const INNER = 80
const OUTER = 130

/* shadcn's "radial chart - stacked": the parts end to end on a half circle, the total under the arch, a legend under it */
export function HalfDonut({ slices, unit, label }: { slices: Slice[]; unit: string; label: string }) {
  const config: ChartConfig = Object.fromEntries(slices.map((s) => [s.key, { label: s.label, color: s.color }]))
  const shown = slices.filter((s) => s.value > 0)
  const row = Object.fromEntries(shown.map((s) => [s.key, s.value]))
  const total = shown.reduce((t, s) => t + s.value, 0)
  return (
    <div>
      <ChartContainer config={config} className="mx-auto aspect-auto w-full" style={{ height: CHART_H }} aria-label={label}>
        <RadialBarChart data={[row]} cy={CY} startAngle={180} endAngle={0} innerRadius={INNER} outerRadius={OUTER}>
          {/* the half circle is the total, so every part gets its share (not the largest part alone) */}
          <PolarAngleAxis type="number" domain={[0, total]} tick={false} axisLine={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
          <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
            <Label
              content={({ viewBox }) => {
                if (!viewBox || !('cx' in viewBox) || !('cy' in viewBox)) return null
                const cx = Number(viewBox.cx)
                const cy = Number(viewBox.cy)
                return (
                  <text x={cx} y={cy} textAnchor="middle">
                    <tspan x={cx} y={cy - 16} className="fill-foreground text-2xl font-bold">{total}</tspan>
                    <tspan x={cx} y={cy + 4} className="fill-muted-foreground text-xs">{unit}</tspan>
                  </text>
                )
              }}
            />
          </PolarRadiusAxis>
          {shown.map((s) => (
            <RadialBar key={s.key} dataKey={s.key} stackId="a" cornerRadius={5} fill={'var(--color-' + s.key + ')'} className="stroke-transparent stroke-2" isAnimationActive={false} />
          ))}
        </RadialBarChart>
      </ChartContainer>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-3 text-xs" aria-hidden="true">
        {slices.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <i className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
