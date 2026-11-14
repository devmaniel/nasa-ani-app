import { Pause, Play, RotateCcw } from 'lucide-react'
import { clamp } from '../climate'
import { mName, TODAY, yearOf, type Dates, type Span } from '../dates'
import type { Strip } from '../hooks/useClimateLayer'

const YEAR_MIN_POS = 12 /* a year mark needs YEAR_MIN_POS % of room after "Today" */

type Props = { dates: Dates; w: Span; frame: number | null; playing: boolean; strip: Strip | null; onPlay: () => void; onScrub: (k: number) => void }

/* the time bar: play the dates month by month (shown when they cover two months or more); each month is coloured like the map
   at its centre for the picked layer, striped where there's no forecast (NASA's usual) */
export function TimeBar({ dates, w, frame, playing, strip, onPlay, onScrub }: Props) {
  const last = w.b - w.a
  const pos = (k: number) => clamp(k / last, 0, 1) * 100 /* a month k's centre, in % of the lane */
  const k = frame ?? 0
  const atEnd = frame !== null && k >= last
  const icon = playing ? 'pause' : atEnd ? 'replay' : 'play'
  const PlayIcon = { pause: Pause, replay: RotateCcw, play: Play }[icon]
  const label = playing ? 'Pause' : atEnd ? 'Play again' : 'Play'
  const years: number[] = []
  for (let i = 1; i <= last; i++) if ((w.a + i) % 12 === 0 && pos(i) >= YEAR_MIN_POS) years.push(i)

  return (
    <div className="tbar glass" id="tbar">
      <button className="tplay" id="tplay" type="button" aria-label={label} data-icon={icon} onClick={onPlay}><PlayIcon className="i" /></button>
      <div className="ttrk">
        <div className="lane tlabels" id="tlabels" aria-hidden="true">
          <span>{strip ? strip.label : 'Pick Rain, Heat or Soil to colour the months'}</span>
        </div>
        <div className="lane tzones" id="tzones" aria-hidden="true">
          {strip?.cells.map((c) => (
            <i
              key={c.m} className="z" data-usual={c.usual ? '' : undefined}
              style={{ left: pos(c.m - w.a - 0.5) + '%', right: 100 - pos(c.m - w.a + 0.5) + '%', background: c.color ?? 'transparent' }}
            />
          ))}
        </div>
        <input
          type="range" id="trange" min={0} max={last} step={1} value={k} aria-label="Month"
          aria-valuetext={frame === null ? 'All your dates' : mName(w.a + frame)}
          onChange={(e) => onScrub(+e.target.value)}
        />
        <div className="tticks" id="tticks" aria-hidden="true">
          <span className="today" style={{ left: 0 }}>{+dates.from === +TODAY ? 'Today' : mName(w.a)}</span>
          {years.map((i) => <span key={i} className="num" style={{ left: pos(i) + '%' }}>{yearOf(w.a + i)}</span>)}
        </div>
      </div>
      <p className="tread num" id="tread">{frame === null ? 'Your dates' : mName(w.a + frame)}</p>
    </div>
  )
}
