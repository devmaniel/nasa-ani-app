import { AttributionControl, GeoJSONSource, MapLibreMap, Marker, setWorkerUrl } from 'maplibre-gl'
import { difference } from 'polyclip-ts'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { useEffect, useRef } from 'react'
import { cityBorder, TERRAIN_TILES, type Area } from '../api'
import { mapStyle, pinElement, STYLE_URL } from '../mapStyle'
import { BOUNDS, type Place } from '../places'

/* MapLibre looks for its worker file beside itself, which Vite moves; point it at the real file */
setWorkerUrl(workerUrl)

/* hills from the free AWS elevation tiles */
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
const WATER_LAYER = 'water' /* the style's sea, lakes and rivers fill */
const SEA = 'ocean' /* the water class of the sea and bays (lakes and rivers stay inside a city's outline) */
const SPECK = 0.01 /* after the sea is cut, pieces under this share of the biggest one (breakwaters, piers cut off) are dropped */

/* the zoom at which `span` degrees of longitude fill `widthPx` */
function zoomFor(widthPx: number, span: number) {
  return Math.log2((360 * widthPx) / (TILE_PX * span))
}

type Ring = [number, number][]
type Box = [number, number, number, number]
const ringOf = (r: number[][]): Ring => r.map((p): [number, number] => [p[0], p[1]])
const polysOf = (a: Area) => (a.type === 'Polygon' ? [a.coordinates.map(ringOf)] : a.coordinates.map((poly) => poly.map(ringOf)))
function boxOf(polys: Ring[][]): Box {
  const pts = polys.flatMap((poly) => poly[0] ?? [])
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]
}
/* a ring's size, in square degrees: only for comparing pieces of one city */
function sizeOf(r: Ring) {
  let twice = 0
  r.forEach((p, i) => {
    const q = r[(i + 1) % r.length]
    twice += p[0] * q[1] - q[0] * p[1]
  })
  return Math.abs(twice) / 2
}
const overlaps = (a: Box, b: Box) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]

/* the city without the sea: some city borders (Manila's) reach far out into the bay. The sea comes from the map's own
   loaded tiles, so it is as detailed as the view; with no sea loaded nearby the border stays as it is */
function onLand(map: MapLibreMap, area: Area): Area {
  const water = map.getStyle().layers.find((l) => l.id === WATER_LAYER)
  if (water?.type !== 'fill') return area
  const city = polysOf(area)
  const box = boxOf(city)
  const sea = map.querySourceFeatures(water.source, { sourceLayer: water['source-layer'], filter: ['==', ['get', 'class'], SEA] }).flatMap((f) => {
    const g = f.geometry
    const polys: Ring[][] = g.type === 'Polygon' || g.type === 'MultiPolygon' ? polysOf(g) : []
    return polys.filter((poly) => overlaps(boxOf([poly]), box))
  })
  if (!sea.length) return area
  const land = difference(city, ...sea)
  const biggest = Math.max(0, ...land.map((poly) => sizeOf(poly[0])))
  const kept = land.filter((poly) => sizeOf(poly[0]) >= biggest * SPECK)
  return kept.length ? { type: 'MultiPolygon', coordinates: kept } : area
}

/* draw the city border, or clear it with null; before the map has loaded there is nothing to draw on yet */
function showBorder(map: MapLibreMap, area: Area | null) {
  const source = map.getSource('border')
  if (!(source instanceof GeoJSONSource)) return
  source.setData(area ? { type: 'Feature', geometry: area, properties: {} } : { type: 'FeatureCollection', features: [] })
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
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
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
    /* the old city's outline goes at once; the new one comes when the lookup answers (a newer pick cancels it).
       It is drawn once the map has settled with its tiles loaded, and again after each move, so the sea is cut from it */
    showBorder(map, null)
    let area: Area | null = null
    const draw = () => {
      if (area) showBorder(map, onLand(map, area))
    }
    map.on('idle', draw)
    const lookup = new AbortController()
    cityBorder(place.lon, place.lat, lookup.signal).then((a) => {
      area = a
      map.triggerRepaint() /* the map settles again, so an already quiet map draws it too */
    }).catch((err: unknown) => {
      if (!lookup.signal.aborted) console.error('City border lookup failed', err)
    })
    return () => {
      lookup.abort()
      map.off('idle', draw)
    }
  }, [place])

  return <div className="stage" id="stage" ref={boxRef} inert={inert} />
}
