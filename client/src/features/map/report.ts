/* The full report's numbers: the chosen place and the map's dates (from _archive/full-report-2026-11-05) */
import { Bug, Clock, Cloud, Droplet, Shovel, Sprout, Sun } from 'lucide-react'
import { sum, type Point } from './climate'
import { band, cropFit, cropMonths, CROPS, GOOD, ISSUE, planText, ranked, type CropWeather, type Fit } from './crops'
import { isLessSure, LESS_SURE_AFTER, M0, MON, MONTH_FULL, mName, seasonKey, yearOf, type Span } from './dates'
import type { MonthValue, Weather } from './hooks/useWeather'
import type { IconType, Tone } from './types'

const RP_DRY = 0.85
const RP_WET = 1.15
export const RP_VERY_DRY_MM = 50
const RP_WARM_C = 0.5

/* one month at the place: rain (mm) and heat (°C), and NASA's usual for that month */
type Month = { rain: number; usualRain: number; heat: number; usualHeat: number }
/* the place's weather for the report, read once from the same NASA and forecast data as the map:
   each month, the crop scoring's view of it (this place only), and the soil now */
export type PlaceWeather = { p: Point; at: (m: number) => Month; crop: CropWeather; soil: MonthValue | null }

/* the months the report reads: the dates and on to the longest crop's harvest, the month before (for the soil
   when preparing the land), and this month (right now) */
export const reportMonths = (w: Span) => [...new Set([w.a - 1, ...cropMonths(w), M0])]

/* null when a month has no rain or heat value */
export function placeWeather(wx: Weather, p: Point, w: Span): PlaceWeather | null {
  const table = new Map<number, Month>()
  for (const m of reportMonths(w)) {
    const r = wx.at('rain', p, m)
    const t = wx.at('heat', p, m)
    if (!r || !t) return null
    table.set(m, { rain: r.v, usualRain: r.usual, heat: t.v, usualHeat: t.usual })
  }
  const at = (m: number) => {
    const x = table.get(m)
    if (!x) throw new Error('The report has no weather for month ' + m)
    return x
  }
  return {
    p,
    at,
    crop: { rain: (_, m) => table.get(m)?.rain ?? null, heat: (_, m) => table.get(m)?.heat ?? null },
    soil: wx.at('soil', p, M0),
  }
}

export function seasonEnd(m: number) {
  const k = seasonKey(m)
  let e = m
  while (seasonKey(e + 1) === k) e++
  return e
}
export function seasonStart(m: number) {
  const k = seasonKey(m)
  let s = m
  while (seasonKey(s - 1) === k) s--
  return s
}
/* up to 18 months the season bar and the chart say "Nov"; longer, just "N" */
const ABBR_MAX = 18
export function monthLabel(m: number, n: number) {
  return n > ABBR_MAX ? MON[m % 12].charAt(0) : MON[m % 12]
}
/* "Dec 2026 – Mar 2027", or "Jan – Mar 2027" inside one year */
export function monthsText(a: number, b: number) {
  return a === b ? mName(a) : (yearOf(a) === yearOf(b) ? MON[a % 12] : mName(a)) + ' – ' + mName(b)
}
export function capFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
/* the runs of months inside the dates where test holds */
function runs(w: Span, test: (m: number) => boolean) {
  const out: Span[] = []
  let open = false
  for (let m = w.a; m <= w.b; m++) {
    if (!test(m)) {
      open = false
      continue
    }
    if (open) out[out.length - 1] = { ...out[out.length - 1], b: m }
    else out.push({ a: m, b: m })
    open = true
  }
  return out
}
export function rainOff(pw: PlaceWeather, a: number, b: number) {
  return 1 - sum(a, b, (m) => pw.at(m).rain) / sum(a, b, (m) => pw.at(m).usualRain)
}
function dryRuns(pw: PlaceWeather, w: Span) {
  return runs(w, (m) => pw.at(m).rain / pw.at(m).usualRain < RP_DRY)
}
const warmthOf = (pw: PlaceWeather, m: number) => pw.at(m).heat - pw.at(m).usualHeat

/* what stands out in the dates */
export type Alert = { tone: Tone; ic: IconType; t: string; when: string; d: string }
export function alertsFor(pw: PlaceWeather, w: Span) {
  const rows: Alert[] = []
  dryRuns(pw, w).forEach((g) => {
    rows.push({ tone: 'harvest', ic: Cloud, t: 'Drier than usual', when: monthsText(g.a, g.b), d: 'About ' + Math.round(rainOff(pw, g.a, g.b) * 100) + '% less rain than a usual year.' + (g.a > w.a ? ' Store water before ' + MONTH_FULL[g.a % 12] + '.' : '') })
  })
  runs(w, (m) => pw.at(m).rain < RP_VERY_DRY_MM).forEach((g) => {
    rows.push({ tone: 'harvest', ic: Droplet, t: 'Very dry', when: monthsText(g.a, g.b), d: 'Under ' + RP_VERY_DRY_MM + ' mm of rain a month. Crops planted then need watering.' })
  })
  runs(w, (m) => warmthOf(pw, m) >= RP_WARM_C).forEach((g) => {
    const d = sum(g.a, g.b, (m) => warmthOf(pw, m)) / (g.b - g.a + 1)
    rows.push({ tone: 'pest', ic: Sun, t: 'Warmer than usual', when: monthsText(g.a, g.b), d: 'About ' + d.toFixed(1) + ' °C warmer. Crops that take less heat, like tomato, may struggle.' })
  })
  runs(w, (m) => pw.at(m).rain / pw.at(m).usualRain > RP_WET).forEach((g) => {
    rows.push({ tone: 'water', ic: Cloud, t: 'Wetter than usual', when: monthsText(g.a, g.b), d: 'About ' + Math.round(-rainOff(pw, g.a, g.b) * 100) + '% more rain than a usual year. Keep the drains open.' })
  })
  if (isLessSure(w.b)) rows.push({ tone: 'none', ic: Clock, t: 'Less sure', when: 'after ' + mName(M0 + LESS_SURE_AFTER), d: 'Those months are an outlook: a likely tendency, not a forecast.' })
  if (!rows.length) rows.push({ tone: 'grow', ic: Sprout, t: 'Nothing stands out', when: '', d: 'Rain and heat look close to a usual year in your dates.' })
  return rows
}

/* the best moves: the old Adapt headlines, for a place and dates instead of a farm */
export type Move = { t: string; d: string; r?: Fit }
export function movesFor(pw: PlaceWeather, w: Span) {
  const all = ranked(pw.crop, pw.p, w)
  const top = all[0]
  const out: Move[] = []
  const n = w.b - w.a + 1
  const where = n >= 12 ? ' this year' : w.a === w.b ? ' this month' : ' in your dates'
  out.push(band(top.score) === 'poor'
    ? { t: 'No crop does well' + where, d: 'Rain and heat are hard on every crop here. ' + top.c.n + ' does the least badly: ' + planText(top) + '.' }
    : { t: top.c.n + ' is your best chance' + where, d: planText(top) + '.', r: top })
  const dry = dryRuns(pw, w)[0]
  if (dry) {
    out.push(dry.a > w.a
      ? { t: 'Store water before ' + MONTH_FULL[dry.a % 12], d: 'Rain is likely about ' + Math.round(rainOff(pw, dry.a, dry.b) * 100) + '% below usual in ' + monthsText(dry.a, dry.b) + '. Fill tanks and ponds while it still rains in ' + MONTH_FULL[(dry.a - 1) % 12] + '.' }
      : { t: 'Save water from the start', d: 'Your dates open drier than usual: about ' + Math.round(rainOff(pw, dry.a, dry.b) * 100) + '% less rain in ' + monthsText(dry.a, dry.b) + '.' })
  }
  const now = all.find((r) => r !== top && band(r.score) === 'good' && r.pm === w.a)
  if (now) out.push({ t: now.c.n + ' does well planted ' + (w.a === M0 ? 'now' : 'at the start, in ' + MONTH_FULL[w.a % 12]), d: planText(now) + '.', r: now })
  const wait = all.find((r) => r !== top && band(r.score) === 'good' && r.pm - w.a >= 3)
  if (wait) out.push({ t: wait.c.n + ' does well if you wait until ' + MONTH_FULL[wait.pm % 12], d: planText(wait) + '.', r: wait })
  return out
}

/* a crop's hardest month, in the report's words */
export function hardestText(r: Fit) {
  const word: Record<Fit['worst']['why'], string> = { hot: 'too hot', cold: 'too cool', dry: 'too dry', wet: 'too wet' }
  return r.worst.f >= ISSUE ? 'Rain and heat suit it from planting to harvest.' : 'Hardest month: ' + mName(r.worst.m) + ', ' + word[r.worst.why] + ' for it.'
}

/* the month's sky, in words */
export function skyOf(r: number): [IconType, string] {
  return r < 50 ? [Sun, 'Dry'] : r < 150 ? [Cloud, 'Some rain'] : r < 300 ? [Cloud, 'Rainy'] : [Droplet, 'Very wet']
}
/* a round top for the rain chart */
export function niceTop(v: number) {
  const step = v > 300 ? 100 : 50
  return Math.max(step, Math.ceil(v / step) * step)
}

/* farm work by month: simple rules of thumb from the month's rain, and the crops' fit for planting */
export type WorkMark = 'good' | 'ok' | 'no'
/* half of last month's rain is still in the ground */
const SOIL_KEEPS = 0.5
export const WORK_WORD: Record<WorkMark, string> = { good: 'Good', ok: 'Possible', no: 'Not a good month' }
export const JOBS: { n: string; ic: IconType; at: (pw: PlaceWeather, m: number) => WorkMark }[] = [
  { n: 'Plant', ic: Sprout, at: (pw, m) => {
    const k = CROPS.filter((c) => cropFit(pw.crop, pw.p, c, m).score >= GOOD).length
    return k >= 4 ? 'good' : k >= 1 ? 'ok' : 'no'
  } },
  { n: 'Prepare the land', ic: Shovel, at: (pw, m) => {
    const w = pw.at(m).rain + SOIL_KEEPS * pw.at(m - 1).rain
    return w >= 60 && w <= 350 ? 'good' : w >= 30 && w <= 500 ? 'ok' : 'no'
  } },
  { n: 'Dry the harvest in the sun', ic: Sun, at: (pw, m) => {
    const r = pw.at(m).rain
    return r < 80 ? 'good' : r < 180 ? 'ok' : 'no'
  } },
  { n: 'Spray', ic: Bug, at: (pw, m) => {
    const r = pw.at(m).rain
    return r < 120 ? 'good' : r < 250 ? 'ok' : 'no'
  } },
  { n: 'Collect rainwater', ic: Droplet, at: (pw, m) => {
    const r = pw.at(m).rain
    return r >= 250 ? 'good' : r >= 150 ? 'ok' : 'no'
  } },
]

/* the rain key under the small map: the lowest and highest rain a month in the dates,
   over the area the small map shows (about 10° × 7° around the spot), from the same data as the map */
const RP_VIEW_W = 300
const RP_VIEW_H = 200
const RP_PX_PER_DEG = 30
const RP_CELL_DEG = 1 /* one spot a degree: enough for a low and a high, and quick to read */
const RP_PIN_DROP = 14
/* spots across that area */
export function areaAround(p: Point): Point[] {
  const kx = RP_PX_PER_DEG * Math.cos((p.lat * Math.PI) / 180)
  const ky = RP_PX_PER_DEG
  const cx = RP_VIEW_W / 2
  const cy = RP_VIEW_H / 2 + RP_PIN_DROP
  const lon0 = p.lon - cx / kx
  const lon1 = p.lon + (RP_VIEW_W - cx) / kx
  const lat1 = p.lat + cy / ky
  const lat0 = p.lat - (RP_VIEW_H - cy) / ky
  const c = RP_CELL_DEG
  const out: Point[] = []
  for (let la = Math.floor(lat0 / c) * c; la < lat1; la += c) {
    for (let lo = Math.floor(lon0 / c) * c; lo < lon1; lo += c) out.push({ lon: lo + c / 2, lat: la + c / 2 })
  }
  return out
}
/* null when no spot has a value for every month */
export function rainRangeAround(wx: Weather, p: Point, w: Span): [number, number] | null {
  const n = w.b - w.a + 1
  const months = Array.from({ length: n }, (_, i) => w.a + i)
  const means = areaAround(p).flatMap((q) => {
    const vs = months.flatMap((m) => {
      const x = wx.at('rain', q, m)
      return x ? [x.v] : []
    })
    return vs.length === n ? [vs.reduce((t, v) => t + v, 0) / n] : []
  })
  return means.length ? [Math.min(...means), Math.max(...means)] : null
}
