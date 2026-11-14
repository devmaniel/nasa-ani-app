import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { SPOT_W, type Place } from './places'
import { monthIndex, parseIso } from './dates'

/* Google place search: Places API (New) through the Maps JavaScript API. The key lives in client/.env.local */
const KEY: unknown = import.meta.env.VITE_GOOGLE_MAPS_KEY
const REGION = 'ph' /* results lean towards the Philippines, but places anywhere can be found */

export type Suggestion = { id: string; name: string; sub: string; prediction: google.maps.places.PlacePrediction }
export type SessionToken = google.maps.places.AutocompleteSessionToken

let library: Promise<google.maps.PlacesLibrary> | null = null
function places() {
  if (typeof KEY !== 'string' || !KEY) return Promise.reject(new Error('Google Maps key missing: set VITE_GOOGLE_MAPS_KEY in client/.env.local'))
  if (!library) {
    setOptions({ key: KEY, v: 'weekly', region: REGION })
    library = importLibrary('places')
  }
  return library
}

/* one token covers a search from first letter to the place picked, so Google bills it as one session */
export async function newSession(): Promise<SessionToken> {
  const { AutocompleteSessionToken } = await places()
  return new AutocompleteSessionToken()
}

export async function suggestPlaces(input: string, sessionToken: SessionToken): Promise<Suggestion[]> {
  const { AutocompleteSuggestion } = await places()
  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken })
  return suggestions.flatMap(({ placePrediction: p }) =>
    p ? [{ id: p.placeId, name: p.mainText?.text ?? p.text.text, sub: p.secondaryText?.text ?? '', prediction: p }] : [],
  )
}

/* ---- city borders, from OpenStreetMap's free place lookup (Nominatim; at most about one request a second) ---- */

export type Area = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] }

const BORDER_URL = 'https://nominatim.openstreetmap.org/reverse'
const CITY_LEVEL = '8' /* the lookup's detail level that lands on whole cities in most countries */
const BORDER_DETAIL = '0.0005' /* degrees: smooths the outline so it stays small to load */
/* only city-sized answers get an outline; where OpenStreetMap has just a province, the pin stands alone */
const CITY_TYPES = new Set(['city', 'town', 'village', 'municipality', 'county', 'borough'])

const isNumber = (v: unknown): v is number => typeof v === 'number'
const isRing = (v: unknown): v is number[][] => Array.isArray(v) && v.every((p) => Array.isArray(p) && p.length >= 2 && p.every(isNumber))
const isPolygon = (v: unknown): v is number[][][] => Array.isArray(v) && v.every(isRing)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/* the city outline in the lookup's answer, or null when there is none */
function areaOf(json: unknown): Area | null {
  const feature: unknown = isRecord(json) && Array.isArray(json.features) ? json.features[0] : null
  if (!isRecord(feature) || !isRecord(feature.properties) || !isRecord(feature.geometry)) return null
  const { addresstype } = feature.properties
  if (typeof addresstype !== 'string' || !CITY_TYPES.has(addresstype)) return null
  const { type, coordinates } = feature.geometry
  if (type === 'Polygon' && isPolygon(coordinates)) return { type, coordinates }
  if (type === 'MultiPolygon' && Array.isArray(coordinates) && coordinates.every(isPolygon)) return { type, coordinates }
  return null
}

/* the border of the city a point is in, anywhere in the world */
export async function cityBorder(lon: number, lat: number, signal: AbortSignal): Promise<Area | null> {
  const params = new URLSearchParams({ format: 'geojson', lat: String(lat), lon: String(lon), zoom: CITY_LEVEL, polygon_geojson: '1', polygon_threshold: BORDER_DETAIL })
  const res = await fetch(`${BORDER_URL}?${params}`, { signal })
  if (!res.ok) throw new Error(`City border lookup failed (${res.status})`)
  return areaOf(await res.json())
}

/* where the picked suggestion is, and how wide to show it (Google's view of the place, at least a spot's width) */
export async function placeOf(s: Suggestion): Promise<Place> {
  const { place } = await s.prediction.toPlace().fetchFields({ fields: ['location', 'viewport'] })
  if (!place.location) throw new Error('Google returned no location for ' + s.name)
  const v = place.viewport
  const w = v ? v.getNorthEast().lng() - v.getSouthWest().lng() : SPOT_W
  return { name: s.name, sub: s.sub, lon: place.location.lng(), lat: place.location.lat(), w: Math.max(w, SPOT_W) }
}

/* ---- weather for the map layers: NASA pictures for now, then a free forecast, then NASA's usual for the month ---- */

const GIBS_URL = 'https://gibs.earthdata.nasa.gov'
const GIBS_WMTS = GIBS_URL + '/wmts/epsg3857/best'

/* NASA's map picture of a layer (GIBS: free, no key); `level` is the closest zoom NASA draws it at;
   time: 'default' for the latest, or a day (YYYY-MM-DD) for an older picture */
export function nasaTiles(layerId: string, level: number, time = 'default') {
  return `${GIBS_WMTS}/${layerId}/default/${time}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.png`
}

/* free elevation tiles on AWS (Mapzen's terrain tiles, "terrarium" colours); in the Philippines they're built from NASA SRTM */
export const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'

/* one map tile's pixels, exactly as sent (no colour adjustment, so a colour can be looked up in a colour key) */
export async function tilePixels(url: string): Promise<ImageData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Map tile request failed (${res.status})`)
  const img = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  const ctx = new OffscreenCanvas(img.width, img.height).getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('This browser cannot read map tiles')
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, img.width, img.height)
}

/* the newest day NASA has a picture of a layer for (YYYY-MM-DD) */
export async function gibsLatest(layerId: string, level: number): Promise<string> {
  const params = new URLSearchParams({ SERVICE: 'WMTS', REQUEST: 'DescribeDomains', LAYER: layerId, TILEMATRIXSET: 'GoogleMapsCompatible_Level' + level })
  const res = await fetch(`${GIBS_WMTS}/wmts.cgi?${params}`)
  if (!res.ok) throw new Error(`NASA GIBS request failed (${res.status})`)
  /* the days as ranges, "2000-06-01/2025-10-22/P1D,…,2026-05-27/2026-11-11/P1D": the last range's end is the newest */
  const domain = /<Domain>([^<]*)<\/Domain>/.exec(await res.text())?.[1]
  const last = domain?.split(',').at(-1)?.split('/')[1]?.slice(0, 10)
  if (!last || !parseIso(last)) throw new Error('NASA GIBS sent an unexpected answer')
  return last
}

/* a colour key: each colour (as 0xRRGGBB) and the values it stands for, from lo up to hi (±Infinity at the open ends) */
export type ColourKey = Map<number, [number, number]>
const RANGE = /^[[(]\s*([^,]+?)\s*,\s*([^)\]]+?)\s*[)\]]$/
const bound = (s: string) => (s.includes('INF') ? (s.startsWith('-') ? -Infinity : Infinity) : Number(s))

/* NASA's published colour key for a layer; colours for "no data" and see-through colours are left out */
export async function gibsKey(name: string): Promise<ColourKey> {
  const res = await fetch(`${GIBS_URL}/colormaps/v1.3/${name}.xml`)
  if (!res.ok) throw new Error(`NASA GIBS colour key request failed (${res.status})`)
  const doc = new DOMParser().parseFromString(await res.text(), 'application/xml')
  const key: ColourKey = new Map()
  for (const e of doc.querySelectorAll('ColorMapEntry')) {
    if (e.getAttribute('nodata') === 'true' || e.getAttribute('transparent') === 'true') continue
    const rgb = (e.getAttribute('rgb') ?? '').split(',').map(Number)
    const range = RANGE.exec(e.getAttribute('value') ?? '')
    if (rgb.length !== 3 || !rgb.every(Number.isInteger) || !range) continue
    const c = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
    if (!key.has(c)) key.set(c, [bound(range[1]), bound(range[2])])
  }
  if (!key.size) throw new Error('NASA GIBS sent an empty colour key')
  return key
}

/* ---- NASA's search (CMR): the newest field picture of a place (free, no key) ---- */

const CMR_URL = 'https://cmr.earthdata.nasa.gov/search/granules.json'
export type Granule = { day: string; cloud: number }

/* the newest picture from a NASA collection that covers the place, with at most maxCloud % cloud, up to day `until` */
export async function latestGranule(shortName: string, p: { lon: number; lat: number }, maxCloud: number, until: string): Promise<Granule | null> {
  const params = new URLSearchParams({
    short_name: shortName, point: p.lon.toFixed(COORD_DP) + ',' + p.lat.toFixed(COORD_DP), sort_key: '-start_date', page_size: '1',
    cloud_cover: '0,' + maxCloud, temporal: ',' + until + 'T23:59:59Z',
  })
  const res = await fetch(`${CMR_URL}?${params}`)
  if (!res.ok) throw new Error(`NASA search failed (${res.status})`)
  const json: unknown = await res.json()
  const entry: unknown = isRecord(json) && isRecord(json.feed) && Array.isArray(json.feed.entry) ? json.feed.entry[0] : null
  if (!isRecord(entry)) return null
  const day = typeof entry.time_start === 'string' ? entry.time_start.slice(0, 10) : ''
  const cloud = Number(entry.cloud_cover)
  return parseIso(day) && Number.isFinite(cloud) ? { day, cloud } : null
}

/* ---- ERA5 (ECMWF's reanalysis of past weather) through Open-Meteo: free, no key, about 5 days behind ---- */

const ERA5_URL = 'https://archive-api.open-meteo.com/v1/archive'
/* day by day from `start` to `end` (YYYY-MM-DD): rain (mm) and mean heat (°C); NaN where ERA5 has none yet */
export type Days = { day: string[]; rain: number[]; heat: number[] }

export async function era5Days(p: { lon: number; lat: number }, start: string, end: string): Promise<Days> {
  const params = new URLSearchParams({
    latitude: p.lat.toFixed(COORD_DP), longitude: p.lon.toFixed(COORD_DP), start_date: start, end_date: end,
    daily: 'precipitation_sum,temperature_2m_mean', models: 'era5',
  })
  const res = await fetch(`${ERA5_URL}?${params}`)
  if (!res.ok) throw new Error(`ERA5 request failed (${res.status})`)
  const json: unknown = await res.json()
  const d = isRecord(json) && isRecord(json.daily) ? json.daily : null
  if (!d || !Array.isArray(d.time)) throw new Error('ERA5 sent an unexpected answer')
  return { day: d.time.map(String), rain: toNumbers(d.precipitation_sum), heat: toNumbers(d.temperature_2m_mean) }
}

export type Box = { w: number; s: number; e: number; n: number }
/* a spot on NASA POWER's grid and its value for each month, January first (NaN where NASA has none) */
export type GridPoint = { lon: number; lat: number; months: number[] }
export type UsualParam = 'PRECTOTCORR' | 'T2M' | 'GWETROOT' | 'RH2M' | 'ALLSKY_SFC_SW_DWN'

const USUAL_URL = 'https://power.larc.nasa.gov/api/temporal/climatology/regional'
const MONTHLY_URL = 'https://power.larc.nasa.gov/api/temporal/monthly/regional'
const MONTH_KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const NO_DATA = -999 /* NASA POWER's mark for a spot it has no value for (soil out at sea) */

/* a spot and its values under the twelve month keys; a missing value is NaN */
function pointOf(f: unknown, param: UsualParam, keys: string[]): GridPoint[] {
  if (!isRecord(f) || !isRecord(f.geometry) || !isRecord(f.properties) || !isRecord(f.properties.parameter)) return []
  const c = f.geometry.coordinates
  const v = f.properties.parameter[param]
  if (!Array.isArray(c) || !isNumber(c[0]) || !isNumber(c[1]) || !isRecord(v)) return []
  const months = keys.map((k) => {
    const x = v[k]
    return isNumber(x) && x !== NO_DATA ? x : NaN
  })
  return [{ lon: c[0], lat: c[1], months }]
}

/* every grid spot NASA POWER has in the box (it takes one measurement and at most 10° a request) */
async function powerGrid(url: string, param: UsualParam, box: Box, keys: string[], extra: Record<string, string> = {}): Promise<GridPoint[]> {
  const params = new URLSearchParams({
    parameters: param, community: 'AG', format: 'JSON',
    'latitude-min': String(box.s), 'latitude-max': String(box.n), 'longitude-min': String(box.w), 'longitude-max': String(box.e), ...extra,
  })
  const res = await fetch(`${url}?${params}`)
  if (!res.ok) throw new Error(`NASA POWER request failed (${res.status})`)
  const json: unknown = await res.json()
  if (!isRecord(json) || !Array.isArray(json.features)) throw new Error('NASA POWER sent an unexpected answer')
  return json.features.flatMap((f: unknown) => pointOf(f, param, keys))
}

/* NASA POWER's 25-year monthly averages; a spot counts only with all twelve months */
export async function usualGrid(param: UsualParam, box: Box): Promise<GridPoint[]> {
  const spots = await powerGrid(USUAL_URL, param, box, MONTH_KEYS)
  return spots.filter((p) => p.months.every(Number.isFinite))
}

/* NASA POWER's measured values for each month of one year (from 1981); months it hasn't put out yet are NaN */
export async function pastGrid(param: UsualParam, box: Box, year: number): Promise<GridPoint[]> {
  const keys = MONTH_KEYS.map((_, i) => year + String(i + 1).padStart(2, '0'))
  const spots = await powerGrid(MONTHLY_URL, param, box, keys, { start: String(year), end: String(year) })
  return spots.filter((p) => p.months.some(Number.isFinite))
}

/* the forecast for one spot: rain (mm in the month) and heat (°C on average), one value a month from `first` on, `months` long */
export type SpotForecast = { rain: number[]; heat: number[] }
export type Forecast = { first: number; months: number; spots: Map<string, SpotForecast> }

const FORECAST_URL = 'https://seasonal-api.open-meteo.com/v1/seasonal' /* Open-Meteo: free, no key; about 6 months ahead */
const COORD_DP = 3

export const spotKey = (p: { lon: number; lat: number }) => p.lon.toFixed(COORD_DP) + ',' + p.lat.toFixed(COORD_DP)
const toNumbers = (v: unknown) => (Array.isArray(v) ? v.map((x) => (isNumber(x) ? x : NaN)) : [])

function spotForecast(json: unknown): { first: number; spot: SpotForecast } | null {
  if (!isRecord(json) || !isRecord(json.monthly) || !Array.isArray(json.monthly.time)) return null
  const start: unknown = json.monthly.time[0]
  const d = typeof start === 'string' ? parseIso(start) : null
  if (!d) return null
  return { first: monthIndex(d), spot: { rain: toNumbers(json.monthly.precipitation_mean), heat: toNumbers(json.monthly.temperature_2m_mean) } }
}

/* the monthly forecast for many spots in one request */
export async function forecastFor(spots: { lon: number; lat: number }[]): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: spots.map((p) => p.lat.toFixed(COORD_DP)).join(','),
    longitude: spots.map((p) => p.lon.toFixed(COORD_DP)).join(','),
    monthly: 'precipitation_mean,temperature_2m_mean',
  })
  const res = await fetch(`${FORECAST_URL}?${params}`)
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`)
  const json: unknown = await res.json()
  const answers = (Array.isArray(json) ? json : [json]).map(spotForecast)
  const first = answers.find((a) => a !== null)?.first
  if (first === undefined) throw new Error('The forecast sent an unexpected answer')
  const pairs = spots.flatMap((p, i): [string, SpotForecast][] => {
    const a = answers[i]
    return a ? [[spotKey(p), a.spot]] : []
  })
  const months = Math.max(0, ...pairs.map(([, s]) => s.rain.length))
  return { first, months, spots: new Map(pairs) }
}

/* ---- FAO GAEZ v4: land and crop suitability (free ArcGIS image services, no key) ---- */

const GAEZ_URL = 'https://gaez-services.fao.org/server/rest/services'

/* one raster's value at each point, in the points' order; NaN where FAO has none (the sea).
   Sent as a form POST: FAO's server turns away a long web address, which many points make */
export async function gaezSamples(service: string, field: string, id: number, pts: { lon: number; lat: number }[]): Promise<number[]> {
  const body = new URLSearchParams({
    geometry: JSON.stringify({ points: pts.map((p) => [p.lon, p.lat]) }), geometryType: 'esriGeometryMultipoint', sr: '4326',
    mosaicRule: JSON.stringify({ mosaicMethod: 'esriMosaicNone', where: `${field}=${id}` }),
    returnFirstValueOnly: 'true', returnGeometry: 'false', f: 'json',
  })
  const res = await fetch(`${GAEZ_URL}/${service}/ImageServer/getSamples`, { method: 'POST', body })
  if (!res.ok) throw new Error(`FAO GAEZ request failed (${res.status})`)
  const json: unknown = await res.json()
  if (!isRecord(json) || !Array.isArray(json.samples)) throw new Error('FAO GAEZ sent an unexpected answer')
  const out = pts.map(() => NaN)
  for (const s of json.samples as unknown[]) {
    if (!isRecord(s) || !isNumber(s.locationId) || typeof s.value !== 'string') continue
    const v = Number(s.value)
    if (Number.isFinite(v) && s.locationId < out.length) out[s.locationId] = v
  }
  return out
}

/* ---- NASA POWER at one place: the usual humidity and sunlight for each month ---- */

const POINT_USUAL_URL = 'https://power.larc.nasa.gov/api/temporal/climatology/point'
/* rh: air humidity (%), sun: sunlight reaching the ground (MJ/m² a day); twelve values each, January first */
export type AirUsual = { rh: number[]; sun: number[] }

function monthsOf(v: unknown): number[] | null {
  if (!isRecord(v)) return null
  const months = MONTH_KEYS.map((k) => v[k])
  return months.every((x): x is number => isNumber(x) && x !== NO_DATA) ? months : null
}

export async function airUsual(p: { lon: number; lat: number }): Promise<AirUsual> {
  const params = new URLSearchParams({
    parameters: 'RH2M,ALLSKY_SFC_SW_DWN', community: 'AG', format: 'JSON', longitude: p.lon.toFixed(COORD_DP), latitude: p.lat.toFixed(COORD_DP),
  })
  const res = await fetch(`${POINT_USUAL_URL}?${params}`)
  if (!res.ok) throw new Error(`NASA POWER request failed (${res.status})`)
  const json: unknown = await res.json()
  const param = isRecord(json) && isRecord(json.properties) && isRecord(json.properties.parameter) ? json.properties.parameter : null
  const rh = param && monthsOf(param.RH2M)
  const sun = param && monthsOf(param.ALLSKY_SFC_SW_DWN)
  if (!rh || !sun) throw new Error('NASA POWER sent an unexpected answer')
  return { rh, sun }
}
