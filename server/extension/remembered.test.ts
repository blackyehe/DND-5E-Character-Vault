import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import type { Server } from 'node:http'
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { env } from '../env'
import { User } from '../models/User'
import { Room } from '../models/Room'
import { Character } from '../models/Character'
import { emptyCharacter } from '../../shared/character'
import { ExtensionFamily, ExtensionPairing, ExtensionRenewal, ExtensionSession } from './models'
import { createExtensionApp, proofHash } from './api'
import { renewalTranscript } from './remembered'

vi.mock('../middleware/request-limit', () => ({ requestLimit: () => (_req: unknown, _res: unknown, next: () => void) => next() }))
const origin = 'http://localhost:5174', websiteOrigin = 'http://127.0.0.1:5184'
const random = () => randomBytes(32).toString('base64url')
const key = () => generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const jwk = (keys: ReturnType<typeof key>) => { const { kty, crv, x, y } = keys.publicKey.export({ format: 'jwk' }); return { kty, crv, x, y } }
const servers: Server[] = [], pairings: string[] = [], families: string[] = [], tokens: string[] = []
let owner: mongoose.Types.ObjectId, player: mongoose.Types.ObjectId, room: mongoose.Types.ObjectId, hero: mongoose.Types.ObjectId
let base = '', cookie = '', csrf = '', time = Date.now()
type Options = { body?: unknown; token?: string; website?: boolean; from?: string; target?: string }
async function request(path: string, options: Options = {}) {
  const response = await fetch((options.target ?? base) + path, { method: options.body ? 'POST' : 'GET', headers: { Origin: options.from ?? (options.website ? websiteOrigin : origin), ...(options.website ? { Cookie: cookie, 'X-Extension-CSRF': csrf } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) })
  return { status: response.status, data: await response.json() as Record<string, any> }
}
async function start(options: Parameters<typeof createExtensionApp>[0]) {
  const app = await createExtensionApp(options)
  const server = await new Promise<Server>(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) }); servers.push(server)
  return `http://127.0.0.1:${(server.address() as { port: number }).port}/api/extension/v1`
}
async function grant(kind: 'remembered' | 'session' | 'long-session' | null = 'remembered', writes = false) {
  const keys = key(), proof = random()
  const paired = await request('/pairings', { body: { challenge: proofHash(proof), details: true, hpWrite: writes, ...(kind ? { connectionKind: kind, ...(kind === 'long-session' ? {} : { publicKey: jwk(keys) }) } : {}) } })
  expect(paired.status).toBe(201); pairings.push(paired.data.id)
  const context = await request('/approval/context?request=' + paired.data.id, { website: true })
  expect(context.data.pairing.connectionKind).toBe(kind ?? undefined)
  expect((await request('/approval/pairings/' + paired.data.id + '/approve', { website: true, body: { roomId: String(room) } })).status).toBe(200)
  const result = await request('/pairings/' + paired.data.id + '/redeem', { body: { proof } })
  expect(result.status).toBe(201); tokens.push(proofHash(result.data.token))
  if (result.data.connection) families.push(result.data.connection.id)
  return { keys, ...result.data } as { keys: ReturnType<typeof key>; token: string; expiresAt: string; connection?: { id: string; kind: string; expiresAt: string } }
}
async function signed(value: Awaited<ReturnType<typeof grant>>, action: 'renew' | 'disconnect' = 'renew', override: { audience?: string; signingKey?: ReturnType<typeof key>; signedAction?: 'renew' | 'disconnect' } = {}) {
  const c = await request('/connections/challenge', { body: { familyId: value.connection!.id, action } }); expect(c.status).toBe(200)
  const transcript = renewalTranscript(override.audience ?? websiteOrigin, origin, value.connection!.id, c.data.id, c.data.nonce, override.signedAction ?? action)
  const signature = sign('sha256', Buffer.from(transcript), { key: (override.signingKey ?? value.keys).privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')
  return { familyId: value.connection!.id, challengeId: c.data.id, nonce: c.data.nonce, signature }
}
describe.skipIf(process.env.OWLBEAR_EXTENSION_TESTS !== '1')('isolated browser-bound remembered connections', () => {
  beforeAll(async () => {
    expect(env.MONGO_URI).toBe('mongodb://127.0.0.1:27038/owlbear_extension_test'); expect(process.env.VERCEL).toBeUndefined()
    expect(await fetch('http://127.0.0.1:4008/__owlbear_test').then(r => r.json())).toMatchObject({ database: 'owlbear_extension_test', isolated: true })
    await mongoose.connect(env.MONGO_URI)
    expect([mongoose.connection.host, mongoose.connection.port, mongoose.connection.name]).toEqual(['127.0.0.1', 27038, 'owlbear_extension_test'])
    const suffix = random()
    owner = (await User.create({ email: `remember-dm-${suffix}@owlbear.test`, displayName: 'Remembered fixture DM', passwordHash: 'no-login' }))._id
    player = (await User.create({ email: `remember-player-${suffix}@owlbear.test`, displayName: 'Remembered fixture player', passwordHash: 'no-login' }))._id
    const character = emptyCharacter(); character.meta.name = 'Remembered fixture'; character.combat.hpCurrent = 15; character.combat.hpMax = 20
    hero = (await Character.create({ ...character, userId: owner }))._id
    room = (await Room.create({ name: 'Remembered fixture party', ownerId: owner, members: [player], assignments: [{ userId: player, characterId: hero }], joinToken: random() }))._id
    cookie = `token=${jwt.sign({ userId: String(player) }, env.JWT_SECRET, { expiresIn: '10m' })}`
    base = await start({ websiteOrigin, extensionOrigins: [origin], rememberedConnections: true, clock: () => time })
    csrf = (await request('/approval/context', { website: true })).data.csrf
  })
  afterAll(async () => {
    for (const server of servers) await new Promise<void>(resolve => server.close(() => resolve()))
    if (mongoose.connection.name === 'owlbear_extension_test') {
      await ExtensionSession.deleteMany({ $or: [{ familyId: { $in: families } }, { tokenHash: { $in: tokens } }] })
      await ExtensionRenewal.deleteMany({ familyId: { $in: families } }); await ExtensionFamily.deleteMany({ _id: { $in: families } }); await ExtensionPairing.deleteMany({ _id: { $in: pairings } })
      if (hero) await Character.deleteOne({ _id: hero, userId: owner }); if (room) await Room.deleteOne({ _id: room }); await User.deleteMany({ _id: { $in: [owner, player].filter(Boolean) } }); await mongoose.disconnect()
    }
  })
  it('survives five simulated hours with one approval, one-hour child tokens and unchanged character data', async () => {
    for (const kind of ['session', 'remembered'] as const) {
      const before = await Character.findById(hero).lean(), value = await grant(kind, true)
      let token = value.token
      for (let hour = 0; hour < 6; hour++) {
        time += 55 * 60000
        const result = await request('/connections/renew', { body: await signed(value) })
        expect(result.status).toBe(201); expect(Date.parse(result.data.expiresAt) - time).toBe(3600000)
        token = result.data.token
        const session = await request('/session', { token }); expect(session.status).toBe(200); expect(session.data.capabilities.hpWrite).toBe(true); expect(session.data.characters.map((c: { id: string }) => c.id)).toEqual([String(hero)])
      }
      expect((await request('/session', { token: value.token })).status).toBe(401)
      expect(await Character.findById(hero).lean()).toEqual(before)
      expect(await ExtensionFamily.countDocuments({ _id: value.connection!.id })).toBe(1)
      expect((await request('/connections/disconnect', { body: await signed(value, 'disconnect') })).status).toBe(200)
      expect((await request('/session', { token })).status).toBe(401)
    }
  })
  it('requires a valid key, exact audience/action and a fresh single-use challenge; rejects replays and racing claims', async () => {
    const value = await grant()
    for (const override of [{ signingKey: key() }, { audience: 'https://wrong.example' }, { signedAction: 'disconnect' as const }]) expect((await request('/connections/renew', { body: await signed(value, 'renew', override) })).status).toBe(401)
    const expired = await signed(value); await ExtensionRenewal.updateOne({ _id: expired.challengeId }, { $set: { expiresAt: new Date(time - 1) } })
    expect((await request('/connections/renew', { body: expired })).status).toBe(401)
    const proof = await signed(value)
    const results = await Promise.all([request('/connections/renew', { body: proof }), request('/connections/renew', { body: proof })]); expect(results.map(r => r.status).sort()).toEqual([201, 401])
    expect((await request('/connections/renew', { body: proof })).status).toBe(401)
    expect((await request('/connections/renew', { body: { ...await signed(value), hpWrite: true } })).status).toBe(400)
    expect((await request('/connections/renew', { token: value.token, body: { familyId: value.connection!.id } })).status).toBe(400)
    expect((await request('/connections/challenge', { from: 'https://wrong.example', body: { familyId: value.connection!.id, action: 'renew' } })).status).toBe(403)
    const other = await grant()
    expect((await request('/connections/renew', { body: { ...await signed(value), familyId: other.connection!.id } })).status).toBe(401)
  })
  it('permits one approved HP save after renewal while rejecting the expired child and stale revision', async () => {
    const before = (await Character.findById(hero).lean())!, value = await grant('session', true)
    time += 61 * 60000
    const body = { expectedUpdatedAt: new Date(before.updatedAt).toISOString(), hpCurrent: 10 }
    expect((await request(`/characters/${hero}/hp`, { token: value.token, body })).status).toBe(401)
    expect(await Character.findById(hero).lean()).toEqual(before)
    const renewed = await request('/connections/renew', { body: await signed(value) }); expect(renewed.status).toBe(201)
    expect((await request(`/characters/${hero}/hp`, { token: renewed.data.token, body })).status).toBe(200)
    const after = (await Character.findById(hero).lean())!
    expect(after.combat.hpCurrent).toBe(10)
    expect({ ...after, combat: { ...after.combat, hpCurrent: before.combat.hpCurrent }, updatedAt: before.updatedAt }).toEqual(before)
    expect((await request(`/characters/${hero}/hp`, { token: renewed.data.token, body })).status).toBe(409)
    expect(await Character.findById(hero).lean()).toEqual(after)
    expect((await request('/connections/disconnect', { body: await signed(value, 'disconnect') })).status).toBe(200)
    expect((await request(`/characters/${hero}/hp`, { token: renewed.data.token, body: { ...body, expectedUpdatedAt: new Date(after.updatedAt).toISOString() } })).status).toBe(401)
    expect(await Character.findById(hero).lean()).toEqual(after)
  })
  it('never broadens read-only approval and checks assignments, membership, owner and user on current access/renewal', async () => {
    const value = await grant()
    expect((await request('/session', { token: value.token })).data.capabilities.hpWrite).toBe(false)
    const result = await request('/connections/renew', { body: await signed(value) }); expect(result.status).toBe(201)
    expect((await request(`/characters/${hero}/hp`, { token: result.data.token, body: { expectedUpdatedAt: new Date().toISOString(), hpCurrent: 2 } })).status).toBe(403)
    await Room.updateOne({ _id: room }, { $set: { assignments: [] } })
    expect((await request(`/characters/${hero}`, { token: result.data.token })).status).toBe(404)
    expect((await request('/session', { token: result.data.token })).data.characters).toEqual([])
    expect((await request('/connections/renew', { body: await signed(value) })).status).toBe(201)
    await Room.updateOne({ _id: room }, { $set: { assignments: [{ userId: player, characterId: hero }] } })
    for (const change of [{ members: [] }, { ownerId: player }]) {
      await Room.updateOne({ _id: room }, { $set: change })
      expect((await request('/session', { token: result.data.token })).status).toBe(403)
      expect((await request('/connections/renew', { body: await signed(value) })).status).toBe(403)
      await Room.updateOne({ _id: room }, { $set: { members: [player], ownerId: owner } })
    }
    const saved = await User.findById(player).lean(); await User.deleteOne({ _id: player })
    expect((await request('/connections/renew', { body: await signed(value) })).status).toBe(403)
    await User.collection.insertOne(saved!)
  })
  it('caps access at fixed family expiry, checks expiry before TTL deletion and revokes all children from management', async () => {
    const value = await grant(); const end = time + 90000
    await ExtensionFamily.updateOne({ _id: value.connection!.id }, { $set: { expiresAt: new Date(end) } })
    const renewed = await request('/connections/renew', { body: await signed(value) }); expect(Date.parse(renewed.data.expiresAt)).toBe(end)
    const list = await request('/approval/connections', { website: true }); expect(list.data.connections.filter((c: { id: string }) => c.id === value.connection!.id)).toHaveLength(1)
    expect((await request('/approval/connections/' + value.connection!.id + '/revoke', { website: true, body: {} })).status).toBe(200)
    expect((await request('/session', { token: value.token })).status).toBe(401); expect((await request('/session', { token: renewed.data.token })).status).toBe(401)
    expect((await request('/connections/challenge', { body: { familyId: value.connection!.id, action: 'renew' } })).status).toBe(401)
    const expired = await grant(); await ExtensionFamily.updateOne({ _id: expired.connection!.id }, { $set: { expiresAt: new Date(time - 1) } })
    expect((await request('/session', { token: expired.token })).status).toBe(401)
    expect((await request('/connections/challenge', { body: { familyId: expired.connection!.id, action: 'renew' } })).status).toBe(401)
  })
  it('leaves old one-hour grants unchanged and offers an explicit twelve-hour nonrenewable fallback', async () => {
    const legacy = await grant(null), fallback = await grant('long-session')
    expect(legacy.connection).toBeUndefined(); expect(fallback.connection).toBeUndefined()
    expect(Date.parse(legacy.expiresAt) - time).toBe(3600000); expect(Date.parse(fallback.expiresAt) - time).toBe(12 * 3600000)
  })
  it('is default-off and mode/epoch isolated even when the client retains a valid family and access token', async () => {
    const value = await grant()
    const disabled = await start({ websiteOrigin, extensionOrigins: [origin], clock: () => time })
    expect((await request('/connections/challenge', { target: disabled, body: { familyId: value.connection!.id, action: 'renew' } })).status).toBe(404)
    expect((await request('/session', { target: disabled, token: value.token })).status).toBe(401)
    expect((await request('/pairings', { target: disabled, body: { challenge: random(), connectionKind: 'remembered', publicKey: jwk(value.keys) } })).status).toBe(403)
    for (const boundary of [{ playTrial: { roomId: String(room), epoch: 'remembered-scope-test1' } }, { readOnlyTrial: { roomId: String(room), epoch: 'remembered-scope-test1' } }]) {
      const scoped = await start({ websiteOrigin, extensionOrigins: [origin], rememberedConnections: true, clock: () => time, ...boundary })
      expect((await request('/session', { target: scoped, token: value.token })).status).toBe(401)
      expect((await request('/connections/challenge', { target: scoped, body: { familyId: value.connection!.id, action: 'renew' } })).status).toBe(401)
    }
  })
})
