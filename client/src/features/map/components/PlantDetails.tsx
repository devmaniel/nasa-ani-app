import { BAND, band, cropFit, harvestMonth, landText, readyIn, slopeText, type Crop, type CropWeather, type Fit } from '../crops'
import { mName, MONTH_FULL, type Span } from '../dates'
import { GAEZ_CROP } from '../land'
import { likes, round, type Month } from '../growing'
import type { Place } from '../places'

const GAEZ_TOP = 10000

type Mark = 'good' | 'dry' | 'wet' | 'cool' | 'hot'
const MARK_WORD: Record<Mark, string> = { good: 'Just right', dry: 'Dry', wet: 'Very wet', cool: 'Cool', hot: 'Hot' }

const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many)

/* the month with the lowest or highest value, null when no month has a number */
function extreme(months: Month[], key: 'rain' | 'heat', highest: boolean) {
  const known = months.flatMap((x) => (x[key] === null ? [] : [{ m: x.m, v: x[key] as number }]))
  if (!known.length) return null
  return known.reduce((best, x) => ((highest ? x.v > best.v : x.v < best.v) ? x : best))
}

/* how a month's numbers sit against the crop's best range (heat first: it's the harder limit) */
function markOf(c: Crop, x: Month): Mark | null {
  if (x.rain === null || x.heat === null) return null
  const l = likes(c)
  if (x.heat < l.heat[0]) return 'cool'
  if (x.heat > l.heat[1]) return 'hot'
  if (x.rain < l.rain[0]) return 'dry'
  if (x.rain > l.rain[1] && !c.paddy) return 'wet'
  return 'good'
}

function MonthTable({ c, months }: { c: Crop; months: Month[] }) {
  return (
    <table className="wtp-tbl">
      <thead><tr><th scope="col">Month</th><th scope="col">Rain</th><th scope="col">Heat</th><th scope="col">For {c.n.toLowerCase()}</th></tr></thead>
      <tbody>
        {months.map((x) => {
          const mk = markOf(c, x)
          return (
            <tr key={x.m}>
              <th scope="row" className="num">{mName(x.m)}</th>
              <td className="num">{x.rain === null ? '—' : round(x.rain) + ' mm'}</td>
              <td className="num">{x.heat === null ? '—' : round(x.heat) + '°C'}</td>
              <td>{mk ? <span className="wtp-mark" data-mark={mk}>{MARK_WORD[mk]}</span> : 'No numbers'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* heat: its best and its limits, then the coolest and warmest growing months here */
function HeatRead({ c, months }: { c: Crop; months: Month[] }) {
  const [lo, a, b, hi] = c.heat
  const cool = extreme(months, 'heat', false)
  const warm = extreme(months, 'heat', true)
  const off = months.filter((x) => x.heat !== null && (x.heat < a || x.heat > b)).length
  return (
    <>
      <p>{c.n} grows best when a month averages <b className="num">{a}–{b}°C</b>. FAO puts its limits at {lo}°C and {hi}°C.</p>
      {cool && warm && (
        <p>
          Here the coolest growing month is {MONTH_FULL[cool.m % 12]} at <b className="num">{round(cool.v)}°C</b>, the warmest {MONTH_FULL[warm.m % 12]} at <b className="num">{round(warm.v)}°C</b>.{' '}
          {off === 0 ? 'Every growing month sits inside its best range.' : plural(off, 'month falls', 'months fall') + ' outside its best range.'}
        </p>
      )}
    </>
  )
}

/* rain: what the whole season needs, what falls here, and the driest and wettest months */
function RainRead({ c, months }: { c: Crop; months: Month[] }) {
  const l = likes(c)
  const known = months.filter((x) => x.rain !== null)
  const total = known.reduce((s, x) => s + (x.rain ?? 0), 0)
  const dry = extreme(months, 'rain', false)
  const wet = extreme(months, 'rain', true)
  return (
    <>
      <p>
        {c.n} likes <b className="num">{round(l.rain[0])}–{round(l.rain[1])} mm</b> of rain a month, about {round(l.rain[0] * c.months)}–{round(l.rain[1] * c.months)} mm over its {plural(c.months, 'month', 'months')} in the ground.
        {c.paddy && ' It grows in a flooded field, so heavy rain doesn’t count against it.'}
      </p>
      {dry && wet && (
        <p>
          Here about <b className="num">{round(total)} mm</b> falls over {known.length === months.length ? 'those months' : 'the months with numbers'}.
          The driest is {MONTH_FULL[dry.m % 12]} ({round(dry.v)} mm), the wettest {MONTH_FULL[wet.m % 12]} ({round(wet.v)} mm).
        </p>
      )}
    </>
  )
}

/* every month in the dates as a planting month, so the person sees the other good ones, not just the best */
function OtherMonths({ wx, place, r, w }: { wx: CropWeather; place: Place; r: Fit; w: Span }) {
  const starts = Array.from({ length: w.b - w.a + 1 }, (_, i) => cropFit(wx, place, r.c, w.a + i))
  const good = starts.filter((x) => band(x.score) === 'good').length
  return (
    <>
      <p>{good ? plural(good, 'month', 'months') + ' in your dates ' + (good === 1 ? 'is' : 'are') + ' good to plant.' : 'No month in your dates is a good time to plant.'} The best is marked.</p>
      <ul className="wtp-mos">
        {starts.map((x) => {
          const bd = band(x.score)
          return (
            <li key={x.pm} className="wtp-mo" data-band={bd} data-best={x.pm === r.pm ? '' : undefined}>
              <b className="num">{mName(x.pm)}</b>
              <span>{x.pm === r.pm ? 'Best' : BAND[bd]}</span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/* land and ground: FAO's long-run land rating, and what the slope means for the crop */
function LandRead({ r, slope }: { r: Fit; slope: number | null }) {
  const ground = slopeText(r.c, slope)
  return (
    <>
      <p>
        {landText(r) ?? (GAEZ_CROP[r.c.n] ? 'No land rating here from FAO.' : 'FAO has no land rating for ' + r.c.n.toLowerCase() + '.')}
        {r.land !== null && <> FAO rates this land <b className="num">{round(r.land).toLocaleString()} of {GAEZ_TOP.toLocaleString()}</b> for {r.c.n.toLowerCase()} (rain-fed, low inputs, 1981–2010).</>}
      </p>
      {slope !== null && <p>The ground here slopes about <b className="num">{round(slope)}%</b>.{ground && ' ' + ground}</p>}
    </>
  )
}

/* the deep read under "More details": month by month, heat, rain, other planting months, land, timing, and where it all comes from */
export function PlantDetails({ wx, place, r, w, months, slope }: { wx: CropWeather; place: Place; r: Fit; w: Span; months: Month[]; slope: number | null }) {
  return (
    <>
      <h4 className="wtp-h4">Month by month</h4>
      <MonthTable c={r.c} months={months} />
      <h4 className="wtp-h4">Heat</h4>
      <HeatRead c={r.c} months={months} />
      <h4 className="wtp-h4">Rain</h4>
      <RainRead c={r.c} months={months} />
      <h4 className="wtp-h4">Other months to plant</h4>
      <OtherMonths wx={wx} place={place} r={r} w={w} />
      <h4 className="wtp-h4">Land and ground</h4>
      <LandRead r={r} slope={slope} />
      <h4 className="wtp-h4">Timing</h4>
      <p>{readyIn(r.c)} Planted in {MONTH_FULL[r.pm % 12]}, it should be ready around {MONTH_FULL[harvestMonth(r) % 12]}.</p>
      <h4 className="wtp-h4">How it&rsquo;s rated</h4>
      <p>The rain and heat over the growing months count most, with extra weight on the hardest month. FAO&rsquo;s land rating counts for the rest. Land FAO rates poor is never more than &ldquo;Plant with care&rdquo;.</p>
      <p className="wtp-src">Rain and heat: NASA weather. What the crop needs: FAO ECOCROP. Land: FAO GAEZ. Slope: NASA SRTM, else FAO GAEZ.</p>
    </>
  )
}
