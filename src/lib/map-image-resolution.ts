import type {MapSummary} from '../../shared/room-maps'

export function fittedMapImageEdge(map: Pick<MapSummary, 'width' | 'height'>, viewport: {width: number; height: number; dpr: number}, zoom = 1) {
  const fit = Math.max(.01, Math.min(Math.max(1, viewport.width - 32) / map.width, Math.max(1, viewport.height - 32) / map.height))
  return Math.max(map.width, map.height) * Math.min(1, fit * zoom * Math.max(1, viewport.dpr || 1))
}

/** Missing legacy variants and demand beyond the largest overview use the original. */
export function mapImageEdge(map: MapSummary, requiredEdge: number) {
  const original = Math.max(map.width, map.height)
  const variant = map.imageVariants?.filter(v => v.edge >= requiredEdge && v.edge < original && v.bytes < map.bytes)
    .sort((a, b) => a.edge - b.edge)[0]
  return variant?.edge ?? original
}

export function mapImagePath(path: string, edge?: number) {
  if (!edge) return path
  const url = new URL(path, 'http://map.local')
  url.searchParams.set('size', String(edge))
  return /^https?:\/\//.test(path) ? url.href : url.pathname + url.search
}
