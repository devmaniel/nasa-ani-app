import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Point } from '../climate'
import type { CropWeather } from '../crops'
import { M0, type Span } from '../dates'
import { gridKey, kindOf, loadGrid, pastYear, tileAt, valueAt, type Grid, type Kind, type MapLayer } from '../climateLayer'

const LAYERS: MapLayer[] = ['rain', 'heat', 'soil']
const BARS_MIN_MONTHS = 12

/* the last month the sidebar's rain chart shows: the end of the dates, at least a year from their start */
export const barsEnd = (w: Span) => Math.max(w.b, w.a + BARS_MIN_MONTHS - 1)
/* the months the Weather tab needs: the rain chart's and this month (soil now) */
export const weatherMonths = (w: Span) => [...Array.from({ length: barsEnd(w) - w.a + 1 }, (_, i) => w.a + i), M0]

/* a month's value at a point, NASA's usual for that month, and where the value comes from */
export type MonthValue = { v: number; usual: number; kind: Kind }
/* at: null while that month's data is still loading */
export type Weather = { status: 'loading' | 'ready' | 'error'; at: (layer: MapLayer, p: Point, m: number) => MonthValue | null }

/* the crop advice's weather: each month's rain and heat exactly as the map shows them */
export const cropWeather = (wx: Weather): CropWeather => ({
  rain: (p, m) => wx.at('rain', p, m)?.v ?? null,
  heat: (p, m) => wx.at('heat', p, m)?.v ?? null,
})

/* rain, heat and soil at some points for some months, worked out exactly as the map does (NASA POWER measured or usual,
   the Open-Meteo forecast laid over it); the requests are shared with the map, so nothing is asked twice */
export function useWeather(pts: Point[], months: number[]): Weather {
  const [grids, setGrids] = useState<Record<string, Grid | null>>({})
  const tiles = [...new Set(pts.map((p) => tileAt(p.lon, p.lat)))]
  const years = [...new Set(months.map(pastYear))]
  const tilesKey = tiles.join('|')
  const yearsKey = years.map((y) => y ?? 'now').join('|')

  useEffect(() => {
    if (!tilesKey || !yearsKey) return
    for (const layer of LAYERS) {
      for (const t of tilesKey.split('|')) {
        for (const y of yearsKey.split('|')) {
          const year = y === 'now' ? null : Number(y)
          const k = gridKey(layer, t, year)
          loadGrid(layer, t, year).then((g) => setGrids((all) => (all[k] === g ? all : { ...all, [k]: g }))).catch((err: unknown) => {
            console.error('NASA POWER request failed', err)
            setGrids((all) => ({ ...all, [k]: null }))
          })
        }
      }
    }
  }, [tilesKey, yearsKey])

  const keys = LAYERS.flatMap((l) => tiles.flatMap((t) => years.map((y) => gridKey(l, t, y))))
  const status = keys.some((k) => grids[k] === null) ? 'error' : keys.every((k) => grids[k]) ? 'ready' : 'loading'
  /* the same object until the data changes, so work done on it can be kept between redraws */
  const at = useCallback((layer: MapLayer, p: Point, m: number): MonthValue | null => {
    const g = grids[gridKey(layer, tileAt(p.lon, p.lat), pastYear(m))]
    const kind = g ? kindOf(layer, m, g) : null
    if (!g || !kind) return null
    const v = valueAt(layer, kind, m, g, p.lon, p.lat)
    const usual = valueAt(layer, 'usual', m, g, p.lon, p.lat)
    return v === null || usual === null ? null : { v, usual, kind }
  }, [grids])
  return useMemo(() => ({ status, at }), [status, at])
}
