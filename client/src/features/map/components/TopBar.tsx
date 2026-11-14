import { Calendar, ChevronDown } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { RefObject } from 'react'
import { fmtY, fromWord, type Dates } from '../dates'
import type { Place } from '../places'
import { PlaceSearch } from './PlaceSearch'

type Props = {
  dates: Dates
  datesOpen: boolean
  datesButtonRef: RefObject<HTMLButtonElement | null>
  onToggleDates: () => void
  recent: Place[]
  onGo: (p: Place) => void
  onLocate: () => void
  inert: boolean
}

/* the top bar: the logo, the place search and the dates button */
export function TopBar({ dates, datesOpen, datesButtonRef, onToggleDates, recent, onGo, onLocate, inert }: Props) {
  const when = fromWord(dates) + ' to ' + fmtY(dates.to)
  return (
    <header className="top" inert={inert}>
      <Link className="mbrand" to="/" aria-label="Ani, back to the home page"><span className="brand" /></Link>
      <PlaceSearch recent={recent} onGo={onGo} onLocate={onLocate} />
      <button className="dbtn" id="dbtn" ref={datesButtonRef} type="button" aria-controls="dp" aria-expanded={datesOpen} aria-label={'Dates: ' + when + '. Change dates'} onClick={onToggleDates}>
        <Calendar className="i" />
        <span id="dlabel">{fromWord(dates)}</span>
        <span className="dk num" id="dsub">to {fmtY(dates.to)}</span>
        <ChevronDown className="i" />
      </button>
    </header>
  )
}
