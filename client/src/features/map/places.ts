import type { Point } from './climate'

/* A place picked on this visit. w: how far in to fly when it's picked again (kept for the map, later) */
export type Place = Point & { name: string; sub: string; w: number }
/* A place the search can find */
export type SearchPlace = Point & { n: string; k: 'Region' | 'Province' | 'City'; w: number }

type Row = [string, number, number, number?]

/* cities: [name, lon, lat] */
const CITIES: Row[] = [
  ['Manila', 120.98, 14.6], ['Cebu City', 123.89, 10.32], ['Davao City', 125.61, 7.07],
  ['Quezon City', 121.04, 14.68], ['Baguio', 120.59, 16.41], ['Cabanatuan City', 120.97, 15.49], ['Tuguegarao', 121.73, 17.61], ['Laoag', 120.59, 18.2], ['Naga', 123.18, 13.62], ['Legazpi', 123.74, 13.14], ['Lucena', 121.62, 13.94],
  ['Iloilo City', 122.56, 10.72], ['Bacolod', 122.95, 10.68], ['Tacloban', 125.0, 11.24], ['Dumaguete', 123.31, 9.31], ['Cagayan de Oro', 124.65, 8.48], ['Zamboanga City', 122.08, 6.92], ['General Santos', 125.17, 6.11], ['Puerto Princesa', 118.74, 9.74], ['Butuan', 125.54, 8.95],
  ['Tarlac City', 120.6, 15.49], ['San Jose City', 120.99, 15.79], ['Gapan', 120.95, 15.31], ['Science City of Muñoz', 120.9, 15.72], ['Angeles', 120.59, 15.15], ['San Fernando', 120.69, 15.03], ['Malolos', 120.81, 14.84], ['Dagupan', 120.34, 16.04], ['Urdaneta', 120.57, 15.98], ['Santiago', 121.55, 16.69], ['Cauayan', 121.77, 16.93], ['Batangas City', 121.06, 13.76],
  ['Dasmariñas', 120.94, 14.33], ['Imus', 120.94, 14.43], ['Bacoor', 120.96, 14.46], ['Trece Martires', 120.87, 14.28], ['Tagaytay', 120.96, 14.1],
]
/* regions and provinces: [name, lon, lat, w] */
const REGION_ROWS: Row[] = [
  ['Central Luzon', 120.8, 15.3, 1.8], ['Cagayan Valley', 121.7, 17.2, 2.4], ['Ilocos Region', 120.5, 17.0, 2.4], ['Calabarzon', 121.4, 14.1, 2], ['Metro Manila', 121.02, 14.6, 0.5], ['Bicol Region', 123.4, 13.4, 2.4], ['Western Visayas', 122.5, 10.9, 2.4], ['Central Visayas', 123.8, 10.0, 2.2], ['Northern Mindanao', 124.8, 8.3, 2.4], ['Davao Region', 125.8, 7.2, 2.4],
]
const PROVINCE_ROWS: Row[] = [
  ['Nueva Ecija', 121.0, 15.6, 1.1], ['Tarlac', 120.5, 15.5, 0.9], ['Pangasinan', 120.3, 15.9, 1.1], ['Pampanga', 120.7, 15.05, 0.7], ['Bulacan', 121.0, 14.95, 0.8], ['Cavite', 120.88, 14.28, 0.7], ['Isabela', 121.9, 16.9, 1.6], ['Camarines Sur', 123.3, 13.6, 1.2], ['Palawan', 118.6, 9.8, 3.2], ['Iloilo', 122.5, 10.95, 1.1], ['Negros Occidental', 123.0, 10.3, 1.3], ['Cebu', 123.85, 10.4, 1.4], ['Leyte', 124.8, 10.9, 1.2], ['Bukidnon', 125.0, 8.0, 1.3], ['Davao del Norte', 125.7, 7.5, 0.9],
]
const CITY_W = 0.5
function toPlaces(rows: Row[], k: SearchPlace['k']): SearchPlace[] {
  return rows.map(([n, lon, lat, w]) => ({ n, k, lon, lat, w: w ?? CITY_W }))
}

export const PLACES: SearchPlace[] = [...toPlaces(REGION_ROWS, 'Region'), ...toPlaces(PROVINCE_ROWS, 'Province'), ...toPlaces(CITIES, 'City')]

/* the ten regions stand for the whole country; an island group is the regions on it */
export const REGIONS = PLACES.filter((p) => p.k === 'Region')
export const GROUPS = [
  { n: 'Luzon', r: ['Ilocos Region', 'Cagayan Valley', 'Central Luzon', 'Metro Manila', 'Calabarzon', 'Bicol Region'] },
  { n: 'Visayas', r: ['Western Visayas', 'Central Visayas'] },
  { n: 'Mindanao', r: ['Northern Mindanao', 'Davao Region'] },
].map((g) => ({ n: g.n, pts: REGIONS.filter((p) => g.r.includes(p.n)) }))

/* the map's bounds: a location outside them is outside the Philippines */
export const BOUNDS = { w: 116, e: 127.5, s: 4.5, n: 21.5 }
export const SPOT_W = 0.6

export function coords(lon: number, lat: number) {
  return lat.toFixed(2) + '° N · ' + lon.toFixed(2) + '° E'
}
