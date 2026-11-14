import { Link } from '@tanstack/react-router'
import earth from '../assets/earth.webp'

/* The page's one call to action: "Open the map" with the Earth sticker, no button */
export function MapCta() {
  return (
    <Link className="cta" to="/map">
      Open the map<img src={earth} alt="" />
    </Link>
  )
}
