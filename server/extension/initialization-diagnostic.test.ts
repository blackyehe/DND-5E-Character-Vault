import { expect, it } from 'vitest'
import express from 'express'
import { mongo } from 'mongoose'
import { duringInitialization, initializationDiagnostic, type InitializationDiagnostic } from './initialization-diagnostic'
import { createProductionTrialApp } from './production-trial-app'
import type { ProductionTrialConfig } from './production-trial-config'

const privateValue = 'mongodb+srv://user:private-password@example.invalid/private-db?token=private-token'
const config: ProductionTrialConfig = { websiteOrigin: 'https://website.test', extensionOrigin: 'https://extension.test', roomId: 'a'.repeat(24), epoch: 'diagnostic-test-epoch', mode: 'play-controls', rememberedConnections: true }

it('reports only fixed stage, error kind and allowlisted numeric code', async () => {
  const error = Object.assign(new Error(privateValue), { name: 'MongoServerError', code: 13, stack: privateValue, reason: { password: privateValue } })
  let tagged: unknown
  try { await duringInitialization('family-indexes', async () => { throw error }) } catch (e) { tagged = e }
  expect(initializationDiagnostic(tagged, 'boundary')).toEqual({ event: 'owlbear-initialization-failed', stage: 'family-indexes', kind: 'MongoServerError', code: 13 })
  expect(JSON.stringify(initializationDiagnostic(tagged, 'boundary'))).not.toContain(privateValue)
  expect(initializationDiagnostic({ name: privateValue, code: privateValue }, 'database')).toEqual({ event: 'owlbear-initialization-failed', stage: 'database', kind: 'unclassified' })
  expect(initializationDiagnostic(Object.assign(new Error(privateValue), { code: 987654 }), 'boundary')).not.toHaveProperty('code')
})

it('does not invoke error property getters or disclose nested driver messages', () => {
  const error = new Error(privateValue)
  Object.defineProperties(error, { name: { get() { throw new Error(privateValue) } }, code: { get() { throw new Error(privateValue) } } })
  expect(initializationDiagnostic(error, 'database')).toEqual({ event: 'owlbear-initialization-failed', stage: 'database', kind: 'unclassified' })
})

it('identifies real driver error classes without invoking their name getters', () => {
  const server = new mongo.MongoServerError({ message: privateValue, code: 13 })
  const network = new mongo.MongoNetworkError(privateValue)
  Object.defineProperty(server, 'name', { get() { throw new Error(privateValue) } })
  expect(initializationDiagnostic(server, 'boundary')).toEqual({ event: 'owlbear-initialization-failed', stage: 'boundary', kind: 'MongoServerError', code: 13 })
  expect(initializationDiagnostic(network, 'database')).toEqual({ event: 'owlbear-initialization-failed', stage: 'database', kind: 'MongoNetworkError' })
})

it('preserves the deepest initialization stage and successful return value', async () => {
  expect(await duringInitialization('database', async () => 'connected')).toBe('connected')
  try {
    await duringInitialization('boundary', () => duringInitialization('renewal-indexes', async () => { throw new Error(privateValue) }))
    throw new Error('Expected initialization failure')
  } catch (e) { expect(initializationDiagnostic(e, 'boundary').stage).toBe('renewal-indexes') }
})

it('logs failed stages once, preserves generic denial and never handles ordinary routes', async () => {
  const records: InitializationDiagnostic[] = []
  let configFails = false, loadFails = true, loads = 0
  const ordinary = express(); ordinary.use((_req, res) => { res.status(204).end() })
  const app = createProductionTrialApp(ordinary, () => { if (configFails) throw new Error(privateValue); return config }, async () => {
    loads++
    if (loadFails) return duringInitialization('family-indexes', async () => { throw Object.assign(new Error(privateValue), { name: 'MongoServerError', code: 13 }) })
    const boundary = express(); boundary.use((_req, res) => res.status(401).end()); return boundary
  }, entry => records.push(entry))
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const get = (path: string) => fetch(base + path, { signal: AbortSignal.timeout(2000), headers: { Authorization: `Bearer ${privateValue}` } })
  try {
    expect((await get('/api/characters')).status).toBe(204); expect(loads).toBe(0); expect(records).toEqual([])
    for (let i = 0; i < 2; i++) {
      const response = await get('/api/extension/v1/session')
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'The website connection is temporarily unavailable. Try again shortly.' })
    }
    expect(records).toEqual([{ event: 'owlbear-initialization-failed', stage: 'family-indexes', kind: 'MongoServerError', code: 13 }])
    loadFails = false
    expect((await get('/api/extension/v1/session')).status).toBe(401)
    configFails = true
    expect((await get('/api/extension/v1/session')).status).toBe(503)
    expect(records[1]).toEqual({ event: 'owlbear-initialization-failed', stage: 'configuration', kind: 'unclassified' })
    expect((await get('/api/extension/v1/session')).status).toBe(503)
    expect(records).toHaveLength(2)
    expect(JSON.stringify(records)).not.toContain(privateValue)
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})

it('keeps initialization denied even when the diagnostic sink throws', async () => {
  const ordinary = express()
  const app = createProductionTrialApp(ordinary, () => { throw new Error(privateValue) }, async () => ordinary, () => { throw new Error(privateValue) })
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/extension/v1/session`, { signal: AbortSignal.timeout(2000) })
    expect(response.status).toBe(503); expect(await response.text()).not.toContain(privateValue)
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})

it('records downstream request failures without disclosing private details or mislabelling initialization', async () => {
  const records: InitializationDiagnostic[] = []
  const ordinary = express(); ordinary.use((_req, res) => { res.status(204).end() })
  const boundary = express()
  boundary.use((_req, _res, next) => next(Object.assign(new Error(privateValue), { name: 'MongoServerError', code: 13 })))
  const app = createProductionTrialApp(ordinary, () => config, async () => boundary, entry => records.push(entry))
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    expect((await fetch(base + '/api/characters', { signal: AbortSignal.timeout(2000) })).status).toBe(204)
    expect(records).toEqual([])
    for (let i = 0; i < 2; i++) {
      const response = await fetch(base + '/api/extension/v1/session', { signal: AbortSignal.timeout(2000) })
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ error: 'The website connection is temporarily unavailable. Try again shortly.' })
    }
    expect(records).toEqual([{ event: 'owlbear-initialization-failed', stage: 'request-dispatch', kind: 'MongoServerError', code: 13 }])
    expect(JSON.stringify(records)).not.toContain(privateValue)
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})
