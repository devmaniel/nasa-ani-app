# Ani demo video (30 seconds, phone) — script

`demo-30s.mp4`: the short cut of the demo at phone size, with live data and no captions. A fingertip dot does everything by hand, at a quicker pace. It is built around crops → weather → the full report last.

- Place: **Nueva Ecija**
- Season: **Dry season** (Dec 2026 – May 2027), picked on screen
- Length: about 0:32, 1080×2160 (a 1:2 phone screen), 60 fps
- Recorded with: `cd client && npm run demo:30s` (source: `client/e2e/demo-30s.spec.ts`)

Before the camera starts, the app loads the place, the season, Rice, the weather and the report once, so the take never sits on a loading screen. Times are from the 14 Nov 2026 run.

| Time | Scene | What happens on screen |
| --- | --- | --- |
| 0:00 | 1. Landing | The home page on a phone. Tap **Open the map**. |
| 0:03 | 2. Search | Tap the search box, type "Nueva Ecija" and pick it. The map flies to the province. |
| 0:08 | 3. Crops | Tap **Crops**: the panel opens full screen. Tap the dates (**Change**) and pick **Dry season**; the crops re-rate for it. |
| 0:14 | | Tap **Rice**. The crop window opens on **When to plant**: the planting calendar and the month to plant. One scroll through the heat, rain and land checks, then close. |
| 0:20 | 4. Weather | Close the panel (on a phone it covers the Crops and Weather buttons), then tap **Weather**. The coming months show, with one scroll. |
| 0:25 | 5. Full report | Tap **See full report**. The report for Nueva Ecija scrolls down through the short answer, **Right now** and **Looking ahead**. |
| 0:31 | End | The video ends on the report. |

Map layers, the timeline and 3D are left out of this cut; the full phone demo (`DEMO-SCRIPT-PHONE.md`) has them.

## Recording

- Run `cd client && npm run demo:30s`. A Chrome window opens at the top-left for about 45 seconds, about 15 of them loading off camera. The page is drawn at phone size in its top-left corner, and only that part is recorded. Keep the mouse and keyboard off it and don't switch apps.
- The video lands in `client/test-results/`. Playwright clears that folder before each run, so move a video out if you want to keep it. This script lives in `e2e/` and is not cleared.
