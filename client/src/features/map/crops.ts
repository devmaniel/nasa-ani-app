import type { Point } from './climate'
import { mName, type Span } from './dates'
import { GAEZ_FAIR, GAEZ_GOOD } from './land'
import { REGIONS } from './places'

/* [absolute lowest, best from, best to, absolute highest] */
type Range = [number, number, number, number]
/* What each crop needs, from FAO's ECOCROP database (gaez.fao.org/pages/ecocrop; full copy: github.com/OpenCLIM/ecocrop):
   heat: the month's average temperature it takes (°C); rain: the rain a year it takes (mm);
   months: planting to harvest, the middle of ECOCROP's crop cycle (corn: FAO's growing-period table, ECOCROP's 65–365 days is too wide);
   paddy: grown in a flooded field (FAO: rice paddy), so heavy rain doesn't count against it */
export type Crop = { n: string; l: string; months: number; heat: Range; rain: Range; first?: boolean; paddy?: boolean }
export const CROPS: Crop[] = [
  { n: 'Rice', l: 'palay, rain-fed', months: 4, heat: [10, 20, 30, 36], rain: [1000, 1500, 2000, 4000], paddy: true }, // Oryza sativa, 80–180 days
  { n: 'Corn', l: 'mais', months: 5, heat: [10, 18, 33, 47], rain: [400, 600, 1200, 1800] }, // Zea mays; FAO maize (grain) 125–180 days
  { n: 'Mung bean', l: 'monggo', months: 3, heat: [8, 21, 36, 40], rain: [500, 650, 900, 1250] }, // Vigna radiata, 50–120 days
  { n: 'Peanut', l: 'mani', months: 4, heat: [10, 22, 32, 45], rain: [400, 600, 1500, 4000] }, // Arachis hypogaea, 90–150 days
  { n: 'Sweet potato', l: 'kamote', months: 4, heat: [10, 18, 28, 38], rain: [350, 750, 2000, 5000] }, // Ipomoea batatas, 80–170 days
  { n: 'Cassava', l: 'kamoteng kahoy', months: 9, heat: [10, 20, 29, 35], rain: [500, 1000, 1500, 5000] }, // Manihot esculenta, 180–365 days
  { n: 'Tomato', l: 'kamatis', months: 4, heat: [7, 20, 27, 35], rain: [400, 600, 1300, 1800] }, // Lycopersicon esculentum, 70–150 days
  { n: 'Eggplant', l: 'talong', months: 3, heat: [9, 20, 35, 40], rain: [800, 1200, 1600, 4000] }, // Solanum melongena, 70–120 days
  { n: 'Okra', l: 'okra', months: 4, heat: [12, 20, 30, 35], rain: [300, 600, 1200, 2500] }, // Abelmoschus esculentus, 50–180 days
  { n: 'Pechay', l: 'pechay', months: 1, heat: [10, 20, 25, 32], rain: [300, 900, 1400, 2000] }, // Brassica rapa Pak Choi, 21–45 days
  { n: 'Bitter gourd', l: 'ampalaya', months: 2, heat: [15, 22, 30, 38], rain: [1000, 2000, 2500, 4000] }, // Momordica charantia, 50–70 days
  { n: 'Squash', l: 'kalabasa', months: 4, heat: [10, 20, 30, 40], rain: [300, 600, 1600, 2800] }, // Cucurbita moschata, 80–140 days
  { n: 'Banana', l: 'saging', months: 12, heat: [16, 23, 28, 38], rain: [1000, 1300, 3000, 5000], first: true }, // Musa balbisiana (saba), 365 days
  { n: 'Sugarcane', l: 'tubo', months: 10, heat: [15, 24, 37, 41], rain: [1000, 1500, 2000, 5000] }, // Saccharum officinarum, 210–365 days
]
/* the longest crop: the weather is needed up to its harvest */
const LONGEST = Math.max(...CROPS.map((c) => c.months))
/* the months the crop advice needs: planting inside the dates, growing until the longest crop's harvest */
export const cropMonths = (w: Span) => Array.from({ length: w.b - w.a + LONGEST }, (_, i) => w.a + i)

/* a month's rain (mm) and average heat (°C) at a point, null when there's no number for it;
   land: how well the crop suits the land there (FAO GAEZ, 0–10000), null when GAEZ has no rating for it or the point */
export type CropWeather = {
  rain: (p: Point, m: number) => number | null
  heat: (p: Point, m: number) => number | null
  land: (p: Point, crop: string) => number | null
}

export const GOOD = 0.7
const FAIR = 0.45
export const ISSUE = 0.9
const MONTHS_A_YEAR = 12
/* the land's share of the score: the weather in the dates decides most of it, the long-run land suitability the rest */
const LAND_WEIGHT = 0.3
/* the highest score on poor land: just under GOOD */
const POOR_LAND_MAX = GOOD - 0.01

export type Why = 'hot' | 'cold' | 'dry' | 'wet'
/* land: the crop's GAEZ suitability index at the point, null without one */
export type Fit = { c: Crop; pm: number; score: number; land: number | null; worst: { f: number; m: number; why: Why } }

/* 1 inside the best range, down to 0 at the absolute limits (ECOCROP's way) */
function within(v: number, [lo, a, b, hi]: Range) {
  return v <= lo || v >= hi ? 0 : v < a ? (v - lo) / (a - lo) : v > b ? (hi - v) / (hi - b) : 1
}
/* ECOCROP's rain is a year's, so a month gets a twelfth. Monsoon months often pass a twelfth of the yearly highest,
   so above it the score only eases off (0 at twice it) instead of dropping */
function rainFit(mm: number, { rain: [lo, a, , hi], paddy }: Crop) {
  const [l, o, h] = [lo, a, hi].map((x) => x / MONTHS_A_YEAR)
  return mm <= l ? 0 : mm < o ? (mm - l) / (o - l) : mm <= h || paddy ? 1 : Math.max(0, 1 - (mm - h) / h)
}

/* how well a crop planted in month pm would do, and its hardest month (a month with no numbers is left out) */
export function cropFit(wx: CropWeather, p: Point, c: Crop, pm: number): Fit {
  let total = 0
  let n = 0
  let worst: Fit['worst'] = { f: 2, m: pm, why: 'dry' }
  for (let m = pm; m < pm + c.months; m++) {
    const r = wx.rain(p, m)
    const t = wx.heat(p, m)
    if (r === null || t === null) continue
    const rf = rainFit(r, c)
    const hf = within(t, c.heat)
    const f = Math.min(rf, hf)
    total += f
    n++
    if (f < worst.f) worst = { f, m, why: hf < rf ? (t > c.heat[2] ? 'hot' : 'cold') : r < c.rain[1] / MONTHS_A_YEAR ? 'dry' : 'wet' }
  }
  const land = wx.land(p, c.n)
  const sky = n ? (0.6 * total) / n + 0.4 * worst.f : 0
  const lf = land === null ? usualLand(wx, p) : landFactor(land)
  const mixed = lf === null ? sky : (1 - LAND_WEIGHT) * sky + LAND_WEIGHT * lf
  /* land FAO rates poor for the crop is at best "Plant with care", however good the weather */
  const score = land !== null && land < GAEZ_FAIR ? Math.min(mixed, POOR_LAND_MAX) : mixed
  return { c, pm, score, land, worst: n ? worst : { f: 0, m: pm, why: 'dry' } }
}
const landFactor = (v: number) => Math.min(1, v / GAEZ_GOOD)
/* a crop GAEZ doesn't rate is taken as doing as well on this land as the rated crops do on average,
   so it isn't lifted above them just for having no rating; null when no crop has one here */
function usualLand(wx: CropWeather, p: Point) {
  const vs = CROPS.flatMap((c) => {
    const v = wx.land(p, c.n)
    return v === null ? [] : [landFactor(v)]
  })
  return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null
}
/* the land's say, from FAO GAEZ; null for a crop or a point it has no rating for */
export function landText(r: Fit) {
  const lb = landBand(r.land)
  return lb && { good: 'The land here suits it well.', fair: 'The land here is only fair for it.', poor: 'The land here is poor for it.' }[lb]
}
/* FAO GAEZ's suitability index in the app's three bands; null without a rating */
export function landBand(v: number | null): Band | null {
  return v === null ? null : v >= GAEZ_GOOD ? 'good' : v >= GAEZ_FAIR ? 'fair' : 'poor'
}

/* steep from 8% (FAO GAEZ's "moderately steep" and up), flat under 2% */
const STEEP_PCT = 8
const FLAT_PCT = 2
/* what the slope (%) means for the crop (rules of thumb); null on in-between ground or without a slope */
export function slopeText(c: Crop, pct: number | null) {
  if (pct === null) return null
  if (pct >= STEEP_PCT) return c.paddy ? 'Steep ground here: a paddy needs terraces to hold its water.' : 'Steep ground here: rain runs off and washes soil away. Plant across the slope and keep the ground covered.'
  if (pct < FLAT_PCT) return c.paddy ? 'Flat ground here holds water well for a paddy.' : 'Flat ground here: water can pool in the wet months. Plant on raised beds or dig drains.'
  return null
}
/* the best month to plant inside the dates (the earliest when it's a tie) */
export function bestPlant(wx: CropWeather, p: Point, c: Crop, a: number, b: number) {
  let best = cropFit(wx, p, c, a)
  for (let pm = a + 1; pm <= b; pm++) {
    const r = cropFit(wx, p, c, pm)
    if (r.score > best.score + 0.005) best = r
  }
  return best
}
export function ranked(wx: CropWeather, p: Point, w: Span) {
  return CROPS.map((c) => bestPlant(wx, p, c, w.a, w.b)).sort((x, y) => y.score - x.score)
}

export type Band = 'good' | 'fair' | 'poor'
export function band(s: number): Band {
  return s >= GOOD ? 'good' : s >= FAIR ? 'fair' : 'poor'
}
/* the score as a 1–5 rating, in step with the bands: 4–5 good to plant, 3 with care, 1–2 not a good time */
const RATE_TOP = 0.85
const RATE_LOW = 0.25
export function rating(s: number) {
  return s >= RATE_TOP ? 5 : s >= GOOD ? 4 : s >= FAIR ? 3 : s >= RATE_LOW ? 2 : 1
}
export const ratingBand = (n: number): Band => (n >= 4 ? 'good' : n === 3 ? 'fair' : 'poor')
/* plain farming words */
export const BAND: Record<Band, string> = { good: 'Good to plant', fair: 'Plant with care', poor: 'Not a good time' }

export function harvestMonth(r: Fit) {
  return r.pm + r.c.months - 1
}
export function cropWhy(r: Fit) {
  if (r.worst.f >= ISSUE) return 'Rain and heat suit it from planting to harvest.'
  if (r.worst.why === 'dry') return 'Likely short of water in ' + mName(r.worst.m) + '.'
  if (r.worst.why === 'wet') return 'Heavy rain in ' + mName(r.worst.m) + ' may hurt it.'
  if (r.worst.why === 'cold') return 'Likely too cool in ' + mName(r.worst.m) + '.'
  return 'Likely too hot in ' + mName(r.worst.m) + '.'
}
export function readyIn(c: Crop) {
  return 'Ready in about ' + c.months + (c.months === 1 ? ' month' : ' months') + ' from planting.'
}

/* the whole country: one band per region */
export function regionBands(wx: CropWeather, c: Crop, w: Span) {
  return REGIONS.map((p) => band(bestPlant(wx, p, c, w.a, w.b).score))
}
export function countOf(bands: Band[], b: Band) {
  return bands.filter((x) => x === b).length
}
export function regionsLine(good: number, fair: number) {
  return (good ? BAND.good + ' in ' + good + (good === 1 ? ' region' : ' regions') : 'Not a good time in any region') + (fair ? ' · with care in ' + fair : '')
}
