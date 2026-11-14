import { useEffect, type RefObject } from 'react'

/* Fades in each [data-rv] block inside the root the first time it scrolls into view.
   With reduced motion the CSS already shows them, so they are just marked as in. */
export function useReveal(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll('[data-rv]') ?? []
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('in'))
      return
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.classList.add('in')
        io.unobserve(e.target)
      })
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [rootRef])
}
