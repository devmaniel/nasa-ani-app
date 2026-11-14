import { AttributionControl, MapLibreMap, Marker } from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { mapStyle, pinElement, STYLE_URL } from '../mapStyle'
import type { Place } from '../places'

const HALF_LON = 5 /* about 10° × 7° around the place, like the rain key's area */
const HALF_LAT = 3.3

/* the report's small map: a still view around the place, pinned */
export function ReportMap({ place }: { place: Place }) {
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!boxRef.current) return
    const map = new MapLibreMap({
      container: boxRef.current,
      style: STYLE_URL,
      transformStyle: mapStyle,
      bounds: [[place.lon - HALF_LON, place.lat - HALF_LAT], [place.lon + HALF_LON, place.lat + HALF_LAT]],
      interactive: false,
      attributionControl: false,
    })
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right')
    /* MapLibre folds the credits to their ⓘ only once the map is dragged; this one can't be, so fold them once it has drawn */
    map.once('idle', () => map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'))
    new Marker({ element: pinElement(), anchor: 'bottom' }).setLngLat([place.lon, place.lat]).addTo(map)
    return () => map.remove()
  }, [place])

  return <div className="rp-mp" ref={boxRef} role="img" aria-label={'Map around ' + place.name + ', marked with a pin'} />
}
