import { AttributionControl, GeoJSONSource, MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef } from 'react'
import { cityBorder, type Area } from '../api'
import { mapStyle } from '../mapStyle'
import { BOUNDS, type Place } from '../places'

/* MapLibre looks for its worker file beside itself, which Vite moves; point it at the real file */
setWorkerUrl(workerUrl)

/* map pictures from OpenFreeMap (free, no key); hills from the free AWS elevation tiles */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const TERRAIN_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
const TERRAIN = { source: 'terrain', exaggeration: 1.5 }
const TERRAIN_TILE_PX = 256
const TERRAIN_MAX_ZOOM = 15
const MAX_PITCH = 60
const START_PITCH = 40
const FLY_PITCH = 55
const TILE_PX = 512
const BORDER_COLOR = '#e53935' /* a bright red that reads over roads and parks */
const BORDER_WIDTH = 3.5
const BORDER_DOTS = [0.1, 1.6] /* short dashes with round ends, close together: a dotted line */
const BORDER_EDGE_COLOR = '#ffffff'
const BORDER_EDGE_WIDTH = 6 /* a white line under the dots so they stand out on busy map */
const BORDER_EDGE_OPACITY = 0.85

/* the zoom at which `span` degrees of longitude fill `widthPx` */
function zoomFor(widthPx: number, span: number) {
  return Math.log2((360 * widthPx) / (TILE_PX * span))
}

/* draw the city border, or clear it with null; before the map has loaded there is nothing to draw on yet */
function showBorder(map: MapLibreMap, area: Area | null) {
  const source = map.getSource('border')
  if (!(source instanceof GeoJSONSource)) return
  source.setData(area ? { type: 'Feature', geometry: area, properties: {} } : { type: 'FeatureCollection', features: [] })
}

/* the pin's look lives in map-changes.css (.pin); its tip is the place */
function pinElement() {
  const el = document.createElement('div')
  el.className = 'pin'
  return el
}

/* 3D: a globe, tilted, with hills. 2D: a flat map seen straight down, north up, no tilting */
function applyMode(map: MapLibreMap, is3d: boolean) {
  map.setProjection({ type: is3d ? 'globe' : 'mercator' })
  if (map.getSource('terrain')) map.setTerrain(is3d ? TERRAIN : null)
  if (is3d) {
    map.setMaxPitch(MAX_PITCH)
    map.easeTo({ pitch: START_PITCH })
  } else {
    map.easeTo({ pitch: 0, bearing: 0 })
    map.once('moveend', () => map.setMaxPitch(0))
  }
}

/* onMap: the map once it has loaded, and null when it goes away */
type Props = { place: Place | null; is3d: boolean; onMap: (map: MapLibreMap | null) => void; inert: boolean }

/* the map; it flies to the picked place, pins it and outlines its city */
export function MapStage({ place, is3d, onMap, inert }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const pinRef = useRef<Marker | null>(null)
  const is3dRef = useRef(is3d)

  useEffect(() => {
    if (!boxRef.current) return
    const map = new MapLibreMap({
      container: boxRef.current,
      style: STYLE_URL,
      transformStyle: mapStyle,
      bounds: [[BOUNDS.w, BOUNDS.s], [BOUNDS.e, BOUNDS.n]],
      pitch: is3dRef.current ? START_PITCH : 0,
      maxPitch: is3dRef.current ? MAX_PITCH : 0,
      attributionControl: false,
    })
    /* the map's credits sit in the empty top-right corner, clear of the buttons; they fold to an "i" once the map is dragged */
    map.addControl(new AttributionControl({ compact: true }), 'top-right')
    map.on('style.load', () => map.setProjection({ type: is3dRef.current ? 'globe' : 'mercator' }))
    map.on('load', () => {
      map.addSource('terrain', { type: 'raster-dem', tiles: [TERRAIN_TILES], encoding: 'terrarium', tileSize: TERRAIN_TILE_PX, maxzoom: TERRAIN_MAX_ZOOM })
      if (is3dRef.current) map.setTerrain(TERRAIN)
      /* the picked city's border: red dots on a white edge, under the map's labels */
      const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
      const round = { 'line-cap': 'round', 'line-join': 'round' } as const
      map.addSource('border', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'border-edge', type: 'line', source: 'border', layout: round,
        paint: { 'line-color': BORDER_EDGE_COLOR, 'line-width': BORDER_EDGE_WIDTH, 'line-opacity': BORDER_EDGE_OPACITY },
      }, firstLabel)
      map.addLayer({
        id: 'border', type: 'line', source: 'border', layout: round,
        paint: { 'line-color': BORDER_COLOR, 'line-width': BORDER_WIDTH, 'line-dasharray': BORDER_DOTS },
      }, firstLabel)
      onMap(map) /* the map's buttons work from here on */
    })
    mapRef.current = map
    return () => {
      onMap(null)
      pinRef.current?.remove()
      pinRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [onMap])

  useEffect(() => {
    const map = mapRef.current
    if (!map || is3dRef.current === is3d) return
    is3dRef.current = is3d
    applyMode(map, is3d)
  }, [is3d])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !place) return
    /* one pin marks the picked place, a searched one or the person's own location */
    pinRef.current ??= new Marker({ element: pinElement(), anchor: 'bottom' }).setLngLat([place.lon, place.lat]).addTo(map)
    pinRef.current.setLngLat([place.lon, place.lat])
    map.flyTo({ center: [place.lon, place.lat], zoom: zoomFor(map.getContainer().clientWidth, place.w), pitch: is3dRef.current ? FLY_PITCH : 0, essential: true })
    /* the old city's outline goes at once; the new one comes when the lookup answers (a newer pick cancels it) */
    showBorder(map, null)
    const lookup = new AbortController()
    cityBorder(place.lon, place.lat, lookup.signal).then((area) => showBorder(map, area)).catch((err: unknown) => {
      if (!lookup.signal.aborted) console.error('City border lookup failed', err)
    })
    return () => lookup.abort()
  }, [place])

  return <div className="stage" id="stage" ref={boxRef} inert={inert} />
}
