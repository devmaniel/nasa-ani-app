import type { ComponentType } from 'react'

/* An icon component from lucide-react or react-icons, drawn with the .i styles */
export type IconType = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

/* The colour pairs used by icon tiles (data-tone in the styles) */
export type Tone = 'soil' | 'grow' | 'water' | 'feed' | 'pest' | 'harvest' | 'none'

export type LayerKey = 'rain' | 'heat' | 'soil' | 'plants'
export type SideTab = 'weather' | 'crops'

/* Lets style={{ '--v': '40%' }} pass the CSS variables the copied styles read */
declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
}
