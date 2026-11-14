import type { Crop, CropWeather, Fit } from './crops'
import type { Place } from './places'

const MONTHS_A_YEAR = 12 /* ECOCROP's rain is a year's; a month gets a twelfth */

/* one growing month's rain (mm) and average heat (°C) at the place, null when there's no number */
export type Month = { m: number; rain: number | null; heat: number | null }

export const round = (v: number) => Math.round(v)

/* the crop's best range: heat (°C) and rain a month (mm) */
export function likes(c: Crop) {
  return { heat: [c.heat[1], c.heat[2]], rain: [c.rain[1] / MONTHS_A_YEAR, c.rain[2] / MONTHS_A_YEAR] }
}

/* the growing months' rain and heat, from planting to harvest */
export function growingMonths(wx: CropWeather, place: Place, r: Fit): Month[] {
  return Array.from({ length: r.c.months }, (_, i) => {
    const m = r.pm + i
    return { m, rain: wx.rain(place, m), heat: wx.heat(place, m) }
  })
}
