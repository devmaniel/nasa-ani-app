import { Calendar } from 'lucide-react'
import { useState } from 'react'
import { addDays, fmtY, fromWord, lengthEnd, MAX_END, PAST_FROM, type Dates } from '../dates'
import { DateField } from './DateField'

const QUICK: { label: string; days?: number; months?: number }[] = [
  { label: '1 week', days: 7 },
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
]

function problem(from: Date, to: Date) {
  if (to < from) return 'Pick an end date on or after the start.'
  if (to > MAX_END) return 'Pick dates up to ' + fmtY(MAX_END) + ', three years ahead.'
  return ''
}

type Props = { dates: Dates; open: boolean; inert: boolean; onApply: (d: Dates) => void }

/* the dates box: a From and a To, from 1981 (NASA's oldest monthly numbers) up to three years ahead; quick picks count from From.
   Like the template it stays in the page while closed, so a bad pick and its message are still there on reopening. */
export function DatesPanel({ dates, open, inert, onApply }: Props) {
  const [from, setFrom] = useState(dates.from)
  const [to, setTo] = useState(dates.to)
  const [err, setErr] = useState('')
  const [field, setField] = useState<'from' | 'to' | null>(null)
  /* what's wrong with a typed date, per box */
  const [typed, setTyped] = useState({ from: '', to: '' })
  const shownErr = typed.from || typed.to || err

  const apply = (f: Date, t: Date) => {
    setFrom(f)
    setTo(t)
    const msg = problem(f, t)
    setErr(msg)
    if (!msg) onApply({ from: f, to: t })
  }
  const openField = (name: 'from' | 'to') => (on: boolean) => setField(on ? name : null)
  return (
    <section className="dp glass" id="dp" role="dialog" aria-label="Dates" hidden={!open} inert={inert}>
      <p className="kick">Dates</p>
      <p className="dline" id="dline">
        <Calendar className="i" />
        <span><b>{fromWord(dates) + ' to ' + fmtY(dates.to)}</b> · crops can be planted any time in these dates</span>
      </p>
      <div className="adv">
        <div className="two">
          <DateField
            id="d-from" label="From" value={from} min={PAST_FROM} max={MAX_END} open={open && field === 'from'} error={typed.from} errorId="d-err"
            onOpen={openField('from')} onPick={(d) => apply(d, to)} onError={(msg) => setTyped((t) => ({ ...t, from: msg }))}
          />
          <DateField
            id="d-end" label="To" value={to} min={dates.from} max={MAX_END} open={open && field === 'to'} error={typed.to} errorId="d-err"
            onOpen={openField('to')} onPick={(d) => apply(from, d)} onError={(msg) => setTyped((t) => ({ ...t, to: msg }))}
          />
        </div>
        <div className="quick" id="quick" role="group" aria-label="Quick picks, counted from the From date">
          {QUICK.map((q) => (
            <button key={q.label} type="button" data-days={q.days} data-months={q.months} onClick={() => {
              setTyped((t) => ({ ...t, to: '' }))
              apply(from, q.days ? addDays(from, q.days - 1) : lengthEnd(from, q.months ?? 1))
            }}>
              {q.label}
            </button>
          ))}
        </div>
        <p className="err" id="d-err" role="alert" hidden={!shownErr}>{shownErr}</p>
      </div>
    </section>
  )
}
