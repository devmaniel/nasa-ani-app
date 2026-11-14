/* Time: from 1981 (NASA's oldest monthly numbers) to three years ahead. A month is counted as year * 12 + month. */
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const NOW = new Date()
export const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())
export const DAY_MS = 864e5
export const AHEAD_MONTHS = 36
export const LESS_SURE_AFTER = 12
export const DEFAULT_MONTHS = 12

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
export const PAST_FROM = new Date(1981, 0, 1) /* NASA POWER's measured monthly numbers start in January 1981 */

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
export function isDefaultDates(d: Dates) {
  return +d.from === +TODAY && +d.to === +lengthEnd(TODAY, DEFAULT_MONTHS)
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
