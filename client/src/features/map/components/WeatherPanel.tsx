import { Cloud, Sprout, Sun } from 'lucide-react'
import { TbRipple } from 'react-icons/tb'
import type { ReactNode } from 'react'
import {
  avg, greenAt, heatOver, heatWord, meanOf, pct, plantLevel, PLANT_WORDS, rainAt, rainRatio, rainWord, ratioOver,
  recentRain, SOIL_WORDS, soilLevel, tempAt, usualRain, usualTemp, type Point,
} from '../climate'
import {
  fromWord, fmtY, lengthWord, M0, MON, mName, seasonsIn, SEASON_NAME, yearOf, type Dates, type Span,
} from '../dates'
import { GROUPS, REGIONS, type Place } from '../places'
import type { IconType, LayerKey } from '../types'
import { RainBars } from './RainBars'
import { LessSureTag, Level, Meter } from './Parts'

const RAIN_HEADROOM = 1.25

type Ratio = (a: number, b: number) => number
type LayerProps = { layer: LayerKey | null; onTile: (l: LayerKey) => void }

/* the season card: how long the dates are, the rain outlook, then the seasons in them */
function Summary({ ratio, w, dates, scope }: { ratio: Ratio; w: Span; dates: Dates; scope: string }) {
  const list = seasonsIn(w.a, w.b)
  return (
    <div className="sum">
      <p className="sum-t"><b>Your dates</b><span className="num">{lengthWord(dates)}</span></p>
      <p className="sum-n num">
        {fromWord(dates)} to {fmtY(dates.to)} · {list.length}{list.length === 1 ? ' season' : ' seasons'}
      </p>
      <p className="sum-r">
        <Cloud className="i" />
        <span>
          Rain across your dates: likely {rainWord(ratio(w.a, w.b))}
          <small>Outlook for {scope}, compared with a usual year</small>
        </span>
      </p>
      <details className="rest">
        <summary>Seasons in your dates · {list.length}</summary>
        <ol className="seas">
          {list.map((sg) => {
            const when = sg.a === sg.b
              ? mName(sg.a)
              : MON[sg.a % 12] + (yearOf(sg.a) !== yearOf(sg.b) ? ' ' + yearOf(sg.a) : '') + ' – ' + mName(sg.b)
            return (
              <li key={sg.a}>
                <b>{SEASON_NAME[sg.k]}<LessSureTag m={sg.a} /></b>
                <span className="num">{when}</span>
                <small>Rain likely {rainWord(ratio(sg.a, sg.b))}</small>
              </li>
            )
          })}
        </ol>
      </details>
    </div>
  )
}

function Tile({ l, ic: Ic, label, layer, onTile, children }: LayerProps & { l: LayerKey; ic: IconType; label: string; children: ReactNode }) {
  return (
    <button className="tile" type="button" data-tile={l} data-layer={l} aria-pressed={layer === l} onClick={() => onTile(l)}>
      <span className="tl"><Ic className="i" aria-hidden />{label}</span>
      {children}
    </button>
  )
}

/* four tiles (rain, heat, soil, plants) for one place, or the average of the regions; a tile shows its layer */
function Tiles({ pts, w, ...lp }: LayerProps & { pts: Point[]; w: Span }) {
  const rain = meanOf(pts, (p) => avg(w.a, w.b, (m) => rainAt(p, m)))
  const usual = meanOf(pts, (p) => avg(w.a, w.b, (m) => usualRain(p, m)))
  const t = meanOf(pts, (p) => avg(w.a, w.b, (m) => tempAt(p, m)))
  const tu = meanOf(pts, (p) => avg(w.a, w.b, (m) => usualTemp(p, m)))
  const soil = soilLevel(meanOf(pts, (p) => recentRain(p, M0)))
  const green = plantLevel(meanOf(pts, (p) => greenAt(p, M0)))
  const top = Math.max(rain, usual) * RAIN_HEADROOM
  return (
    <>
      <p className="kick">{w.a === w.b ? 'This month' : 'Across your dates'}</p>
      <div className="tiles">
        <Tile l="rain" ic={Cloud} label="Rain" {...lp}>
          <span className="tv num">{Math.round(rain)} <small>mm a month</small></span>
          <Meter v={pct(rain / top)} u={pct(usual / top)} />
          <span className="tc num">Usual {Math.round(usual)} mm · {rainWord(rain / usual)}</span>
        </Tile>
        <Tile l="heat" ic={Sun} label="Heat" {...lp}>
          <span className="tv num">{t.toFixed(1)} <small>°C</small></span>
          <span className="tc">{heatWord(t - tu)}</span>
        </Tile>
        <Tile l="soil" ic={TbRipple} label="Soil now" {...lp}>
          <span className="tv">{SOIL_WORDS[soil]}</span>
          <Level n={soil} />
          <span className="tc">Water in the ground, from satellites</span>
        </Tile>
        <Tile l="plants" ic={Sprout} label="Plants now" {...lp}>
          <span className="tv">{PLANT_WORDS[green]}</span>
          <Level n={green} />
          <span className="tc">How green the land is, from satellites</span>
        </Tile>
      </div>
    </>
  )
}

export function PlaceWeather({ place, w, dates, ...lp }: LayerProps & { place: Place; w: Span; dates: Dates }) {
  return (
    <>
      <section><Summary ratio={(a, b) => rainRatio(place, a, b)} w={w} dates={dates} scope="this place" /></section>
      <section><Tiles pts={[place]} w={w} {...lp} /><RainBars pts={[place]} w={w} /></section>
    </>
  )
}

export function CountryWeather({ w, dates, ...lp }: LayerProps & { w: Span; dates: Dates }) {
  return (
    <>
      <section><Summary ratio={(a, b) => ratioOver(REGIONS, a, b)} w={w} dates={dates} scope="the whole country" /></section>
      <section><Tiles pts={REGIONS} w={w} {...lp} /><RainBars pts={REGIONS} w={w} /></section>
      <section>
        <p className="kick">By island group</p>
        <ol className="seas">
          {GROUPS.map((g) => (
            <li key={g.n}>
              <b>{g.n}</b>
              <span className="num">{heatOver(g.pts, w.a, w.b).toFixed(1)} °C</span>
              <small>Rain likely {rainWord(ratioOver(g.pts, w.a, w.b))}</small>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
