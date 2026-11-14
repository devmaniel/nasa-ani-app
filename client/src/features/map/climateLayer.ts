import { forecastFor, pastGrid, spotKey, usualGrid, type Box, type Forecast, type GridPoint, type UsualParam } from './api'
import { clamp } from './climate'
import { iso, M0, monthEnd, yearOf } from './dates'
import type { LayerKey } from './types'

/* What the map layers show: the land coloured area by area (about one colour every 50 km) by its value for the month,
   under the sea and the map's names; Play fades it from month to month:
   past months             → NASA POWER's measured value for that month (from 1981; the last month or two aren't out yet: usual)
   this month and the next → the free Open-Meteo forecast, as far as it reaches (about 6 months), laid over NASA's detailed usual
   later months            → NASA POWER's usual for that month (25-year average): no forecast, so the map says so
   Soil has no forecast: its forecast months are NASA's usual soil, nudged by the forecast rain.
   The map also shows NASA's satellite picture (GIBS): the latest this month, and for past months the month's own where NASA makes one. */

export type MapLayer = Exclude<LayerKey, 'plants'>
export type Kind = 'past' | 'forecast' | 'usual' | 'estimate'
/* past: NASA's measured values for one year; no points when that request failed (its months fall back to the usual) */
export type Grid = { usual: GridPoint[]; rain: GridPoint[] | null; forecast: Forecast | null; past: { year: number; points: GridPoint[] } | null }

type Look = {
  name: string
  nasa: { id: string; level: number; sharp: number; source: string } /* sharp: the zoom NASA's tiles are taken at; lower is smoother */
  usual: UsualParam
  unit: string
  bands: [number, string | null][] /* from this value up, this colour; null: no colour (the map shows through, fading in towards the next band) */
}

export const LOOKS: Record<MapLayer, Look> = {
  rain: {
    name: 'Rain', nasa: { id: 'IMERG_Precipitation_Rate', level: 6, sharp: 4, source: 'NASA GPM' }, usual: 'PRECTOTCORR', unit: 'mm in the month',
    /* radar colours, like NASA's rain picture and weather apps: nothing when dry, then green, yellow, orange, red */
    bands: [[0, null], [50, '#9be08f'], [100, '#3dbb4c'], [200, '#f2df3a'], [300, '#f59a23'], [450, '#e0362c']],
  },
  heat: {
    name: 'Heat', nasa: { id: 'MODIS_Terra_Land_Surface_Temp_Day', level: 7, sharp: 7, source: 'NASA MODIS, ground surface' }, usual: 'T2M', unit: '°C on average',
    bands: [[0, '#8fd0ff'], [15, '#ffe45c'], [22, '#ffb733'], [26, '#ff8126'], [29, '#ee4a1c'], [32, '#b5121b']],
  },
  soil: {
    name: 'Soil', nasa: { id: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', level: 6, sharp: 4, source: 'NASA SMAP' }, usual: 'GWETROOT', unit: 'root-zone wetness, 0% dry to 100% soaked',
    bands: [[0, '#8a4510'], [0.3, '#c47a26'], [0.5, '#e8b85a'], [0.65, '#6fd0a4'], [0.8, '#22a585'], [0.9, '#08665c']],
  },
}
/* NASA's latest picture for every chip; Plants has only pictures (nobody forecasts plant greenness, and NASA POWER has no numbers for it) */
const NASA_PICTURES: Record<LayerKey, Look['nasa']> = {
  rain: LOOKS.rain.nasa, heat: LOOKS.heat.nasa, soil: LOOKS.soil.nasa,
  plants: { id: 'MODIS_Terra_NDVI_8Day', level: 9, sharp: 9, source: 'NASA MODIS, plant greenness (NDVI)' },
}
/* NASA's picture of a whole past month, where it makes one, from month `from` on: Heat since March 2000, Plants since July 2002
   (rain and soil pictures only go back about a year, as daily ones, so past months show their numbers only) */
const NASA_MONTHLY: Partial<Record<LayerKey, Look['nasa'] & { from: number }>> = {
  heat: { id: 'MODIS_Terra_L3_Land_Surface_Temp_Monthly_Day', level: 6, sharp: 6, source: 'NASA MODIS, ground surface, month average', from: 2000 * 12 + 2 },
  plants: { id: 'MODIS_Aqua_L3_NDVI_Monthly', level: 7, sharp: 7, source: 'NASA MODIS, plant greenness for the month', from: 2002 * 12 + 6 },
}
/* NASA's monthly pictures come out about this many months late */
const MONTHLY_LAG = 2

/* the picture on the map; time: 'default' for the latest, or the month's first day */
export type MapPicture = Look['nasa'] & { time: string }
export function pictureFor(layer: LayerKey, m: number): MapPicture | null {
  if (m === M0) return { ...NASA_PICTURES[layer], time: 'default' }
  const p = NASA_MONTHLY[layer]
  if (!p || m < p.from || m > M0 - MONTHLY_LAG) return null
  return { id: p.id, level: p.level, sharp: p.sharp, source: p.source, time: iso(new Date(yearOf(m), m % 12, 1)) }
}

/* the data comes in TILE_DEG tiles (NASA POWER takes at most 10° a request); the map colours the tiles in view,
   at most MAX_TILES of them (nearest the centre first), so a far-out view stays quick */
const TILE_DEG = 10
const MAX_TILES = 12
const MAX_LAT = 80
/* NASA POWER's grid: a spot every 0.625° of longitude and 0.5° of latitude, so a tile is TILE_COLS × TILE_ROWS spots */
const STEP_LON = 0.625
const STEP_LAT = 0.5
const TILE_COLS = TILE_DEG / STEP_LON
const TILE_ROWS = TILE_DEG / STEP_LAT
/* the drawn picture has this many rows per row of spots, spaced the way the map stretches north to south (Mercator) */
const ROW_SCALE = 2
/* the forecast is asked on a coarser grid (spots that are also on NASA's grid), FC_STEP apart, to stay within its free use */
const FC_STEP = 2.5
const FC_LON0 = 1.25
const FC_LAT0 = 1
const FC_PER_TILE = TILE_DEG / FC_STEP
/* a forecast month counts as at most this many times the usual rain */
const RAIN_SHARE_MAX = 4
/* soil follows rain only part way: wetter or drier by at most this share */
const SOIL_NUDGE_MIN = 0.6
const SOIL_NUDGE_MAX = 1.4

const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i)
const tileX = (lon: number) => Math.floor(clamp(lon, -180, 179.9) / TILE_DEG)
const tileY = (lat: number) => Math.floor(clamp(lat, -MAX_LAT, MAX_LAT - 0.1) / TILE_DEG)

/* the tile a point is in */
export function tileAt(lon: number, lat: number) {
  return tileX(lon) + ',' + tileY(lat)
}
/* the tiles in a view, nearest its centre first; limited: some were left out (zoomed far out) */
export function tilesIn(v: { w: number; s: number; e: number; n: number; lon: number; lat: number }) {
  const all = range(tileX(v.w), tileX(v.e)).flatMap((x) => range(tileY(v.s), tileY(v.n)).map((y) => ({
    t: x + ',' + y,
    d: Math.hypot((x + 0.5) * TILE_DEG - v.lon, (y + 0.5) * TILE_DEG - v.lat),
  })))
  const near = [...all].sort((a, b) => a.d - b.d)
  return { tiles: near.slice(0, MAX_TILES).map((n) => n.t), limited: near.length > MAX_TILES }
}
function tileXY(t: string) {
  const [x, y] = t.split(',').map(Number)
  return { x: x * TILE_DEG, y: y * TILE_DEG }
}
/* the tile's spots on NASA's grid, without its far edges (they belong to the next tiles) */
function tileBox(t: string): Box {
  const { x, y } = tileXY(t)
  return { w: x, e: x + TILE_DEG - STEP_LON, s: y, n: y + TILE_DEG - STEP_LAT }
}
function forecastSpots(t: string) {
  const { x, y } = tileXY(t)
  return range(0, FC_PER_TILE - 1).flatMap((i) => range(0, FC_PER_TILE - 1).map((j) => ({ lon: x + FC_LON0 + i * FC_STEP, lat: y + FC_LAT0 + j * FC_STEP })))
}
/* the coarse forecast spot nearest a spot of the same tile */
function forecastKeyNear(p: { lon: number; lat: number }) {
  const x = Math.floor(p.lon / TILE_DEG) * TILE_DEG
  const y = Math.floor(p.lat / TILE_DEG) * TILE_DEG
  const i = clamp(Math.round((p.lon - x - FC_LON0) / FC_STEP), 0, FC_PER_TILE - 1)
  const j = clamp(Math.round((p.lat - y - FC_LAT0) / FC_STEP), 0, FC_PER_TILE - 1)
  return spotKey({ lon: x + FC_LON0 + i * FC_STEP, lat: y + FC_LAT0 + j * FC_STEP })
}

/* each request is made once and kept; a failed one is dropped so it can be tried again */
const savedUsual = new Map<string, Promise<GridPoint[]>>()
const savedForecast = new Map<string, Promise<Forecast>>()
const savedPast = new Map<string, Promise<GridPoint[]>>()
function once<T>(saved: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = saved.get(key)
  if (hit) return hit
  const p = load()
  saved.set(key, p)
  p.catch(() => saved.delete(key))
  return p
}

/* everything one layer needs for a tile; year: the past year to measure (null for now and ahead);
   without the forecast or the past, those months fall back to NASA's usual */
export async function loadGrid(layer: MapLayer, tile: string, year: number | null): Promise<Grid> {
  const param = LOOKS[layer].usual
  const usualOf = (p: UsualParam) => once(savedUsual, p + ':' + tile, () => usualGrid(p, tileBox(tile)))
  const [usual, rain, forecast, past] = await Promise.all([
    usualOf(param),
    layer === 'soil' ? usualOf('PRECTOTCORR') : null,
    once(savedForecast, tile, () => forecastFor(forecastSpots(tile))).catch((err: unknown) => {
      console.error('Forecast failed; later months show NASA usual', err)
      return null
    }),
    year === null ? null : once(savedPast, param + ':' + tile + ':' + year, () => pastGrid(param, tileBox(tile), year))
      .then((points) => ({ year, points }))
      .catch((err: unknown) => {
        console.error('NASA POWER past months failed; they show NASA usual', err)
        return { year, points: [] }
      }),
  ])
  return { usual, rain, forecast, past }
}

/* a loaded grid's name: layer, tile, and the past year ('now' for this month on) */
export const gridKey = (layer: MapLayer, tile: string, year: number | null) => layer + ':' + tile + ':' + (year ?? 'now')

/* this month: NASA's latest satellite picture is on the map */
export const isLive = (m: number) => m === M0
/* the year to measure for a past month, null for now and ahead */
export const pastYear = (m: number) => (m < M0 ? yearOf(m) : null)

/* which kind of data a month gets; unknown until the grid (and for a past month, its year) is in */
export function kindOf(layer: MapLayer, m: number, grid: Grid | null): Kind | null {
  if (!grid) return null
  if (m < M0) {
    if (!grid.past || grid.past.year !== yearOf(m)) return null
    return grid.past.points.some((p) => Number.isFinite(p.months[m % 12])) ? 'past' : 'usual'
  }
  const f = grid.forecast
  if (f && m >= f.first && m - f.first < f.months) return layer === 'soil' ? 'estimate' : 'forecast'
  return 'usual'
}

type Spot = { lon: number; lat: number; v: number }

/* NASA's value for month m on its fine grid, usual or measured (rain as mm in the month) */
function monthSpots(layer: MapLayer, m: number, points: GridPoint[]): Spot[] {
  const days = monthEnd(m).getDate()
  return points.map((p) => ({ lon: p.lon, lat: p.lat, v: p.months[m % 12] * (layer === 'rain' ? days : 1) }))
}

/* the forecast for month m on NASA's fine grid: NASA's usual at each spot, shifted the way the forecast at the nearest coarse spot
   differs from usual there (heat: plus the difference; rain: times the rain's share of usual; soil: nudged part way by that share) */
function forecastSpotValues(layer: MapLayer, m: number, grid: Grid, f: Forecast): Spot[] {
  const i = m - f.first
  const x = m % 12
  const days = monthEnd(m).getDate()
  const base = new Map((layer === 'soil' ? grid.rain ?? [] : grid.usual).map((p) => [spotKey(p), p]))
  return grid.usual.map((p) => {
    const key = forecastKeyNear(p)
    const s = f.spots.get(key)
    const u = base.get(key)
    const usual = p.months[x]
    if (layer === 'heat') return { lon: p.lon, lat: p.lat, v: usual + (s && u ? s.heat[i] - u.months[x] : 0) }
    const share = s && u && u.months[x] > 0 ? s.rain[i] / (u.months[x] * days) : 1
    if (layer === 'rain') return { lon: p.lon, lat: p.lat, v: usual * days * clamp(share, 0, RAIN_SHARE_MAX) }
    return { lon: p.lon, lat: p.lat, v: clamp(usual * clamp(Math.sqrt(share), SOIL_NUDGE_MIN, SOIL_NUDGE_MAX), 0, 1) }
  })
}

/* every spot's value for month m (NaN where there is none: soil out at sea) */
function monthValues(layer: MapLayer, kind: Kind, m: number, grid: Grid): Spot[] {
  if (kind === 'past' && grid.past) return monthSpots(layer, m, grid.past.points)
  if (kind === 'usual' || !grid.forecast) return monthSpots(layer, m, grid.usual)
  return forecastSpotValues(layer, m, grid, grid.forecast)
}

/* the value for month m at the spot nearest a point, or null when there is none */
export function valueAt(layer: MapLayer, kind: Kind, m: number, grid: Grid, lon: number, lat: number): number | null {
  const near = monthValues(layer, kind, m, grid).filter((s) => Number.isFinite(s.v)).reduce<Spot | null>((best, s) => {
    const d = Math.hypot(s.lon - lon, s.lat - lat)
    return !best || d < Math.hypot(best.lon - lon, best.lat - lat) ? s : best
  }, null)
  return near ? near.v : null
}

const rgbOfHex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))

const OPAQUE = 255
const solid = (c: string | null) => (c ? [...rgbOfHex(c), OPAQUE] : [0, 0, 0, 0])

/* the colour for a value (RGBA), blended between the two nearest band colours; from a no-colour band it fades in */
function rgbaOf(layer: MapLayer, v: number) {
  const bands = LOOKS[layer].bands
  const i = bands.findIndex(([from]) => v < from)
  if (i === 0) return solid(bands[0][1])
  if (i === -1) return solid(bands[bands.length - 1][1])
  const [a, ca] = bands[i - 1]
  const [b, cb] = bands[i]
  const t = (v - a) / (b - a)
  if (!cb) return solid(ca)
  const hi = rgbOfHex(cb)
  if (!ca) return [...hi, Math.round(OPAQUE * t)]
  const lo = rgbOfHex(ca)
  return [...lo.map((c, k) => Math.round(c + (hi[k] - c) * t)), OPAQUE]
}

/* the colour for a value as CSS, the same as on the map (see-through when there's no colour) */
export function cssColor(layer: MapLayer, v: number) {
  const [r, g, b, a] = rgbaOf(layer, v)
  return `rgba(${r},${g},${b},${a / OPAQUE})`
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const latOfMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp(y)) - 90

export type AreaTile = { tile: string; grid: Grid; kind: Kind }
export type Corners = [[number, number], [number, number], [number, number], [number, number]]
export type AreaPicture = { pixels: Uint8ClampedArray<ArrayBuffer>; width: number; height: number; corners: Corners }

/* the spots' colours on a grid covering the tiles, one pixel a spot (RGBA, north row first), see-through where there's no value yet */
function spotPixels(layer: MapLayer, m: number, ready: AreaTile[], west: number, topLat: number, cols: number, rows: number) {
  const px = new Uint8ClampedArray(cols * rows * 4)
  for (const a of ready) {
    for (const s of monthValues(layer, a.kind, m, a.grid)) {
      const c = Math.round((s.lon - west) / STEP_LON)
      const r = Math.round((topLat - s.lat) / STEP_LAT)
      if (!Number.isFinite(s.v) || c < 0 || c >= cols || r < 0 || r >= rows) continue
      px.set(rgbaOf(layer, s.v), (r * cols + c) * 4)
    }
  }
  return px
}

/* one picture of the colours across all the tiles in view (ready: those with data so far), its rows re-spaced to the map's
   north–south stretch so each colour sits on its place; the map smooths it between pixels */
export function areaPicture(layer: MapLayer, m: number, tiles: string[], ready: AreaTile[]): AreaPicture {
  const xy = tiles.map((t) => t.split(',').map(Number))
  const [x0, x1] = [Math.min(...xy.map(([x]) => x)), Math.max(...xy.map(([x]) => x))]
  const [y0, y1] = [Math.min(...xy.map(([, y]) => y)), Math.max(...xy.map(([, y]) => y))]
  const cols = (x1 - x0 + 1) * TILE_COLS
  const rows = (y1 - y0 + 1) * TILE_ROWS
  const west = x0 * TILE_DEG
  const topLat = (y1 + 1) * TILE_DEG - STEP_LAT /* the top row of spots */
  const src = spotPixels(layer, m, ready, west, topLat, cols, rows)
  const north = topLat + STEP_LAT / 2
  const south = north - rows * STEP_LAT
  const height = rows * ROW_SCALE
  const out = new Uint8ClampedArray(cols * height * 4)
  for (let r = 0; r < height; r++) {
    const lat = latOfMercY(mercY(north) + (mercY(south) - mercY(north)) * ((r + 0.5) / height))
    const f = clamp((topLat - lat) / STEP_LAT, 0, rows - 1)
    const j0 = Math.floor(f)
    const j1 = Math.min(j0 + 1, rows - 1)
    const t = f - j0
    for (let c = 0; c < cols; c++) {
      const a = (j0 * cols + c) * 4
      const b = (j1 * cols + c) * 4
      const wa = (1 - t) * src[a + 3]
      const wb = t * src[b + 3]
      if (wa + wb === 0) continue
      const o = (r * cols + c) * 4
      for (let k = 0; k < 3; k++) out[o + k] = (src[a + k] * wa + src[b + k] * wb) / (wa + wb)
      out[o + 3] = wa + wb
    }
  }
  const w = west - STEP_LON / 2
  const e = w + (x1 - x0 + 1) * TILE_DEG
  return { pixels: out, width: cols, height, corners: [[w, north], [e, north], [e, south], [w, south]] }
}
