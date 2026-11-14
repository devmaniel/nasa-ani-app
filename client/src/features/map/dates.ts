/* Time: from 1981 (NASA's oldest monthly numbers) to three years ahead. A month is counted as year * 12 + month. */
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const NOW = new Date()
export const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())
export const DAY_MS = 864e5
export const AHEAD_MONTHS = 36
export const LESS_SURE_AFTER = 12

export function monthIndex(d: Date) {
  return d.getFullYear() * 12 + d.getMonth()
}
export function monthEnd(m: number) {
  return new Date(Math.floor(m / 12), (m % 12) + 1, 0)
}
export function mName(m: number) {
  return MON[m % 12] + ' ' + Math.floor(m / 12)
}
export function yearOf(m: number) {
  return Math.floor(m / 12)
}
export function fmtY(d: Date) {
  return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear()
}
export function iso(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
export function parseIso(v: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}

export const M0 = monthIndex(TODAY)
export const MAX_END = monthEnd(M0 + AHEAD_MONTHS)

export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
export function addMonths(d: Date, n: number) {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last))
}
/* the last day of a length that starts on from */
export function lengthEnd(from: Date, months: number) {
  const d = addDays(addMonths(from, months), -1)
  return d > MAX_END ? MAX_END : d
}
export function isLessSure(m: number) {
  return m - M0 > LESS_SURE_AFTER
}

/* The chosen dates, and the months they cover */
export type Dates = { from: Date; to: Date }
export type Span = { a: number; b: number }

export function spanOf(d: Dates): Span {
  return { a: monthIndex(d.from), b: monthIndex(d.to) }
}
export function fromWord(d: Dates) {
  return +d.from === +TODAY ? 'Today' : fmtY(d.from)
}
const DAYS_UNDER = 28
const MONTH_DAYS = 30.44
/* a length under DAYS_UNDER days is said in days, longer in months */
export function lengthWord(d: Dates) {
  const days = Math.round((+d.to - +d.from) / DAY_MS) + 1
  const months = Math.round(days / MONTH_DAYS)
  return days < DAYS_UNDER ? days + (days === 1 ? ' day' : ' days') : months + (months === 1 ? ' month' : ' months')
}
/* the dates the map opens with: today to the end of this planting season */
export const defaultDates = (): Dates => seasonChoices(1)[0].dates
export function isDefaultDates(d: Dates) {
  const now = defaultDates()
  return +d.from === +now.from && +d.to === +now.to
}

/* The planting seasons the dates are picked by: Rainy (June to November) and Dry (December to May).
   The weather seasons below (wet, cool dry, hot dry) still describe the weather inside them. */
export type PlantSeasonKey = 'rainy' | 'dry'
export const PLANT_SEASON_NAME: Record<PlantSeasonKey, string> = { rainy: 'Rainy season', dry: 'Dry season' }
const RAINY_FIRST = 5 /* June */
const RAINY_LAST = 10 /* November */
export function plantSeasonKey(m: number): PlantSeasonKey {
  const x = m % 12
  return x >= RAINY_FIRST && x <= RAINY_LAST ? 'rainy' : 'dry'
}
function plantSeasonEnd(m: number) {
  let e = m
  while (plantSeasonKey(e + 1) === plantSeasonKey(m)) e++
  return e
}
export type SeasonChoice = { k: PlantSeasonKey; a: number; b: number; isNow: boolean; dates: Dates }
/* the dates dropdown's choices: the rest of this season (from today), then the whole seasons after it */
export function seasonChoices(count: number): SeasonChoice[] {
  const out: SeasonChoice[] = []
  let a = M0
  while (out.length < count && monthEnd(a - 1) < MAX_END) {
    const b = plantSeasonEnd(a)
    const end = monthEnd(b)
    const isNow = a === M0
    out.push({ k: plantSeasonKey(a), a, b, isNow, dates: { from: isNow ? TODAY : new Date(yearOf(a), a % 12, 1), to: end > MAX_END ? MAX_END : end } })
    a = b + 1
  }
  return out
}

/* Seasons (the usual Philippine calendar) */
export type SeasonKey = 'wet' | 'cool' | 'hot'
export const SEASON_NAME: Record<SeasonKey, string> = { wet: 'Wet season', cool: 'Cool dry season', hot: 'Hot dry season' }

export function seasonKey(m: number): SeasonKey {
  const x = m % 12
  return x >= 5 && x <= 10 ? 'wet' : x === 11 || x <= 1 ? 'cool' : 'hot'
}
export type SeasonRun = { k: SeasonKey; a: number; b: number }
export function seasonsIn(a: number, b: number) {
  const out: SeasonRun[] = []
  for (let m = a; m <= b; m++) {
    const k = seasonKey(m)
    const last = out[out.length - 1]
    if (last && last.k === k) out[out.length - 1] = { ...last, b: m }
    else out.push({ k, a: m, b: m })
  }
  return out
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
/* the last day of the season that from falls in (seasons: 1), or of a later one (2: the next season too); never past MAX_END */
export function seasonEndDate(from: Date, seasons = 1) {
  let m = seasonEnd(monthIndex(from))
  for (let i = 1; i < seasons; i++) m = seasonEnd(m + 1)
  const d = monthEnd(m)
  return d > MAX_END ? MAX_END : d
}
