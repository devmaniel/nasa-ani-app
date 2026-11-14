import { useEffect, useRef, useState, type RefObject } from 'react'
import { MapCta } from './MapCta'

const LINKS: [string, string][] = [['#weather', 'Weather'], ['#plant', 'What to plant'], ['#report', 'Full report']]

/* The header stays away on the hero and slides in once the headline is scrolled past.
   On phones, "Menu" opens a full-screen list of the same links. */
export function LandingHeader({ titleRef }: { titleRef: RefObject<HTMLHeadingElement | null> }) {
  const [isPastTitle, setIsPastTitle] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setIsPastTitle((titleRef.current?.getBoundingClientRect().bottom ?? 0) < 0)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [titleRef])

  useEffect(() => {
    if (!isMenuOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setIsMenuOpen(false)
      menuBtnRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKey)
    }
  }, [isMenuOpen])

  const links = LINKS.map(([href, label]) => <a key={href} className="nl" href={href}>{label}</a>)

  return (
    <>
      <header className={isMenuOpen || isPastTitle ? 'hdr show' : 'hdr'}>
        <div className="wrap">
          <nav className="pn" aria-label="Home">
            <a className="logo" href="#top" aria-label="Ani home"><span className="brand" /></a>
          </nav>
          <nav className="pn" aria-label="Main">
            {links}
            <MapCta />
            <button
              ref={menuBtnRef}
              className="menu-btn"
              type="button"
              aria-expanded={isMenuOpen}
              aria-controls="menu"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span aria-hidden="true" />Menu
            </button>
          </nav>
        </div>
      </header>
      <div className="menu" id="menu" hidden={!isMenuOpen} onClick={(e) => {
        if (e.target instanceof Element && e.target.closest('a')) setIsMenuOpen(false)
      }}>
        {links}
        <MapCta />
      </div>
    </>
  )
}
