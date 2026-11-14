import { Calendar, Check, ChevronDown, CloudRain, Sun } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  fmtY, fromWord, lengthWord, MAX_END, MON, PLANT_SEASON_NAME, seasonChoices, seasonEndDate, seasonsIn, spanOf, TODAY, yearOf,
  type Dates, type PlantSeasonKey, type SeasonChoice,
} from '../dates'
import { DateField } from './DateField'

function problem(from: Date, to: Date) {
  if (to < from) return 'Pick an end date on or after the start.'
  if (to > MAX_END) return 'Pick dates up to ' + fmtY(MAX_END) + ', three years ahead.'
  return ''
}

/* the dropdown's choices: the rest of this season, then the next two whole seasons (about a year ahead) */
const CHOICES = 3
/* each planting season's swatch takes the colour of its weather: rainy like the wet season, dry like the hot dry one */
const SWATCH: Record<PlantSeasonKey, string> = { rainy: 'wet', dry: 'hot' }
const SEASON_ICON = { rainy: CloudRain, dry: Sun } as const

/* "30 Nov", with the year when it isn't this one */
const shortDay = (d: Date) => d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() === TODAY.getFullYear() ? '' : ' ' + d.getFullYear())
/* "Jun – Nov 2027", or "Dec 2026 – May 2027" across a new year */
function monthRange(a: number, b: number) {
  const ya = yearOf(a)
  const yb = yearOf(b)
  return MON[a % 12] + (ya === yb ? '' : ' ' + ya) + ' – ' + MON[b % 12] + ' ' + yb
}
/* under a choice's name: "Today – 30 Nov · 17 days", or "Dec 2026 – May 2027 · 6 months" */
const choiceWhen = (c: SeasonChoice) => (c.isNow ? 'Today – ' + shortDay(c.dates.to) : monthRange(c.a, c.b)) + ' · ' + lengthWord(c.dates)
const choiceName = (c: SeasonChoice) => PLANT_SEASON_NAME[c.k] + (c.isNow ? ' · now' : '')
const isSame = (x: Dates, y: Dates) => +x.from === +y.from && +x.to === +y.to

/* the months of the dates as a thin bar, coloured by the weather in them */
function SeasonStrip({ dates }: { dates: Dates }) {
  const w = spanOf(dates)
  return (
    <span className="dstrip" aria-hidden="true">
      {seasonsIn(w.a, w.b).map((s) => <i key={s.a} className={s.k} style={{ flexGrow: s.b - s.a + 1 }} />)}
    </span>
  )
}

type Props = { dates: Dates; onApply: (d: Dates) => void }

/* the dates, at the top of the panel on both tabs: a dropdown of planting seasons, this one picked first.
   Crops, Weather, the time bar, the crop window and the full report all follow them. */
export function DatesBar({ dates, onApply }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const sumRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const choices = seasonChoices(CHOICES)
  const picked = choices.find((c) => isSame(c.dates, dates))
  /* your own dates: the From and To boxes, and what's wrong with them */
  const [from, setFrom] = useState(dates.from)
  const [to, setTo] = useState(dates.to)
  const [err, setErr] = useState('')
  const [field, setField] = useState<'from' | 'to' | null>(null)
  const [typed, setTyped] = useState({ from: '', to: '' })
  const shownErr = typed.from || typed.to || err
  /* the From and To boxes wait behind "Advanced", unless your own dates are the ones in use */
  const [isAdvanced, setIsAdvanced] = useState(false)
  const showDates = isAdvanced || !picked

  const close = (focus = true) => {
    setOpen(false)
    setField(null)
    if (focus) sumRef.current?.focus()
  }
  const pick = (c: SeasonChoice) => {
    setFrom(c.dates.from)
    setTo(c.dates.to)
    setErr('')
    setTyped({ from: '', to: '' })
    onApply(c.dates)
    close()
  }
  const apply = (f: Date, t: Date) => {
    setFrom(f)
    setTo(t)
    const msg = problem(f, t)
    setErr(msg)
    if (!msg) onApply({ from: f, to: t })
  }
  const openField = (name: 'from' | 'to') => (on: boolean) => setField(on ? name : null)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return
    e.stopPropagation() /* only the dropdown closes, not the panel */
    close()
  }

  /* a click outside the dropdown closes it */
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !wrapRef.current?.contains(e.target)) {
        setOpen(false)
        setField(null)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div className="dbar" ref={wrapRef} onKeyDown={onKeyDown}>
      <button className="dsum" ref={sumRef} type="button" aria-expanded={open} aria-controls="dpop" aria-label={'Dates: ' + (picked ? choiceName(picked) + ', ' : '') + fromWord(dates) + ' to ' + fmtY(dates.to) + '. Change season'} onClick={() => (open ? close() : setOpen(true))}>
        <Calendar className="i" />
        <span className="dsum-t">
          <b>{picked ? choiceName(picked) : fromWord(dates) + ' – ' + shortDay(dates.to)}</b>
          <span className="num">{picked ? choiceWhen(picked) : lengthWord(dates)}</span>
        </span>
        <span className="dsum-c">Change<ChevronDown className="i" /></span>
        <SeasonStrip dates={dates} />
      </button>
      {open && (
        <div className="dpop" id="dpop" role="dialog" aria-label="When will you plant?">
          <p className="dpop-h">When will you plant?</p>
          <p className="dpop-s">Crops, weather, the time bar and the full report all use this season.</p>
          <div className="dopts" role="group" aria-label="Planting seasons">
            {choices.map((c) => {
              const on = picked === c
              const Ic = SEASON_ICON[c.k]
              return (
                <button key={c.a} className={'dopt ' + SWATCH[c.k]} type="button" aria-pressed={on} aria-label={choiceName(c) + ', ' + choiceWhen(c)} onClick={() => pick(c)}>
                  <span className="dsw" aria-hidden="true"><Ic className="i" /></span>
                  <span className="dopt-t">
                    <b>{PLANT_SEASON_NAME[c.k]}{c.isNow && <span className="dnow">Now</span>}</b>
                    <small className="num">{choiceWhen(c)}</small>
                  </span>
                  {on && <Check className="i" aria-hidden />}
                </button>
              )
            })}
          </div>

          <div className="dadv-box">
          <button className="dadv" type="button" aria-expanded={showDates} aria-controls="d-adv" onClick={() => setIsAdvanced(!showDates)}>
            <span className="dadv-t"><b>Advanced</b><small>Pick your own From and To dates</small></span>
            <ChevronDown className="i" aria-hidden />
          </button>
          <div className="adv" id="d-adv" hidden={!showDates}>
            <div className="two">
              <DateField
                id="d-from" label="From" value={from} min={TODAY} max={MAX_END} open={field === 'from'} error={typed.from} errorId="d-err"
                onOpen={openField('from')} onPick={(d) => apply(d, to < d ? seasonEndDate(d) : to)} onError={(msg) => setTyped((t) => ({ ...t, from: msg }))}
              />
              <DateField
                id="d-end" label="To" value={to} min={from} max={MAX_END} open={field === 'to'} error={typed.to} errorId="d-err"
                onOpen={openField('to')} onPick={(d) => {
                  setTyped((t) => ({ ...t, to: '' }))
                  apply(from, d)
                }} onError={(msg) => setTyped((t) => ({ ...t, to: msg }))}
              />
            </div>
            <p className="err" id="d-err" role="alert" hidden={!shownErr}>{shownErr}</p>
          </div>
          </div>
          {showDates && (
            <div className="dpop-f">
              <p className="dhint num">{fromWord(dates) + ' – ' + shortDay(dates.to) + ' · ' + lengthWord(dates)}</p>
              <button className="ddone" type="button" onClick={() => close()}>Done</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
