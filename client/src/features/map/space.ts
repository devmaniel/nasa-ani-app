import { era5Days, gibsKey, gibsLatest, latestGranule, nasaTiles, TERRAIN_TILES, tilePixels, type ColourKey } from './api'
import { clamp, rainWord, type Point } from './climate'
import { addDays, iso, MON, MONTH_FULL, parseIso, TODAY } from './dates'

/* Readings from space at one place, next to NASA POWER's months and FAO's land:
   lately: rain over the last 7 days (NASA GPM IMERG), soil water now (NASA SMAP), plant greenness now (NASA VIIRS),
           the ground's water in the newest month NASA GLDAS has against the same month in the 10 years before it,
           and rain and heat over the last 30 days against the same days in the 10 years before (ERA5, through Open-Meteo);
   ground: the exact spot's height and slope (NASA SRTM) and how tall the trees around it are (NASA GEDI);
   fields: the newest clear photo of the fields (Landsat or Sentinel-2, as NASA's HLS).
   NASA's map pictures (GIBS) come with a colour key, so a pixel's colour at the place gives the value back. */

type GibsLayer = { id: string; key: string; level: number }
/* the day's average rain, in mm an hour (see-through under 0.1, about 2 mm a day) */
const IMERG: GibsLayer = { id: 'IMERG_Precipitation_Rate', key: 'GPM_Precipitation_Rate', level: 6 }
/* water in the root zone (about the top metre), m³ of water per m³ of soil; 9 km squares */
const SMAP: GibsLayer = { id: 'SMAP_L4_Analyzed_Root_Zone_Soil_Moisture', key: 'SMAP_Analyzed_Soil_Moisture', level: 6 }
/* plant greenness (NDVI, 0 bare to 1 lush) over the 8 days to the date; 500 m squares */
const VIIRS: GibsLayer = { id: 'VIIRS_NOAA20_NDVI_8Day', key: 'MODIS_NDVI', level: 8 }
/* water in the top 10 cm of soil for the month, kg/m²; 25 km squares */
const GLDAS: GibsLayer = { id: 'GLDAS_Underground_Soil_Moisture_Monthly', key: 'GLDAS_Underground_Soil_Moisture_Monthly', level: 6 }
/* the height of the tallest things (mostly tree tops), averaged over 1 km squares, April 2019 to March 2023 */
const GEDI: GibsLayer = { id: 'GEDI_ISS_L3_Canopy_Height_Mean_RH100_201904-202303', key: 'GEDI_RH100_Mean_Color_Index', level: 7 }

const TILE_ZOOM0_M = 156543.03392 /* metres a pixel of a 256-pixel tile at zoom 0 on the equator */
const TILE_PX = 256
const RAIN_DAYS = 7
const HOURS = 24
const GROUND_YEARS = 10
const ERA5_LAG_DAYS = 6 /* ERA5 is about 5 days behind */
const ERA5_DAYS = 30
const ERA5_YEARS = 10
const GREEN_R = 1 /* VIIRS: the 3 × 3 squares around the place (about 1.5 km), so one road or river doesn't decide it */
const TREES_R = 2 /* GEDI misses many squares: the 5 × 5 around the place (about 5 km) */
const SRTM_ZOOM = 12 /* elevation pixels of about 38 m, close to SRTM's 30 m */
const SLOPE_STEP = 2 /* the slope is taken 2 pixels to each side (about 150 m of ground) */
const TERRARIUM_OFFSET = 32768
const FIELD_LEVEL = 12
const MAX_CLOUD = 30 /* a field photo counts as clear with at most this % cloud */
const HLS = [
  { id: 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance', short: 'HLSS30', name: 'Sentinel-2' },
  { id: 'HLS_L30_Nadir_BRDF_Adjusted_Reflectance', short: 'HLSL30', name: 'Landsat' },
]

/* each request is made once and kept; a failed one is dropped so it can be tried again */
function once<T>(saved: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = saved.get(key)
  if (hit) return hit
  const p = load()
  saved.set(key, p)
  p.catch(() => saved.delete(key))
  return p
}
const tiles = new Map<string, Promise<ImageData>>()
const keys = new Map<string, Promise<ColourKey>>()
const newest = new Map<string, Promise<string>>()
const latelySaved = new Map<string, Promise<Lately>>()
const groundSaved = new Map<string, Promise<Ground>>()
const fieldsSaved = new Map<string, Promise<FieldPicture | null>>()

const finiteMean = (vs: number[]) => {
  const f = vs.filter(Number.isFinite)
  return f.length ? f.reduce((s, v) => s + v, 0) / f.length : null
}
const latestOf = (id: string, level: number) => once(newest, id, () => gibsLatest(id, level))
const shiftYears = (d: Date, n: number) => new Date(d.getFullYear() + n, d.getMonth(), d.getDate())
const placeKey = (p: Point, dp: number) => p.lon.toFixed(dp) + ',' + p.lat.toFixed(dp)

/* the tile a point is in at zoom z, and where in it (0–1 across and down) */
function tileSpot(p: Point, z: number) {
  const n = 2 ** z
  const r = (clamp(p.lat, -85, 85) * Math.PI) / 180
  const fx = ((p.lon + 180) / 360) * n
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n
  const x = Math.floor(fx)
  const y = Math.floor(fy)
  return { z, x, y, u: fx - x, v: fy - y }
}
const tileUrl = (template: string, t: { z: number; x: number; y: number }) =>
  template.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y))

/* the RGBA offsets of the pixels within r of a spot's pixel, kept inside the tile */
function pixelsAround(img: ImageData, t: { u: number; v: number }, r: number) {
  const px = Math.floor(t.u * img.width)
  const py = Math.floor(t.v * img.height)
  const out: number[] = []
  for (let y = Math.max(0, py - r); y <= Math.min(img.height - 1, py + r); y++) {
    for (let x = Math.max(0, px - r); x <= Math.min(img.width - 1, px + r); x++) out.push((y * img.width + x) * 4)
  }
  return out
}

/* a colour's value in the key: the middle of its range (the closed end at an open end); the nearest key colour if it isn't in it */
function valueOf(key: ColourKey, d: Uint8ClampedArray, i: number) {
  if (d[i + 3] === 0) return NaN
  let range = key.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
  if (!range) {
    let best = Infinity
    for (const [c, r] of key) {
      const dist = ((c >> 16) - d[i]) ** 2 + (((c >> 8) & 255) - d[i + 1]) ** 2 + ((c & 255) - d[i + 2]) ** 2
      if (dist < best) [best, range] = [dist, r]
    }
  }
  if (!range) return NaN
  const [lo, hi] = range
  return !Number.isFinite(lo) ? hi : !Number.isFinite(hi) ? lo : (lo + hi) / 2
}

/* the values within r pixels of a point on NASA's picture of a layer for a day; NaN where it's see-through */
async function gibsValues(l: GibsLayer, day: string, p: Point, r = 0): Promise<number[]> {
  const t = tileSpot(p, l.level)
  const url = tileUrl(nasaTiles(l.id, l.level, day), t)
  const [img, key] = await Promise.all([once(tiles, url, () => tilePixels(url)), once(keys, l.key, () => gibsKey(l.key))])
  return pixelsAround(img, t, r).map((i) => valueOf(key, img.data, i))
}

/* ---- lately ---- */

/* each null when its source failed or has nothing at the place; days as YYYY-MM-DD */
export type Lately = {
  rain7: { mm: number; to: string } | null
  soil: { v: number; day: string } | null
  green: { v: number; day: string } | null
  ground: { v: number; usual: number; month: string } | null
  last30: { rain: number; usualRain: number; heat: number; usualHeat: number } | null
}

async function rain7(p: Point): Promise<Lately['rain7']> {
  const to = parseIso(await latestOf(IMERG.id, IMERG.level))
  if (!to) return null
  const days = Array.from({ length: RAIN_DAYS }, (_, i) => iso(addDays(to, -i)))
  const rates = await Promise.all(days.map((d) => gibsValues(IMERG, d, p)))
  /* see-through: under the key's lowest rain, counted as none */
  return { mm: rates.reduce((s, [v]) => s + (Number.isFinite(v) ? v * HOURS : 0), 0), to: iso(to) }
}

async function readingNow(l: GibsLayer, p: Point, r = 0) {
  const day = await latestOf(l.id, l.level)
  const v = finiteMean(await gibsValues(l, day, p, r))
  return v === null ? null : { v, day }
}

async function groundWater(p: Point): Promise<Lately['ground']> {
  const month = parseIso(await latestOf(GLDAS.id, GLDAS.level))
  if (!month) return null
  const months = Array.from({ length: GROUND_YEARS + 1 }, (_, k) => iso(shiftYears(month, -k)))
  const vs = await Promise.all(months.map((m) => gibsValues(GLDAS, m, p).then(([v]) => v)))
  const usual = finiteMean(vs.slice(1))
  return Number.isFinite(vs[0]) && usual ? { v: vs[0], usual, month: months[0] } : null
}

/* rain (mm) and heat (°C) over the last 30 days ERA5 has, and the same days in each of the 10 years before;
   taken as a day's average times 30, so a missing day doesn't count as dry */
async function last30(p: Point): Promise<Lately['last30']> {
  const to = addDays(TODAY, -ERA5_LAG_DAYS)
  const from = addDays(to, -(ERA5_DAYS - 1))
  const d = await era5Days(p, iso(shiftYears(from, -ERA5_YEARS)), iso(to))
  const window = (k: number) => {
    const a = iso(shiftYears(from, -k))
    const b = iso(shiftYears(to, -k))
    const at = d.day.flatMap((day, i) => (day >= a && day <= b ? [i] : []))
    const rain = finiteMean(at.map((i) => d.rain[i]))
    const heat = finiteMean(at.map((i) => d.heat[i]))
    return rain === null || heat === null ? null : { rain: rain * ERA5_DAYS, heat }
  }
  const now = window(0)
  const before = Array.from({ length: ERA5_YEARS }, (_, k) => window(k + 1)).flatMap((w) => (w ? [w] : []))
  const usualRain = finiteMean(before.map((w) => w.rain))
  const usualHeat = finiteMean(before.map((w) => w.heat))
  return now && usualRain !== null && usualHeat !== null ? { rain: now.rain, usualRain, heat: now.heat, usualHeat } : null
}

/* a reading that failed is logged and left out, so the others still show */
function orNull<T>(what: string, p: Promise<T>): Promise<T | null> {
  return p.catch((err: unknown) => {
    console.error(what + ' failed', err)
    return null
  })
}

export function loadLately(p: Point): Promise<Lately> {
  return once(latelySaved, placeKey(p, 3), async () => {
    const [r7, soil, green, ground, l30] = await Promise.all([
      orNull('NASA IMERG', rain7(p)), orNull('NASA SMAP', readingNow(SMAP, p)), orNull('NASA VIIRS', readingNow(VIIRS, p, GREEN_R)),
      orNull('NASA GLDAS', groundWater(p)), orNull('ERA5', last30(p)),
    ])
    return { rain7: r7, soil, green, ground, last30: l30 }
  })
}

/* ---- the ground at the spot ---- */

/* height: metres above the sea; slope: %; trees: metres, null where GEDI has no reading near */
export type Ground = { height: number; slope: number; trees: number | null }

/* SRTM's height and slope at the spot (Horn's method over the pixels SLOPE_STEP to each side) */
async function srtmAt(p: Point) {
  const t = tileSpot(p, SRTM_ZOOM)
  const url = tileUrl(TERRAIN_TILES, t)
  const img = await once(tiles, url, () => tilePixels(url))
  const px = Math.floor(t.u * img.width)
  const py = Math.floor(t.v * img.height)
  const h = (dx: number, dy: number) => {
    const i = (clamp(py + dy, 0, img.height - 1) * img.width + clamp(px + dx, 0, img.width - 1)) * 4
    return img.data[i] * 256 + img.data[i + 1] + img.data[i + 2] / 256 - TERRARIUM_OFFSET
  }
  const k = SLOPE_STEP
  const res = (TILE_ZOOM0_M * Math.cos((p.lat * Math.PI) / 180)) / 2 ** SRTM_ZOOM * (TILE_PX / img.width)
  const dx = (h(k, -k) + 2 * h(k, 0) + h(k, k) - (h(-k, -k) + 2 * h(-k, 0) + h(-k, k))) / (8 * k * res)
  const dy = (h(-k, k) + 2 * h(0, k) + h(k, k) - (h(-k, -k) + 2 * h(0, -k) + h(k, -k))) / (8 * k * res)
  return { height: h(0, 0), slope: 100 * Math.hypot(dx, dy) }
}

export function loadGround(p: Point): Promise<Ground> {
  return once(groundSaved, placeKey(p, 4), async () => {
    const [spot, trees] = await Promise.all([srtmAt(p), orNull('NASA GEDI', gibsValues(GEDI, 'default', p, TREES_R).then(finiteMean))])
    return { ...spot, trees }
  })
}

/* ---- the newest clear field photo ---- */

export type FieldPicture = { id: string; level: number; day: string; cloud: number; name: string }

/* the newer of the clearest recent Sentinel-2 and Landsat photos over a point (as NASA has drawn them), null when neither has one */
export function loadFieldPicture(p: Point): Promise<FieldPicture | null> {
  return once(fieldsSaved, placeKey(p, 2), async () => {
    const found = await Promise.all(HLS.map(async (s) => {
      const g = await latestGranule(s.short, p, MAX_CLOUD, await latestOf(s.id, FIELD_LEVEL))
      return g ? [{ id: s.id, level: FIELD_LEVEL, day: g.day, cloud: g.cloud, name: s.name }] : []
    }))
    return found.flat().sort((a, b) => b.day.localeCompare(a.day) || a.cloud - b.cloud)[0] ?? null
  })
}

/* ---- in words ---- */

/* "10 Nov" */
export function dayWord(day: string) {
  const d = parseIso(day)
  return d ? d.getDate() + ' ' + MON[d.getMonth()] : day
}
/* SMAP's root-zone water: under 15% dry, from 30% wet (rules of thumb; it depends on the soil) */
export const soilWord = (v: number) => (v < 0.15 ? 'dry' : v < 0.3 ? 'moist' : 'wet')
/* NDVI: under 0.2 bare ground or buildings, under 0.4 thin plants, under 0.6 green, then lush green */
export const greenWord = (v: number) => (v < 0.2 ? 'Bare or built-up' : v < 0.4 ? 'Thin plants' : v < 0.6 ? 'Green' : 'Lush green')
/* GEDI's tree tops: under 10 m mostly open land, under 20 m some trees, then tall forest */
export const treeWord = (h: number) => (h < 10 ? 'mostly open land' : h < 20 ? 'some trees' : 'tall forest')
/* steep from 8%, flat under 2% (the same lines as FAO's slope classes) */
export const slopeWord = (pct: number) => (pct < 2 ? 'flat' : pct < 8 ? 'gently sloping' : pct < 16 ? 'moderately steep' : 'steep')

/* the lately readings (not the 7-day rain or plants, which have their own place), one line each with its source */
export function latelyLines(l: Lately): string[] {
  const lines: string[] = []
  if (l.last30) {
    const { rain, usualRain, heat, usualHeat } = l.last30
    const d = heat - usualHeat
    lines.push('Last 30 days: ' + Math.round(rain) + ' mm of rain, ' + rainWord(usualRain > 0 ? rain / usualRain : 1) + ' (usual ' + Math.round(usualRain) + ' mm); '
      + heat.toFixed(1) + ' °C, ' + (Math.abs(d) < 0.2 ? 'usual heat' : Math.abs(d).toFixed(1) + '° ' + (d > 0 ? 'warmer' : 'cooler')) + ' · ERA5')
  }
  if (l.soil) lines.push('Soil now: ' + soilWord(l.soil.v) + ', ' + Math.round(l.soil.v * 100) + '% water · NASA SMAP, ' + dayWord(l.soil.day))
  if (l.ground) {
    const d = parseIso(l.ground.month)
    lines.push('Ground water in ' + (d ? MONTH_FULL[d.getMonth()] + ' ' + d.getFullYear() : l.ground.month) + ': ' + rainWord(l.ground.v / l.ground.usual) + ' · NASA GLDAS')
  }
  return lines
}

/* every lately reading as a line, the 7-day rain first (for the report; plants show in its Plants column) */
export function allLatelyLines(l: Lately): string[] {
  return [
    ...(l.rain7 ? [Math.round(l.rain7.mm) + ' mm of rain in the 7 days to ' + dayWord(l.rain7.to) + ' · NASA IMERG'] : []),
    ...latelyLines(l),
  ]
}

/* "This spot: gently sloping (3% slope), 85 m above the sea" */
export const groundLine = (g: Ground) => 'This spot: ' + slopeWord(g.slope) + ' (' + Math.round(g.slope) + '% slope), ' + Math.round(Math.max(0, g.height)) + ' m above the sea'
export const treesLine = (g: Ground) => (g.trees === null ? null : 'Trees around: ' + treeWord(g.trees) + ', tops about ' + Math.round(g.trees) + ' m')
