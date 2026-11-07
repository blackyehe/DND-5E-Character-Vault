import {MAP_LIMITS, type MapSummary, type RoomMap} from '../../shared/room-maps'
import {ApiError} from './api'
import {beginForegroundWork} from './foreground-work'
import {fittedMapImageEdge, mapImageEdge, mapImagePath} from './map-image-resolution'

type MapStage = 'details' | 'image'
type MapFailure = 'http' | 'network' | 'timeout' | 'response'
const transientStatuses = new Set([408, 502, 503, 504])

export class MapLoadError extends ApiError {
  readonly stage: MapStage
  readonly reason: MapFailure
  constructor(stage: MapStage, reason: MapFailure, status = 0) {
    const subject = stage === 'image' ? 'The map image' : 'The map details'
    const message = status === 401 ? 'Please sign in again before opening this map.'
      : status === 403 || status === 404 ? 'This map is no longer available to you. Refresh maps to check access.'
      : reason === 'timeout' ? `${subject} took too long to load. Choose Retry map to try again.`
      : reason === 'network' ? `${subject} could not be downloaded. Check your connection, then choose Retry map.`
      : reason === 'response' ? `${subject} could not be read. Choose Retry map to try again.`
      : `${subject} could not be loaded (HTTP ${status}). Choose Retry map to try again.`
    super(status, message)
    this.stage = stage
    this.reason = reason
  }
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const done = () => {signal.removeEventListener('abort', cancel); resolve()}
    const timer = setTimeout(done, 250)
    const cancel = () => {clearTimeout(timer); reject(signal.reason)}
    signal.addEventListener('abort', cancel, {once: true})
  })
}

async function readPart<T>(path: string, stage: MapStage, caller: AbortSignal, read: (response: Response) => Promise<T>, deadline = AbortSignal.timeout(stage === 'image' ? 20000 : 15000)): Promise<T> {
  // One deadline covers both attempts and body reading. A timed-out opening does
  // not silently gain another 15/20 seconds by starting a fresh attempt.
  const signal = AbortSignal.any([caller, deadline])
  for (let attempt = 0; ; attempt++) {
    try {
      signal.throwIfAborted()
      const response = await fetch(path, {
        method: 'GET', credentials: 'include', signal,
        ...(stage === 'image' ? {cache: 'no-cache' as const} : {headers: {'Content-Type': 'application/json'}}),
      })
      if (!response.ok) {
        void response.body?.cancel().catch(() => {})
        throw new MapLoadError(stage, 'http', response.status)
      }
      const value = await read(response)
      signal.throwIfAborted()
      return value
    } catch (error) {
      if (caller.aborted) throw caller.reason
      if (deadline.aborted) throw new MapLoadError(stage, 'timeout')
      const failure = error instanceof MapLoadError ? error
        : new MapLoadError(stage, error instanceof TypeError ? 'network' : 'response')
      // This helper performs GETs only. Never retry authorization, missing
      // content, rate limiting, invalid JSON or an exhausted overall deadline.
      if (attempt || !(failure.reason === 'network' || transientStatuses.has(failure.status))) throw failure
      try {await pause(signal)} catch {
        if (caller.aborted) throw caller.reason
        throw new MapLoadError(stage, 'timeout')
      }
    }
  }
}

export interface MapImageProgress {received: number; total?: number}
interface ImageOptions {edge?: number; originalEdge?: number; onProgress?: (progress: MapImageProgress) => void}
async function imageBlob(response: Response, progress?: ImageOptions['onProgress']) {
  if (response.headers?.get('Content-Type')?.split(';')[0] !== 'image/webp') throw new MapLoadError('image', 'response')
  if (!progress || !response.body) {
    const image = await response.blob()
    if (!image.size || image.size > MAP_LIMITS.imageBytes) throw new MapLoadError('image', 'response')
    return image
  }
  const length = Number(response.headers.get('Content-Length'))
  const total = length > 0 && length <= MAP_LIMITS.imageBytes ? length : undefined
  const reader = response.body.getReader(), chunks: Uint8Array<ArrayBuffer>[] = []
  let received = 0
  progress({received, total})
  try {
    for (;;) {
      const {done, value} = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAP_LIMITS.imageBytes) throw new MapLoadError('image', 'response')
      chunks.push(new Uint8Array(value))
      progress({received, total})
    }
    if (!received || total && received !== total) throw new MapLoadError('image', 'response')
    return new Blob(chunks, {type: 'image/webp'})
  } catch (error) {void reader.cancel().catch(() => {}); throw error}
  finally {reader.releaseLock()}
}

export async function loadMapImage(imagePath: string, signal: AbortSignal, options: ImageOptions = {}): Promise<{image: Blob; imageEdge: number}> {
  const deadline = AbortSignal.timeout(20000), finish = beginForegroundWork()
  const read = (edge?: number) => readPart(mapImagePath(imagePath, edge), 'image', signal, async response => {
    const reported = Number(response.headers?.get('X-Map-Image-Edge'))
    const image = await imageBlob(response, options.onProgress)
    return {image, imageEdge: reported > 0 && reported <= MAP_LIMITS.dimension ? reported : edge ?? options.originalEdge ?? 0}
  }, deadline)
  try {
    try {return await read(options.edge)} catch (error) {
      // Never mask a denied/missing map with another URL. A broken overview can
      // fall back to the original, within the same overall image deadline.
      if (!options.edge || signal.aborted || deadline.aborted || error instanceof ApiError && [401, 403, 404].includes(error.status)) throw error
      return await read()
    }
  } finally {finish()}
}

export async function loadRoomMap(detailsPath: string, imagePath: string, signal: AbortSignal, options: {
  summary?: MapSummary; viewport?: {width: number; height: number; dpr: number}
  onDetails?: (map: RoomMap) => void; onProgress?: ImageOptions['onProgress']
} = {}): Promise<{map: RoomMap; image: Blob; imageEdge: number}> {
  const controller = new AbortController(), active = AbortSignal.any([signal, controller.signal])
  const finish = beginForegroundWork()
  try {
    const summary = options.summary, originalEdge = summary ? Math.max(summary.width, summary.height) : undefined
    const edge = summary && options.viewport ? mapImageEdge(summary, fittedMapImageEdge(summary, options.viewport)) : originalEdge
    const [map, loaded] = await Promise.all([
      readPart(detailsPath, 'details', active, response => response.json() as Promise<RoomMap>).then(map => {active.throwIfAborted(); options.onDetails?.(map); return map}),
      loadMapImage(imagePath, active, {edge: edge !== originalEdge ? edge : undefined, originalEdge, onProgress: options.onProgress}),
    ])
    return {map, ...loaded}
  } finally {
    controller.abort()
    finish()
  }
}

/** Decode offscreen so an upgrade cannot replace a usable overview with a blank. */
export function decodedMapImageUrl(blob: Blob, caller: AbortSignal): Promise<string> {
  caller.throwIfAborted()
  const signal = AbortSignal.any([caller, AbortSignal.timeout(5000)])
  const url = URL.createObjectURL(blob), image = new Image()
  return new Promise((resolve, reject) => {
    const cleanup = () => {signal.removeEventListener('abort', abort); image.onload = null; image.onerror = null}
    const fail = (error: unknown) => {cleanup(); image.src = ''; URL.revokeObjectURL(url); reject(error)}
    const abort = () => fail(caller.aborted ? caller.reason : new MapLoadError('image', 'timeout'))
    image.onload = () => {if (signal.aborted) return abort(); cleanup(); resolve(url)}
    image.onerror = () => fail(new MapLoadError('image', 'response'))
    signal.addEventListener('abort', abort, {once: true})
    image.src = url
  })
}
