import { BookOpen, Calendar, ChevronDown, ChevronRight, Cloud, Info, Satellite, ShoppingBasket, Sprout, Sun } from 'lucide-react'
import { TbRipple } from 'react-icons/tb'
import type { MouseEvent, ReactNode } from 'react'
import {
  clamp, heatWord, pct, rainWord, SOIL_WORDS, soilLevel, sum,
} from '../climate'
import { BAND, band, harvestMonth, ranked, type Band, type Crop, type Fit } from '../crops'
import { DAY_MS, M0, MON, mName, monthEnd, seasonKey, SEASON_NAME, TODAY, yearOf, type Span } from '../dates'
import { guideOf } from '../guides'
import { allLatelyLines, type Lately } from '../space'
import { capFirst, hardestText, JOBS, seasonEnd, seasonStart, WORK_WORD, type Alert, type Move, type PlaceWeather, type WorkMark } from '../report'
import type { IconType, LayerKey } from '../types'
import type { OpenGuide } from './CropsPanel'
import { FIT_COLOR } from '../chartColors'
import { HalfDonut } from './HalfDonut'
import { LabelPie } from './LabelPie'
import { Axis, Chips, Gantt, Level, Meter, type Chip } from './Parts'

const CAL_MIN_MONTHS = 6
const openFrom = (onOpen: OpenGuide, crop: string) => (e: MouseEvent<HTMLButtonElement>) => onOpen(crop, e.currentTarget)

function Cell({ l, ic: Ic, label, v, children }: { l: LayerKey; ic: IconType; label: string; v: string; children: ReactNode }) {
  return (
    <div className="rp-cell" data-rl={l}>
      <span className="tl"><Ic className="i" aria-hidden />{label}</span>
      <span className="tv num">{v}</span>
      {children}
    </div>
  )
}

/* right now, always today: the season and four readings in one row */
/* "Right now" under the season row: the last days at the place, from space, one line each with its source */
export function LatelyList({ lately }: { lately: Lately | null }) {
  const lines = lately ? allLatelyLines(lately) : []
  if (!lines.length) return null
  return (
    <ul className="rp-lately" aria-label="Lately, from space">
      {lines.map((l) => <li key={l} className="num"><Satellite className="i" aria-hidden />{l}</li>)}
    </ul>
  )
}

export function NowRow({ pw }: { pw: PlaceWeather }) {
  const k = seasonKey(M0)
  const e = seasonEnd(M0)
  const s = seasonStart(M0)
  const end = monthEnd(e)
  const start = new Date(yearOf(s), s % 12, 1)
  const left = Math.round((+end - +TODAY) / DAY_MS) + 1
  const done = (+TODAY - +start) / (+end - +start)
  const { rain: r, usualRain: u, heat: t, usualHeat } = pw.at(M0)
  const top = Math.max(r, u) * 1.25
  const soil = pw.soil ? soilLevel(pw.soil.v) : null
  return (
    <div className="rp-now" id="rp-now">
      <div className={'rp-cell season ' + k}>
        <span className="tl"><Calendar className="i" />Season</span>
        <span className="tv">{SEASON_NAME[k]}</span>
        <span className="prog" role="img" aria-label={Math.round(clamp(done, 0, 1) * 100) + '% of the season has passed'}><i style={{ '--p': pct(done) }} /></span>
        <span className="tc num">{left}{left === 1 ? ' day' : ' days'} left · next: {SEASON_NAME[seasonKey(e + 1)].replace(' season', '')} from 1 {MON[(e + 1) % 12]}</span>
      </div>
      <Cell l="rain" ic={Cloud} label="Rain this month" v={Math.round(r) + ' mm'}>
        <Meter v={pct(r / top)} u={pct(u / top)} />
        <span className="tc num">{capFirst(rainWord(r / u))} · usual {Math.round(u)}</span>
      </Cell>
      <Cell l="heat" ic={Sun} label="Heat" v={t.toFixed(1) + ' °C'}><span className="tc">{heatWord(t - usualHeat)}</span></Cell>
      <Cell l="soil" ic={TbRipple} label="Soil" v={soil === null ? '–' : SOIL_WORDS[soil]}>
        <Level n={soil ?? 0} />
        <span className="tc">{pw.soil?.kind === 'usual' ? 'NASA\'s usual for ' + MON[M0 % 12] : 'NASA, with the forecast rain'}</span>
      </Cell>
      <Cell l="plants" ic={Sprout} label="Plants" v="On the map"><span className="tc">NASA&rsquo;s satellite picture of how green the land is</span></Cell>
    </div>
  )
}

export function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <ul className="rp-alerts" id="rp-alerts">
      {alerts.map((x) => (
        <li key={x.t + x.when} className="rp-alert">
          <span className="ic" data-tone={x.tone}><x.ic className="i" aria-hidden /></span>
          <div><b className="num">{x.t}{x.when ? ' · ' + x.when : ''}</b><p className="num">{x.d}</p></div>
        </li>
      ))}
    </ul>
  )
}

/* a crop's guide, as a row that opens its window */
function GuideRow({ c, chips, onOpen }: { c: Crop; chips: Chip[]; onOpen: OpenGuide }) {
  if (!guideOf(c.n)) return <p className="gd-none"><Info className="i" />No growing guide for {c.n.toLowerCase()} yet.</p>
  return (
    <button className="gd-row" type="button" data-guide={c.n} aria-haspopup="dialog" onClick={openFrom(onOpen, c.n)}>
      <span className="ic" data-tone="grow"><BookOpen className="i" /></span>
      <span className="tx">
        <span className="gd-h"><b>How to grow {c.n.toLowerCase()}</b><span className="gd-tag">Sample</span></span>
        <span className="gd-meta"><Chips chips={chips} /></span>
      </span>
      <span className="go"><ChevronRight className="i" /></span>
    </button>
  )
}
function FitTag({ r }: { r: Fit }) {
  return <span className={'fit ' + band(r.score)}>{BAND[band(r.score)]}</span>
}

export function MoveList({ moves, onOpen }: { moves: Move[]; onOpen: OpenGuide }) {
  return (
    <ol className="rp-moves" id="rp-moves">
      {moves.map((x) => (
        <li key={x.t} className="rp-mv">
          <div>
            <h3>{x.t}</h3>
            <p className="d num">{x.r && <FitTag r={x.r} />}{x.d}</p>
            {x.r && <GuideRow c={x.r.c} chips={[[Calendar, 'Plant ' + mName(x.r.pm)], [ShoppingBasket, 'Ready ' + mName(harvestMonth(x.r))]]} onOpen={onOpen} />}
          </div>
        </li>
      ))}
    </ol>
  )
}

/* what to plant: every crop, good ones first, each on the same calendar */
export function CropGroups({ pw, w, onOpen }: { pw: PlaceWeather; w: Span; onOpen: OpenGuide }) {
  const all = ranked(pw.crop, pw.p, w)
  const a = w.a
  const b = Math.max(a + CAL_MIN_MONTHS - 1, Math.max(...all.map(harvestMonth)))
  const row = (r: Fit) => {
    const bd = band(r.score)
    return (
      <li key={r.c.n} className={'rp-crop ' + bd}>
        <span className="cn"><b>{r.c.n}</b><small>{r.c.l}</small></span>
        <span className="fit">{BAND[bd]}</span>
        <Gantt r={r} w={w} a={a} b={b} />
        <span className="why num">{hardestText(r)}</span>
        {bd !== 'poor' && guideOf(r.c.n) && (
          <button className="rp-gl" type="button" data-guide={r.c.n} aria-haspopup="dialog" onClick={openFrom(onOpen, r.c.n)}>
            <BookOpen className="i" />How to grow {r.c.n.toLowerCase()}<ChevronRight className="i" />
          </button>
        )}
      </li>
    )
  }
  const count = (bd: Band) => all.filter((r) => band(r.score) === bd).length
  return (
    <div id="rp-crops">
      <HalfDonut
        unit="crops"
        label={'Crops for your dates: ' + count('good') + ' good to plant, ' + count('fair') + ' plant with care, ' + count('poor') + ' not a good time'}
        slices={[
          { key: 'good', label: BAND.good, value: count('good'), color: FIT_COLOR.good },
          { key: 'fair', label: BAND.fair, value: count('fair'), color: FIT_COLOR.fair },
          { key: 'poor', label: BAND.poor, value: count('poor'), color: FIT_COLOR.poor },
        ]}
      />
      {(['good', 'fair', 'poor'] as const).map((bd: Band) => {
        const rs = all.filter((r) => band(r.score) === bd)
        if (!rs.length) return null
        const list = <><Axis a={a} b={b} className="rp-cax" /><ul>{rs.map(row)}</ul></>
        return bd === 'poor' ? (
          <details key={bd} className="rp-rest"><summary>{BAND.poor} · {rs.length}<ChevronDown className="i" /></summary>{list}</details>
        ) : (
          <div key={bd} className="rp-cg"><p className="kick"><span>{BAND[bd]}</span><span className="num">{rs.length}</span></p>{list}</div>
        )
      })}
    </div>
  )
}

/* the months in the dates by how good they are for planting (the farm-work table's "Plant" row) */
export function PlantingMonths({ pw, w }: { pw: PlaceWeather; w: Span }) {
  const marks: WorkMark[] = []
  for (let m = w.a; m <= w.b; m++) marks.push(JOBS[0].at(pw, m))
  const count = (k: WorkMark) => marks.filter((x) => x === k).length
  return (
    <div className="rp-cg">
      <p className="kick"><span>Months for planting</span></p>
      <LabelPie
        label={'Months for planting: ' + count('good') + ' good, ' + count('ok') + ' possible, ' + count('no') + ' not a good month'}
        slices={[
          { key: 'good', label: WORK_WORD.good, value: count('good'), color: FIT_COLOR.good },
          { key: 'ok', label: WORK_WORD.ok, value: count('ok'), color: FIT_COLOR.fair },
          { key: 'no', label: WORK_WORD.no, value: count('no'), color: FIT_COLOR.none, light: true },
        ]}
      />
    </div>
  )
}

/* farm work by month: good months for each job */
export function WorkTable({ pw, w }: { pw: PlaceWeather; w: Span }) {
  const months: number[] = []
  for (let m = w.a; m <= w.b; m++) months.push(m)
  return (
    <table className="rp-work" id="rp-work">
      <caption className="sr">Good months for each farm job</caption>
      <thead>
        <tr>
          <th scope="col"><span className="sr">Job</span></th>
          {months.map((m) => <th key={m} scope="col" className="num">{MON[m % 12]}{(m === w.a || m % 12 === 0) && <small>{yearOf(m)}</small>}</th>)}
        </tr>
      </thead>
      <tbody>
        {JOBS.map((j) => (
          <tr key={j.n}>
            <th scope="row"><span><j.ic className="i" aria-hidden />{j.n}</span></th>
            {months.map((m) => {
              const v = j.at(pw, m)
              return <td key={m}><i className={'rp-dot ' + v} aria-hidden="true" /><span className="sr">{mName(m)}: {WORK_WORD[v]}</span></td>
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Fig({ label, v, c }: { label: string; v: string; c: string }) {
  return <div className="rp-fig"><span className="tl">{label}</span><span className="tv num">{v}</span><span className="tc num">{c}</span></div>
}
/* your dates in numbers, against the same months in a usual year */
export function Figures({ pw, w }: { pw: PlaceWeather; w: Span }) {
  const rainOf = (m: number) => pw.at(m).rain
  const rain = sum(w.a, w.b, rainOf)
  const usual = sum(w.a, w.b, (m) => pw.at(m).usualRain)
  const off = 1 - rain / usual
  const heat = sum(w.a, w.b, (m) => pw.at(m).heat - pw.at(m).usualHeat) / (w.b - w.a + 1)
  let dry = w.a
  let wet = w.a
  for (let m = w.a; m <= w.b; m++) {
    if (rainOf(m) < rainOf(dry)) dry = m
    if (rainOf(m) > rainOf(wet)) wet = m
  }
  return (
    <div className="rp-figs" id="rp-figs">
      <Fig label="Rain" v={Math.abs(Math.round(off * 100)) + '% ' + (off >= 0 ? 'less' : 'more')} c={Math.round(rain).toLocaleString('en') + ' mm, usual ' + Math.round(usual).toLocaleString('en') + ' mm'} />
      <Fig
        label="Heat"
        v={Math.abs(heat) < 0.2 ? 'Usual' : (heat > 0 ? '+' : '−') + Math.abs(heat).toFixed(1) + ' °C'}
        c={heat >= 0.2 ? 'Warmer than usual, on average' : heat <= -0.2 ? 'Cooler than usual, on average' : 'About usual, on average'}
      />
      {w.a !== w.b && <Fig label="Driest month" v={mName(dry)} c={Math.round(rainOf(dry)) + ' mm of rain'} />}
      {w.a !== w.b && <Fig label="Wettest month" v={mName(wet)} c={Math.round(rainOf(wet)) + ' mm of rain'} />}
    </div>
  )
}
