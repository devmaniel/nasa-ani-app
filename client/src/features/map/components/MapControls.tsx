import { Cloud, Minus, Navigation, Plus, Sprout, Sun } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { clamp } from '../climate'
import { TbRipple } from 'react-icons/tb'
import { coords } from '../places'
import type { IconType, LayerKey } from '../types'

const CHIPS: [LayerKey, IconType, string][] = [['rain', Cloud, 'Rain'], ['heat', Sun, 'Heat'], ['soil', TbRipple, 'Soil'], ['plants', Sprout, 'Plants']]

/* the template's starting map view: its centre and width in degrees, from the map's size when it opens.
   The map can't move yet, so the coordinates and the scale stay at these values. */
const START = { cx: 121.8, cy: 12.6 }
const MIN_W = 0.012
const MAX_W = 40
const SCALE_PX = 90
const NICE = [1, 2, 5]
const KM_PER_DEG = 111
function scaleFor(width: number, height: number) {
  const viewW = clamp(Math.max(11, (17.5 * width) / height), MIN_W, MAX_W)
  const kmPx = (viewW * KM_PER_DEG * Math.cos((START.cy * Math.PI) / 180)) / width
  const target = kmPx * SCALE_PX
  const pow = Math.pow(10, Math.floor(Math.log10(target)))
  let km = pow
  NICE.forEach((n) => {
    if (n * pow <= target) km = n * pow
  })
  return { px: Math.round(km / kmPx), label: km >= 1 ? km + ' km' : Math.round(km * 1000) + ' m' }
}

export type Hint = { msg: string; warn: boolean }
type Props = { layer: LayerKey | null; onLayer: (l: LayerKey) => void; locating: boolean; onLocate: () => void; hint: Hint | null; inert: boolean; children: ReactNode }

/* on the map: layer chips top left, my location and zoom bottom right, a hint for a moment, the time bar bottom left */
export function MapControls({ layer, onLayer, locating, onLocate, hint, inert, children }: Props) {
  const uiRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<{ px: number; label: string } | null>(null)
  useLayoutEffect(() => {
    const el = uiRef.current
    if (el && el.clientWidth && el.clientHeight) setScale(scaleFor(el.clientWidth, el.clientHeight))
  }, [])
  return (
    <div className="mapui" ref={uiRef} inert={inert}>
      <div className="layers" role="group" aria-label="Map layer">
        {CHIPS.map(([l, Ic, label]) => (
          <button key={l} className="chip glass" type="button" data-layer={l} aria-pressed={layer === l} onClick={() => onLayer(l)}>
            <Ic className="i" aria-hidden />{label}
          </button>
        ))}
      </div>
      <nav className="rail" aria-label="Map tools">
        <div className="rg">
          <button className="rb glass" id="loc" type="button" aria-label="Use my location" aria-busy={locating || undefined} onClick={onLocate}>
            <Navigation className="i" /><span className="tip" aria-hidden="true">Use my location</span>
          </button>
          {/* zooming moves the map drawing, which is deferred */}
          <div className="zoomg glass" role="group" aria-label="Zoom">
            <button className="rb" type="button" id="zin" aria-label="Zoom in"><Plus className="i" /><span className="tip" aria-hidden="true">Zoom in</span></button>
            <button className="rb" type="button" id="zout" aria-label="Zoom out"><Minus className="i" /><span className="tip" aria-hidden="true">Zoom out</span></button>
          </div>
        </div>
      </nav>
      <p className="hint glass" id="hint" aria-live="polite" hidden={!hint} data-warn={hint?.warn ? '' : undefined}>{hint?.msg}</p>
      <div className="dock">
        {children}
        <div className="foot" aria-hidden="true">
          <span className="ll num" id="ll">{coords(START.cx, START.cy)}</span>
          <span className="scale num"><i id="scale-bar" style={{ width: (scale?.px ?? 0) + 'px' }} /><span id="scale-t">{scale?.label}</span></span>
        </div>
      </div>
    </div>
  )
}
