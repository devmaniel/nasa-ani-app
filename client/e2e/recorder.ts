import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { type Locator, type Page } from '@playwright/test'

/* What both demo recordings share: the drawn mouse, a hand that moves like a person, the window fit and the screen recorder */
export const PLACE = 'Nueva Ecija'
export const DATA_MS = 60_000 /* live NASA / Open-Meteo data can take a while */
const TYPE_MS = 120
const MOVE_MS = 700
export const VIEW = { w: 1280, h: 720 } /* the page, in CSS px; small enough that the window clears the macOS menu bar and Dock */
const OUT = { w: 1920, h: 1080, fps: 60, bitrate: '16M' }
const SCREEN = 'Capture screen 0' /* ffmpeg's name for the main display */
const REC_START_MS = 1500
const SCROLL_PAD = 16 /* how far inside its scroll area an element must sit to count as in view */

/* Playwright's video has no mouse, so the page draws one: a pointer that follows the real mouse and ripples on click.
   Scrolling is eased frame by frame in the page too: synthetic wheel ticks jump, and stop at the edges with a bounce */
export const CURSOR = `
const scroller = (x, y) => {
  let n = document.elementFromPoint(x, y)
  while (n && n !== document.body && n !== document.documentElement) {
    const o = getComputedStyle(n).overflowY
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n
    n = n.parentElement
  }
  return document.scrollingElement
}
window.__demoRect = (x, y) => {
  const s = scroller(x, y)
  if (s === document.scrollingElement) return [0, innerHeight]
  const r = s.getBoundingClientRect()
  return [r.top, r.bottom]
}
window.__demoScroll = (x, y, dy, ms) => new Promise((done) => {
  const s = scroller(x, y)
  const from = s.scrollTop
  const to = Math.max(0, Math.min(s.scrollHeight - s.clientHeight, from + dy))
  if (Math.abs(to - from) < 1) return done()
  const t0 = performance.now()
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms)
    const e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
    s.scrollTo({ top: from + (to - from) * e, behavior: 'instant' })
    if (t < 1) requestAnimationFrame(step)
    else done()
  }
  requestAnimationFrame(step)
})
addEventListener('DOMContentLoaded', () => {
  const css = document.createElement('style')
  css.textContent = \`
    #demo-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; z-index: 2147483647; pointer-events: none;
      transform: translate(-100px, -100px); transition: scale .12s; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)) }
    #demo-cursor.down { scale: .85 }
    .demo-ripple { position: fixed; width: 36px; height: 36px; margin: -18px 0 0 -18px; border-radius: 50%; z-index: 2147483646;
      pointer-events: none; border: 2px solid rgba(16,185,129,.9); animation: demo-ripple .5s ease-out forwards }
    @keyframes demo-ripple { from { scale: .3; opacity: 1 } to { scale: 1.6; opacity: 0 } }\`
  document.head.append(css)
  const c = document.createElement('div')
  c.id = 'demo-cursor'
  c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 2l7 19 2.6-7.6L20 11z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  document.documentElement.append(c)
  addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 2) + 'px)' }, true)
  addEventListener('mousedown', (e) => {
    c.classList.add('down')
    const r = document.createElement('i')
    r.className = 'demo-ripple'
    r.style.left = e.clientX + 'px'
    r.style.top = e.clientY + 'px'
    document.documentElement.append(r)
    setTimeout(() => r.remove(), 600)
  }, true)
  addEventListener('mouseup', () => c.classList.remove('down'), true)
})`

/* A person's hand: curved, eased moves, small pauses, letter-by-letter typing, wheel scrolling in steps */
export function hand(page: Page) {
  let at = { x: VIEW.w / 2, y: VIEW.h / 2 }
  const rest = (ms: number) => page.waitForTimeout(ms)

  async function moveTo(x: number, y: number, ms = MOVE_MS) {
    const from = at
    const bend = { x: (from.x + x) / 2 + (y - from.y) * 0.15, y: (from.y + y) / 2 - (x - from.x) * 0.15 }
    const steps = Math.max(12, Math.round(ms / 16))
    const start = Date.now()
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const e = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2 /* ease in-out */
      const px = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * bend.x + e ** 2 * x
      const py = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * bend.y + e ** 2 * y
      await page.mouse.move(px, py)
      const wait = start + (ms * i) / steps - Date.now() /* keep to the planned time, however long a move took */
      if (wait > 0) await rest(wait)
    }
    at = { x, y }
  }
  async function point(el: Locator, ms = MOVE_MS) {
    await el.waitFor({ state: 'visible', timeout: DATA_MS })
    const b = await el.boundingBox()
    if (!b) throw new Error('Nothing to point at')
    await moveTo(b.x + b.width / 2, b.y + b.height / 2, ms)
  }
  async function click(el: Locator, ms = MOVE_MS) {
    await point(el, ms)
    await rest(180)
    await page.mouse.down()
    await rest(70)
    await page.mouse.up()
    await rest(350)
  }
  async function type(text: string, ms = TYPE_MS) {
    await page.keyboard.type(text, { delay: ms })
  }
  /* scroll whatever is under the mouse by dy pixels in one smooth, eased glide; it stops at the top or bottom */
  async function scroll(dy: number) {
    const ms = Math.min(1400, 300 + Math.abs(dy) * 0.9)
    await page.evaluate(`__demoScroll(${at.x}, ${at.y}, ${dy}, ${ms})`)
  }
  /* glide the element into view, a third of the way down its scroll area; nothing if it's already in view */
  async function scrollTo(el: Locator) {
    await el.waitFor({ state: 'attached', timeout: DATA_MS })
    const b = await el.boundingBox()
    if (!b) throw new Error('Nothing to scroll to')
    const [top, bottom] = await page.evaluate<number[]>(`__demoRect(${at.x}, ${at.y})`)
    if (b.y >= top + SCROLL_PAD && b.y + b.height <= bottom - SCROLL_PAD) return
    await scroll(b.y - (top + (bottom - top) / 3))
  }
  return { rest, moveTo, point, click, type, scroll, scrollTo }
}

/* size the real window so the page is exactly VIEW, and return where the page sits on screen, in screen pixels */
export async function fitWindow(page: Page) {
  const read = () => page.evaluate<number[]>('[screenX, screenY, outerWidth - innerWidth, outerHeight - innerHeight, innerWidth, innerHeight, devicePixelRatio]')
  const [, , padW, padH] = await read()
  const cdp = await page.context().newCDPSession(page)
  const { windowId } = await cdp.send('Browser.getWindowForTarget')
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: 0, top: 0, width: VIEW.w + padW, height: VIEW.h + padH } })
  await page.waitForTimeout(500)
  const [x, y, , chromeH, w, hgt, dpr] = await read()
  if (w !== VIEW.w || hgt !== VIEW.h) throw new Error(`Window gave a ${w}x${hgt} page, not ${VIEW.w}x${VIEW.h}`)
  return { x: x * dpr, y: (y + chromeH) * dpr, w: w * dpr, h: hgt * dpr }
}

/* screen-record the page's area of the display at 60 fps on the Mac's hardware encoder; returns a stop function */
export async function record(crop: { x: number; y: number; w: number; h: number }, file: string) {
  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'avfoundation', '-capture_cursor', '0', '-framerate', String(OUT.fps), '-pixel_format', 'nv12',
    '-i', SCREEN + ':none',
    '-vf', `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=${OUT.w}:${OUT.h}:flags=lanczos,format=yuv420p`,
    '-c:v', 'h264_videotoolbox', '-b:v', OUT.bitrate, '-r', String(OUT.fps), '-movflags', '+faststart', file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] })
  const exited = once(ff, 'exit')
  const early = await Promise.race([exited.then(() => true), new Promise<false>((r) => setTimeout(() => r(false), REC_START_MS))])
  if (early) throw new Error('ffmpeg stopped right away: check Screen Recording permission for this app in macOS settings')
  return async () => {
    ff.stdin.end('q')
    await exited
  }
}
