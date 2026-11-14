/* The short read under the crop calendar: a few checks (heat, rain, land, a backup month), each with a plain verdict,
   and one lead sentence built from them. Numbers in, words out; no UI here. */
import { band, cropFit, landBand, type Crop, type CropWeather, type Fit } from './crops'
import { MON, MONTH_FULL, yearOf, type Span } from './dates'
import type { Month } from './growing'
import type { Place } from './places'

const MONTHS_A_YEAR = 12 /* ECOCROP's rain is a year's; a month gets a twelfth */
const BACKUP_MAX = 2 /* backup months named in the check */

export type Status = 'good' | 'watch' | 'bad'
export type CheckKey = 'heat' | 'rain' | 'land' | 'backup'
/* note: how the check reads inside the lead sentence when it's something to watch ("dry in Feb") */
export type Check = { k: CheckKey; label: string; status: Status; verdict: string; detail: string; note: string }
export type Brief = { lead: string; checks: Check[] }

const r0 = (v: number) => Math.round(v)
const short = (m: number) => MON[m % 12]
const full = (m: number) => MONTH_FULL[m % 12]
const withYear = (m: number) => MON[m % 12] + ' ' + yearOf(m)
const span = (lo: number, hi: number, unit: string) => (r0(lo) === r0(hi) ? r0(lo) + unit : r0(lo) + '–' + r0(hi) + unit)
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
/* "Feb", "Jan and Feb", "Jan–Mar" for a run, else "3 months" */
function monthsWord(ms: number[]) {
  if (ms.length === 1) return short(ms[0])
  if (ms.length === 2) return short(ms[0]) + ' and ' + short(ms[1])
  const isRun = ms.every((m, i) => i === 0 || m === ms[i - 1] + 1)
  return isRun ? short(ms[0]) + '–' + short(ms[ms.length - 1]) : ms.length + ' months'
}

type Known = { m: number; v: number }
function known(months: Month[], key: 'rain' | 'heat'): Known[] {
  return months.flatMap((x) => (x[key] === null ? [] : [{ m: x.m, v: x[key] as number }]))
}
function pick(xs: Known[], highest: boolean) {
  return xs.reduce((best, x) => ((highest ? x.v > best.v : x.v < best.v) ? x : best))
}
function check(k: CheckKey, label: string, status: Status, verdict: string, detail: string, note = lower(verdict)): Check {
  return { k, label, status, verdict, detail, note }
}

/* heat: inside the best range all season, a hot or cool spell, or past what the crop can take */
function heatCheck(c: Crop, months: Month[]): Check | null {
  const hs = known(months, 'heat')
  if (!hs.length) return null
  const [lo, a, b, hi] = c.heat
  const cool = pick(hs, false)
  const warm = pick(hs, true)
  const season = span(cool.v, warm.v, '°C')
  const likes = 'it likes ' + a + '–' + b + '°C'
  if (warm.v >= hi) return check('heat', 'Heat', 'bad', 'Too hot in ' + short(warm.m), full(warm.m) + ' reaches ' + r0(warm.v) + '°C, past the ' + hi + '°C it can take.')
  if (cool.v <= lo) return check('heat', 'Heat', 'bad', 'Too cold in ' + short(cool.m), full(cool.m) + ' drops to ' + r0(cool.v) + '°C, under the ' + lo + '°C it can take.')
  const hot = hs.filter((x) => x.v > b).map((x) => x.m)
  const cold = hs.filter((x) => x.v < a).map((x) => x.m)
  if (hot.length) return check('heat', 'Heat', 'watch', 'Hot in ' + monthsWord(hot), season + ' over the season; ' + likes + '. Water well in the heat.')
  if (cold.length) return check('heat', 'Heat', 'watch', 'Cool in ' + monthsWord(cold), season + ' over the season; ' + likes + ', so it may grow slower.')
  return check('heat', 'Heat', 'good', 'Just right', season + ' all season; ' + likes + '.')
}

/* rain: in the range it likes, short (water it), or heavy (drain it); a paddy is grown flooded, so heavy rain is fine */
function rainCheck(c: Crop, months: Month[]): Check | null {
  const rs = known(months, 'rain')
  if (!rs.length) return null
  const [lo, a, b, hi] = c.rain.map((x) => x / MONTHS_A_YEAR)
  const avg = rs.reduce((s, x) => s + x.v, 0) / rs.length
  const likes = 'it likes ' + r0(a) + '–' + r0(b) + ' mm a month'
  const dry = rs.filter((x) => x.v < a)
  const wet = c.paddy ? [] : rs.filter((x) => x.v > b)
  if (dry.length) {
    const driest = pick(dry, false)
    const isBad = driest.v <= lo || dry.length * 2 > rs.length
    return check('rain', 'Rain', isBad ? 'bad' : 'watch', 'Dry in ' + monthsWord(dry.map((x) => x.m)), full(driest.m) + ' gets about ' + r0(driest.v) + ' mm; ' + likes + '. Plan to water then.')
  }
  if (wet.length) {
    const wettest = pick(wet, true)
    return check('rain', 'Rain', wettest.v >= hi ? 'bad' : 'watch', 'Very wet in ' + monthsWord(wet.map((x) => x.m)), full(wettest.m) + ' gets about ' + r0(wettest.v) + ' mm; ' + likes + '. Dig drains or plant on raised beds.')
  }
  if (c.paddy && avg > b) return check('rain', 'Rain', 'good', 'Plenty', 'About ' + r0(avg) + ' mm a month, more than the ' + r0(a) + '–' + r0(b) + ' mm it likes. Fine for a flooded paddy.')
  return check('rain', 'Rain', 'good', 'Just right', 'About ' + r0(avg) + ' mm a month; ' + likes + '.')
}

/* land: FAO's long-run rating of how well the land suits the crop; no row without a rating */
function landCheck(r: Fit): Check | null {
  const lb = landBand(r.land)
  if (!lb) return null
  const name = r.c.n.toLowerCase()
  if (lb === 'good') return check('land', 'Land', 'good', 'Suits it well', 'FAO rates the land here good for ' + name + '.')
  if (lb === 'fair') return check('land', 'Land', 'watch', 'Only fair', 'FAO rates the land here fair for ' + name + '. Expect a smaller harvest than on the best land.', 'land that’s only fair for it')
  return check('land', 'Land', 'bad', 'Poor for it', 'FAO rates the land here poor for ' + name + '. A crop that suits the land may do better.', 'poor land for it')
}

/* a backup: the other good months to start in the dates, the nearest to the best first */
function backupCheck(wx: CropWeather, place: Place, r: Fit, w: Span): Check | null {
  if (band(r.score) !== 'good') return null
  const others = Array.from({ length: w.b - w.a + 1 }, (_, i) => w.a + i)
    .filter((pm) => pm !== r.pm && band(cropFit(wx, place, r.c, pm).score) === 'good')
    .sort((x, y) => Math.abs(x - r.pm) - Math.abs(y - r.pm))
  if (!others.length) return check('backup', 'Backup', 'watch', 'No other month', 'It’s the only good month to start in your dates. Get the land ready before it.')
  const named = others.slice(0, BACKUP_MAX).sort((x, y) => x - y)
  const more = others.length - named.length
  const rest = more ? ' ' + more + ' more good ' + (more === 1 ? 'month' : 'months') + ' in your dates.' : ''
  return check('backup', 'Backup', 'good', 'Also good: ' + named.map(withYear).join(', '), 'If you miss ' + full(r.pm) + '.' + rest)
}

/* one sentence: the verdict first, then what to watch, by name */
function leadFor(r: Fit, checks: Check[]) {
  const name = r.c.n.toLowerCase()
  const weather = checks.filter((x) => x.k === 'heat' || x.k === 'rain')
  const watch = checks.filter((x) => x.k !== 'backup' && x.status !== 'good').map((x) => x.note)
  const watchText = watch.length ? ' Watch for ' + watch.join(', ') + '.' : ''
  if (band(r.score) === 'poor') return 'No month in your dates suits ' + name + ' well; ' + full(r.pm) + ' is the least risky.' + watchText
  const isSkyGood = weather.length > 0 && weather.every((x) => x.status === 'good')
  const sky = isSkyGood ? 'the heat and rain ' + name + ' needs from planting to harvest' : 'the best weather for ' + name + ' in your dates'
  return full(r.pm) + ' gives ' + sky + '.' + watchText
}

export function briefFor(wx: CropWeather, place: Place, r: Fit, w: Span, months: Month[]): Brief {
  const checks = [heatCheck(r.c, months), rainCheck(r.c, months), landCheck(r), backupCheck(wx, place, r, w)].filter((x): x is Check => x !== null)
  return { lead: leadFor(r, checks), checks }
}
