import { Pie, PieChart, type PieLabelRenderProps } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/shared/ui/chart'

/* one part of a chart; `light` marks a pale colour that needs dark text on it */
export type Slice = { key: string; label: string; value: number; color: string; light?: boolean }

const PIE_H = 240
const LABEL_AT = 0.6 /* labels sit 60% of the way out from the centre */
const RAD = Math.PI / 180

/* shadcn's "pie chart - label list": a full pie, each part named on itself */
export function LabelPie({ slices, label }: { slices: Slice[]; label: string }) {
  const config: ChartConfig = Object.fromEntries(slices.map((s) => [s.key, { label: s.label, color: s.color }]))
  const data = slices.filter((s) => s.value > 0).map((s) => ({ key: s.key, value: s.value, fill: 'var(--color-' + s.key + ')' }))
  const nameOn = (p: PieLabelRenderProps) => {
    const s = slices.find((x) => x.key === p.payload?.key)
    if (!s) return null
    const r = Number(p.outerRadius) * LABEL_AT
    const a = -Number(p.midAngle) * RAD
    return (
      <text x={Number(p.cx) + r * Math.cos(a)} y={Number(p.cy) + r * Math.sin(a)} textAnchor="middle" dominantBaseline="central" fontSize={12} className={s.light ? 'fill-foreground' : 'fill-white'}>
        {s.label}
      </text>
    )
  }
  return (
    <ChartContainer config={config} className="mx-auto aspect-auto w-full" style={{ height: PIE_H }} aria-label={label}>
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent hideLabel nameKey="key" />} />
        <Pie data={data} dataKey="value" nameKey="key" label={nameOn} labelLine={false} stroke="var(--background)" strokeWidth={2} isAnimationActive={false} />
      </PieChart>
    </ChartContainer>
  )
}
