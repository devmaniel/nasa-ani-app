import { ChevronDown, ChevronUp, Minus, Navigation, Plus } from 'lucide-react'
import type { MapLibreMap } from 'maplibre-gl'
import { useEffect, useState } from 'react'
import { coords } from '../places'

const TILT_STEP = 15
const SCALE_PX = 90 /* the scale bar is at most this wide */
const NICE = [1, 2, 5]

/* a round distance (1, 2 or 5 times a power of ten) that fits in SCALE_PX, given km per pixel */
function scaleFor(kmPx: number) {
  const target = kmPx * SCALE_PX
  const pow = Math.pow(10, Math.floor(Math.log10(target)))
  const km = [...NICE].reverse().map((n) => n * pow).find((k) => k <= target) ?? pow
  return { px: Math.round(km / kmPx), label: km >= 1 ? km + ' km' : Math.round(km * 1000) + ' m' }
}

/* the map centre and how many km one pixel covers there, measured on the map so it holds on the globe and when tilted */
function readView(map: MapLibreMap) {
  const { clientWidth: w, clientHeight: h } = map.getContainer()
  const a = map.unproject([w / 2, h / 2])
  const b = map.unproject([w / 2 + SCALE_PX, h / 2])
  return { lon: a.lng, lat: a.lat, kmPx: a.distanceTo(b) / 1000 / SCALE_PX }
}

export type Hint = { msg: string; warn: boolean }
type Props = {
  locating: boolean; onLocate: () => void; hint: Hint | null; inert: boolean
  map: MapLibreMap | null; is3d: boolean; onToggle3d: () => void
}

/* on the map: one see-through pill at the bottom centre with 2D/3D, tilt, my location and zoom; a hint for a moment;
   the centre's coordinates and the scale bottom left. The map buttons wait for the map. */
export function MapControls({ locating, onLocate, hint, inert, map, is3d, onToggle3d }: Props) {
  const [view, setView] = useState<ReturnType<typeof readView> | null>(null)
  const scale = view && view.kmPx > 0 ? scaleFor(view.kmPx) : null
  const tilt = (up: boolean) => map?.easeTo({ pitch: map.getPitch() + (up ? TILT_STEP : -TILT_STEP) }) /* the map keeps it within its limits */

  useEffect(() => {
    if (!map) return
    const update = () => setView(readView(map))
    update()
    map.on('move', update)
    return () => {
      map.off('move', update)
    }
  }, [map])

  return (
    <div className="mapui" inert={inert}>
      <nav className="rail" aria-label="Map tools">
        <div className="rg">
          {/* the button names the view it switches to */}
          <button className="rb mode" type="button" aria-label={is3d ? 'Switch to 2D' : 'Switch to 3D'} disabled={!map} onClick={onToggle3d}>
            {is3d ? '2D' : '3D'}<span className="tip" aria-hidden="true">{is3d ? 'Flat map' : 'Globe, tilt and hills'}</span>
          </button>
          {is3d && (
            <>
              <button className="rb" type="button" aria-label="Tilt up" disabled={!map} onClick={() => tilt(true)}><ChevronUp className="i" /><span className="tip" aria-hidden="true">Tilt up</span></button>
              <button className="rb" type="button" aria-label="Tilt down" disabled={!map} onClick={() => tilt(false)}><ChevronDown className="i" /><span className="tip" aria-hidden="true">Tilt down</span></button>
            </>
          )}
          <i className="sep" aria-hidden="true" />
          <button className="rb" id="loc" type="button" aria-label="Use my location" aria-busy={locating || undefined} onClick={onLocate}>
            <Navigation className="i" /><span className="tip" aria-hidden="true">Use my location</span>
          </button>
          <i className="sep" aria-hidden="true" />
          <button className="rb" type="button" id="zout" aria-label="Zoom out" disabled={!map} onClick={() => map?.zoomOut()}><Minus className="i" /><span className="tip" aria-hidden="true">Zoom out</span></button>
          <button className="rb" type="button" id="zin" aria-label="Zoom in" disabled={!map} onClick={() => map?.zoomIn()}><Plus className="i" /><span className="tip" aria-hidden="true">Zoom in</span></button>
        </div>
      </nav>
      <p className="hint glass" id="hint" aria-live="polite" hidden={!hint} data-warn={hint?.warn ? '' : undefined}>{hint?.msg}</p>
      <div className="dock">
        <div className="foot" aria-hidden="true">
          <span className="ll num" id="ll">{view && coords(view.lon, view.lat)}</span>
          <span className="scale num"><i id="scale-bar" style={{ width: (scale?.px ?? 0) + 'px' }} /><span id="scale-t">{scale?.label}</span></span>
        </div>
      </div>
    </div>
  )
}
