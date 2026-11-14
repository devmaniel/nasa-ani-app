import { defineConfig } from '@playwright/test'

const URL = 'http://localhost:5173'

/* The demo video: one long take of the app with live data. Playwright drives a visible Chrome window and the
   spec screen-records it with ffmpeg (Playwright's own recorder only manages 6-14 real frames a second) */
export default defineConfig({
  testDir: './e2e',
  timeout: 6 * 60_000,
  workers: 1,
  reporter: 'list',
  use: {
    channel: 'chromium',
    headless: false,
    viewport: null, /* the page fills the real window, so what's on screen is what's recorded */
    baseURL: URL,
  },
  webServer: { command: 'npm run dev', url: URL, reuseExistingServer: true },
})
