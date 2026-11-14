import { useEffect, useState } from 'react'
import { spotKey } from '../api'
import type { Point } from '../climate'
import { loadGround, loadLately, type Ground, type Lately } from '../space'

type Got = { key: string; lately: Lately | null; ground: Ground | null }

/* the readings from space at one place (space.ts): lately and the ground at the spot; each null while loading,
   when it failed, or with no place. Each place is loaded once and kept. */
export function useSpace(p: Point | null): { lately: Lately | null; ground: Ground | null } {
  const key = p ? spotKey(p) : ''
  const [got, setGot] = useState<Got>({ key: '', lately: null, ground: null })

  useEffect(() => {
    if (!key) return
    const [lon, lat] = key.split(',').map(Number)
    let live = true
    const put = (part: Partial<Got>) => {
      if (live) setGot((g) => ({ ...(g.key === key ? g : { key, lately: null, ground: null }), ...part }))
    }
    loadLately({ lon, lat }).then((lately) => put({ lately })).catch((err: unknown) => console.error('Readings from space failed', err))
    loadGround({ lon, lat }).then((ground) => put({ ground })).catch((err: unknown) => console.error('NASA SRTM failed', err))
    return () => {
      live = false
    }
  }, [key])

  return got.key === key ? got : { lately: null, ground: null }
}
