import { Calendar as CalendarIcon } from 'lucide-react'
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Calendar } from '@/shared/ui/calendar'
import './DateField.css'

const SHOWN = new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' })
/* today: a small dot under the day, white on the picked day */
/* keyboard focus: a soft green ring instead of shadcn's grey one (mouse use shows none) */
const DAY_FOCUS = 'group-data-[focused=true]/day:ring-primary/30 focus-visible:ring-primary/30'
const TODAY_DOT = 'relative after:pointer-events-none after:absolute after:bottom-1.5 after:left-1/2 after:z-20 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-foreground data-[selected=true]:after:bg-primary-foreground'

type Props = {
  id: string
  label: string
  value: Date
  min: Date
  max: Date
  open: boolean
  onOpen: (open: boolean) => void
  onPick: (d: Date) => void
}

/* a date box that opens a calendar under it; days outside min–max can't be picked */
export function DateField({ id, label, value, min, max, open, onOpen, onPick }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const close = () => {
    onOpen(false)
    buttonRef.current?.focus()
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
      <label>
        {label}
        <button className="dfield-btn num" id={id} ref={buttonRef} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => onOpen(!open)}>
          <span>{SHOWN.format(value)}</span>
          <CalendarIcon className="i" />
        </button>
      </label>
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
              onPick(d)
              close()
            }}
          />
        </div>
      )}
    </div>
  )
}
