import { Clock, MapPin, Navigation, Search } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { newSession, placeOf, suggestPlaces, type SessionToken, type Suggestion } from '../api'
import type { Place } from '../places'
import type { IconType } from '../types'

const MATCH_MAX = 6
const TYPE_PAUSE_MS = 250 /* ask Google once typing pauses, not on every key */
type Item = { n: string; k?: string; ic: IconType; go: () => void }
type Status = 'idle' | 'loading' | 'error'

type Props = { recent: Place[]; onGo: (p: Place) => void; onLocate: () => void }

/* empty box: "Use my location" and the places chosen on this visit; typing: Google's matching places in the Philippines */
export function PlaceSearch({ recent, onGo, onLocate }: Props) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('') /* what the person typed; picking a place changes the box, not this */
  const [open, setOpen] = useState(false)
  const [act, setAct] = useState(-1)
  const [found, setFound] = useState<Suggestion[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const barRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<SessionToken | null>(null)
  const q = query.trim()

  const goTo = (p: Place) => {
    setText(p.name)
    onGo(p)
  }
  const pick = (s: Suggestion) => {
    setText(s.name)
    sessionRef.current = null /* picking a place ends the search session */
    placeOf(s).then(onGo).catch((err: unknown) => {
      console.error('Google place details failed', err)
      setFound([])
      setStatus('error')
      setOpen(true)
    })
  }
  const items: Item[] = !q
    ? [{ n: 'Use my location', ic: Navigation, go: onLocate }, ...recent.map((r): Item => ({ n: r.name, k: r.sub, ic: Clock, go: () => goTo(r) }))]
    : found.slice(0, MATCH_MAX).map((s): Item => ({ n: s.name, k: s.sub, ic: MapPin, go: () => pick(s) }))

  /* typing asks Google for matches once typing pauses; an answer for older text is dropped */
  useEffect(() => {
    if (!q) return
    let stale = false
    const timer = setTimeout(async () => {
      try {
        sessionRef.current ??= await newSession()
        const list = await suggestPlaces(q, sessionRef.current)
        if (stale) return
        setFound(list)
        setStatus('idle')
        setAct(list.length ? 0 : -1)
      } catch (err: unknown) {
        if (stale) return
        console.error('Google place search failed', err)
        setFound([])
        setStatus('error')
      }
    }, TYPE_PAUSE_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [q])

  const show = (value: string) => {
    setOpen(true)
    setAct(value.trim() ? 0 : -1)
  }
  const run = (it: Item) => {
    setOpen(false)
    it.go()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length || !open) return
      e.preventDefault()
      setAct((act + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length)
    } else if (e.key === 'Enter') {
      if (act >= 0 && open && items[act]) {
        e.preventDefault()
        run(items[act])
      }
    } else if (e.key === 'Escape') setOpen(false)
  }

  /* a click anywhere outside the search closes the list */
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !barRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const empty = status === 'error'
    ? 'Search isn’t working right now. Try again, or use your location.'
    : status === 'loading' ? 'Searching…' : `No place found for “${q}”.`
  const active = open && act >= 0 && items[act] ? 'o' + act : undefined
  return (
    <div className="search" id="bar" ref={barRef} data-open={open ? '' : undefined}>
      <div className="sbox">
        <Search className="i" />
        <input
          id="q" type="text" autoComplete="off" spellCheck={false} placeholder="Search a city, province or region"
          role="combobox" aria-label="Search a place" aria-autocomplete="list" aria-expanded={open} aria-controls="sug" aria-activedescendant={active}
          value={text}
          onChange={(e) => {
            const v = e.target.value
            setText(v)
            setQuery(v)
            /* an empty box drops old matches; typed text waits for Google */
            if (!v.trim()) setFound([])
            setStatus(v.trim() ? 'loading' : 'idle')
            show(v)
          }}
          onFocus={() => show(query)}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul className="sug glass" id="sug" role="listbox" aria-label="Places" hidden={!open} onMouseDown={(e) => e.preventDefault()}>
        {items.length ? items.map((it, i) => (
          <li key={it.n + i} role="option" id={'o' + i} data-i={i} aria-selected={i === act} onMouseDown={() => run(it)}>
            <span className="si"><it.ic className="i" aria-hidden /></span>
            <span className="st"><b>{it.n}</b>{it.k && <small>{it.k}</small>}</span>
          </li>
        )) : (
          <li className="none" role="option" aria-disabled="true">{empty}</li>
        )}
      </ul>
    </div>
  )
}
