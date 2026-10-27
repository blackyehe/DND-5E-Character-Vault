import type {NotebookAudience} from './notebook'

export const MAP_LIMITS = {
  imageBytes: 3 * 1024 * 1024, roomBytes: 10 * 1024 * 1024,
  ownerBytes: 25 * 1024 * 1024, siteBytes: 100 * 1024 * 1024,
  dimension: 4096, inputPixels: 16 * 1024 * 1024, mapsPerRoom: 25, pinsPerMap: 100,
  regionsPerMap: 32, pointsPerRegion: 256,
} as const
// Base64 expands image bytes by 4/3. Leave bounded space for map metadata;
// this complete request stays below Vercel's 4.5 MB Function payload limit.
export const MAP_UPLOAD_JSON_BYTES = Math.ceil(MAP_LIMITS.imageBytes / 3) * 4 + 16 * 1024
export const PIN_VISIBILITIES = ['always', 'zoomed', 'close'] as const
export const PIN_COLORS = ['theme', 'gold', 'blue', 'green', 'purple', 'red'] as const
export const PIN_SYMBOLS = ['number', 'settlement', 'fortress', 'ruins', 'quest', 'danger', 'person', 'treasure'] as const
export const PIN_LABELS = ['selected', 'always', 'never'] as const
export interface MapPinDisplay {
  visibility: typeof PIN_VISIBILITIES[number]
  color: typeof PIN_COLORS[number]
  symbol: typeof PIN_SYMBOLS[number]
  label: typeof PIN_LABELS[number]
}
// Missing settings include existing pins: the agreed default is zoomed-in.
export function pinDisplay(pin: {display?: Partial<MapPinDisplay> | null} = {}): MapPinDisplay {
  return {visibility: pin.display?.visibility ?? 'zoomed', color: pin.display?.color ?? 'theme',
    symbol: pin.display?.symbol ?? 'number', label: pin.display?.label ?? 'selected'}
}
export const pinZoom = (display: MapPinDisplay) => display.visibility === 'close' ? 4 : display.visibility === 'zoomed' ? 2 : 1
export interface MapPin {id: string; label: string; entryId: string; x: number; y: number; noteTitle: string | null; cityLibrary?: boolean; display?: MapPinDisplay; audience?: NotebookAudience; characterIds?: string[]}
export interface MapSummary {
  id: string; title: string; audience: NotebookAudience; characterIds: string[]
  revision: number; updatedAt: string; width: number; height: number; bytes: number
}
export interface MapPoint {x:number; y:number}
export interface MapRegion {id:string; name:string; color:string; opacity:number; fadeZoom:number; points:MapPoint[]}
export interface RoomMap extends MapSummary {pins: MapPin[]; regions?:MapRegion[]}
export interface MapIndex {
  maps: MapSummary[]; role: 'dm' | 'player'; readOnly: boolean
  characters: {id: string; name: string; assigned: boolean}[]
  storage?: {roomBytes: number; ownerBytes: number}
}
export interface MapDraft {title: string; audience: NotebookAudience; characterIds: string[]}
export interface MapPinDraft {label: string; entryId: string; x: number; y: number; display?: MapPinDisplay; audience?: NotebookAudience; characterIds?: string[]}
