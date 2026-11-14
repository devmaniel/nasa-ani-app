import { tempAt, waterAt, type Point } from './climate'
import { M0, mName, type Span } from './dates'
import { REGIONS } from './places'

/* months to harvest, the water a month they like (lo–hi mm), the heat they take (tmax °C) */
export type Crop = { n: string; l: string; months: number; lo: number; hi: number; tmax: number; first?: boolean }
export const CROPS: Crop[] = [
  { n: 'Rice', l: 'palay, rain-fed', months: 4, lo: 180, hi: 600, tmax: 30.5 },
  { n: 'Corn', l: 'mais', months: 4, lo: 90, hi: 350, tmax: 31 },
  { n: 'Mung bean', l: 'monggo', months: 3, lo: 30, hi: 180, tmax: 32 },
  { n: 'Peanut', l: 'mani', months: 4, lo: 50, hi: 220, tmax: 31 },
  { n: 'Sweet potato', l: 'kamote', months: 4, lo: 40, hi: 300, tmax: 31.5 },
  { n: 'Cassava', l: 'kamoteng kahoy', months: 10, lo: 25, hi: 400, tmax: 32 },
  { n: 'Tomato', l: 'kamatis', months: 3, lo: 30, hi: 170, tmax: 28.8 },
  { n: 'Eggplant', l: 'talong', months: 4, lo: 60, hi: 300, tmax: 31 },
  { n: 'Okra', l: 'okra', months: 3, lo: 50, hi: 300, tmax: 32 },
  { n: 'Pechay', l: 'pechay', months: 1, lo: 50, hi: 220, tmax: 29.5 },
  { n: 'Bitter gourd', l: 'ampalaya', months: 3, lo: 60, hi: 280, tmax: 31 },
  { n: 'Squash', l: 'kalabasa', months: 4, lo: 40, hi: 250, tmax: 31 },
  { n: 'Banana', l: 'saging', months: 12, lo: 100, hi: 450, tmax: 31.5, first: true },
  { n: 'Sugarcane', l: 'tubo', months: 12, lo: 60, hi: 450, tmax: 32 },
]

export const GOOD = 0.7
const FAIR = 0.45
export const ISSUE = 0.9

export type Why = 'hot' | 'dry' | 'wet'
export type Fit = { c: Crop; pm: number; score: number; worst: { f: number; m: number; why: Why } }

/* how well a crop planted in month pm would do, and its hardest month */
export function cropFit(p: Point, c: Crop, pm: number): Fit {
  let total = 0
  let worst: Fit['worst'] = { f: 2, m: pm, why: 'dry' }
  for (let m = pm; m < pm + c.months; m++) {
    const w = waterAt(p, m)
    const t = tempAt(p, m)
    const rf = w < c.lo ? Math.pow(w / c.lo, 1.3) : w > c.hi ? Math.max(0, 1 - (w - c.hi) / c.hi) : 1
    const hf = t <= c.tmax ? 1 : Math.max(0, 1 - (t - c.tmax) / 2.5)
    const f = rf * hf
    total += f
    if (f < worst.f) worst = { f, m, why: hf < rf ? 'hot' : w < c.lo ? 'dry' : 'wet' }
  }
  return { c, pm, score: (0.6 * total) / c.months + 0.4 * worst.f, worst }
}
/* the best month to plant inside the dates (the earliest when it's a tie) */
export function bestPlant(p: Point, c: Crop, a: number, b: number) {
  let best = cropFit(p, c, a)
  for (let pm = a + 1; pm <= b; pm++) {
    const r = cropFit(p, c, pm)
    if (r.score > best.score + 0.005) best = r
  }
  return best
}
export function ranked(p: Point, w: Span) {
  return CROPS.map((c) => bestPlant(p, c, w.a, w.b)).sort((x, y) => y.score - x.score)
}

export type Band = 'good' | 'fair' | 'poor'
export function band(s: number): Band {
  return s >= GOOD ? 'good' : s >= FAIR ? 'fair' : 'poor'
}
/* plain farming words */
export const BAND: Record<Band, string> = { good: 'Good to plant', fair: 'Plant with care', poor: 'Not a good time' }

export function harvestMonth(r: Fit) {
  return r.pm + r.c.months - 1
}
/* "Plant in Jan 2027 → harvest about Apr 2027" */
export function planText(r: Fit) {
  return (r.pm === M0 ? 'Plant now' : 'Plant in ' + mName(r.pm)) + ' → ' + (r.c.first ? 'first harvest' : 'harvest') + ' about ' + mName(harvestMonth(r))
}
export function cropWhy(r: Fit) {
  if (r.worst.f >= ISSUE) return 'Rain and heat suit it from planting to harvest.'
  if (r.worst.why === 'dry') return 'Likely short of water in ' + mName(r.worst.m) + '.'
  if (r.worst.why === 'wet') return 'Heavy rain in ' + mName(r.worst.m) + ' may hurt it.'
  return 'Likely too hot in ' + mName(r.worst.m) + '.'
}
export function readyIn(c: Crop) {
  return 'Ready in about ' + c.months + (c.months === 1 ? ' month' : ' months') + ' from planting.'
}

/* the whole country: one band per region */
export function regionBands(c: Crop, w: Span) {
  return REGIONS.map((p) => band(bestPlant(p, c, w.a, w.b).score))
}
export function countOf(bands: Band[], b: Band) {
  return bands.filter((x) => x === b).length
}
export function regionsLine(good: number, fair: number) {
  return (good ? BAND.good + ' in ' + good + (good === 1 ? ' region' : ' regions') : 'Not a good time in any region') + (fair ? ' · with care in ' + fair : '')
}
