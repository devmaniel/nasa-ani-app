import { Calendar as CalendarIcon } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Calendar } from '@/shared/ui/calendar'
import { fmtY } from '../dates'
import './DateField.css'

const SHOWN = new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' })
/* the person's date format: the order of its parts (e.g. month, day, year) and its pattern (e.g. MM/DD/YYYY) */
const SAMPLE = SHOWN.formatToParts(new Date(2000, 11, 31))
const ORDER: string[] = SAMPLE.map((p) => p.type).filter((t) => t === 'month' || t === 'day' || t === 'year')
const PART_WORD: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = { month: 'MM', day: 'DD', year: 'YYYY' }
const PATTERN = SAMPLE.map((p) => PART_WORD[p.type] ?? p.value).join('')
const MIN_YEAR = 1000
/* today: a small dot under the day, white on the picked day */
/* keyboard focus: a soft green ring instead of shadcn's grey one (mouse use shows none) */
const DAY_FOCUS = 'group-data-[focused=true]/day:ring-primary/30 focus-visible:ring-primary/30'
const TODAY_DOT = 'relative after:pointer-events-none after:absolute after:bottom-1.5 after:left-1/2 after:z-20 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-foreground data-[selected=true]:after:bg-primary-foreground'

/* a typed date in the person's format, or null when it isn't a real day */
function parseTyped(text: string): Date | null {
  const nums = text.trim().split(/\D+/).filter(Boolean).map(Number)
  if (nums.length !== ORDER.length) return null
  const at = (part: string) => nums[ORDER.indexOf(part)]
  const [y, m, d] = [at('year'), at('month'), at('day')]
  if (y < MIN_YEAR) return null
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null
}

type Props = {
  id: string
  label: string
  value: Date
  min: Date
  max: Date
  open: boolean
  error: string /* what's wrong with the typed date ('' when nothing); the dates box shows it on its error line */
  errorId: string
  onOpen: (open: boolean) => void
  onPick: (d: Date) => void
  onError: (msg: string) => void
}

/* a date box to type in, with a calendar behind its icon; a typed date counts on Enter or on leaving the box,
   and one that isn't a date or is outside min–max gets a red edge and is reported through onError */
export function DateField({ id, label, value, min, max, open, error, errorId, onOpen, onPick, onError }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const iconRef = useRef<HTMLButtonElement>(null)
  const [text, setText] = useState(() => SHOWN.format(value))
  const [shownFor, setShownFor] = useState(value)
  /* a new date from outside (the calendar, a quick pick) replaces what's typed */
  if (+shownFor !== +value) {
    setShownFor(value)
    setText(SHOWN.format(value))
  }

  const close = () => {
    onOpen(false)
    iconRef.current?.focus()
  }
  const pick = (d: Date) => {
    onError('')
    onPick(d)
  }
  const commit = () => {
    if (text.trim() === SHOWN.format(value)) return onError('')
    const d = parseTyped(text)
    if (!d) return onError(label + ': type the date as ' + PATTERN + '.')
    if (d < min) return onError(label + ': the earliest is ' + fmtY(min) + '.')
    if (d > max) return onError(label + ': the latest is ' + fmtY(max) + '.')
    setText(SHOWN.format(d))
    pick(d)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return
    e.stopPropagation() /* only the calendar closes, not the dates box */
    close()
  }

  /* a click outside the field closes its calendar */
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !wrapRef.current?.contains(e.target)) onOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, onOpen])

  return (
    <div className="dfield" ref={wrapRef}>
      <label htmlFor={id}>{label}</label>
      <div className="dfield-box">
        <input
          id={id}
          className="num"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={PATTERN}
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
          }}
        />
        <button className="dfield-ic" ref={iconRef} type="button" aria-label={'Pick the ' + label.toLowerCase() + ' date on a calendar'} aria-haspopup="dialog" aria-expanded={open} onClick={() => onOpen(!open)}>
          <CalendarIcon className="i" />
        </button>
      </div>
      {open && (
        <div className="dcal glass" role="dialog" aria-label={label + ' date'} onKeyDown={onKeyDown}>
          <Calendar
            mode="single"
            required
            selected={value}
            defaultMonth={value}
            startMonth={min}
            endMonth={max}
            disabled={[{ before: min }, { after: max }]}
            className="rounded-2xl p-3 [--cell-size:--spacing(9)]"
            classNames={{ root: 'w-full', today: TODAY_DOT, day_button: DAY_FOCUS }}
            onSelect={(d) => {
              pick(d)
              close()
            }}
          />
        </div>
      )}
    </div>
  )
}
