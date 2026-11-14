import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { LOOKS, type Kind, type MapLayer, type MapPicture } from '../climateLayer'
import { fmtY, M0, mName, MONTH_FULL, parseIso } from '../dates'
import type { LayerView } from '../hooks/useClimateLayer'

const KIND_WORD: Record<Kind, (m: number) => string> = {
  past: (m) => 'Measured in ' + mName(m),
  forecast: (m) => 'Forecast for ' + mName(m),
  usual: (m) => 'Usual for ' + MONTH_FULL[m % 12],
  estimate: (m) => 'Estimate for ' + mName(m),
}
const SOURCE: Record<Kind, string> = {
  past: 'NASA POWER, measured that month',
  forecast: 'Open-Meteo seasonal forecast (not NASA)',
  usual: 'NASA POWER, 25-year average',
  estimate: 'NASA POWER usual soil, nudged by the forecast rain',
}
/* a band's lower value on the colour key, and the centre's value in words */
const BAND: Record<MapLayer, (v: number) => string> = {
  rain: String,
  heat: String,
  soil: (v) => Math.round(v * 100) + '%',
  humid: (v) => v + '%',
  sun: String,
}
const VALUE: Record<MapLayer, (v: number) => string> = {
  rain: (v) => Math.round(v) + ' mm',
  heat: (v) => v.toFixed(1) + '°C',
  soil: (v) => Math.round(v * 100) + '% wet',
  humid: (v) => Math.round(v) + '% humidity',
  sun: (v) => v.toFixed(1) + ' MJ/m² a day',
}

/* which NASA picture is on the map: the latest, or the month's own */
const pictureWord = (p: MapPicture, m: number) => (p.time === 'default' ? 'the latest satellite view' : "NASA's satellite view for " + mName(m))

/* the key on the map, under the header: the month and how sure (measured, forecast, usual or estimate), the value at the map centre,
   what the colours mean, the source, and which NASA picture is on the map */
export function LayerLegend({ view }: { view: LayerView }) {
  const { layer, kind, month, live, value, picture } = view
  if (layer === 'plants') return <PlantsKey month={month} picture={picture} />
  if (layer === 'fields') return <FieldsKey view={view} />
  const look = LOOKS[layer]
  const name = look.name.toLowerCase()
  const short = view.status === 'error' ? "Couldn't load " + name
    : view.status === 'loading' ? 'Loading ' + name + '…'
    : <><b>{look.name}</b> · {value === null ? 'no data here' : VALUE[layer](value)}</>
  return (
    <KeyBox short={short}>
      {view.status === 'error' && <p className="lk-t">Couldn't load {look.name.toLowerCase()} here. Move the map to try again.</p>}
      {view.status === 'loading' && <p className="lk-t">Loading {look.name.toLowerCase()}…</p>}
      {kind && view.status === 'ready' && (
        <>
          <p className="lk-t"><b>{look.name}</b> · {live ? 'This month · ' : ''}{KIND_WORD[kind](month)}</p>
          <p className="lk-v">At the map centre: <b>{value === null ? 'no data here' : VALUE[layer](value)}</b></p>
          <ol className="lk-bar" aria-label={'Colour key, ' + look.unit}>
            {look.bands.map(([v, c]) => <li key={v} style={{ '--c': c ?? 'transparent' }} data-none={c ? undefined : ''}>{BAND[layer](v)}</li>)}
          </ol>
          <p className="lk-s">{look.unit} · {SOURCE[kind]}</p>
          {picture && <p className="lk-s">On the map: {pictureWord(picture, month)}, {picture.source} (NASA's colours)</p>}
          {view.limited && <p className="lk-s">Zoom in to colour all the land in view.</p>}
        </>
      )}
    </KeyBox>
  )
}

/* the key's box: on phones and tablets it folds to one short line, and tapping it opens the full key (see map-changes.css);
   on bigger screens the short line is hidden and the full key always shows */
function KeyBox({ short, children }: { short: ReactNode; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const bodyId = useId()
  return (
    <div className="lkey" role="status" data-open={isOpen || undefined}>
      <button className="lk-tog" type="button" aria-expanded={isOpen} aria-controls={bodyId} onClick={() => setIsOpen((o) => !o)}>
        <span>{short}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      <div className="lk-body" id={bodyId}>{children}</div>
    </div>
  )
}

/* a label on the map, over the time bar, when the month has no real data: no forecast this far ahead, not measured yet,
   or no plant picture; the colours then show NASA's usual for the month */
export function NoDataBadge({ view }: { view: LayerView }) {
  const { layer, month, kind, picture } = view
  if (layer === 'fields') return null
  const usualWord = 'showing the usual ' + MONTH_FULL[month % 12]
  const text = layer === 'plants'
    ? picture ? null : month > M0 ? 'No forecast for plants' : 'No plant picture for ' + mName(month)
    : kind !== 'usual' ? null : month > M0 ? 'No forecast for ' + mName(month) + ' · ' + usualWord : 'Not measured yet for ' + mName(month) + ' · ' + usualWord
  return text ? <p className="nofc" role="status">{text}</p> : null
}

/* Plants has NASA's pictures only: the latest this month, the month's own for past months from July 2002; nobody forecasts plant greenness */
function PlantsKey({ month, picture }: { month: number; picture: MapPicture | null }) {
  const ahead = month > M0
  const title = picture ? (picture.time === 'default' ? 'Latest satellite view' : 'Satellite view for ' + mName(month)) : ahead ? 'No forecast for plants' : 'No plant picture for ' + mName(month)
  return (
    <KeyBox short={<><b>Plants</b> · {picture ? (picture.time === 'default' ? 'Latest' : mName(month)) : 'No picture'}</>}>
      <p className="lk-t"><b>Plants</b> · {title}</p>
      <p className="lk-s">
        {picture
          ? 'Greener means more growing plants · ' + picture.source + " (NASA's colours)"
          : ahead
            ? 'NASA only has satellite views of what already happened. Move the time bar back to Today, or pick past dates.'
            : "NASA's monthly plant pictures run from July 2002 to about two months ago."}
      </p>
    </KeyBox>
  )
}

/* Fields: the newest clear photo of the fields over the map centre (Sentinel-2 or Landsat, as NASA's HLS); it doesn't follow the time bar */
function FieldsKey({ view }: { view: LayerView }) {
  const { picture, status } = view
  const day = picture ? parseIso(picture.time) : null
  const short = day ? fmtY(day) : status === 'loading' ? 'Finding a photo…' : status === 'error' ? "Couldn't load" : 'No photo yet'
  return (
    <KeyBox short={<><b>Fields</b> · {short}</>}>
      <p className="lk-t">
        <b>Fields</b> · {day ? 'Newest clear photo, ' + fmtY(day)
          : status === 'loading' ? 'Finding the newest clear photo…'
          : status === 'error' ? "Couldn't reach NASA's search. Move the map to try again."
          : 'No clear photo of this area yet'}
      </p>
      {picture && <p className="lk-s">{picture.source} · Zoom in to see single fields; the time bar doesn&rsquo;t change it.</p>}
    </KeyBox>
  )
}
