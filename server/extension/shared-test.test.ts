import { it, expect } from 'vitest'
import express from 'express'
import { createSharedTestApp } from './shared-test-app'
import { readSharedTestConfig, LIVE_PROJECT_ID } from './shared-test-config'

const input = () => ({ VERCEL: '1', OWLBEAR_SHARED_TEST: '1', VERCEL_PROJECT_ID: 'prj_test', OWLBEAR_SHARED_PROJECT_ID: 'prj_test', MONGO_HOST: 'test.example.mongodb.net', MONGO_DATABASE: 'owlbear_shared_test', MONGO_USER: 'owlbear_shared_test', MONGO_PASSWORD: 'fixture-not-a-credential', JWT_SECRET: 'fixture-signing-secret-not-a-credential', OWLBEAR_SHARED_WEBSITE_ORIGIN: 'https://website.example.test', OWLBEAR_SHARED_EXTENSION_ORIGIN: 'https://sheet.example.test', OWLBEAR_SHARED_ENVIRONMENT_ID: 'fixture-environment-20261024' })

it('keeps renewal off unless explicitly enabled for the exact isolated project and hosts', () => {
  expect(readSharedTestConfig(input()).rememberedConnections).toBe(false)
  expect(readSharedTestConfig({ ...input(), OWLBEAR_SHARED_REMEMBERED: '0' }).rememberedConnections).toBe(false)
  const enabled = { ...input(), OWLBEAR_SHARED_REMEMBERED: '1', VERCEL_PROJECT_ID: 'prj_18GWqWwAU92VJ5hTDXtmjxpxFSLR', OWLBEAR_SHARED_PROJECT_ID: 'prj_18GWqWwAU92VJ5hTDXtmjxpxFSLR', OWLBEAR_SHARED_WEBSITE_ORIGIN: 'https://dndoldal-owlbear-test.vercel.app', OWLBEAR_SHARED_EXTENSION_ORIGIN: 'https://owlbear-character-sheet-test.vercel.app' }
  expect(readSharedTestConfig(enabled).rememberedConnections).toBe(true)
  for (const patch of [
    { OWLBEAR_SHARED_REMEMBERED: 'true' }, { OWLBEAR_SHARED_REMEMBERED: '' },
    { VERCEL_PROJECT_ID: 'prj_other', OWLBEAR_SHARED_PROJECT_ID: 'prj_other' },
    { OWLBEAR_SHARED_WEBSITE_ORIGIN: 'https://other.example.test' },
    { OWLBEAR_SHARED_EXTENSION_ORIGIN: 'https://other.example.test' },
    { VERCEL_PROJECT_ID: LIVE_PROJECT_ID, OWLBEAR_SHARED_PROJECT_ID: LIVE_PROJECT_ID },
  ]) expect(() => readSharedTestConfig({ ...enabled, ...patch })).toThrow()
})

it('refuses live project, inherited DB URIs, ordinary database/user and missing test activation', () => {
  expect(readSharedTestConfig(input()).database).toBe('owlbear_shared_test')
  for (const patch of [
    { VERCEL_PROJECT_ID: LIVE_PROJECT_ID, OWLBEAR_SHARED_PROJECT_ID: LIVE_PROJECT_ID },
    { VERCEL_PROJECT_ID: 'prj_other' }, { OWLBEAR_SHARED_TEST: undefined }, { VERCEL: undefined },
    { MONGO_URI: 'mongodb://localhost/dnd_site' }, { MONGODB_URI: 'mongodb://localhost/dnd_site' },
    { MONGO_DATABASE: 'dnd_site' }, { MONGO_USER: 'codex_app' }, { MONGO_PASSWORD: '' }, { JWT_SECRET: 'short' },
    { MONGO_HOST: 'test.example.mongodb.net/path' }, { OWLBEAR_SHARED_ENVIRONMENT_ID: '' },
  ]) expect(() => readSharedTestConfig({ ...input(), ...patch })).toThrow()
})

it('requires separate canonical HTTPS test origins', () => {
  for (const origin of ['https://dndoldal.vercel.app', 'https://localhost', 'http://website.example.test', 'https://website.example.test/', 'https://user:pass@website.example.test', 'https://website.example.test?x=1']) {
    expect(() => readSharedTestConfig({ ...input(), OWLBEAR_SHARED_WEBSITE_ORIGIN: origin })).toThrow()
    expect(() => readSharedTestConfig({ ...input(), OWLBEAR_SHARED_EXTENSION_ORIGIN: origin })).toThrow()
  }
  expect(() => readSharedTestConfig({ ...input(), OWLBEAR_SHARED_EXTENSION_ORIGIN: input().OWLBEAR_SHARED_WEBSITE_ORIGIN })).toThrow()
})

it('dispatches only exact extension paths ahead of ordinary website policy and retains website framing protection', async () => {
  const ordinary = express()
  ordinary.use((_req, res) => { res.status(403).json({ ordinaryPolicy: true }) })
  const boundary = express()
  boundary.use((req, res) => { res.json({ boundary: req.path, ip: req.ip }) })
  let loads = 0
  const app = createSharedTestApp(readSharedTestConfig(input()), ordinary, async () => { loads++; return boundary })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    for (const path of ['/api/characters', '/api/extension/v10/session', '/owlbear/connect-extra']) {
      const response = await fetch(base + path)
      expect(response.status).toBe(403); expect(await response.json()).toEqual({ ordinaryPolicy: true })
    }
    expect(loads).toBe(0)
    for (const path of ['/owlbear/connect?request=fixture', '/api/extension/v1/session']) {
      const response = await fetch(base + path, { headers: { 'X-Forwarded-For': '203.0.113.7' } })
      expect(response.status).toBe(200); expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(await response.json()).toEqual({ boundary: path.split('?')[0], ip: '203.0.113.7' })
    }
    const ready = await fetch(base + '/__owlbear_shared_test')
    expect(await ready.json()).toMatchObject({ application: 'owlbear-shared-test', database: 'owlbear_shared_test', rememberedConnections: false })
    expect(loads).toBe(1)
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})

it('retries a failed boundary initialisation and returns no internal error details', async () => {
  let loads = 0
  const boundary = express(); boundary.get('/api/extension/v1/session', (_req, res) => { res.json({ ok: true }) })
  const app = createSharedTestApp(readSharedTestConfig(input()), express(), async () => {
    if (++loads === 1) throw new Error('private-database-error')
    return boundary
  })
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    const first = await fetch(base + '/api/extension/v1/session')
    expect(first.status).toBe(503); expect(await first.text()).not.toContain('private-database-error')
    const next = await fetch(base + '/api/extension/v1/session')
    expect(next.status).toBe(200); expect(await next.json()).toEqual({ ok: true })
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})
