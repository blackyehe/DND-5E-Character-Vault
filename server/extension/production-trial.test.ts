import { expect, it } from 'vitest'
import express from 'express'
import { readProductionTrialConfig, productionBoundaryOptions, TRIAL_PROJECT_ID, TRIAL_WEBSITE_ORIGIN, TRIAL_EXTENSION_ORIGIN, TRIAL_ROOM_ID } from './production-trial-config'
import { createProductionTrialApp } from './production-trial-app'

const input = () => ({ VERCEL: '1', VERCEL_PROJECT_ID: TRIAL_PROJECT_ID, OWLBEAR_PRODUCTION_TRIAL: 'read-only', OWLBEAR_TRIAL_WEBSITE_ORIGIN: TRIAL_WEBSITE_ORIGIN, OWLBEAR_TRIAL_EXTENSION_ORIGIN: TRIAL_EXTENSION_ORIGIN, OWLBEAR_TRIAL_ROOM_ID: TRIAL_ROOM_ID, OWLBEAR_TRIAL_EPOCH: 'trial-fixture-20261024' })
it('defaults off and accepts only explicit production identity, origin, room and grant epoch', () => {
  expect(readProductionTrialConfig({})).toBeUndefined()
  expect(readProductionTrialConfig({ ...input(), OWLBEAR_PRODUCTION_TRIAL: 'write' })).toBeUndefined()
  expect(readProductionTrialConfig(input())?.roomId).toBe(TRIAL_ROOM_ID)
  expect(readProductionTrialConfig(input())?.mode).toBe('read-only')
  expect(readProductionTrialConfig({ ...input(), OWLBEAR_PRODUCTION_TRIAL: 'play-controls' })?.mode).toBe('play-controls')
  for (const patch of [{ VERCEL: undefined }, { VERCEL_PROJECT_ID: 'prj_test' }, { OWLBEAR_SHARED_TEST: '1' }, { OWLBEAR_TRIAL_WEBSITE_ORIGIN: TRIAL_WEBSITE_ORIGIN + '/' }, { OWLBEAR_TRIAL_EXTENSION_ORIGIN: 'https://other.example.test' }, { OWLBEAR_TRIAL_ROOM_ID: 'a'.repeat(24) }, { OWLBEAR_TRIAL_EPOCH: '' }]) expect(() => readProductionTrialConfig({ ...input(), ...patch })).toThrow()
})

it('keeps renewal default-off and binds explicit activation to the existing production play scope', () => {
  const play = { ...input(), OWLBEAR_PRODUCTION_TRIAL: 'play-controls' }
  expect(productionBoundaryOptions(readProductionTrialConfig(play)!)).toEqual({ websiteOrigin: TRIAL_WEBSITE_ORIGIN, extensionOrigins: [TRIAL_EXTENSION_ORIGIN], rememberedConnections: false, playTrial: { roomId: TRIAL_ROOM_ID, epoch: play.OWLBEAR_TRIAL_EPOCH } })
  const enabled = { ...play, OWLBEAR_PRODUCTION_REMEMBERED: '1' }
  expect(productionBoundaryOptions(readProductionTrialConfig(enabled)!)).toEqual({ websiteOrigin: TRIAL_WEBSITE_ORIGIN, extensionOrigins: [TRIAL_EXTENSION_ORIGIN], rememberedConnections: true, playTrial: { roomId: TRIAL_ROOM_ID, epoch: play.OWLBEAR_TRIAL_EPOCH } })
  for (const activation of ['', '0', 'true', 'yes', ' 1']) expect(() => readProductionTrialConfig({ ...play, OWLBEAR_PRODUCTION_REMEMBERED: activation })).toThrow()
  for (const mode of [undefined, 'read-only', 'unknown']) expect(() => readProductionTrialConfig({ ...enabled, OWLBEAR_PRODUCTION_TRIAL: mode })).toThrow()
  for (const patch of [{ VERCEL_PROJECT_ID: 'prj_test' }, { OWLBEAR_SHARED_TEST: '1' }, { OWLBEAR_TRIAL_WEBSITE_ORIGIN: TRIAL_WEBSITE_ORIGIN + '/' }, { OWLBEAR_TRIAL_EXTENSION_ORIGIN: 'https://owlbear-character-sheet-test.vercel.app' }, { OWLBEAR_TRIAL_ROOM_ID: 'a'.repeat(24) }, { OWLBEAR_TRIAL_EPOCH: '' }]) expect(() => readProductionTrialConfig({ ...enabled, ...patch })).toThrow()
  expect(productionBoundaryOptions(readProductionTrialConfig(input())!)).toHaveProperty('readOnlyTrial')
})

it('preserves ordinary routes, denies existing grants when disabled and reloads on epoch rotation', async () => {
  let current = readProductionTrialConfig(input()), loads = 0, fail = false
  const ordinary = express(); ordinary.use((_req, res) => { res.status(403).json({ ordinaryPolicy: true }) })
  const app = createProductionTrialApp(ordinary, () => current, async config => {
    loads++
    if (fail) throw new Error('private-internal-detail')
    const boundary = express(); boundary.use((req, res) => { res.json({ epoch: config.epoch, ip: req.ip }) }); return boundary
  })
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    for (const path of ['/api/characters', '/api/extension/v10/session', '/owlbear/connect-extra', '/__owlbear_shared_test']) {
      const res = await fetch(base + path); expect(res.status).toBe(403); expect(await res.json()).toEqual({ ordinaryPolicy: true })
    }
    expect(loads).toBe(0)
    const first = await fetch(base + '/api/extension/v1/session', { headers: { Authorization: 'Bearer fixture', 'X-Forwarded-For': '203.0.113.7' } })
    expect(first.headers.get('x-frame-options')).toBe('DENY'); expect(await first.json()).toMatchObject({ epoch: current!.epoch, ip: '203.0.113.7' })
    current = undefined
    for (const path of ['/api/extension/v1/session', '/api/extension/v1/pairings', '/owlbear/connect']) expect((await fetch(base + path)).status).toBe(503)
    expect(loads).toBe(1)
    current = { ...readProductionTrialConfig(input())!, epoch: 'rotated-trial-fixture' }
    expect(await (await fetch(base + '/api/extension/v1/session')).json()).toMatchObject({ epoch: current.epoch }); expect(loads).toBe(2)
    current = { ...current, mode: 'play-controls' }
    expect((await fetch(base + '/api/extension/v1/session')).status).toBe(200); expect(loads).toBe(3)
    current = { ...current, rememberedConnections: true }
    expect((await fetch(base + '/api/extension/v1/session')).status).toBe(200); expect(loads).toBe(4)
    current = { ...current, rememberedConnections: false }
    expect((await fetch(base + '/api/extension/v1/session')).status).toBe(200); expect(loads).toBe(5)
    fail = true; current = { ...current, epoch: 'failed-trial-fixture' }
    const failed = await fetch(base + '/api/extension/v1/session'); expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('private-internal-detail')
    fail = false; expect((await fetch(base + '/api/extension/v1/session')).status).toBe(200)
  } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
})
