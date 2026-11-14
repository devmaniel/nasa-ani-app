import { useEffect, useState } from 'react'
import { airUsual, spotKey, type AirUsual } from '../api'
import type { Point } from '../climate'

/* each place is asked once; a failed request is dropped so it can be tried again */
const cache = new Map<string, Promise<AirUsual>>()

/* NASA POWER's usual humidity and sunlight for each month at one place; null while loading, when it failed, or with no place */
export function useAir(p: Point | null): AirUsual | null {
  const key = p ? spotKey(p) : ''
  const [air, setAir] = useState<{ key: string; v: AirUsual } | null>(null)

  useEffect(() => {
    if (!key) return
    let req = cache.get(key)
    if (!req) {
      const [lon, lat] = key.split(',').map(Number)
      req = airUsual({ lon, lat })
      cache.set(key, req)
      req.catch(() => cache.delete(key))
    }
    let live = true
    req.then((v) => {
      if (live) setAir({ key, v })
    }).catch((err: unknown) => console.error('NASA POWER request failed', err))
    return () => {
      live = false
    }
  }, [key])

  return air && air.key === key ? air.v : null
}
