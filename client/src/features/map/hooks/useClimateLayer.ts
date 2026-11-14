import { ImageSource, RasterTileSource, type MapLibreMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { nasaTiles } from '../api'
import {
  areaPicture, cssColor, gridKey, isLive, kindOf, loadGrid, LOOKS, pastYear, pictureFor, tileAt, tilesIn, valueAt,
  type AreaPicture, type AreaTile, type Grid, type Kind, type MapLayer, type MapPicture,
} from '../climateLayer'
import type { Span } from '../dates'
import { loadFieldPicture, type FieldPicture } from '../space'
import type { LayerKey } from '../types'

const NASA_OPACITY = 0.6
const NASA_TILE_PX = 256
const NASA_PREFIX = 'nasa-'
const AREA_PREFIX = 'area-'
const AREA_OPACITY = 0.7
const FADE_MS = 700 /* one month fades into the next */
const SEA_LAYER = 'water' /* the map's sea: the colours go under it, so only land is coloured */

/* the newest clear field photo, drawn solid: its source line carries the satellite and the cloud */
const fieldsPicture = (f: FieldPicture): MapPicture => ({
  id: f.id, level: f.level, sharp: f.level, time: f.day, opacity: 1, source: f.name + ' · ' + Math.round(f.cloud) + '% cloud · NASA HLS',
})
/* the field photo is looked up for the map centre rounded to this many decimals (about 11 km); one photo covers about 110 km */
const FIELDS_DP = 1

/* what the picked layer shows for a month: kind (the data's kind) is null while it loads, and always for Plants and Fields (pictures only);
   live: it's this month; picture: NASA's picture on the map, if any; value: the value at the map centre;
   limited: zoomed out too far for all the land in view to be coloured; strip: every month of the dates at the map centre, for the time bar */
export type LayerView = {
  layer: LayerKey; month: number; kind: Kind | null; live: boolean; picture: MapPicture | null; value: number | null; limited: boolean
  strip: Strip | null; status: 'loading' | 'ready' | 'error'
}
/* a month's colour at the map centre, the same as on the map (null while it loads); usual: no forecast or measurement, NASA's usual */
export type StripCell = { m: number; color: string | null; usual: boolean }
export type Strip = { label: string; cells: StripCell[] }
type View = { lon: number; lat: number; w: number; s: number; e: number; n: number }
/* the colours are two pictures taking turns, so a new month fades in over the last; key: what the front one shows */
type Painted = { front: 'a' | 'b'; key: string; layer: MapLayer | null }

const areaId = (side: 'a' | 'b') => AREA_PREFIX + side

/* the first of the map's own layers with this id, else its first name layer */
function beforeId(map: MapLibreMap, id?: string) {
  const layers = map.getStyle().layers
  return layers.find((l) => l.id === id)?.id ?? layers.find((l) => l.type === 'symbol')?.id
}

/* NASA's picture for the picked layer and month (each kind of picture added the first time it's needed, its month swapped in after), the others hidden */
function showNasa(map: MapLibreMap, pic: MapPicture | null) {
  const want = pic ? NASA_PREFIX + pic.id : null
  if (pic && want) {
    const url = nasaTiles(pic.id, pic.level, pic.time)
    const src = map.getSource(want)
    if (!src) {
      map.addSource(want, { type: 'raster', tiles: [url], tileSize: NASA_TILE_PX, maxzoom: pic.sharp, attribution: 'NASA GIBS' })
      map.addLayer({ id: want, type: 'raster', source: want, paint: { 'raster-opacity': pic.opacity ?? NASA_OPACITY } }, beforeId(map))
    } else if (src instanceof RasterTileSource && src.tiles[0] !== url) src.setTiles([url])
  }
  for (const l of map.getStyle().layers) {
    if (l.id.startsWith(NASA_PREFIX)) map.setLayoutProperty(l.id, 'visibility', l.id === want ? 'visible' : 'none')
  }
}

/* one of the two colour pictures, added empty and see-through the first time, under the sea */
function areaSource(map: MapLibreMap, side: 'a' | 'b', pic: AreaPicture) {
  const id = areaId(side)
  if (!map.getSource(id)) {
    map.addSource(id, { type: 'image', coordinates: pic.corners })
    map.addLayer({
      id, type: 'raster', source: id,
      paint: { 'raster-opacity': 0, 'raster-opacity-transition': { duration: FADE_MS, delay: 0 }, 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
    }, beforeId(map, SEA_LAYER))
  }
  const src = map.getSource(id)
  return src instanceof ImageSource ? src : null
}

/* fade the new colours in over the old ones */
function paintArea(map: MapLibreMap, was: Painted, key: string, layer: MapLayer, pic: AreaPicture): Painted {
  const back = was.front === 'a' ? 'b' : 'a'
  areaSource(map, back, pic)?.updateImage({ image: new ImageData(pic.pixels, pic.width, pic.height), coordinates: pic.corners })
  map.setPaintProperty(areaId(back), 'raster-opacity', AREA_OPACITY)
  if (map.getLayer(areaId(was.front))) map.setPaintProperty(areaId(was.front), 'raster-opacity', 0)
  return { front: back, key, layer }
}

/* fade the colours out */
function hideArea(map: MapLibreMap, was: Painted): Painted {
  if (map.getLayer(areaId(was.front))) map.setPaintProperty(areaId(was.front), 'raster-opacity', 0)
  return { ...was, key: '', layer: null }
}

/* the picked layer for a month: rain, heat and soil colour the land in view (fading from month to month), with the value at the
   map centre for the key; NASA's picture on the map where there is one */
export function useClimateLayer(map: MapLibreMap | null, layer: LayerKey | null, month: number, span: Span): LayerView | null {
  const shown: MapLayer | null = layer === 'plants' || layer === 'fields' ? null : layer
  const [view, setView] = useState<View | null>(null)
  const [grids, setGrids] = useState<Record<string, Grid | null>>({})
  /* the last field photo found (kept while the next one is looked up, so moving the map doesn't blink); failed: that search failed */
  const [fields, setFields] = useState<{ key: string; pic: FieldPicture | null; failed: boolean } | null>(null)
  const fieldsKey = layer === 'fields' && view ? view.lon.toFixed(FIELDS_DP) + ',' + view.lat.toFixed(FIELDS_DP) : ''
  const painted = useRef<Painted>({ front: 'b', key: '', layer: null })
  const year = pastYear(month)
  const inView = view ? tilesIn(view) : null
  const tilesKey = inView ? inView.tiles.join('|') : ''
  const centreTile = view ? tileAt(view.lon, view.lat) : null
  const centreKey = shown && centreTile ? gridKey(shown, centreTile, year) : null
  const months = Array.from({ length: span.b - span.a + 1 }, (_, i) => span.a + i)
  /* the past years the dates cover ('now' for this month on), for the time bar's colours */
  const yearsKey = [...new Set(months.map((m) => pastYear(m) ?? 'now'))].join('|')
  const grid = centreKey ? grids[centreKey] : undefined
  const kind = shown && grid ? kindOf(shown, month, grid) : null
  const live = isLive(month)
  /* NASA's pictures are blocky over the smooth colours, so only Plants and Fields (which have no numbers to colour) show one */
  const fieldPic = fields?.pic ?? null
  const picture = useMemo(
    () => (layer === 'plants' ? pictureFor(layer, month) : layer === 'fields' && fieldPic ? fieldsPicture(fieldPic) : null),
    [layer, month, fieldPic],
  )
  const value = shown && grid && kind && view ? valueAt(shown, kind, month, grid, view.lon, view.lat) : null

  /* follow the map: its centre and the area in view */
  useEffect(() => {
    if (!map) return
    const follow = () => {
      const c = map.getCenter()
      const b = map.getBounds()
      setView({ lon: c.lng, lat: c.lat, w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() })
    }
    follow()
    map.on('moveend', follow)
    return () => {
      map.off('moveend', follow)
    }
  }, [map])

  /* the data for the layer, every tile in view and (for a past month) its year; each kept once loaded */
  useEffect(() => {
    if (!shown || !tilesKey) return
    for (const t of tilesKey.split('|')) {
      const k = gridKey(shown, t, year)
      loadGrid(shown, t, year).then((g) => setGrids((all) => (all[k] === g ? all : { ...all, [k]: g }))).catch((err: unknown) => {
        console.error('NASA POWER request failed', err)
        setGrids((all) => ({ ...all, [k]: null }))
      })
    }
  }, [shown, tilesKey, year])

  /* the data at the centre for every year the dates cover, for the time bar */
  useEffect(() => {
    if (!shown || !centreTile) return
    for (const y of yearsKey.split('|')) {
      const yr = y === 'now' ? null : Number(y)
      const k = gridKey(shown, centreTile, yr)
      loadGrid(shown, centreTile, yr).then((g) => setGrids((all) => (all[k] === g ? all : { ...all, [k]: g }))).catch((err: unknown) => {
        console.error('NASA POWER request failed', err)
        setGrids((all) => ({ ...all, [k]: null }))
      })
    }
  }, [shown, centreTile, yearsKey])

  /* colour the land for the month once the centre's data is in; until then the last colours stay (same layer), so playing never blinks */
  useEffect(() => {
    if (!map) return
    const was = painted.current
    if (!shown || !tilesKey) {
      painted.current = hideArea(map, was)
      return
    }
    if (!kind) {
      if (was.layer !== shown) painted.current = hideArea(map, was)
      return
    }
    const tiles = tilesKey.split('|')
    const ready = tiles.flatMap((t): AreaTile[] => {
      const g = grids[gridKey(shown, t, year)]
      const k = g ? kindOf(shown, month, g) : null
      return g && k ? [{ tile: t, grid: g, kind: k }] : []
    })
    const key = [shown, month, tilesKey, ...ready.map((r) => r.tile + r.kind)].join(':')
    if (key !== was.key) painted.current = paintArea(map, was, key, shown, areaPicture(shown, month, tiles, ready))
  }, [map, shown, kind, month, year, grids, tilesKey])

  /* Fields: the newest clear photo over the map centre */
  useEffect(() => {
    if (!fieldsKey) return
    const [lon, lat] = fieldsKey.split(',').map(Number)
    let live = true
    loadFieldPicture({ lon, lat }).then((pic) => {
      if (live) setFields({ key: fieldsKey, pic, failed: false })
    }).catch((err: unknown) => {
      console.error('NASA field photo search failed', err)
      if (live) setFields({ key: fieldsKey, pic: null, failed: true })
    })
    return () => {
      live = false
    }
  }, [fieldsKey])

  useEffect(() => {
    if (map) showNasa(map, picture)
  }, [map, picture])

  const limited = inView?.limited ?? false
  if (layer === 'plants') return { layer, month, kind: null, live, picture, value: null, limited, strip: null, status: 'ready' }
  if (layer === 'fields') {
    const status = !fields || fields.key !== fieldsKey ? 'loading' : fields.failed ? 'error' : 'ready'
    return { layer, month, kind: null, live, picture, value: null, limited, strip: null, status }
  }
  if (!shown) return null
  const cells = months.map((m): StripCell => {
    const g = centreTile ? grids[gridKey(shown, centreTile, pastYear(m))] : undefined
    const k = g ? kindOf(shown, m, g) : null
    const v = g && k && view ? valueAt(shown, k, m, g, view.lon, view.lat) : null
    return { m, color: v === null ? null : cssColor(shown, v), usual: k === 'usual' }
  })
  const strip = { label: LOOKS[shown].name + ' at the map centre, month by month', cells }
  const status = kind ? 'ready' : grid === null ? 'error' : 'loading'
  return { layer: shown, month, kind, live, picture, value, limited, strip, status }
}
