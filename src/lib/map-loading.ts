import type {RoomMap} from '../../shared/room-maps'
import {ApiError} from './api'
import {beginForegroundWork} from './foreground-work'

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

async function readPart<T>(path: string, stage: MapStage, caller: AbortSignal, read: (response: Response) => Promise<T>): Promise<T> {
  // One deadline covers both attempts and body reading. A timed-out opening does
  // not silently gain another 15/20 seconds by starting a fresh attempt.
  const deadline = AbortSignal.timeout(stage === 'image' ? 20000 : 15000)
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

export async function loadRoomMap(detailsPath: string, imagePath: string, signal: AbortSignal): Promise<{map: RoomMap; image: Blob}> {
  const controller = new AbortController(), active = AbortSignal.any([signal, controller.signal])
  const finish = beginForegroundWork()
  try {
    const [map, image] = await Promise.all([
      readPart(detailsPath, 'details', active, response => response.json() as Promise<RoomMap>),
      readPart(imagePath, 'image', active, response => response.blob()),
    ])
    return {map, image}
  } finally {
    controller.abort()
    finish()
  }
}
