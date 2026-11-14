/* small helpers for the weather numbers, and the words they are shown with */
export type Point = { lon: number; lat: number }

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v
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

export function rainWord(r: number) {
  return r < 0.6 ? 'much less than usual' : r < 0.85 ? 'less than usual' : r < 1.15 ? 'about usual' : r < 1.4 ? 'more than usual' : 'much more than usual'
}
export function heatWord(d: number) {
  return Math.abs(d) < 0.2 ? 'About usual' : Math.abs(d).toFixed(1) + '° ' + (d > 0 ? 'warmer' : 'cooler') + ' than usual'
}
/* d: humidity minus the usual, in % */
export function humidWord(d: number) {
  return Math.abs(d) < 3 ? 'About usual' : (d > 0 ? 'Damper' : 'Drier') + ' air than usual'
}
/* r: sunlight against the usual */
export function sunWord(r: number) {
  return r < 0.9 ? 'Cloudier than usual' : r > 1.1 ? 'Sunnier than usual' : 'About usual'
}
export const SOIL_WORDS = ['Dry', 'Moist', 'Wet']
/* NASA's root-zone wetness (0 dry to 1 soaked): under SOIL_MOIST is Dry, from SOIL_WET up is Wet (where the map turns green) */
const SOIL_MOIST = 0.5
const SOIL_WET = 0.7
export function soilLevel(v: number) {
  return v < SOIL_MOIST ? 0 : v < SOIL_WET ? 1 : 2
}
