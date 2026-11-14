import { gaezSamples, spotKey } from './api'
import type { Point } from './climate'

/* The land around a place, from FAO's GAEZ v4 (gaez.fao.org):
   how well each crop suits the land over 1981–2010 when rain-fed with low inputs (its climate, soil and terrain together),
   and the land's slope and height. FAO gives one value per 5 arc-minute square (about 9 km); a place is read as the
   square it's in and the 8 around it (about 25 km across), so a place on a square's edge isn't decided by one side. */
const CELL = 1 / 12 /* one FAO square, in degrees */
const AROUND = [-1, 0, 1]
const AROUND_N = AROUND.length * AROUND.length
const SUIT_SERVICE = 'res05' /* crop suitability: the field that picks a raster is `objectid` */
const LAND_SERVICE = 'LR' /* land resources: `OBJECTID` */

/* our crop → GAEZ's crop and its suitability-index raster (0–10000, all land in the cell; 1981–2010, rain-fed, low inputs).
   The other crops (eggplant, okra, pechay, bitter gourd, squash) aren't in GAEZ. Gram is taken as mung bean (green gram). */
export const GAEZ_CROP: Record<string, { crop: string; id: number }> = {
  Rice: { crop: 'Wetland rice', id: 255678 },
  Corn: { crop: 'Maize', id: 255667 },
  'Mung bean': { crop: 'Gram', id: 255664 },
  Peanut: { crop: 'Groundnut', id: 255663 },
  'Sweet potato': { crop: 'Sweet potato', id: 255683 },
  Cassava: { crop: 'Cassava', id: 255660 },
  Tomato: { crop: 'Tomato', id: 255690 },
  Banana: { crop: 'Banana', id: 255647 },
  Sugarcane: { crop: 'Sugarcane', id: 255686 },
}
const SLOPE_ID = 718 /* median terrain slope class, 30 arc-second */
const ALT_ID = 700 /* median altitude, metres, 30 arc-second */

/* GAEZ's slope classes 1–8 (0–0.5, 0.5–2, 2–5, 5–8, 8–16, 16–30, 30–45, over 45 %) */
export const SLOPE_WORDS = ['', 'flat', 'nearly flat', 'gently sloping', 'sloping', 'moderately steep', 'steep', 'very steep', 'extremely steep']
export const SLOPE_PCT = ['', 'under 0.5%', '0.5–2%', '2–5%', '5–8%', '8–16%', '16–30%', '30–45%', 'over 45%']
/* the low end of each class, % */
export const SLOPE_FROM = [NaN, 0, 0.5, 2, 5, 8, 16, 30, 45]

/* suit: crop name → suitability index, for the crops GAEZ has; slope: class 1–8; both null out at sea */
export type Land = { slope: number | null; alt: number | null; suit: Record<string, number> }

/* GAEZ's "good" suitability class starts here, "moderate" here (its classes checked against sampled values) */
export const GAEZ_GOOD = 5500
export const GAEZ_FAIR = 2500

/* the 9 squares around a point: its own and the 8 next to it */
const around = (p: Point) => AROUND.flatMap((dy) => AROUND.map((dx) => ({ lon: p.lon + dx * CELL, lat: p.lat + dy * CELL })))
/* the squares with a value (the sea has none); null when none has */
function mean(vs: number[]) {
  const f = vs.filter(Number.isFinite)
  return f.length ? f.reduce((s, v) => s + v, 0) / f.length : null
}
/* slope is a class, so the middle one rather than an average */
function median(vs: number[]) {
  const f = vs.filter(Number.isFinite).sort((a, b) => a - b)
  return f.length ? f[Math.floor(f.length / 2)] : null
}

const cache = new Map<string, Promise<Map<string, Land>>>()

/* the land around some points, keyed by spotKey; each set of points is asked once */
export function loadLand(pts: Point[]): Promise<Map<string, Land>> {
  const key = pts.map(spotKey).join('|')
  const have = cache.get(key)
  if (have) return have
  const crops = Object.entries(GAEZ_CROP)
  const all = pts.flatMap(around)
  const p = Promise.all([
    gaezSamples(LAND_SERVICE, 'OBJECTID', SLOPE_ID, all),
    gaezSamples(LAND_SERVICE, 'OBJECTID', ALT_ID, all),
    ...crops.map(([, g]) => gaezSamples(SUIT_SERVICE, 'objectid', g.id, all)),
  ]).then(([slope, alt, ...suits]) => {
    const out = new Map<string, Land>()
    pts.forEach((pt, i) => {
      const of = (vs: number[]) => vs.slice(i * AROUND_N, (i + 1) * AROUND_N)
      const suit: Record<string, number> = {}
      crops.forEach(([name], j) => {
        const v = mean(of(suits[j]))
        if (v !== null) suit[name] = v
      })
      out.set(spotKey(pt), { slope: median(of(slope)), alt: mean(of(alt)), suit })
    })
    return out
  })
  cache.set(key, p)
  p.catch(() => cache.delete(key)) /* a failed set can be asked again */
  return p
}

/* "nearly flat (0.5–2%), 36 m above the sea" */
export function landLine(l: Land) {
  const parts: string[] = []
  if (l.slope !== null && SLOPE_WORDS[l.slope]) parts.push(SLOPE_WORDS[l.slope] + ' (' + SLOPE_PCT[l.slope] + ')')
  if (l.alt !== null) parts.push(Math.round(l.alt) + ' m above the sea')
  return parts.join(', ')
}
