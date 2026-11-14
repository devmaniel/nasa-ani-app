import type { TransformStyleFunction } from 'maplibre-gl'

/* OpenFreeMap's "Liberty" map recoloured in a bright street-map palette (in the spirit of Mapbox's street map):
   warm land, vivid blue water, vivid green parks, orange motorways, yellow main roads, English names, no shop icons. */

type Style = Parameters<TransformStyleFunction>[1]
type Layer = Style['layers'][number]
type TextField = NonNullable<NonNullable<Extract<Layer, { type: 'symbol' }>['layout']>['text-field']>

const LAND = '#f4f1ec'
const WATER = '#75cff0'
const GREEN = '#b5e3a3'
const WOOD = '#a3d991'
const GRASS = '#c8eab5'
const SAND = '#f6eec7'
const BUILT = '#ede7df'
const BUILDING = '#e2dcd3'
const ROAD = '#ffffff'
const CASING = '#d9d2c7'
const MOTORWAY = '#ff9d5c'
const MOTORWAY_CASING = '#e2783a'
const PRIMARY = '#ffd166'
const PRIMARY_CASING = '#e3b13f'
const RAIL = '#c9c4bc'
const BORDER = '#8d86a8'
const INK = '#1d2326'
const MUTE = '#6b6f70'
const WATER_TEXT = '#1d6f9f'
const HALO = '#ffffff'

/* shop and sight icons, one-way arrows and road number shields: noise on a crop map */
const HIDDEN = /^(poi_|road_one_way|highway-shield|road_shield)/

/* first match wins: casings before road fills, motorways and main roads before other roads */
const AREA_COLORS: [RegExp, string][] = [
  [/^background$/, LAND],
  [/^(water|waterway_.*)$/, WATER],
  [/^landcover_wood$/, WOOD],
  [/^(park|park_outline)$/, GREEN],
  [/^(landcover_grass|landuse_(pitch|track|cemetery))$/, GRASS],
  [/^landcover_sand$/, SAND],
  [/^(landcover_|landuse_|aeroway_fill)/, BUILT],
  [/^aeroway_/, BUILDING],
  [/motorway(_link)?_casing$/, MOTORWAY_CASING],
  [/trunk_primary_casing$/, PRIMARY_CASING],
  [/casing$/, CASING],
  [/(rail|hatching)$/, RAIL],
  [/motorway(_link)?$/, MOTORWAY],
  [/trunk_primary$/, PRIMARY],
  [/^(tunnel|road|bridge)_/, ROAD],
  [/^building/, BUILDING],
  [/^boundary_3$/, RAIL],
  [/^boundary_/, BORDER],
]
const TEXT_COLORS: [RegExp, string][] = [
  [/^(waterway_line_label|water_name)/, WATER_TEXT],
  [/^(label_other|highway-name|airport)/, MUTE],
  [/^label_/, INK],
]

/* the English name where the map has one, else the Latin-script one, else the local one */
const ENGLISH_NAME: TextField = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']]

function pick(rules: [RegExp, string][], id: string) {
  return rules.find(([re]) => re.test(id))?.[1]
}

function recolorLayer(l: Layer): Layer {
  if (HIDDEN.test(l.id)) return { ...l, layout: { ...l.layout, visibility: 'none' } }
  if (l.type === 'symbol') {
    const color = pick(TEXT_COLORS, l.id)
    const usesName = JSON.stringify(l.layout?.['text-field'] ?? '').includes('name')
    return {
      ...l,
      layout: usesName ? { ...l.layout, 'text-field': ENGLISH_NAME } : l.layout,
      paint: color ? { ...l.paint, 'text-color': color, 'text-halo-color': HALO } : l.paint,
    }
  }
  const color = pick(AREA_COLORS, l.id)
  if (!color) return l
  switch (l.type) {
    case 'background': return { ...l, paint: { ...l.paint, 'background-color': color } }
    case 'fill': return l.paint?.['fill-pattern'] ? l : { ...l, paint: { ...l.paint, 'fill-color': color, 'fill-outline-color': color } }
    case 'line': return { ...l, paint: { ...l.paint, 'line-color': color } }
    case 'fill-extrusion': return { ...l, paint: { ...l.paint, 'fill-extrusion-color': color } }
    default: return l
  }
}

export const mapStyle: TransformStyleFunction = (_previous, next) => ({ ...next, layers: next.layers.map(recolorLayer) })
