import { Link } from '@tanstack/react-router'
import type { Place } from '../places'
import { PlaceSearch } from './PlaceSearch'

type Props = {
  recent: Place[]
  onGo: (p: Place) => void
  onLocate: () => void
  inert: boolean
}

/* the top bar: the logo and, right beside it, the place search */
export function TopBar({ recent, onGo, onLocate, inert }: Props) {
  return (
    <header className="top" inert={inert}>
      <Link className="mbrand" to="/" aria-label="Ani, back to the home page"><span className="brand" /></Link>
      <PlaceSearch recent={recent} onGo={onGo} onLocate={onLocate} />
    </header>
  )
}
