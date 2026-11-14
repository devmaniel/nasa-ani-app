import { test, type Locator, type Page } from '@playwright/test'
import { CURSOR, DATA_MS, PLACE, VIEW, fitWindow, hand, record } from './recorder.ts'

test('demo video', async ({ page }, info) => {
  await page.addInitScript(CURSOR)
  const h = hand(page)
  const panel = page.locator('#sb-body')
  const ready = () => page.locator('#sb-body:not([aria-busy])').waitFor({ timeout: DATA_MS })
  const crop = await fitWindow(page)
  await page.bringToFront()

  /* 1. Landing page */
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  const stop = await record(crop, info.outputPath('demo.mp4'))
  try {
    await tour(page, h, panel, ready)
  } finally {
    await stop()
  }
})

async function tour(page: Page, h: ReturnType<typeof hand>, panel: Locator, ready: () => Promise<void>) {
  await h.moveTo(VIEW.w * 0.57, VIEW.h * 0.57, 900)
  await h.rest(2500)
  for (let i = 0; i < 6; i++) {
    await h.scroll(560)
    await h.rest(1800)
  }
  const cta = page.locator('.ready .cta')
  await h.scrollTo(cta)
  await h.rest(1200)
  await h.click(cta, 900)

  /* 2. Map, the whole country */
  await page.locator('#mapload[data-done]').waitFor({ state: 'attached', timeout: DATA_MS })
  await ready()
  await h.moveTo(VIEW.w * 0.47, VIEW.h * 0.52, 900)
  await h.rest(3000)

  /* 3. Search */
  await h.click(page.locator('#q'))
  await h.rest(400)
  await h.type(PLACE)
  const hit = page.locator('#sug li[role="option"]', { hasText: PLACE }).first()
  await hit.waitFor({ timeout: DATA_MS })
  await h.rest(700)
  await h.click(hit, 600)
  await ready()
  await h.rest(3500)

  /* 4. Crops panel and the Rice window */
  const rice = page.locator('#sb-body button.crh[data-guide="Rice"]')
  await rice.waitFor({ timeout: DATA_MS })
  await h.point(panel)
  await h.scroll(700)
  await h.rest(1500)
  await h.scroll(-700)
  await h.rest(800)
  await h.scrollTo(rice)
  await h.click(rice)
  const topics = page.locator('#gm-nav a')
  await topics.first().waitFor({ timeout: DATA_MS })
  await h.rest(2000)
  await h.click(topics.nth(1))
  await h.rest(2200)
  await h.click(topics.nth(2))
  await h.rest(2200)
  await h.click(page.locator('#gm-x'))
  await h.rest(1200)

  /* 5. Map layers */
  const chip = (layer: string) => page.locator(`.layers .chip[data-layer="${layer}"]`)
  for (const layer of ['rain', 'heat', 'soil', 'rain']) {
    await h.click(chip(layer))
    await h.rest(3500)
  }

  /* 6. Time bar */
  await h.click(page.locator('#tplay'))
  await h.rest(6500)
  await h.click(page.locator('#tplay'))
  await h.rest(1000)
  const range = page.locator('#trange')
  const rb = await range.boundingBox()
  if (rb) {
    const y = rb.y + rb.height / 2
    await h.moveTo(rb.x + rb.width * 0.15, y)
    await page.mouse.down()
    await h.moveTo(rb.x + rb.width * 0.75, y, 2200)
    await page.mouse.up()
  }
  await h.rest(2000)

  /* 7. 3D */
  await h.click(page.getByRole('button', { name: 'Switch to 3D' }))
  await h.rest(2500)
  await h.click(page.getByRole('button', { name: 'Tilt up' }))
  await h.rest(1200)
  await h.click(page.getByRole('button', { name: 'Tilt up' }), 300)
  await h.rest(1500)
  await h.click(page.getByRole('button', { name: 'Zoom in' }))
  await h.rest(2500)
  await h.click(page.getByRole('button', { name: 'Switch to 2D' }))
  await h.rest(2000)

  /* 8. Weather tab */
  await h.click(page.locator('.tabsf button[aria-label="Weather"]'))
  await ready()
  await h.rest(2500)
  await h.point(panel)
  await h.scroll(500)
  await h.rest(2000)
  const more = page.locator('#sb-body button.more')
  await h.scrollTo(more)
  await h.rest(1000)
  await h.click(more)
  await h.rest(3000)

  /* 9. Full report */
  await h.click(page.locator('.tabsf button[aria-label="Crops"]'))
  await ready()
  await h.rest(1500)
  await h.click(page.locator('#rp-open'))
  await page.locator('#rp-s-now').waitFor({ timeout: DATA_MS })
  await h.rest(3000)
  await h.moveTo(VIEW.w * 0.42, VIEW.h * 0.57)
  for (let i = 0; i < 8; i++) {
    await h.scroll(450)
    await h.rest(2000)
  }
  const back = page.locator('#rp-back')
  await h.scrollTo(back)
  await h.rest(800)
  await h.click(back)
  await h.moveTo(VIEW.w / 2, VIEW.h / 2, 900)
  await h.rest(3500)
}
