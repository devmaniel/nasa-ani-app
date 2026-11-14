import { useEffect, useState } from 'react'
import { spotKey } from '../api'
import type { Point } from '../climate'
import { loadFieldPicture, loadGround, loadLately, type FieldPicture, type Ground, type Lately } from '../space'

type Got = { key: string; lately: Lately | null; ground: Ground | null; fields: FieldPicture | null }
const NONE = { lately: null, ground: null, fields: null }

/* the readings from space at one place (space.ts): lately, the ground at the spot and the newest clear field photo; each null while loading,
   when it failed (or there's no clear photo), or with no place. Each place is loaded once and kept. */
export function useSpace(p: Point | null): Omit<Got, 'key'> {
  const key = p ? spotKey(p) : ''
  const [got, setGot] = useState<Got>({ key: '', ...NONE })

  useEffect(() => {
    if (!key) return
    const [lon, lat] = key.split(',').map(Number)
    let live = true
    const put = (part: Partial<Got>) => {
      if (live) setGot((g) => ({ ...(g.key === key ? g : { key, ...NONE }), ...part }))
    }
    loadLately({ lon, lat }).then((lately) => put({ lately })).catch((err: unknown) => console.error('Readings from space failed', err))
    loadGround({ lon, lat }).then((ground) => put({ ground })).catch((err: unknown) => console.error('NASA SRTM failed', err))
    loadFieldPicture({ lon, lat }).then((fields) => put({ fields })).catch((err: unknown) => console.error('NASA HLS failed', err))
    return () => {
      live = false
    }
  }, [key])

  return got.key === key ? got : NONE
}
