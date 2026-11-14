import { useEffect, useState } from 'react'
import { placeName, spotKey } from '../api'
import type { Point } from '../climate'

/* each spot is asked once; a failed request is dropped so it can be tried again */
const cache = new Map<string, Promise<string | null>>()

/* the town and province at a point ("Carmona, Cavite"), from OpenStreetMap; null while loading, when it failed, or with no point */
export function usePlaceName(p: Point | null): string | null {
  const key = p ? spotKey(p) : ''
  const [got, setGot] = useState<{ key: string; name: string | null } | null>(null)

  useEffect(() => {
    if (!key) return
    let req = cache.get(key)
    if (!req) {
      const [lon, lat] = key.split(',').map(Number)
      req = placeName(lon, lat)
      cache.set(key, req)
      req.catch(() => cache.delete(key))
    }
    let live = true
    req.then((name) => {
      if (live) setGot({ key, name })
    }).catch((err: unknown) => console.error('Place name lookup failed', err))
    return () => {
      live = false
    }
  }, [key])

  return got && got.key === key ? got.name : null
}
