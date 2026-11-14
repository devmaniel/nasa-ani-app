import { Cloud, CloudSun, Droplets, LandPlot, Mountain, Satellite, Sprout, Sun } from 'lucide-react'
import { TbRipple } from 'react-icons/tb'
import type { ReactNode } from 'react'
import { heatWord, humidWord, meanOf, pct, rainWord, SOIL_WORDS, soilLevel, sunWord, type Point } from '../climate'
import type { Kind, MapLayer } from '../climateLayer'
import { fromWord, fmtY, lengthWord, M0, MON, mName, seasonsIn, SEASON_NAME, yearOf, type Dates, type Span } from '../dates'
import { barsEnd, type Weather } from '../hooks/useWeather'
import { CROPS, landBand } from '../crops'
import { SLOPE_PCT, SLOPE_WORDS, type Land } from '../land'
import type { AirUsual } from '../api'
import { useAir } from '../hooks/useAir'
import { useSpace } from '../hooks/useSpace'
import { dayWord, greenWord, groundLine, latelyLines, treesLine, type FieldPicture, type Ground, type Lately } from '../space'
import { capFirst, isDim, isHumid, monthsText, runs } from '../report'
import { GROUPS, REGIONS, type Place } from '../places'
import type { IconType, LayerKey } from '../types'
import { RainBars } from './RainBars'
import { Level, Meter } from './Parts'

const RAIN_HEADROOM = 1.25

/* a month of one layer, averaged over the points: its value, NASA's usual, and where the value comes from */
type Row = { m: number; v: number; usual: number; kind: Kind }
/* wv: the months the rain chart shows (the dates, and more on demand); onMore: shows more, missing at the furthest month */
type PanelProps = { wx: Weather; w: Span; wv: Span; onMore?: () => void; dates: Dates }

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

/* a reading, in its layer's colour; only shows numbers (the chips on the map switch the layers) */
function Tile({ l, ic: Ic, label, children }: { l: LayerKey; ic: IconType; label: string; children: ReactNode }) {
  return (
    <div className="tile" data-tile={l} data-layer={l}>
      <span className="tl"><Ic className="i" aria-hidden />{label}</span>
      {children}
    </div>
  )
}

/* one tile per map layer (rain, heat, soil, humidity, sun, plants, fields) over the months with data, for one place or the average of the regions.
   green: NASA VIIRS's plant greenness at one place; fields: the newest clear field photo there;
   air: NASA POWER's usual humidity and sunlight there, for the humid and cloudy months (each null for the country or while it loads) */
function Tiles({ wx, pts, rain, w, green, fields, air }: {
  wx: Weather; pts: Point[]; rain: Row[]; w: Span; green: Lately['green']; fields: FieldPicture | null; air: AirUsual | null
}) {
  const rr = withData(rain)
  const hr = withData(rowsOf(wx, 'heat', pts, w.a, w.b))
  const ur = withData(rowsOf(wx, 'humid', pts, w.a, w.b))
  const sr = withData(rowsOf(wx, 'sun', pts, w.a, w.b))
  const soil = rowsOf(wx, 'soil', pts, M0, M0).at(0)
  const r = meanOf(rr, (x) => x.v)
  const usual = meanOf(rr, (x) => x.usual)
  const t = meanOf(hr, (x) => x.v)
  const tu = meanOf(hr, (x) => x.usual)
  const h = meanOf(ur, (x) => x.v)
  const hu = meanOf(ur, (x) => x.usual)
  const sun = meanOf(sr, (x) => x.v)
  const su = meanOf(sr, (x) => x.usual)
  const humid = air ? runs(w, (m) => isHumid(air, m)).map((g) => monthsText(g.a, g.b)) : []
  const dim = air ? runs(w, (m) => isDim(air, m)).map((g) => monthsText(g.a, g.b)) : []
  const top = Math.max(r, usual) * RAIN_HEADROOM
  const real = rr.some(isReal)
  const one = pts.length === 1
  const kick = !real ? 'Your dates · ' + noData(w.a).toLowerCase() + ', so the usual'
    : rr.length === rain.length ? (w.a === w.b ? 'This month' : 'Across your dates')
    : rr.length === 1 ? 'In ' + mName(rr[0].m) + ', the month with data' : 'Across the ' + rr.length + ' months with data'
  const level = soil ? soilLevel(soil.v) : 0
  return (
    <>
      <p className="kick">{kick}</p>
      <div className="tiles">
        <Tile l="rain" ic={Cloud} label="Rain">
          <span className="tv num">{Math.round(r)} <small>mm a month</small></span>
          <Meter v={pct(r / top)} u={pct(usual / top)} />
          <span className="tc num">Usual {Math.round(usual)} mm · {real ? rainWord(r / usual) : 'no data yet'}</span>
        </Tile>
        <Tile l="heat" ic={Sun} label="Heat">
          <span className="tv num">{t.toFixed(1)} <small>°C</small></span>
          <span className="tc">{hr.some(isReal) ? heatWord(t - tu) : 'The usual · no data yet'}</span>
        </Tile>
        <Tile l="soil" ic={TbRipple} label="Soil now">
          <span className="tv">{soil ? SOIL_WORDS[level] : '–'} {soil && <small className="num">{Math.round(soil.v * 100)}% wet</small>}</span>
          <Level n={level} />
          <span className="tc">{soil?.kind === 'usual' ? 'Water in the ground: NASA\'s usual for ' + MON[M0 % 12] : 'Water in the ground: NASA, with the forecast rain'}</span>
        </Tile>
        <Tile l="humid" ic={Droplets} label="Humidity">
          <span className="tv num">{Math.round(h)}% <small>humidity</small></span>
          <span className="tc num">{ur.some(isReal) ? humidWord(h - hu) + ' · usual ' + Math.round(hu) + '%' : 'The usual · no data yet'}</span>
          {air && <span className="tc num">{humid.length ? 'Humid, fungus spreads easily: ' + humid.join(', ') : 'No very humid months in your dates'}</span>}
        </Tile>
        <Tile l="sun" ic={CloudSun} label="Sun">
          <span className="tv num">{sun.toFixed(1)} <small>MJ/m² a day</small></span>
          <span className="tc num">{sr.some(isReal) ? sunWord(sun / su) + ' · usual ' + su.toFixed(1) : 'The usual · no data yet'}</span>
          {air && <span className="tc num">{dim.length ? 'Less sun, slower growth: ' + dim.join(', ') : 'Plenty of sun through your dates'}</span>}
        </Tile>
        <Tile l="plants" ic={Sprout} label="Plants now">
          <span className="tv">{green ? greenWord(green.v) : 'On the map'} {green && <small className="num">NDVI {green.v.toFixed(2)}</small>}</span>
          <span className="tc">{green ? 'NASA VIIRS, the 8 days to ' + dayWord(green.day) + ' · the map: NASA MODIS' : 'NASA’s satellite picture of how green the land is'}</span>
        </Tile>
        <Tile l="fields" ic={LandPlot} label="Fields">
          <span className="tv num">{fields ? dayWord(fields.day) : one ? 'On the map' : 'Pick a place'} {fields && <small>newest clear photo</small>}</span>
          <span className="tc num">
            {fields ? fields.name + ' · ' + Math.round(fields.cloud) + '% cloud · NASA HLS' : one ? 'The newest clear photo of the fields, from Landsat or Sentinel-2' : 'To see the newest clear photo of your fields'}
          </span>
        </Tile>
      </div>
    </>
  )
}

/* the land under one place: from FAO GAEZ about 25 km around, its slope, height and the crops it suits; from NASA SRTM the exact spot's
   slope and height; from NASA GEDI how tall the trees around are. It has no map layer, so it isn't a button */
function LandTile({ land, ground }: { land: Land | null; ground: Ground | null }) {
  const cls = land && land.slope !== null && SLOPE_WORDS[land.slope] ? land.slope : null
  if (cls === null && !ground) return null
  const good = CROPS.filter((c) => landBand(land?.suit[c.n] ?? null) === 'good').map((c) => c.n.toLowerCase())
  const trees = ground && treesLine(ground)
  return (
    <div className="tile static land">
      <span className="tl"><Mountain className="i" aria-hidden />Land</span>
      {cls !== null && land && (
        <>
          <span className="tv">{capFirst(SLOPE_WORDS[cls])} <small className="num">{SLOPE_PCT[cls]} slope</small></span>
          {land.alt !== null && <span className="tc num">{Math.round(land.alt)} m above the sea</span>}
          <span className="tc">{good.length ? 'Good land for ' + good.join(', ') : 'Not good land for any crop FAO rates'} · FAO GAEZ, about 25 km around</span>
        </>
      )}
      {ground && <span className="tc num">{groundLine(ground)} · NASA SRTM</span>}
      {trees && <span className="tc num">{trees} · NASA GEDI</span>}
    </div>
  )
}

/* the last days at one place, from space: rain over 7 days (NASA IMERG), then the last 30 days (ERA5), the soil now (NASA SMAP)
   and the ground's water in GLDAS's newest month; no map layer, so not a button */
function LatelyTile({ lately }: { lately: Lately | null }) {
  const lines = lately ? latelyLines(lately) : []
  if (!lately || (!lately.rain7 && !lines.length)) return null
  return (
    <div className="tile static lately">
      <span className="tl"><Satellite className="i" aria-hidden />Lately</span>
      {lately.rain7 && <span className="tv num">{Math.round(lately.rain7.mm)} mm <small>of rain in the 7 days to {dayWord(lately.rain7.to)} · NASA IMERG</small></span>}
      {lines.map((l) => <span key={l} className="tc num">{l}</span>)}
    </div>
  )
}

/* the season card, the tiles and the rain chart for some points */
function Panel({ pts, scope, wx, w, wv, onMore, dates }: PanelProps & { pts: Point[]; scope: string }) {
  const bars = rowsOf(wx, 'rain', pts, wv.a, barsEnd(wv))
  const rain = bars.filter((r) => r.m <= w.b)
  const one = pts.length === 1 ? pts[0] : null
  const air = useAir(one)
  const space = useSpace(one)
  return (
    <>
      <section><Summary rain={rain} w={w} dates={dates} scope={scope} /></section>
      <section>
        <Tiles wx={wx} pts={pts} rain={rain} w={w} green={space.lately?.green ?? null} fields={space.fields} air={air} />
        <LatelyTile lately={space.lately} />
        {one && <LandTile land={wx.land(one)} ground={space.ground} />}
        <RainBars rows={bars.map((r) => ({ m: r.m, rain: isReal(r) ? r.v : null, usual: r.usual, kind: r.kind }))} w={wv} />
        {onMore && <button className="more" type="button" onClick={onMore}>Show 12 more months</button>}
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
