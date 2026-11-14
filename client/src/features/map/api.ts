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

/* NASA's map picture of a layer (GIBS: free, no key); `level` is the closest zoom NASA draws it at;
   time: 'default' for the latest, or a day (YYYY-MM-DD) for an older picture */
export function nasaTiles(layerId: string, level: number, time = 'default') {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerId}/default/${time}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.png`
}

export type Box = { w: number; s: number; e: number; n: number }
/* a spot on NASA POWER's grid and its value for each month, January first (NaN where NASA has none) */
export type GridPoint = { lon: number; lat: number; months: number[] }
export type UsualParam = 'PRECTOTCORR' | 'T2M' | 'GWETROOT'

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
