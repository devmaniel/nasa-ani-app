/* The full report's numbers: the chosen place and the map's dates (from _archive/full-report-2026-11-05) */
import { Bug, Clock, Cloud, Droplet, Shovel, Sprout, Sun } from 'lucide-react'
import { rainAt, sum, tempAt, usualRain, usualTemp, waterAt, type Point } from './climate'
import { band, cropFit, CROPS, GOOD, ISSUE, planText, ranked, type CropWeather, type Fit } from './crops'
import { isLessSure, LESS_SURE_AFTER, M0, MON, MONTH_FULL, mName, seasonKey, yearOf, type Span } from './dates'
import type { IconType, Tone } from './types'

const RP_DRY = 0.85
const RP_WET = 1.15
export const RP_VERY_DRY_MM = 50
const RP_WARM_C = 0.5
/* the report is still on the sample climate: its crops are scored on it too */
export const SAMPLE_WEATHER: CropWeather = { rain: rainAt, heat: tempAt }

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
export function rainOff(p: Point, a: number, b: number) {
  return 1 - sum(a, b, (m) => rainAt(p, m)) / sum(a, b, (m) => usualRain(p, m))
}
function dryRuns(p: Point, w: Span) {
  return runs(w, (m) => rainAt(p, m) / usualRain(p, m) < RP_DRY)
}

/* what stands out in the dates */
export type Alert = { tone: Tone; ic: IconType; t: string; when: string; d: string }
export function alertsFor(p: Point, w: Span) {
  const rows: Alert[] = []
  dryRuns(p, w).forEach((g) => {
    rows.push({ tone: 'harvest', ic: Cloud, t: 'Drier than usual', when: monthsText(g.a, g.b), d: 'About ' + Math.round(rainOff(p, g.a, g.b) * 100) + '% less rain than a usual year.' + (g.a > w.a ? ' Store water before ' + MONTH_FULL[g.a % 12] + '.' : '') })
  })
  runs(w, (m) => rainAt(p, m) < RP_VERY_DRY_MM).forEach((g) => {
    rows.push({ tone: 'harvest', ic: Droplet, t: 'Very dry', when: monthsText(g.a, g.b), d: 'Under ' + RP_VERY_DRY_MM + ' mm of rain a month. Crops planted then need watering.' })
  })
  runs(w, (m) => tempAt(p, m) - usualTemp(p, m) >= RP_WARM_C).forEach((g) => {
    const d = sum(g.a, g.b, (m) => tempAt(p, m) - usualTemp(p, m)) / (g.b - g.a + 1)
    rows.push({ tone: 'pest', ic: Sun, t: 'Warmer than usual', when: monthsText(g.a, g.b), d: 'About ' + d.toFixed(1) + ' °C warmer. Crops that take less heat, like tomato, may struggle.' })
  })
  runs(w, (m) => rainAt(p, m) / usualRain(p, m) > RP_WET).forEach((g) => {
    rows.push({ tone: 'water', ic: Cloud, t: 'Wetter than usual', when: monthsText(g.a, g.b), d: 'About ' + Math.round(-rainOff(p, g.a, g.b) * 100) + '% more rain than a usual year. Keep the drains open.' })
  })
  if (isLessSure(w.b)) rows.push({ tone: 'none', ic: Clock, t: 'Less sure', when: 'after ' + mName(M0 + LESS_SURE_AFTER), d: 'Those months are an outlook: a likely tendency, not a forecast.' })
  if (!rows.length) rows.push({ tone: 'grow', ic: Sprout, t: 'Nothing stands out', when: '', d: 'Rain and heat look close to a usual year in your dates.' })
  return rows
}

/* the best moves: the old Adapt headlines, for a place and dates instead of a farm */
export type Move = { t: string; d: string; r?: Fit }
export function movesFor(p: Point, w: Span) {
  const all = ranked(SAMPLE_WEATHER, p, w)
  const top = all[0]
  const out: Move[] = []
  const n = w.b - w.a + 1
  const where = n >= 12 ? ' this year' : w.a === w.b ? ' this month' : ' in your dates'
  out.push(band(top.score) === 'poor'
    ? { t: 'No crop does well' + where, d: 'Rain and heat are hard on every crop here. ' + top.c.n + ' does the least badly: ' + planText(top) + '.' }
    : { t: top.c.n + ' is your best chance' + where, d: planText(top) + '.', r: top })
  const dry = dryRuns(p, w)[0]
  if (dry) {
    out.push(dry.a > w.a
      ? { t: 'Store water before ' + MONTH_FULL[dry.a % 12], d: 'Rain is likely about ' + Math.round(rainOff(p, dry.a, dry.b) * 100) + '% below usual in ' + monthsText(dry.a, dry.b) + '. Fill tanks and ponds while it still rains in ' + MONTH_FULL[(dry.a - 1) % 12] + '.' }
      : { t: 'Save water from the start', d: 'Your dates open drier than usual: about ' + Math.round(rainOff(p, dry.a, dry.b) * 100) + '% less rain in ' + monthsText(dry.a, dry.b) + '.' })
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

/* farm work by month: sample rules from the month's rain and heat */
export type WorkMark = 'good' | 'ok' | 'no'
export const WORK_WORD: Record<WorkMark, string> = { good: 'Good', ok: 'Possible', no: 'Not a good month' }
export const JOBS: { n: string; ic: IconType; at: (p: Point, m: number) => WorkMark }[] = [
  { n: 'Plant', ic: Sprout, at: (p, m) => {
    const k = CROPS.filter((c) => cropFit(SAMPLE_WEATHER, p, c, m).score >= GOOD).length
    return k >= 4 ? 'good' : k >= 1 ? 'ok' : 'no'
  } },
  { n: 'Prepare the land', ic: Shovel, at: (p, m) => {
    const w = waterAt(p, m)
    return w >= 60 && w <= 350 ? 'good' : w >= 30 && w <= 500 ? 'ok' : 'no'
  } },
  { n: 'Dry the harvest in the sun', ic: Sun, at: (p, m) => {
    const r = rainAt(p, m)
    return r < 80 ? 'good' : r < 180 ? 'ok' : 'no'
  } },
  { n: 'Spray', ic: Bug, at: (p, m) => {
    const r = rainAt(p, m)
    return r < 120 ? 'good' : r < 250 ? 'ok' : 'no'
  } },
  { n: 'Collect rainwater', ic: Droplet, at: (p, m) => {
    const r = rainAt(p, m)
    return r >= 250 ? 'good' : r >= 150 ? 'ok' : 'no'
  } },
]

/* the rain key under the small map: the lowest and highest rain a month in the dates,
   over the area the small map shows (about 10° × 7° around the spot) */
const RP_VIEW_W = 300
const RP_VIEW_H = 200
const RP_PX_PER_DEG = 30
const RP_CELL_DEG = 0.25
const RP_PIN_DROP = 14
export function rainRangeAround(p: Point, w: Span): [number, number] {
  const kx = RP_PX_PER_DEG * Math.cos((p.lat * Math.PI) / 180)
  const ky = RP_PX_PER_DEG
  const cx = RP_VIEW_W / 2
  const cy = RP_VIEW_H / 2 + RP_PIN_DROP
  const lon0 = p.lon - cx / kx
  const lon1 = p.lon + (RP_VIEW_W - cx) / kx
  const lat1 = p.lat + cy / ky
  const lat0 = p.lat - (RP_VIEW_H - cy) / ky
  const c = RP_CELL_DEG
  let lo = Infinity
  let hi = -Infinity
  for (let la = Math.floor(lat0 / c) * c; la < lat1; la += c) {
    for (let lo2 = Math.floor(lon0 / c) * c; lo2 < lon1; lo2 += c) {
      const q = { lon: lo2 + c / 2, lat: la + c / 2 }
      const v = sum(w.a, w.b, (m) => rainAt(q, m)) / (w.b - w.a + 1)
      lo = Math.min(lo, v)
      hi = Math.max(hi, v)
    }
  }
  return [lo, hi]
}
