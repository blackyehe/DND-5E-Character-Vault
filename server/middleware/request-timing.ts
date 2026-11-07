import {AsyncLocalStorage} from 'node:async_hooks'
import {randomUUID} from 'node:crypto'
import type {RequestHandler, Response} from 'express'
import type {mongo} from 'mongoose'

type Bucket = 'listing' | 'navigation' | 'counts' | 'other'
type Cache = 'hit' | 'miss'
interface Pending {started: number; bucket: Bucket; release: () => void}
interface Timing {
  endpoint: string
  closed: boolean; dbMs: number; roundTrips: number; failedRoundTrips: number
  buckets: Record<Bucket, number>; pending: Set<Pending>; sharedListingRead: boolean
  role: 'DM' | 'player' | null; hits: number; misses: number; entries: number | null; results: number | null
}
const scope = new AsyncLocalStorage<Timing>()
const observed = new WeakSet<mongo.MongoClient>()
let sampleCursor = 0
export const requestTimingEnabled = () => !['0', 'off', 'false'].includes((process.env.REQUEST_TIMING ?? 'on').trim().toLowerCase())
export function recordTimingRole(role: 'DM' | 'player') {
  const state = scope.getStore()
  if (state && !state.closed) state.role = role
}
export function recordTimingCache(cache: Cache) {
  const state = scope.getStore()
  if (state && !state.closed) state[cache === 'hit' ? 'hits' : 'misses']++
}
export function recordTimingEntries(count: number) {
  const state = scope.getStore()
  if (state && !state.closed) state.entries = count
}

function bucketFor(command: Record<string, any>, endpoint: string): Bucket {
  if (!endpoint.startsWith('notebook.')) return 'other'
  if (endpoint === 'notebook.navigation') return 'navigation'
  if (command.count || command.aggregate && command.pipeline?.some((p: any) => p.$count || p.$group || p.$facet)) return 'counts'
  if (command.comment === 'notebook-navigation' || command.find === 'rooms' || command.find === 'characters' || command.filter?.kind === 'folder') return 'navigation'
  return 'listing'
}

/** Three listeners per client, never per query/request. Retains no command values. */
export function observeTimingClient(client: mongo.MongoClient) {
  if (!requestTimingEnabled() || observed.has(client)) return
  observed.add(client)
  const pending = new Map<number, {state: Timing; operation: Pending}>()
  client.on('commandStarted', event => {
    const state = scope.getStore()
    if (!state || state.closed) return
    const bucket = event.commandName === 'getMore' ? cursorBuckets.get(String(event.command.getMore)) ?? 'other' : bucketFor(event.command, state.endpoint)
    const operation: Pending = {started: performance.now(), bucket, release: () => {pending.delete(event.requestId); state.pending.delete(operation)}}
    // The legacy notebook query supplies both rows and navigation/count data.
    if (state.endpoint === 'notebook.listing' && bucket === 'listing' && event.command.find === 'notebooks' && event.command.filter?.kind === 'entry' && event.command.comment !== 'notebook-listing') state.sharedListingRead = true
    state.roundTrips++
    state.pending.add(operation)
    pending.set(event.requestId, {state, operation})
  })
  // Cursor attribution stores only a numeric cursor ID and a fixed bucket name.
  const cursorBuckets = new Map<string, Bucket>()
  function finish(event: mongo.CommandSucceededEvent | mongo.CommandFailedEvent, failed: boolean) {
    const entry = pending.get(event.requestId)
    if (!entry) return
    const {state, operation} = entry
    operation.release()
    if (state.closed) return
    state.dbMs += event.duration
    state.buckets[operation.bucket] += event.duration
    if (failed) state.failedRoundTrips++
    const reply = 'reply' in event ? event.reply as {cursor?: {id?: unknown}} : undefined
    if (reply?.cursor?.id && String(reply.cursor.id) !== '0') {
      // Bound bookkeeping even if a caller abandons a cursor.
      if (cursorBuckets.size >= 1024) cursorBuckets.delete(cursorBuckets.keys().next().value!)
      cursorBuckets.set(String(reply.cursor.id), operation.bucket)
    }
  }
  client.on('commandSucceeded', event => finish(event, false))
  client.on('commandFailed', event => finish(event, true))
}

function endpoint(path: string) {
  const notebook = /^\/api\/rooms\/[^/]+\/notebook(?:\/(.*))?\/?$/.exec(path)
  if (notebook) return !notebook[1] ? 'notebook.listing' : notebook[1] === 'link-targets' ? 'notebook.navigation' : /\/history\/?$/.test(path) ? 'notebook.history' : 'notebook.read'
  if (/^\/api\/compendium-browse(?:\/|$)/.test(path)) {
    const parts = path.slice('/api/compendium-browse'.length).split('/').filter(Boolean)
    const known: Record<string, string> = {'detail-batch': 'preload', 'local-revision': 'local-revision', 'detail-revision': 'detail-revision', 'local-index': 'local-index', 'saved-detail': 'saved-detail'}
    const key = parts[1] ?? ''
    return 'compendium.' + (Object.hasOwn(known, key) ? known[key] : parts.length <= 1 ? 'browse' : 'detail')
  }
  if (/^\/api\/compendium(?:\/|$)/.test(path)) return 'compendium.read'
  return null
}
const number = (value: unknown, max: number): number | null => typeof value === 'string' && /^\d+$/.test(value) && Number(value) <= max ? Number(value) : null
const rounded = (value: number) => Math.round(value * 100) / 100
function size(chunk: unknown, encoding?: unknown) {
  if (typeof chunk === 'string') return Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding as BufferEncoding : 'utf8')
  return chunk instanceof Uint8Array ? chunk.byteLength : 0
}
function entryCount(body: unknown): number | null {
  if (Array.isArray(body)) return body.length
  if (!body || typeof body !== 'object') return null
  const value = body as Record<string, unknown>
  if (Array.isArray(value.entries)) return value.entries.length
  if (value.entry && typeof value.entry === 'object') return 1
  if (typeof value.index === 'string') return 1
  return null
}

/** Count bytes at write/end, without serializing, buffering or changing headers. */
export const requestTiming: RequestHandler = (req, res, next) => {
  if (!requestTimingEnabled() || !['GET', 'HEAD'].includes(req.method)) return next()
  const matched = endpoint(req.path)
  if (!matched) return next()
  const name: string = matched
  const sampleRate = process.env.REQUEST_TIMING_SAMPLE_EVERY === '5' ? 5 : 1
  if (sampleRate === 5) {sampleCursor = (sampleCursor + 1) % 5; if (sampleCursor !== 1) return next()}
  const state: Timing = {endpoint: name, closed: false, dbMs: 0, roundTrips: 0, failedRoundTrips: 0, buckets: {listing: 0, navigation: 0, counts: 0, other: 0}, pending: new Set(), sharedListingRead: false, role: null, hits: 0, misses: 0, entries: null, results: null}
  const requestId = randomUUID(), started = performance.now()
  let bytes = 0
  const write = res.write, end = res.end, json = res.json
  res.write = function(this: Response, ...args: Parameters<Response['write']>) {
    const length = size(args[0], args[1])
    const result = write.apply(this, args)
    bytes += length
    return result
  } as Response['write']
  res.end = function(this: Response, ...args: Parameters<Response['end']>) {
    const length = size(args[0], args[1])
    bytes += length
    try {return end.apply(this, args)} catch (error) {bytes -= length; throw error}
  } as Response['end']
  res.json = function(this: Response, body: unknown) {
    state.results = entryCount(body)
    return json.call(this, body)
  }
  function log(complete: boolean) {
    if (state.closed) return
    const finished = performance.now(), inFlight = state.pending.size
    for (const operation of [...state.pending]) {
      const duration = finished - operation.started
      state.dbMs += duration
      state.buckets[operation.bucket] += duration
      operation.release()
    }
    state.closed = true
    const section = typeof req.query.section === 'string' && ['all', 'journal', 'story-items'].includes(req.query.section) ? req.query.section : null
    const cache = state.hits && state.misses ? 'mixed' : state.misses ? 'miss' : state.hits ? 'hit' : 'not-observed'
    const record = {
      event: 'request_timing', requestId, endpoint: name, role: state.role, section,
      status: res.statusCode, handlerMs: rounded(finished - started), dbMs: rounded(state.dbMs), dbRoundTrips: state.roundTrips,
      dbReadyMs: rounded(Number(res.locals.dbReadyMs) || 0),
      dbFailedRoundTrips: state.failedRoundTrips, dbInFlightAtEnd: inFlight,
      ...(name.startsWith('notebook.') ? {dbListingMs: rounded(state.buckets.listing), dbNavigationMs: rounded(state.buckets.navigation), dbCountsMs: rounded(state.buckets.counts), dbOtherMs: rounded(state.buckets.other), dbSharedListingRead: state.sharedListingRead} : {}),
      responseBytes: bytes, compressed: !!res.getHeader('Content-Encoding') && res.getHeader('Content-Encoding') !== 'identity', compressionScope: 'application', complete, sampleEvery: sampleRate,
      ...(name === 'notebook.listing' ? {searchUsed: typeof req.query.search === 'string' && req.query.search.length > 0, offset: req.query.offset === undefined ? 0 : number(req.query.offset, 100000), resultsReturned: state.results} : {}),
      ...(name.startsWith('compendium.') ? {entriesRead: state.entries ?? state.results, resultsReturned: state.results, cache} : {}),
    }
    // Existing application logger; logging must never turn a completed read into an error.
    try {console.info(JSON.stringify(record))} catch { /* Optional telemetry. */ }
  }
  res.once('finish', () => log(true))
  res.once('close', () => log(res.writableFinished))
  scope.run(state, next)
}
