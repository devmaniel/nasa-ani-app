import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { SPOT_W, type Place } from './places'

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
