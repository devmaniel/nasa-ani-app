import { Pause, Play, RotateCcw } from 'lucide-react'
import { clamp } from '../climate'
import { LESS_SURE_AFTER, M0, mName, seasonsIn, SEASON_NAME, TODAY, yearOf, type Dates, type Span } from '../dates'

const LABEL_MIN_MONTHS = 3
const YEAR_MIN_POS = 12 /* a year mark needs YEAR_MIN_POS % of room after "Today" */

type Props = { dates: Dates; w: Span; frame: number | null; playing: boolean; onPlay: () => void; onScrub: (k: number) => void }

/* the time bar: play the dates month by month (shown when they cover two months or more) */
export function TimeBar({ dates, w, frame, playing, onPlay, onScrub }: Props) {
  const last = w.b - w.a
  const pos = (k: number) => clamp(k / last, 0, 1) * 100 /* a month k's centre, in % of the lane */
  const segs = seasonsIn(w.a, w.b)
  const lsFrom = M0 + LESS_SURE_AFTER + 1
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
          {segs.filter((sg) => sg.b - sg.a + 1 >= LABEL_MIN_MONTHS).map((sg) => {
            const l = pos(sg.a - w.a - 0.5)
            const r = pos(sg.b - w.a + 0.5)
            return <span key={sg.a} style={{ left: l + '%', width: r - l + '%' }}>{SEASON_NAME[sg.k].replace(' season', '')}</span>
          })}
        </div>
        <div className="lane tzones" id="tzones" aria-hidden="true">
          {segs.map((sg) => <i key={sg.a} className={'z ' + sg.k} style={{ left: pos(sg.a - w.a - 0.5) + '%', right: 100 - pos(sg.b - w.a + 0.5) + '%' }} />)}
          {w.b >= lsFrom && <i className="ls" style={{ left: pos(lsFrom - w.a - 0.5) + '%', right: 0 }} />}
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
