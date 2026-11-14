import { Cloud, Sprout, Sun } from 'lucide-react'
import { TbRipple } from 'react-icons/tb'
import type { ReactNode } from 'react'
import { heatWord, meanOf, pct, rainWord, SOIL_WORDS, type Point } from '../climate'
import type { Kind, MapLayer } from '../climateLayer'
import { fromWord, fmtY, lengthWord, M0, MON, mName, seasonsIn, SEASON_NAME, yearOf, type Dates, type Span } from '../dates'
import { barsEnd, type Weather } from '../hooks/useWeather'
import { GROUPS, REGIONS, type Place } from '../places'
import type { IconType, LayerKey } from '../types'
import { RainBars } from './RainBars'
import { Level, Meter } from './Parts'

const RAIN_HEADROOM = 1.25
/* NASA's root-zone wetness (0 dry to 1 soaked): under SOIL_MOIST is Dry, from SOIL_WET up is Wet (where the map turns green) */
const SOIL_MOIST = 0.5
const SOIL_WET = 0.7

/* a month of one layer, averaged over the points: its value, NASA's usual, and where the value comes from */
type Row = { m: number; v: number; usual: number; kind: Kind }
type LayerProps = { layer: LayerKey | null; onTile: (l: LayerKey) => void }
type PanelProps = LayerProps & { wx: Weather; w: Span; dates: Dates }

const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i)
/* measured or forecast, not just NASA's usual */
const isReal = (r: Row) => r.kind !== 'usual'
const noData = (m: number) => (m < M0 ? 'Not measured yet' : 'No forecast yet')

/* a layer month by month from a to b, averaged over the points (a month still loading is left out) */
function rowsOf(wx: Weather, layer: MapLayer, pts: Point[], a: number, b: number): Row[] {
  return range(a, b).flatMap((m) => {
    const vs = pts.flatMap((p) => {
      const x = wx.at(layer, p, m)
      return x ? [x] : []
    })
    return vs.length ? [{ m, v: meanOf(vs, (x) => x.v), usual: meanOf(vs, (x) => x.usual), kind: vs[0].kind }] : []
  })
}
/* the months with data, or all of them (NASA's usual) when none has */
function withData(rows: Row[]) {
  const real = rows.filter(isReal)
  return real.length ? real : rows
}
/* the rain against a usual year over the months with data ("likely" when it's a forecast), null when none has */
function outlook(rows: Row[]) {
  const real = rows.filter(isReal)
  if (!real.length) return null
  const ratio = real.reduce((s, r) => s + r.v, 0) / real.reduce((s, r) => s + r.usual, 0)
  return (real.some((r) => r.kind === 'forecast') ? 'likely ' : '') + rainWord(ratio)
}
/* where the numbers come from, and how many of the months have them */
function sourceLine(rain: Row[], scope: string) {
  const real = rain.filter(isReal)
  if (!real.length) return 'The map shows NASA\'s usual for these months'
  const past = real.some((r) => r.kind === 'past')
  const ahead = real.some((r) => r.kind === 'forecast')
  const what = past && ahead ? 'Measured and forecast' : past ? 'Measured by NASA' : 'Forecast'
  const cover = real.length < rain.length ? ' · ' + real.length + ' of ' + rain.length + ' months have data' : ''
  return what + ' for ' + scope + ', compared with a usual year' + cover
}

/* the season card: how long the dates are, the rain outlook, then the seasons in them */
function Summary({ rain, w, dates, scope }: { rain: Row[]; w: Span; dates: Dates; scope: string }) {
  const list = seasonsIn(w.a, w.b)
  return (
    <div className="sum">
      <p className="sum-t"><b>Your dates</b><span className="num">{lengthWord(dates)}</span></p>
      <p className="sum-n num">
        {fromWord(dates)} to {fmtY(dates.to)} · {list.length}{list.length === 1 ? ' season' : ' seasons'}
      </p>
      <p className="sum-r">
        <Cloud className="i" />
        <span>
          Rain across your dates: {outlook(rain) ?? noData(w.a).toLowerCase()}
          <small>{sourceLine(rain, scope)}</small>
        </span>
      </p>
      <details className="rest">
        <summary>Seasons in your dates · {list.length}</summary>
        <ol className="seas">
          {list.map((sg) => {
            const when = sg.a === sg.b
              ? mName(sg.a)
              : MON[sg.a % 12] + (yearOf(sg.a) !== yearOf(sg.b) ? ' ' + yearOf(sg.a) : '') + ' – ' + mName(sg.b)
            const o = outlook(rain.filter((r) => r.m >= sg.a && r.m <= sg.b))
            return (
              <li key={sg.a}>
                <b>{SEASON_NAME[sg.k]}</b>
                <span className="num">{when}</span>
                <small>{o ? 'Rain ' + o : noData(sg.a)}</small>
              </li>
            )
          })}
        </ol>
      </details>
    </div>
  )
}

function Tile({ l, ic: Ic, label, layer, onTile, children }: LayerProps & { l: LayerKey; ic: IconType; label: string; children: ReactNode }) {
  return (
    <button className="tile" type="button" data-tile={l} data-layer={l} aria-pressed={layer === l} onClick={() => onTile(l)}>
      <span className="tl"><Ic className="i" aria-hidden />{label}</span>
      {children}
    </button>
  )
}

/* four tiles (rain, heat, soil, plants) over the months with data, for one place or the average of the regions; a tile shows its layer */
function Tiles({ wx, pts, rain, w, ...lp }: LayerProps & { wx: Weather; pts: Point[]; rain: Row[]; w: Span }) {
  const rr = withData(rain)
  const hr = withData(rowsOf(wx, 'heat', pts, w.a, w.b))
  const soil = rowsOf(wx, 'soil', pts, M0, M0).at(0)
  const r = meanOf(rr, (x) => x.v)
  const usual = meanOf(rr, (x) => x.usual)
  const t = meanOf(hr, (x) => x.v)
  const tu = meanOf(hr, (x) => x.usual)
  const top = Math.max(r, usual) * RAIN_HEADROOM
  const real = rr.some(isReal)
  const kick = !real ? 'Your dates · ' + noData(w.a).toLowerCase() + ', so the usual'
    : rr.length === rain.length ? (w.a === w.b ? 'This month' : 'Across your dates')
    : rr.length === 1 ? 'In ' + mName(rr[0].m) + ', the month with data' : 'Across the ' + rr.length + ' months with data'
  const level = soil ? (soil.v < SOIL_MOIST ? 0 : soil.v < SOIL_WET ? 1 : 2) : 0
  return (
    <>
      <p className="kick">{kick}</p>
      <div className="tiles">
        <Tile l="rain" ic={Cloud} label="Rain" {...lp}>
          <span className="tv num">{Math.round(r)} <small>mm a month</small></span>
          <Meter v={pct(r / top)} u={pct(usual / top)} />
          <span className="tc num">Usual {Math.round(usual)} mm · {real ? rainWord(r / usual) : 'no data yet'}</span>
        </Tile>
        <Tile l="heat" ic={Sun} label="Heat" {...lp}>
          <span className="tv num">{t.toFixed(1)} <small>°C</small></span>
          <span className="tc">{hr.some(isReal) ? heatWord(t - tu) : 'The usual · no data yet'}</span>
        </Tile>
        <Tile l="soil" ic={TbRipple} label="Soil now" {...lp}>
          <span className="tv">{soil ? SOIL_WORDS[level] : '–'} {soil && <small className="num">{Math.round(soil.v * 100)}% wet</small>}</span>
          <Level n={level} />
          <span className="tc">{soil?.kind === 'usual' ? 'Water in the ground: NASA\'s usual for ' + MON[M0 % 12] : 'Water in the ground: NASA, with the forecast rain'}</span>
        </Tile>
        <Tile l="plants" ic={Sprout} label="Plants now" {...lp}>
          <span className="tv">On the map</span>
          <span className="tc">NASA&rsquo;s satellite picture of how green the land is</span>
        </Tile>
      </div>
    </>
  )
}

/* the season card, the tiles and the rain chart for some points */
function Panel({ pts, scope, wx, w, dates, ...lp }: PanelProps & { pts: Point[]; scope: string }) {
  const bars = rowsOf(wx, 'rain', pts, w.a, barsEnd(w))
  const rain = bars.filter((r) => r.m <= w.b)
  return (
    <>
      <section><Summary rain={rain} w={w} dates={dates} scope={scope} /></section>
      <section>
        <Tiles wx={wx} pts={pts} rain={rain} w={w} {...lp} />
        <RainBars rows={bars.map((r) => ({ m: r.m, rain: isReal(r) ? r.v : null, usual: r.usual, kind: r.kind }))} w={w} />
      </section>
    </>
  )
}

export function PlaceWeather({ place, ...p }: PanelProps & { place: Place }) {
  return <Panel pts={[place]} scope="this place" {...p} />
}

export function CountryWeather(p: PanelProps) {
  const { wx, w } = p
  return (
    <>
      <Panel pts={REGIONS} scope="the whole country" {...p} />
      <section>
        <p className="kick">By island group</p>
        <ol className="seas">
          {GROUPS.map((g) => {
            const o = outlook(rowsOf(wx, 'rain', g.pts, w.a, w.b))
            const heat = withData(rowsOf(wx, 'heat', g.pts, w.a, w.b))
            return (
              <li key={g.n}>
                <b>{g.n}</b>
                <span className="num">{meanOf(heat, (x) => x.v).toFixed(1)} °C</span>
                <small>{o ? 'Rain ' + o : noData(w.a)}</small>
              </li>
            )
          })}
        </ol>
      </section>
    </>
  )
}
