import { test, type Locator, type Page } from '@playwright/test'
import { DATA_MS, PHONE, PHONE_OUT, PLACE, TOUCH, fitPhone, hand, record } from './recorder.ts'

type Hand = ReturnType<typeof hand>
const LANDING_STEPS_MAX = 16 /* scroll steps down the landing page before the closing "Open the map" shows */
const SEASON = 1 /* the dates dropdown's second choice: the next whole planting season (the current one can be days long) */

/* The phone demo: the same live app at phone size, one long take, a fingertip dot doing everything by hand.
   On phones the map comes first; Crops and Weather open full-screen, and the map tools show once Weather has been open.
   Scene by scene: DEMO-SCRIPT-PHONE.md */
test('demo video phone', async ({ page }, info) => {
  await page.addInitScript(TOUCH)
  const h = hand(page, PHONE)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const area = await fitPhone(page) /* on the app, not the blank start page: a phone lays a page out device-wide only when its viewport tag asks */
  await page.bringToFront()
  const stop = await record(area, info.outputPath('demo-phone.mp4'), PHONE_OUT)
  try {
    await tour(page, h)
  } finally {
    await stop()
  }
})

async function tour(page: Page, h: Hand) {
  const panel = page.locator('#sb .sb-s') /* the panel's scroll area: the list inside runs far below the screen */
  const ready = () => page.locator('#sb-body:not([aria-busy])').waitFor({ timeout: DATA_MS })
  const tab = (name: string) => page.locator(`.tabsf button[aria-label="${name}"]`)
  const closePanel = async () => {
    await h.click(page.locator('#sb-x'))
    await page.locator('#sb').waitFor({ state: 'detached' })
    await h.rest(1500)
  }
  /* glide an item in the panel to the middle, clear of the "See full report" button floating over the list's bottom */
  const centre = async (el: Locator) => {
    await el.waitFor({ state: 'attached', timeout: DATA_MS })
    const b = await el.boundingBox()
    if (b) await h.scroll(b.y + b.height / 2 - PHONE.h * 0.45)
  }

  /* 1. Landing page, scrolled down to the closing "Open the map" */
  await h.moveTo(PHONE.w * 0.55, PHONE.h * 0.6, 900)
  await h.rest(2500)
  const cta = page.locator('.ready .cta')
  for (let i = 0; i < LANDING_STEPS_MAX; i++) {
    const b = await cta.boundingBox()
    if (b && b.y + b.height < PHONE.h * 0.8) break
    await h.scroll(PHONE.h * 0.6)
    await h.rest(1500)
  }
  await h.scrollTo(cta)
  await h.rest(1000)
  await h.click(cta, 900)

  /* 2. Map, the whole country, the panel closed */
  await page.locator('#mapload[data-done]').waitFor({ state: 'attached', timeout: DATA_MS })
  await h.moveTo(PHONE.w * 0.5, PHONE.h * 0.5, 900)
  await h.rest(3000)

  /* 3. Search: the map flies there */
  await h.click(page.locator('#q'))
  await h.rest(400)
  await h.type(PLACE)
  const hit = page.locator('#sug li[role="option"]', { hasText: PLACE }).first()
  await hit.waitFor({ timeout: DATA_MS })
  await h.rest(700)
  await h.click(hit, 600)
  await h.moveTo(PHONE.w * 0.5, PHONE.h * 0.5, 900)
  await h.rest(3500)

  /* 4. Crops, and the planting season */
  await h.click(tab('Crops'))
  await ready()
  await h.rest(2000)
  await h.click(page.locator('.dsum'))
  await page.locator('#dpop').waitFor()
  await h.rest(2500)
  await h.click(page.locator('#dpop .dopt').nth(SEASON))
  await ready()
  await h.rest(2000)
  await h.point(panel)
  await h.scroll(600)
  await h.rest(1500)
  await h.scroll(-600)
  await h.rest(800)

  /* 5. Rice: when to plant, then the growing guide */
  const rice = page.locator('#sb-body button.crh[data-guide="Rice"]')
  await centre(rice)
  await h.rest(600)
  await h.click(rice)
  await cropWindow(page, h)

  /* 6. Full report, over the panel */
  await h.click(page.locator('#rp-open'))
  await page.locator('#rp-s-now').waitFor({ timeout: DATA_MS })
  await h.rest(3000)
  await h.moveTo(PHONE.w * 0.5, PHONE.h * 0.6)
  for (let i = 0; i < 10; i++) {
    await h.scroll(420)
    await h.rest(1800)
  }
  const back = page.locator('#rp-back')
  await h.scrollTo(back)
  await h.rest(800)
  await h.click(back)
  await h.rest(1500)
  await closePanel()

  /* 7. Weather */
  await h.click(tab('Weather'))
  await ready()
  await h.rest(2500)
  await h.point(panel)
  await h.scroll(500)
  await h.rest(2000)
  const more = page.locator('#sb-body button.more')
  if (await more.count()) {
    await centre(more)
    await h.rest(1000)
    await h.click(more)
    await h.rest(2500)
  }
  await closePanel()

  /* 8. Map layers and the timeline, now on the map */
  await h.click(page.locator('.layers button[aria-controls="layers"]'))
  const chip = (layer: string) => page.locator(`.layers .chip[data-layer="${layer}"]`)
  for (const layer of ['rain', 'heat', 'soil', 'humid', 'sun', 'rain']) {
    await reveal(chip(layer))
    await h.click(chip(layer))
    await h.rest(3500)
  }
  await h.click(page.locator('.topen'))
  await h.rest(1200)
  await h.click(page.locator('#tplay'))
  await h.rest(6500)
  await h.click(page.locator('#tplay'))
  await h.rest(1000)
  const rb = await page.locator('#trange').boundingBox()
  if (rb) {
    const y = rb.y + rb.height / 2
    await h.moveTo(rb.x + rb.width * 0.15, y)
    await page.mouse.down()
    await h.moveTo(rb.x + rb.width * 0.75, y, 2200)
    await page.mouse.up()
  }
  await h.rest(2000)

  /* 9. 3D */
  await h.click(page.getByRole('button', { name: 'Switch to 3D' }))
  await h.rest(2500)
  await h.click(page.getByRole('button', { name: 'Tilt up' }))
  await h.rest(1200)
  await h.click(page.getByRole('button', { name: 'Tilt up' }), 300)
  await h.rest(1500)
  await h.click(page.getByRole('button', { name: 'Zoom in' }))
  await h.rest(2500)
  await h.click(page.getByRole('button', { name: 'Switch to 2D' }))
  await h.moveTo(PHONE.w / 2, PHONE.h / 2, 900)
  await h.rest(3500)
}

/* the crop window: the planting calendar and its heat, rain and land checks, "More details", then the growing guide */
async function cropWindow(page: Page, h: Hand) {
  const body = page.locator('#gm-body')
  await page.locator('#gm-body:not([aria-busy])').waitFor({ timeout: DATA_MS })
  await h.rest(2500)
  await h.point(body)
  await h.scroll(450)
  await h.rest(2500)
  const details = page.locator('.wtp-more summary')
  await h.scrollTo(details)
  await h.rest(800)
  await h.click(details)
  await h.rest(1500)
  await h.scroll(500)
  await h.rest(2000)
  await h.scroll(500)
  await h.rest(2000)
  await h.click(page.locator('#gm-tab-1'))
  await h.rest(2000)
  await h.point(body)
  await h.scroll(450)
  await h.rest(2200)
  await h.click(page.locator('#gm-x'))
  await h.rest(1200)
}

/* the chips row scrolls sideways on a phone: glide a chip to the middle (clear of the map buttons) before it's tapped */
async function reveal(el: Locator) {
  await el.evaluate((n) => n.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }))
  await el.page().waitForTimeout(500)
}
