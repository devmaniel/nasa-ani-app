import { test, type Page } from '@playwright/test'
import { CURSOR, DATA_MS, PLACE, VIEW, fitWindow, hand, record } from './recorder.ts'

/* The 30-second cut of the demo: the highlights only, at a quicker pace */
test('demo video 30s', async ({ page }, info) => {
  await page.addInitScript(CURSOR)
  const h = hand(page)
  const ready = () => page.locator('#sb-body:not([aria-busy])').waitFor({ timeout: DATA_MS })
  const crop = await fitWindow(page)
  await page.bringToFront()

  await warmUp(page, ready)
  const cta = page.locator('.hero .cta')
  await cta.waitFor({ timeout: DATA_MS })
  await h.moveTo(VIEW.w * 0.57, VIEW.h * 0.62, 10)

  const stop = await record(crop, info.outputPath('demo-30s.mp4'))
  try {
    /* 1. Landing (the recorder's start-up second and a half is the hero's hold) */
    await h.click(cta, 700)

    /* 2. Search */
    await page.locator('#mapload[data-done]').waitFor({ state: 'attached', timeout: DATA_MS })
    await ready()
    await h.click(page.locator('#q'), 700)
    await h.type(PLACE, 60)
    const hit = page.locator('#sug li[role="option"]', { hasText: PLACE }).first()
    await hit.waitFor({ timeout: DATA_MS })
    await h.rest(250)
    await h.click(hit, 450)
    await ready()
    await h.rest(1000)

    /* 3. Crops: the Rice guide */
    const rice = page.locator('#sb-body button.crh[data-guide="Rice"]')
    await rice.waitFor({ timeout: DATA_MS })
    await h.click(rice, 500)
    await page.locator('#gm-nav a').first().waitFor({ timeout: DATA_MS })
    await h.rest(1300)
    await h.click(page.locator('#gm-x'), 500)
    await h.rest(250)

    /* 4. Map layers */
    const chip = (layer: string) => page.locator(`.layers .chip[data-layer="${layer}"]`)
    await h.click(chip('rain'), 600)
    await h.rest(1000)
    await h.click(chip('heat'), 450)
    await h.rest(1000)

    /* 5. Time bar */
    await h.click(page.locator('#tplay'), 600)
    await h.rest(2000)
    await h.click(page.locator('#tplay'), 250)

    /* 6. 3D */
    await h.click(page.getByRole('button', { name: 'Switch to 3D' }), 600)
    await h.rest(700)
    await h.click(page.getByRole('button', { name: 'Tilt up' }), 450)
    await h.rest(500)

    /* 7. Full report */
    await h.click(page.locator('#rp-open'), 600)
    await page.locator('#rp-s-now').waitFor({ timeout: DATA_MS })
    await h.rest(300)
    await h.moveTo(VIEW.w * 0.42, VIEW.h * 0.57, 400)
    await h.scrollTo(page.locator('#rp-s-ahead'))
    await h.rest(700)
  } finally {
    await stop()
  }
})

/* Off camera: load the map and the place once, so the take doesn't sit waiting on live data. The app keeps
   what it fetched in memory, so it goes back to the landing page without a reload */
async function warmUp(page: Page, ready: () => Promise<void>) {
  await page.goto('/map')
  await page.locator('#mapload[data-done]').waitFor({ state: 'attached', timeout: DATA_MS })
  await ready()
  await page.locator('#q').fill(PLACE)
  await page.locator('#sug li[role="option"]', { hasText: PLACE }).first().click({ timeout: DATA_MS })
  await ready()
  await page.locator('#rp-open').click({ timeout: DATA_MS })
  await page.locator('#rp-s-now').waitFor({ timeout: DATA_MS })
  await page.evaluate(`history.pushState(null, '', '/'); dispatchEvent(new PopStateEvent('popstate'))`)
  await page.evaluate(`scrollTo({ top: 0, behavior: 'instant' })`)
  await page.waitForTimeout(1500)
}
