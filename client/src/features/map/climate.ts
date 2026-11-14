/* Made-up climate (sample data, not a real forecast): west Luzon has a clear dry season,
   the Pacific side and Mindanao get rain all year. */
export type Point = { lon: number; lat: number }

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
}
export function avg(a: number, b: number, f: (m: number) => number) {
  let s = 0
  for (let m = a; m <= b; m++) s += f(m)
  return s / (b - a + 1)
}
export function sum(a: number, b: number, f: (m: number) => number) {
  let s = 0
  for (let m = a; m <= b; m++) s += f(m)
  return s
}
export function meanOf<T>(pts: T[], f: (p: T) => number) {
  let t = 0
  pts.forEach((p) => {
    t += f(p)
  })
  return t / pts.length
}
export function pct(x: number) {
  return (clamp(x, 0, 1) * 100).toFixed(1) + '%'
}

const RAIN_WEST = [20, 15, 20, 35, 140, 260, 400, 430, 360, 200, 120, 60]
const RAIN_EAST = [260, 180, 150, 110, 140, 180, 200, 170, 200, 260, 330, 380]
const RAIN_SOUTH = [150, 120, 110, 110, 170, 200, 190, 180, 180, 190, 170, 160]
const TEMP_SHIFT = [-1.3, -0.9, 0, 1.2, 1.6, 0.8, 0.1, 0, 0, -0.1, -0.3, -0.9]
const RAIN_BY_YEAR: Record<number, number> = { 2027: 0.9, 2028: 1.06, 2029: 0.96 }
const HEAT_BY_YEAR: Record<number, number> = { 2027: 0.4, 2028: 0.1, 2029: 0.3 }

function wave(lon: number, lat: number, f: number) {
  return (
    Math.sin(lon * 1.9 + lat * 1.3 + f) * 0.45 +
    Math.sin(lon * 4.7 - lat * 3.9 + f * 1.7) * 0.3 +
    Math.sin(lon * 11.3 + lat * 9.1 - f) * 0.15 +
    Math.sin(lon * 31 - lat * 23 + f * 2.3) * 0.1
  )
}
export function usualRain(p: Point, m: number) {
  const x = m % 12
  const west = clamp((123.2 - p.lon) / 1.6, 0, 1) * clamp((p.lat - 8) / 2, 0, 1)
  const south = clamp((9.5 - p.lat) / 2, 0, 1)
  let r = RAIN_EAST[x] + (RAIN_WEST[x] - RAIN_EAST[x]) * west
  r += (RAIN_SOUTH[x] - r) * south
  return r * (1 + 0.12 * wave(p.lon, p.lat, 1))
}
export function usualTemp(p: Point, m: number) {
  const x = m % 12
  const cool = x === 11 || x <= 1
  return 27.3 + TEMP_SHIFT[x] - (cool ? 0.12 * (p.lat - 12) : 0) + 0.3 * wave(p.lon, p.lat, 5)
}
/* the sample outlook: a drier, warmer next dry season (Dec 2026 – May 2027), then close to usual */
function isDry2027(m: number) {
  const y = Math.floor(m / 12)
  const x = m % 12
  return (x === 11 && y === 2026) || (x <= 4 && y === 2027)
}
function rainAnom(m: number) {
  return isDry2027(m) ? 0.68 : (RAIN_BY_YEAR[Math.floor(m / 12)] ?? 1)
}
function tempAnom(m: number) {
  return isDry2027(m) ? 0.7 : (HEAT_BY_YEAR[Math.floor(m / 12)] ?? 0)
}
export function rainAt(p: Point, m: number) {
  return usualRain(p, m) * rainAnom(m) * (1 + 0.06 * wave(p.lon, p.lat, m * 0.7))
}
export function tempAt(p: Point, m: number) {
  return usualTemp(p, m) + tempAnom(m) + 0.15 * wave(p.lon, p.lat, m * 0.5 + 2)
}
/* half of last month's rain is still in the ground */
export function waterAt(p: Point, m: number) {
  return rainAt(p, m) + 0.5 * rainAt(p, m - 1)
}

export function rainWord(r: number) {
  return r < 0.6 ? 'much less than usual' : r < 0.85 ? 'less than usual' : r < 1.15 ? 'about usual' : r < 1.4 ? 'more than usual' : 'much more than usual'
}
export function heatWord(d: number) {
  return Math.abs(d) < 0.2 ? 'About usual' : Math.abs(d).toFixed(1) + '° ' + (d > 0 ? 'warmer' : 'cooler') + ' than usual'
}
/* the two months before m, what the soil holds in m */
export function recentRain(p: Point, m: number) {
  return (rainAt(p, m - 1) + rainAt(p, m - 2)) / 2
}
export const SOIL_WORDS = ['Dry', 'Moist', 'Wet']
export const PLANT_WORDS = ['Bare', 'Patchy', 'Green']
export function soilLevel(r: number) {
  return r < 60 ? 0 : r < 150 ? 1 : 2
}
/* how green the plants are now, 0 bare to 1 green: made up from the water in the soil and this month's heat */
const GREEN_RAIN_MM = 400
const GREEN_HOT_C = 28.5
export function greenAt(p: Point, m: number) {
  return clamp(recentRain(p, m) / GREEN_RAIN_MM - Math.max(0, tempAt(p, m) - GREEN_HOT_C) * 0.2 + 0.08 * wave(p.lon, p.lat, 9), 0, 1)
}
export function plantLevel(g: number) {
  return g < 0.35 ? 0 : g < 0.65 ? 1 : 2
}
export function rainRatio(p: Point, a: number, b: number) {
  return avg(a, b, (m) => rainAt(p, m)) / avg(a, b, (m) => usualRain(p, m))
}
export function ratioOver(pts: Point[], a: number, b: number) {
  return meanOf(pts, (p) => rainRatio(p, a, b))
}
export function heatOver(pts: Point[], a: number, b: number) {
  return meanOf(pts, (p) => avg(a, b, (m) => tempAt(p, m)))
}
