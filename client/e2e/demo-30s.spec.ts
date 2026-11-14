import { test, type Locator, type Page } from '@playwright/test'
import { DATA_MS, PHONE, PHONE_OUT, PLACE, TOUCH, fitPhone, hand, record } from './recorder.ts'

const SEASON = 1 /* the dates dropdown's second choice: the next whole planting season (the current one can be days long) */
const REPORT_SCROLLS = 2

/* The 30-second cut of the demo at phone size, at a quicker pace: crops, then weather, then the full report last.
   Scene by scene: DEMO-SCRIPT-30S.md */
test('demo video 30s', async ({ page }, info) => {
  await page.addInitScript(TOUCH)
  const h = hand(page, PHONE)
  const ready = () => page.locator('#sb-body:not([aria-busy])').waitFor({ timeout: DATA_MS })
  const tab = (name: string) => page.locator(`.tabsf button[aria-label="${name}"]`)
  const panel = page.locator('#sb .sb-s')
  await page.goto('/map')
  const area = await fitPhone(page) /* on the app, not the blank start page: a phone lays a page out device-wide only when its viewport tag asks */
  await page.bringToFront()

  await warmUp(page, ready, tab)
  const cta = page.locator('.hero .cta')
  await cta.waitFor({ timeout: DATA_MS })
  await h.moveTo(PHONE.w * 0.55, PHONE.h * 0.6, 10)

  const stop = await record(area, info.outputPath('demo-30s.mp4'), PHONE_OUT)
  try {
    /* 1. Landing (the recorder's start-up second and a half is the hero's hold) */
    await h.click(cta, 700)

    /* 2. Search: the map flies there */
    await page.locator('#mapload[data-done]').waitFor({ state: 'attached', timeout: DATA_MS })
    await h.click(page.locator('#q'), 600)
    await h.type(PLACE, 60)
    const hit = page.locator('#sug li[role="option"]', { hasText: PLACE }).first()
    await hit.waitFor({ timeout: DATA_MS })
    await h.rest(250)
    await h.click(hit, 450)
    await h.rest(800)

    /* 3. Crops: the dry season, then Rice's planting calendar */
    await h.click(tab('Crops'), 500)
    await ready()
    await h.rest(300)
    await h.click(page.locator('.dsum'), 450)
    await page.locator('#dpop').waitFor()
    await h.rest(500)
    await h.click(page.locator('#dpop .dopt').nth(SEASON), 400)
    await ready()
    await h.rest(400)
    const rice = page.locator('#sb-body button.crh[data-guide="Rice"]')
    await h.point(panel, 300)
    await centre(h, rice)
    await h.click(rice, 450)
    await page.locator('#gm-body:not([aria-busy])').waitFor({ timeout: DATA_MS })
    await h.rest(900)
    await h.point(page.locator('#gm-body'), 300)
    await h.scroll(350)
    await h.rest(600)
    await h.click(page.locator('#gm-x'), 450)
    await h.rest(200)

    /* 4. Weather: on a phone the panel covers the tabs, so it closes first */
    await h.click(page.locator('#sb-x'), 450)
    await page.locator('#sb').waitFor({ state: 'detached' })
    await h.click(tab('Weather'), 500)
    await ready()
    await h.rest(500)
    await h.point(panel, 300)
    await h.scroll(400)
    await h.rest(800)

    /* 5. Full report, last */
    await h.click(page.locator('#rp-open'), 500)
    await page.locator('#rp-s-now').waitFor({ timeout: DATA_MS })
    await h.rest(800)
    await h.moveTo(PHONE.w * 0.5, PHONE.h * 0.6, 300)
    for (let i = 0; i < REPORT_SCROLLS; i++) {
      await h.scroll(420)
      await h.rest(1300)
    }
    await h.rest(500)
  } finally {
    await stop()
  }
})

/* glide an item in the panel to the middle, clear of the "See full report" button floating over the list's bottom */
async function centre(h: ReturnType<typeof hand>, el: Locator) {
  await el.waitFor({ state: 'attached', timeout: DATA_MS })
  const b = await el.boundingBox()
  if (b) await h.scroll(b.y + b.height / 2 - PHONE.h * 0.45)
}

/* Off camera: load the place, the season, Rice, the weather and the report once, so the take doesn't sit waiting on
   live data. The app keeps what it fetched in memory, so it goes back to the landing page without a reload */
async function warmUp(page: Page, ready: () => Promise<void>, tab: (name: string) => Locator) {
  await page.locator('#mapload[data-done]').waitFor({ state: 'attached', timeout: DATA_MS })
  await page.locator('#q').fill(PLACE)
  await page.locator('#sug li[role="option"]', { hasText: PLACE }).first().click({ timeout: DATA_MS })
  await tab('Crops').click()
  await ready()
  await page.locator('.dsum').click()
  await page.locator('#dpop .dopt').nth(SEASON).click()
  await ready()
  const rice = page.locator('#sb-body button.crh[data-guide="Rice"]')
  await rice.evaluate((n) => n.scrollIntoView({ block: 'center' }))
  await rice.click({ timeout: DATA_MS })
  await page.locator('#gm-body:not([aria-busy])').waitFor({ timeout: DATA_MS })
  await page.locator('#gm-x').click()
  await page.locator('#sb-x').click()
  await page.locator('#sb').waitFor({ state: 'detached' })
  await tab('Weather').click()
  await ready()
  await page.locator('#rp-open').click({ timeout: DATA_MS })
  await page.locator('#rp-s-now').waitFor({ timeout: DATA_MS })
  await page.evaluate(`history.pushState(null, '', '/'); dispatchEvent(new PopStateEvent('popstate'))`)
  await page.evaluate(`scrollTo({ top: 0, behavior: 'instant' })`)
  await page.waitForTimeout(1500)
}
