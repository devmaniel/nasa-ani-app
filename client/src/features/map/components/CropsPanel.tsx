import type { MouseEvent, ReactNode } from 'react'
import { band, bestPlant, countOf, CROPS, harvestMonth, ranked, rating, ratingBand, regionBands, type Band, type Crop, type CropWeather } from '../crops'
import { M0, MONTH_FULL, yearOf, type Span } from '../dates'
import { REGIONS, type Place } from '../places'

export type OpenGuide = (crop: string, from: HTMLElement) => void

const RATE_MAX = 5
/* the crops are rated for planting this month: the best to plant now come first */
const NOW: Span = { a: M0, b: M0 }
/* what a rating means, in a farmer's words, and the order the groups come in */
const VERDICT: Record<Band, string> = { good: 'Plant now', fair: 'With care', poor: 'Wait' }
const ORDER: Band[] = ['good', 'fair', 'poor']

/* a photo per crop (Wikimedia Commons, 250 px), by file name: the crop's name in kebab-case */
const PHOTOS = import.meta.glob<string>('../assets/crops/*.jpg', { eager: true, import: 'default' })
const photoOf = (crop: string) => PHOTOS['../assets/crops/' + crop.toLowerCase().replace(/ /g, '-') + '.jpg']
/* the photos' credits, as their licences ask: author and licence, all from Wikimedia Commons */
export const PHOTO_CREDITS = 'Crop photos, Wikimedia Commons: Rice, Undeka 11 (CC BY-SA 4.0) · Corn, Forest and Kim Starr (CC BY 2.0) · '
  + 'Mung bean, Ivar Leidus (CC BY-SA 4.0) · Peanut, TorbeyCharbel (CC BY 4.0) · Sweet potato, Iyinolamercy (CC0) · Cassava, Denis kasozi (CC BY-SA 4.0) · '
  + 'Tomato, Softeis (CC BY-SA 3.0) · Eggplant, Joydeep (CC BY-SA 3.0) · Okra, Earth100 (CC BY-SA 3.0) · Pechay, spurekar (CC BY 2.0) · '
  + 'Bitter gourd, SarKaLay (CC0) · Squash, Chiswick Chap (CC BY-SA 4.0) · Banana, TimothyPilgrim (CC BY-SA 3.0) · Sugarcane, Dandy1022 (CC BY-SA 3.0)'

/* "March", or "March 2027" outside this year */
const monthWord = (m: number) => MONTH_FULL[m % 12] + (yearOf(m) === yearOf(M0) ? '' : ' ' + yearOf(m))

/* a 1–5 rating bar at the foot of a crop row, coloured like its group */
function Rating({ n }: { n: number }) {
  return (
    <span className="rate" role="img" aria-label={'Rating ' + n + ' of ' + RATE_MAX}>
      <span className="rate-bar">{Array.from({ length: RATE_MAX }, (_, i) => <i key={i} data-on={i < n ? '' : undefined} />)}</span>
    </span>
  )
}

/* one crop: its photo, its name with the verdict, one line on what to expect, the rating; it opens the crop's window */
function CropRow({ c, n, line, onOpen }: { c: Crop; n: number; line: string; onOpen: OpenGuide }) {
  const bd = ratingBand(n)
  return (
    <li className={bd}>
      <button className="crh" type="button" data-guide={c.n} aria-haspopup="dialog" onClick={(e: MouseEvent<HTMLButtonElement>) => onOpen(c.n, e.currentTarget)}>
        <img className="cph" src={photoOf(c.n)} alt="" loading="lazy" />
        <span className="crb">
          <span className="cn"><b>{c.n}</b><span className="vd">{VERDICT[bd]}</span></span>
          <span className="when">{line}</span>
          <Rating n={n} />
        </span>
      </button>
    </li>
  )
}

/* the rows in three groups (Plant now, With care, Wait), each headed with how many it holds; empty groups are left out */
function Groups({ rows }: { rows: { n: number; row: ReactNode }[] }) {
  return ORDER.map((b) => {
    const group = rows.filter((r) => ratingBand(r.n) === b)
    return group.length > 0 && (
      <div key={b} className={'crg ' + b}>
        <h3 className="crg-h">{VERDICT[b]}<span className="num">{group.length}</span></h3>
        <ul className="crl">{group.map((r) => r.row)}</ul>
      </div>
    )
  })
}

/* one place: each crop rated for planting now, best first; those to plant now say when to harvest,
   those to wait say the best month in the coming year (w) */
export function PlaceCrops({ place, wx, w, onOpen }: { place: Place; wx: CropWeather; w: Span; onOpen: OpenGuide }) {
  const rows = ranked(wx, place, NOW).map((r) => {
    const n = rating(r.score)
    let line = 'Harvest around ' + monthWord(harvestMonth(r))
    if (ratingBand(n) === 'poor') {
      const best = bestPlant(wx, place, r.c, w.a, w.b)
      line = band(best.score) === 'poor' ? 'No good month in the coming year' : 'Best to plant in ' + monthWord(best.pm)
    }
    return { n, row: <CropRow key={r.c.n} c={r.c} n={n} line={line} onOpen={onOpen} /> }
  })
  return <Groups rows={rows} />
}

/* the whole country: each crop rated by how many regions suit planting it now ("with care" counts as half) */
export function CountryCrops({ wx, onOpen }: { wx: CropWeather; onOpen: OpenGuide }) {
  const rows = CROPS.map((c) => {
    const bands = regionBands(wx, c, NOW)
    const good = countOf(bands, 'good')
    const fair = countOf(bands, 'fair')
    return { c, good, fair, share: (good + fair / 2) / REGIONS.length }
  }).sort((x, y) => y.share - x.share)
  return (
    <Groups rows={rows.map((r) => {
      const n = Math.max(1, Math.round(r.share * RATE_MAX))
      const line = 'Good now in ' + r.good + ' of ' + REGIONS.length + ' regions' + (r.fair ? ' · with care in ' + r.fair : '')
      return { n, row: <CropRow key={r.c.n} c={r.c} n={n} line={line} onOpen={onOpen} /> }
    })} />
  )
}
