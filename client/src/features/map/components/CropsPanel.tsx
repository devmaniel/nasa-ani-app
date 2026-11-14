import { ChevronRight } from 'lucide-react'
import type { MouseEvent } from 'react'
import { BAND, band, countOf, CROPS, planText, ranked, regionBands, regionsLine, type Band, type CropWeather, type Fit } from '../crops'
import type { Span } from '../dates'
import { REGIONS, type Place } from '../places'
import { FIT_COLOR } from '../chartColors'
import { HalfDonut } from './HalfDonut'
import { LessSureTag } from './Parts'

export type CropFilter = Band | 'all'
export type OpenGuide = (crop: string, from: HTMLElement) => void

function CropRow({ r, showFit, onOpen }: { r: Fit; showFit: boolean; onOpen: OpenGuide }) {
  const bd = band(r.score)
  return (
    <li className={bd}>
      <button className="crh" type="button" data-guide={r.c.n} aria-haspopup="dialog" onClick={(e: MouseEvent<HTMLButtonElement>) => onOpen(r.c.n, e.currentTarget)}>
        <span className="cn"><b>{r.c.n}</b> <small>{r.c.l}</small></span>
        {showFit && <span className={'fit ' + bd}>{BAND[bd]}</span>}
        <ChevronRight className="i" />
        <span className="when num">{planText(r)}<LessSureTag m={r.pm} /></span>
      </button>
    </li>
  )
}

/* one place: a filter, then one short row per crop; a row opens the crop's window */
export function PlaceCrops({ place, wx, w, filter, onFilter, onOpen }: { place: Place; wx: CropWeather; w: Span; filter: CropFilter | null; onFilter: (f: CropFilter) => void; onOpen: OpenGuide }) {
  const all = ranked(wx, place, w)
  const n: Record<Band, number> = { good: 0, fair: 0, poor: 0 }
  all.forEach((r) => {
    n[band(r.score)]++
  })
  const f: CropFilter = filter && (filter === 'all' || n[filter]) ? filter : n.good ? 'good' : n.fair ? 'fair' : 'all'
  const shown = f === 'all' ? all : all.filter((r) => band(r.score) === f)
  const options: [CropFilter, string, number][] = [['good', BAND.good, n.good], ['fair', 'With care', n.fair], ['all', 'All', all.length]]
  return (
    <>
      <h3>What to plant <span>· your dates</span></h3>
      <HalfDonut
        unit="crops"
        label={'Crops for your dates: ' + n.good + ' good to plant, ' + n.fair + ' plant with care, ' + n.poor + ' not a good time'}
        slices={[
          { key: 'good', label: BAND.good, value: n.good, color: FIT_COLOR.good },
          { key: 'fair', label: BAND.fair, value: n.fair, color: FIT_COLOR.fair },
          { key: 'poor', label: BAND.poor, value: n.poor, color: FIT_COLOR.poor },
        ]}
      />
      <div className="cf" role="group" aria-label="Show crops">
        {options.map(([key, label, count]) => (
          <button key={key} className={key} type="button" data-f={key} aria-pressed={f === key} disabled={!count} onClick={() => onFilter(key)}>
            {label}<span className="n num">{count}</span>
          </button>
        ))}
      </div>
      <ul className="crl">{shown.map((r) => <CropRow key={r.c.n} r={r} showFit={f === 'all'} onOpen={onOpen} />)}</ul>
      <p className="note">Options to weigh, not orders. Each crop shows the best month to plant inside your dates.</p>
    </>
  )
}

/* the whole country: each crop with one dot per region */
export function CountryCrops({ wx, w, onOpen }: { wx: CropWeather; w: Span; onOpen: OpenGuide }) {
  const rows = CROPS.map((c) => {
    const bands = regionBands(wx, c, w)
    return { c, bands, good: countOf(bands, 'good'), fair: countOf(bands, 'fair') }
  }).sort((x, y) => y.good - x.good || y.fair - x.fair)
  return (
    <>
      <h3>What to plant across the country <span>· {REGIONS.length} regions</span></h3>
      <ul className="crl">
        {rows.map((r) => (
          <li key={r.c.n}>
            <button className="crh" type="button" data-guide={r.c.n} aria-haspopup="dialog" onClick={(e: MouseEvent<HTMLButtonElement>) => onOpen(r.c.n, e.currentTarget)}>
              <span className="cn"><b>{r.c.n}</b> <small>{r.c.l}</small></span>
              <span className="cnt num">{r.good} of {REGIONS.length}</span>
              <ChevronRight className="i" />
              <span className="dots" aria-hidden="true">{r.bands.map((b, i) => <i key={i} className={b} />)}</span>
              <span className="when">{regionsLine(r.good, r.fair)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="cleg" aria-hidden="true">
        <span><i className="dot good" />{BAND.good}</span>
        <span><i className="dot fair" />{BAND.fair}</span>
        <span><i className="dot" />{BAND.poor}</span>
      </p>
      <p className="note">Pick a place to see when to plant and harvest there.</p>
    </>
  )
}
