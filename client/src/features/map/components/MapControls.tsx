import { ChevronDown, ChevronUp, Cloud, CloudSun, Droplets, LandPlot, Minus, Navigation, Plus, Sprout, Sun } from 'lucide-react'
import type { MapLibreMap } from 'maplibre-gl'
import { useEffect, useState, type ReactNode } from 'react'
import { TbRipple } from 'react-icons/tb'
import type { LayerView } from '../hooks/useClimateLayer'
import { coords } from '../places'
import type { IconType, LayerKey } from '../types'
import { LayerLegend, NoDataBadge } from './LayerLegend'

const CHIPS: [LayerKey, IconType, string][] = [
  ['rain', Cloud, 'Rain'], ['heat', Sun, 'Heat'], ['soil', TbRipple, 'Soil'], ['humid', Droplets, 'Humidity'], ['sun', CloudSun, 'Sun'], ['plants', Sprout, 'Plants'], ['fields', LandPlot, 'Fields'],
]

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
  layer: LayerKey | null; onLayer: (l: LayerKey) => void; locating: boolean; onLocate: () => void; hint: Hint | null; inert: boolean; children: ReactNode
  map: MapLibreMap | null; is3d: boolean; onToggle3d: () => void; layerView: LayerView | null
}

/* on the map: layer chips top left; 2D/3D, tilt, my location and zoom bottom right; a hint for a moment;
   the time bar, the centre's coordinates and the scale bottom left. The map buttons wait for the map. */
export function MapControls({ layer, onLayer, locating, onLocate, hint, inert, children, map, is3d, onToggle3d, layerView }: Props) {
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
      <div className="layers" role="group" aria-label="Map layer">
        {CHIPS.map(([l, Ic, label]) => (
          <button key={l} className="chip glass" type="button" data-layer={l} aria-pressed={layer === l} onClick={() => onLayer(l)}>
            <Ic className="i" aria-hidden />{label}
          </button>
        ))}
      </div>
      {layerView && <LayerLegend view={layerView} />}
      <nav className="rail" aria-label="Map tools">
        <div className="rg">
          {/* the button names the view it switches to */}
          <button className="rb glass mode" type="button" aria-label={is3d ? 'Switch to 2D' : 'Switch to 3D'} disabled={!map} onClick={onToggle3d}>
            {is3d ? '2D' : '3D'}<span className="tip" aria-hidden="true">{is3d ? 'Flat map' : 'Globe, tilt and hills'}</span>
          </button>
          {is3d && (
            <div className="zoomg glass" role="group" aria-label="Tilt">
              <button className="rb" type="button" aria-label="Tilt up" disabled={!map} onClick={() => tilt(true)}><ChevronUp className="i" /><span className="tip" aria-hidden="true">Tilt up</span></button>
              <button className="rb" type="button" aria-label="Tilt down" disabled={!map} onClick={() => tilt(false)}><ChevronDown className="i" /><span className="tip" aria-hidden="true">Tilt down</span></button>
            </div>
          )}
          <button className="rb glass" id="loc" type="button" aria-label="Use my location" aria-busy={locating || undefined} onClick={onLocate}>
            <Navigation className="i" /><span className="tip" aria-hidden="true">Use my location</span>
          </button>
          <div className="zoomg glass" role="group" aria-label="Zoom">
            <button className="rb" type="button" id="zin" aria-label="Zoom in" disabled={!map} onClick={() => map?.zoomIn()}><Plus className="i" /><span className="tip" aria-hidden="true">Zoom in</span></button>
            <button className="rb" type="button" id="zout" aria-label="Zoom out" disabled={!map} onClick={() => map?.zoomOut()}><Minus className="i" /><span className="tip" aria-hidden="true">Zoom out</span></button>
          </div>
        </div>
      </nav>
      <p className="hint glass" id="hint" aria-live="polite" hidden={!hint} data-warn={hint?.warn ? '' : undefined}>{hint?.msg}</p>
      <div className="dock">
        {layerView && <NoDataBadge view={layerView} />}
        {children}
        <div className="foot" aria-hidden="true">
          <span className="ll num" id="ll">{view && coords(view.lon, view.lat)}</span>
          <span className="scale num"><i id="scale-bar" style={{ width: (scale?.px ?? 0) + 'px' }} /><span id="scale-t">{scale?.label}</span></span>
        </div>
      </div>
    </div>
  )
}
