import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from 'vitest'
import express from 'express'
import {EventEmitter} from 'node:events'
import type {Server} from 'node:http'
import type {mongo} from 'mongoose'
import {gzipSync} from 'node:zlib'
import {requestTiming, observeTimingClient, recordTimingCache, recordTimingRole} from './request-timing'

const client = new EventEmitter()
let sequence = 0
function command(command: object, duration: number, failed = false) {
  const requestId = ++sequence
  client.emit('commandStarted', {requestId, commandName: 'find', command})
  client.emit(failed ? 'commandFailed' : 'commandSucceeded', {requestId, duration, reply: {}})
}
let server: Server, base: string
const output: string[] = []
const logs = () => output.map(line => JSON.parse(line)).filter(r => r.event === 'request_timing')
const body = {entries: [{id: 'private-id', title: 'Private title', body: 'Private prose'}], counts: {people: 1}}
beforeAll(async () => {
  vi.spyOn(console, 'info').mockImplementation((line: unknown) => {if (typeof line === 'string') output.push(line)})
  process.env.REQUEST_TIMING = 'on'
  observeTimingClient(client as unknown as mongo.MongoClient)
  observeTimingClient(client as unknown as mongo.MongoClient)
  const app = express()
  app.use(requestTiming)
  app.get('/api/rooms/:roomId/notebook', async (req, res) => {
    recordTimingRole(req.query.player ? 'player' : 'DM')
    command({find: 'notebooks', filter: {kind: 'folder'}}, 2)
    await new Promise(resolve => setTimeout(resolve, req.query.player ? 8 : 1))
    command({find: 'notebooks', filter: {kind: 'entry'}}, req.query.player ? 9 : 3)
    command({aggregate: 'notebooks', pipeline: [{$count: 'total'}]}, 1, true)
    res.set('Cache-Control', 'private, no-store').json(body)
  })
  app.get('/api/rooms/:roomId/notebook/link-targets', (_req, res) => {recordTimingRole('player');command({find: 'notebooks', filter: {kind: 'entry'}}, 4);res.json({entries: []})})
  app.get('/api/compendium-browse/:kind/detail-batch', (_req, res) => {recordTimingCache('hit');res.json({entries: [{index: 'private-reference', entry: body}], skipped: []})})
  app.get('/api/compendium/:kind/:index', (_req, res) => {recordTimingCache('miss');res.status(404).json({error: 'Private diagnostic'})})
  app.get('/api/compendium-browse/:kind/local-index', (_req, res) => {res.set('Content-Encoding', 'gzip').send(gzipSync('synthetic data'))})
  app.get('/api/compendium-browse/:kind/stream', (_req, res) => {res.write('first');res.end('second')})
  app.get('/api/compendium-browse/:kind/empty', (_req, res) => res.status(304).end())
  app.get('/unrelated', (_req, res) => res.json(body))
  server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  base = 'http://127.0.0.1:' + (server.address() as {port: number}).port
})
afterAll(async () => {await new Promise<void>(resolve => server.close(() => resolve())); vi.restoreAllMocks()})
afterEach(() => {output.length = 0; delete process.env.REQUEST_TIMING; delete process.env.REQUEST_TIMING_SAMPLE_EVERY})

describe('optional privacy-safe request timing', () => {
  it('logs one line with the requested measurements without changing the response', async () => {
    const response = await fetch(base + '/api/rooms/private-room/notebook?section=journal&search=PrivateSearch&tags=PrivateTag&offset=60')
    const text = await response.text()
    expect(JSON.parse(text)).toEqual(body)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(logs()).toHaveLength(1)
    expect(logs()[0]).toMatchObject({endpoint: 'notebook.listing', role: 'DM', section: 'journal', dbMs: 6, dbRoundTrips: 3, dbFailedRoundTrips: 1, dbListingMs: 3, dbNavigationMs: 2, dbCountsMs: 1, dbSharedListingRead: true, responseBytes: Buffer.byteLength(text), compressed: false, searchUsed: true, offset: 60, resultsReturned: 1, complete: true})
    expect(logs()[0].requestId).toMatch(/^[a-f0-9-]{36}$/)
    expect(logs()[0].handlerMs).toBeGreaterThanOrEqual(0)
    expect(output.join('')).not.toMatch(/private-room|private-id|Private title|Private prose|PrivateSearch|PrivateTag/)
    expect(client.listenerCount('commandStarted')).toBe(1)
  })
  it('keeps concurrent requests separate', async () => {
    await Promise.all([fetch(base + '/api/rooms/a/notebook').then(r => r.text()), fetch(base + '/api/rooms/b/notebook?player=true').then(r => r.text())])
    expect(logs()).toHaveLength(2)
    expect(logs().find(r => r.role === 'DM').dbMs).toBe(6)
    expect(logs().find(r => r.role === 'player').dbMs).toBe(12)
    expect(new Set(logs().map(r => r.requestId)).size).toBe(2)
  })
  it('covers navigation, preload cache hits, errors, gzip, streamed and empty responses', async () => {
    await (await fetch(base + '/api/rooms/a/notebook/link-targets')).text()
    await (await fetch(base + '/api/compendium-browse/spells/detail-batch')).text()
    await (await fetch(base + '/api/compendium/spells/private-index')).text()
    await (await fetch(base + '/api/compendium-browse/spells/local-index')).text()
    expect(await (await fetch(base + '/api/compendium-browse/spells/stream')).text()).toBe('firstsecond')
    await (await fetch(base + '/api/compendium-browse/spells/empty')).text()
    expect(logs()).toHaveLength(6)
    expect(logs()[0]).toMatchObject({endpoint: 'notebook.navigation', dbNavigationMs: 4})
    expect(logs()[1]).toMatchObject({endpoint: 'compendium.preload', cache: 'hit', entriesRead: 1, role: null})
    expect(logs()[2]).toMatchObject({cache: 'miss', status: 404})
    expect(logs()[3]).toMatchObject({compressed: true, responseBytes: gzipSync('synthetic data').length})
    expect(logs()[4].responseBytes).toBe(11)
    expect(logs()[5].responseBytes).toBe(0)
    expect(output.join('')).not.toContain('private-index')
  })
  it('can be disabled and samples exactly one in five eligible requests', async () => {
    process.env.REQUEST_TIMING = 'off'
    expect(await (await fetch(base + '/api/rooms/a/notebook')).json()).toEqual(body)
    expect(logs()).toHaveLength(0)
    process.env.REQUEST_TIMING = 'on'
    process.env.REQUEST_TIMING_SAMPLE_EVERY = '5'
    for (let n = 0; n < 10; n++) await (await fetch(base + '/api/rooms/a/notebook')).text()
    expect(logs()).toHaveLength(2)
    await (await fetch(base + '/unrelated')).text()
    expect(logs()).toHaveLength(2)
  })
})
