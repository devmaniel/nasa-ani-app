# Ani demo video (phone) — script

`demo-phone.mp4`: one long take of the app at phone size with live data, no captions, a fingertip dot doing everything by hand.

- Place: **Nueva Ecija**
- Season: **Dry season** (Dec 2026 – May 2027), picked on screen. The default "now" season is only a couple of weeks long, too short for the timeline.
- Length: about 3:42, 1080×2160 (a 1:2 phone screen), 60 fps
- Recorded with: `cd client && npm run demo:phone` (source: `client/e2e/demo-phone.spec.ts`)

Times are from the 14 Nov 2026 run. Live data loads at different speeds on each run, so scenes shift by a few seconds.

| Time | Scene | What happens on screen |
| --- | --- | --- |
| 0:00 | 1. Landing | The home page on a phone. It scrolls down section by section to the closing "Open the map" block. |
| 0:32 | | Tap **Open the map**. |
| 0:34 | 2. Map | The whole Philippines map, full screen. On phones the map comes first, the panel stays closed. |
| 0:38 | 3. Search | Tap the search box, type "Nueva Ecija" letter by letter, pick it. The map flies to the province. |
| 0:48 | 4. Season | Tap **Crops**: the panel opens full screen. Tap the dates (**Change**): "When will you plant?" shows the Rainy and Dry season choices. Pick **Dry season**. The crops re-rate for it, and the list scrolls down and back up. |
| 1:05 | 5. Rice | Tap **Rice**. The crop window opens on **When to plant**: the planting calendar, the month to plant and harvest, then the heat, rain and land checks. Tap **More details** and scroll through month by month, heat, rain, land. Switch to the **Cultivation guide** tab, scroll a little, close. |
| 1:35 | 6. Full report | Tap **See full report**. The report for Nueva Ecija scrolls down slowly: right now, looking ahead, month by month, best moves, what to plant. Back to the top, tap **Map**, close the panel. |
| 2:16 | 7. Weather | Tap **Weather**: the panel opens full screen. It scrolls down and **more** is tapped to show more months. Close the panel. |
| 2:28 | 8. Layers and timeline | Back on the map, now with the map tools. Tap **Layers**, then **Rain**, **Heat**, **Soil**; the chips row glides sideways to **Humidity** and **Sun**, then back to **Rain**. The map colours change with each. Tap **Timeline**, press **Play**, and the months run by. Pause, then drag the bar to a later month. |
| 3:12 | 9. 3D | **Switch to 3D**, **Tilt up** twice, **Zoom in**, then **Switch to 2D**. |
| 3:28 | End | The dot rests in the middle of the map until the video ends. |

## Recording

- Run `cd client && npm run demo:phone`. A Chrome window opens at the top-left for about 3½ minutes. The page is drawn phone-size in its top-left corner, and only that part is recorded. Keep the mouse and keyboard off it and don't switch apps.
- The video lands in `client/test-results/`. Playwright clears that folder before each run, so move a video out if you want to keep it. This script lives in `e2e/` and is not cleared.
