import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import type { Server } from 'node:http'
import { randomBytes } from 'node:crypto'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import { env } from '../env'
import { User } from '../models/User'
import { Room } from '../models/Room'
import { Character } from '../models/Character'
import { emptyCharacter } from '../../shared/character'
import { innateRaceSpells } from '../../shared/workshop-race'
import { characterOutput } from '../lib/character-output'
import { ExtensionPairing, ExtensionSession } from './models'
import { createExtensionApp, proofHash } from './api'

// Run only through the explicit local test command. Never use an inherited URI.
vi.mock('../middleware/request-limit', () => ({ requestLimit: () => (_req: unknown, _res: unknown, next: () => void) => next() }))
const uri = 'mongodb://127.0.0.1:27038/owlbear_extension_test'
const origin = 'http://localhost:5174', websiteOrigin = 'http://127.0.0.1:5184'
let server: Server | undefined, base = '', csrf = '', cookie = '', ownerCookie = '', ownerCsrf = ''
let characterId: mongoose.Types.ObjectId, unassignedId: mongoose.Types.ObjectId
let ownerId: mongoose.Types.ObjectId, playerId: mongoose.Types.ObjectId, roomId: mongoose.Types.ObjectId
const pairings: string[] = [], sessions: mongoose.Types.ObjectId[] = []
const random = () => randomBytes(32).toString('base64url')

describe.skipIf(process.env.OWLBEAR_EXTENSION_TESTS !== '1')('isolated database extension lifecycle', () => {
  beforeAll(async () => {
    expect(env.MONGO_URI).toBe(uri)
    expect(process.env.VERCEL).toBeUndefined()
    const marker = await fetch('http://127.0.0.1:4008/__owlbear_test').then(response => response.json())
    expect(marker).toMatchObject({ database: 'owlbear_extension_test', isolated: true })
    await mongoose.connect(uri)
    expect(mongoose.connection.host).toBe('127.0.0.1')
    expect(mongoose.connection.port).toBe(27038)
    expect(mongoose.connection.name).toBe('owlbear_extension_test')
    const suffix = random()
    const owner = await User.create({ email: `expiry-owner-${suffix}@owlbear.test`, displayName: 'Lifecycle fixture DM', passwordHash: 'no-login-fixture' })
    ownerId = owner._id
    const player = await User.create({ email: `expiry-player-${suffix}@owlbear.test`, displayName: 'Lifecycle fixture player', passwordHash: 'no-login-fixture' })
    playerId = player._id
    const room = await Room.create({ name: 'Lifecycle fixture room', ownerId, members: [playerId], joinToken: random() })
    roomId = room._id
    const hero = emptyCharacter(); hero.meta.name = 'HP fixture'; hero.combat.hpMax = 30; hero.combat.hpCurrent = 20; hero.combat.hpTemp = 4
    hero.spellcasting.slots = { l1: { max: 2, used: 1 } }
    const character = await Character.create({ ...hero, userId: ownerId }); characterId = character._id
    unassignedId = (await Character.create({ ...hero, userId: ownerId }))._id
    await Room.updateOne({ _id: roomId }, { $set: { assignments: [{ characterId, userId: playerId }] } })
    ownerCookie = `token=${jwt.sign({ userId: String(ownerId) }, env.JWT_SECRET, { expiresIn: '5m' })}`
    cookie = `token=${jwt.sign({ userId: String(playerId) }, env.JWT_SECRET, { expiresIn: '5m' })}`
    const app = await createExtensionApp({ websiteOrigin, extensionOrigins: [origin], ...(process.env.OWLBEAR_EXTENSION_PLAY_TESTS === '1' ? { playTrial: { roomId: String(roomId), epoch: 'play-lifecycle-fixture' } } : {}) })
    server = await new Promise<Server>(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)) })
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/extension/v1`
    const context = await request('/approval/context', { website: true })
    csrf = context.data.csrf
    ownerCsrf = (await request('/approval/context', { website: true, owner: true })).data.csrf
  })
  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === 'owlbear_extension_test') {
      await ExtensionSession.deleteMany({ _id: { $in: sessions } })
      await ExtensionPairing.deleteMany({ _id: { $in: pairings } })
      if (ownerId) await Character.deleteMany({ _id: { $in: [characterId, unassignedId].filter(Boolean) }, userId: ownerId })
      if (roomId) await Room.deleteOne({ _id: roomId })
      if (ownerId) await User.deleteOne({ _id: ownerId })
      if (playerId) await User.deleteOne({ _id: playerId })
      await mongoose.disconnect()
    }
  })
  async function request(path: string, options: { website?: boolean; owner?: boolean; body?: unknown; token?: string; expected?: number } = {}) {
    const response = await fetch(base + path, { method: options.body ? 'POST' : 'GET', headers: { Origin: options.website ? websiteOrigin : origin, ...(options.website ? { Cookie: options.owner ? ownerCookie : cookie, 'X-Extension-CSRF': options.owner ? ownerCsrf : csrf } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) })
    const data = await response.json() as Record<string, any>
    expect(response.status, `${path}: ${data.error ?? ''}`).toBe(options.expected ?? 200)
    return { data, response }
  }
  async function pair(hpWrite = false, slotsWrite = false, tempHpWrite = false, resourcesWrite = false, combatWrite = false, equipmentWrite = false, preparationWrite = false, inventoryWrite = false, effectsWrite = false, featuresWrite = false) {
    const proof = random()
    const { data } = await request('/pairings', { body: { challenge: proofHash(proof), hpWrite, slotsWrite, tempHpWrite, resourcesWrite, combatWrite, equipmentWrite, preparationWrite, inventoryWrite, effectsWrite, featuresWrite }, expected: 201 })
    pairings.push(data.id)
    return { id: data.id as string, proof }
  }
  async function grant(hpWrite = false, owner = false, slotsWrite = false, tempHpWrite = false, resourcesWrite = false, combatWrite = false, equipmentWrite = false, preparationWrite = false, inventoryWrite = false, effectsWrite = false, featuresWrite = false) {
    const pending = await pair(hpWrite, slotsWrite, tempHpWrite, resourcesWrite, combatWrite, equipmentWrite, preparationWrite, inventoryWrite, effectsWrite, featuresWrite)
    await request(`/approval/pairings/${pending.id}/approve`, { website: true, owner, body: { roomId: String(roomId) } })
    const { data } = await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 201 })
    const session = await ExtensionSession.findOne({ tokenHash: proofHash(data.token) }).orFail()
    sessions.push(session._id)
    return { token: data.token as string, id: session._id }
  }
  it('rejects expired pending and approved pairings before asynchronous TTL deletion', async () => {
    for (const approved of [false, true]) {
      const pending = await pair()
      if (approved) await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(roomId) } })
      await ExtensionPairing.updateOne({ _id: pending.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
      await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 410 })
      await request(`/approval/context?request=${pending.id}`, { website: true, expected: 410 })
    }
  })
  it('rejects an expired session even while its database record remains', async () => {
    const grantData = await grant(true, false, true, true, true, true, true, true, true, true, true)
    await ExtensionSession.updateOne({ _id: grantData.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    await request('/session', { token: grantData.token, expected: 401 })
    await request(`/characters/${characterId}/hp`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), hpCurrent: 10 }, expected: 401 })
    await request(`/characters/${characterId}/slots`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), key: 'l1', action: 'spend' }, expected: 401 })
    await request(`/characters/${characterId}/temp-hp`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), hpTemp: 5 }, expected: 401 })
    await request(`/characters/${characterId}/resources`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'custom', action: 'spend' }, expected: 401 })
    await request(`/characters/${characterId}/combat`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), field: 'inspiration', value: true }, expected: 401 })
    await request(`/characters/${characterId}/equipment`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), field: 'equipped', value: true }, expected: 401 })
    await request(`/characters/${characterId}/preparation`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'magic-missile', prepared: true }, expected: 401 })
    await request(`/characters/${characterId}/inventory`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), action: 'remove' }, expected: 401 })
    await request(`/characters/${characterId}/effects`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'trial-effect', active: true }, expected: 401 })
    await request(`/characters/${characterId}/features`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), pinned: true }, expected: 401 })
  })
  it('checks current membership on every protected read', async () => {
    const grantData = await grant(true, false, true, true, true, true, true, true, true, true, true)
    await request('/session', { token: grantData.token })
    try {
      await Room.updateOne({ _id: roomId }, { $pull: { members: playerId } })
      await request('/session', { token: grantData.token, expected: 403 })
      await request(`/characters/${characterId}/hp`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), hpCurrent: 10 }, expected: 403 })
      await request(`/characters/${characterId}/slots`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), key: 'l1', action: 'spend' }, expected: 403 })
      await request(`/characters/${characterId}/temp-hp`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), hpTemp: 5 }, expected: 403 })
      await request(`/characters/${characterId}/resources`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'custom', action: 'spend' }, expected: 403 })
      await request(`/characters/${characterId}/combat`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), field: 'inspiration', value: true }, expected: 403 })
      await request(`/characters/${characterId}/equipment`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), field: 'equipped', value: true }, expected: 403 })
      await request(`/characters/${characterId}/preparation`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'magic-missile', prepared: true }, expected: 403 })
      await request(`/characters/${characterId}/inventory`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), action: 'remove' }, expected: 403 })
      await request(`/characters/${characterId}/effects`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'trial-effect', active: true }, expected: 403 })
      await request(`/characters/${characterId}/features`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), pinned: true }, expected: 403 })
    } finally { await Room.updateOne({ _id: roomId }, { $addToSet: { members: playerId } }) }
  })
  it('does not carry approval across a room ownership change', async () => {
    const grantData = await grant(true, false, true, true, true, true, true, true, true, true, true)
    try {
      await Room.updateOne({ _id: roomId }, { $set: { ownerId: playerId } })
      await request('/session', { token: grantData.token, expected: 403 })
      await request(`/characters/${characterId}/hp`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), hpCurrent: 10 }, expected: 403 })
      await request(`/characters/${characterId}/slots`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), key: 'l1', action: 'spend' }, expected: 403 })
      await request(`/characters/${characterId}/temp-hp`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), hpTemp: 5 }, expected: 403 })
      await request(`/characters/${characterId}/resources`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'custom', action: 'spend' }, expected: 403 })
      await request(`/characters/${characterId}/combat`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), field: 'inspiration', value: true }, expected: 403 })
      await request(`/characters/${characterId}/equipment`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), field: 'equipped', value: true }, expected: 403 })
      await request(`/characters/${characterId}/preparation`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'magic-missile', prepared: true }, expected: 403 })
      await request(`/characters/${characterId}/inventory`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), action: 'remove' }, expected: 403 })
      await request(`/characters/${characterId}/effects`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'trial-effect', active: true }, expected: 403 })
      await request(`/characters/${characterId}/features`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), pinned: true }, expected: 403 })
    } finally { await Room.updateOne({ _id: roomId }, { $set: { ownerId } }) }
  })
  const hpPath = () => `/characters/${characterId}/hp`
  const current = () => Character.findById(characterId).lean().orFail()
  it('preserves read-only grants and propagates explicit HP consent', async () => {
    const read = await grant()
    expect((await request('/session', { token: read.token })).data.capabilities.hpWrite).toBe(false)
    await request(hpPath(), { token: read.token, body: { expectedUpdatedAt: new Date((await current()).updatedAt).toISOString(), hpCurrent: 10 }, expected: 403 })
    const write = await grant(true)
    expect((await request('/session', { token: write.token })).data.capabilities.hpWrite).toBe(true)
  })
  it('saves assigned-player HP through existing website rules and returns it on the ordinary website read', async () => {
    const write = await grant(true), before = await current()
    const expectedUpdatedAt = new Date(before.updatedAt).toISOString()
    const saved = await request(hpPath(), { token: write.token, body: { expectedUpdatedAt, hpCurrent: 15 } })
    expect(saved.data.hp).toEqual({ current: 15, max: 30, temp: 4 })
    const after = await current()
    expect(after.combat.hpCurrent).toBe(15)
    expect(after.combat.hpTemp).toBe(before.combat.hpTemp)
    expect(after.spellcasting).toEqual(before.spellcasting)
    expect(after.meta).toEqual(before.meta)
    expect(after.personality).toEqual(before.personality)
    expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime())
    expect(saved.data).not.toHaveProperty('userId')
    const site = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${characterId}?view=quick`, { headers: { Cookie: cookie, Origin: websiteOrigin } })
    expect(site.status).toBe(200)
    expect((await site.json() as { character: { combat: { hpCurrent: number } } }).character.combat.hpCurrent).toBe(15)
    await request(hpPath(), { token: write.token, body: { expectedUpdatedAt, hpCurrent: 10 }, expected: 409 })
    expect((await current()).combat.hpCurrent).toBe(15)
  })
  it('rejects malformed or broader writes and current assignment/ownership loss', async () => {
    const write = await grant(true), before = await current()
    const expectedUpdatedAt = new Date(before.updatedAt).toISOString()
    for (const body of [{ expectedUpdatedAt, hpCurrent: -1 }, { expectedUpdatedAt, hpCurrent: 1.5 }, { expectedUpdatedAt, hpCurrent: 31 }, { expectedUpdatedAt, hpCurrent: '10' }, { expectedUpdatedAt, hpCurrent: 10, hpTemp: 99 }, { expectedUpdatedAt, hpCurrent: 10, slots: [] }, { hpCurrent: 10 }]) {
      await request(hpPath(), { token: write.token, body, expected: 400 })
    }
    await request(`/characters/${unassignedId}/hp`, { token: write.token, body: { expectedUpdatedAt, hpCurrent: 10 }, expected: 404 })
    try {
      await Room.updateOne({ _id: roomId }, { $set: { assignments: [] } })
      await request(hpPath(), { token: write.token, body: { expectedUpdatedAt, hpCurrent: 10 }, expected: 404 })
    } finally { await Room.updateOne({ _id: roomId }, { $set: { assignments: [{ characterId, userId: playerId }] } }) }
    try {
      await Character.updateOne({ _id: characterId }, { $set: { userId: playerId } })
      await request(hpPath(), { token: write.token, body: { expectedUpdatedAt, hpCurrent: 10 }, expected: 404 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { userId: ownerId } }) }
    expect((await current()).combat.hpCurrent).toBe(before.combat.hpCurrent)
    await request('/session/revoke', { token: write.token, body: {} })
    await request(hpPath(), { token: write.token, body: { expectedUpdatedAt, hpCurrent: 10 }, expected: 401 })
  })
  it('accepts exactly one racing save and allows a DM to save an unassigned character', async () => {
    const write = await grant(true), before = await current()
    const expectedUpdatedAt = new Date(before.updatedAt).toISOString()
    const responses = await Promise.all([9, 8].map(hpCurrent => fetch(base + hpPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt, hpCurrent }) })))
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    const winner = await responses.find(r => r.status === 200)!.json() as { hp: { current: number } }
    expect((await current()).combat.hpCurrent).toBe(winner.hp.current)
    const dm = await grant(true, true), other = await Character.findById(unassignedId).lean().orFail()
    const saved = await request(`/characters/${unassignedId}/hp`, { token: dm.token, body: { expectedUpdatedAt: new Date(other.updatedAt).toISOString(), hpCurrent: 0 } })
    expect(saved.data.hp.current).toBe(0)
    const dmSite = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${unassignedId}?view=quick`, { headers: { Cookie: ownerCookie, Origin: websiteOrigin } })
    expect(dmSite.status).toBe(200)
    expect((await dmSite.json() as { character: { combat: { hpCurrent: number } } }).character.combat.hpCurrent).toBe(0)
  })
  const slotPath = () => `/characters/${characterId}/slots`
  const slotBody = async (action = 'spend') => ({ expectedUpdatedAt: new Date((await current()).updatedAt).toISOString(), key: 'l1', action })
  it('keeps slot permission separate from HP and preserves read-only/older grants', async () => {
    for (const hp of [false, true]) {
      const old = await grant(hp)
      expect((await request('/session', { token: old.token })).data.capabilities.slotsWrite).toBe(false)
      await request(slotPath(), { token: old.token, body: await slotBody(), expected: 403 })
    }
    const slotGrant = await grant(false, false, true)
    expect((await request('/session', { token: slotGrant.token })).data.capabilities).toMatchObject({ hpWrite: false, slotsWrite: true })
    await request(hpPath(), { token: slotGrant.token, body: { expectedUpdatedAt: new Date((await current()).updatedAt).toISOString(), hpCurrent: 1 }, expected: 403 })
    const pending = await pair()
    await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(roomId), slotsWrite: true } })
    const redeemed = await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 201 })
    const record = await ExtensionSession.findOne({ tokenHash: proofHash(redeemed.data.token) }).orFail(); sessions.push(record._id)
    expect(record.slotsWrite).toBe(false)
  })
  it('spends/restores one assigned slot, persists on the website, and preserves other fields', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { 'spellcasting.slots.l1.used': 1 } })
    const write = await grant(false, false, true), before = await current()
    const body = await slotBody()
    const saved = await request(slotPath(), { token: write.token, body })
    expect(saved.data.slots.find((s: { key: string }) => s.key === 'l1')).toMatchObject({ max: 2, used: 2 })
    await request(slotPath(), { token: write.token, body, expected: 409 })
    const after = await current()
    expect(after.combat).toEqual(before.combat); expect(after.resources).toEqual(before.resources)
    expect(after.equipment).toEqual(before.equipment); expect(after.personality).toEqual(before.personality)
    expect(after.spellcasting.prepared).toEqual(before.spellcasting.prepared)
    expect(after.spellcasting.slots.l1!.max).toBe(before.spellcasting.slots.l1!.max)
    expect(after.spellcasting.slots.l2).toEqual(before.spellcasting.slots.l2)
    const site = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${characterId}?view=quick`, { headers: { Cookie: cookie, Origin: websiteOrigin } })
    expect(site.status).toBe(200)
    expect((await site.json() as { character: { spellcasting: { slots: { l1: { used: number } } } } }).character.spellcasting.slots.l1.used).toBe(2)
    await request(slotPath(), { token: write.token, body: await slotBody(), expected: 400 })
    await request(slotPath(), { token: write.token, body: await slotBody('restore') })
    await request(slotPath(), { token: write.token, body: await slotBody('restore') })
    expect((await current()).spellcasting.slots.l1!.used).toBe(0)
    await request(slotPath(), { token: write.token, body: await slotBody('restore'), expected: 400 })
  })
  it('rejects broader slot commands, serialises racing actions and checks assignment/ownership/revocation', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { 'spellcasting.slots.l1.used': 0 } })
    const write = await grant(false, false, true), body = await slotBody()
    for (const invalid of [{ ...body, key: 'l10' }, { ...body, key: 'l0' }, { ...body, action: 'reset' }, { ...body, max: 99 }, { ...body, used: 99 }, { ...body, hpCurrent: 1 }, { key: 'l1', action: 'spend' }, { ...body, key: 'l9' }]) {
      await request(slotPath(), { token: write.token, body: invalid, expected: 400 })
    }
    const responses = await Promise.all([1, 2].map(() => fetch(base + slotPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })))
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    expect((await current()).spellcasting.slots.l1!.used).toBe(1)
    const both = await grant(true, false, true), revision = (await slotBody()).expectedUpdatedAt
    const cross = await Promise.all([
      fetch(base + slotPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${both.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: revision, key: 'l1', action: 'spend' }) }),
      fetch(base + hpPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${both.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: revision, hpCurrent: 7 }) }),
    ])
    expect(cross.map(r => r.status).sort()).toEqual([200, 409])
    await request(`/characters/${unassignedId}/slots`, { token: write.token, body: await slotBody(), expected: 404 })
    try {
      await Room.updateOne({ _id: roomId }, { $set: { assignments: [] } })
      await request(slotPath(), { token: write.token, body: await slotBody(), expected: 404 })
    } finally { await Room.updateOne({ _id: roomId }, { $set: { assignments: [{ characterId, userId: playerId }] } }) }
    try {
      await Character.updateOne({ _id: characterId }, { $set: { userId: playerId } })
      await request(slotPath(), { token: write.token, body: await slotBody(), expected: 404 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { userId: ownerId } }) }
    await request('/session/revoke', { token: write.token, body: {} })
    await request(slotPath(), { token: write.token, body: await slotBody(), expected: 401 })
  })
  it('uses website-derived wizard/pact allowances without changing saved maxima', async () => {
    const dm = await grant(false, true, true)
    for (const [klass, progression, key, maximum] of [['Wizard', 'full', 'l1', 4], ['Warlock', 'pact', 'l2', 2]] as const) {
      await Character.updateOne({ _id: unassignedId }, { $set: { 'meta.klass': klass, 'meta.level': 3, 'spellcasting.slotRule': { progression, className: klass }, 'spellcasting.slots.l1.max': 0, 'spellcasting.slots.l1.used': 0, 'spellcasting.slots.l2.max': 0, 'spellcasting.slots.l2.used': 0 } })
      const before = await Character.findById(unassignedId).lean().orFail()
      const saved = await request(`/characters/${unassignedId}/slots`, { token: dm.token, body: { expectedUpdatedAt: new Date(before.updatedAt).toISOString(), key, action: 'spend' } })
      expect(saved.data.slots.find((s: { key: string }) => s.key === key)).toMatchObject({ max: maximum, used: 1 })
      expect((await Character.findById(unassignedId).lean().orFail()).spellcasting.slots[key]!.max).toBe(0)
    }
  })
  const tempPath = () => `/characters/${characterId}/temp-hp`
  const resourcePath = () => `/characters/${characterId}/resources`
  const revision = async () => new Date((await current()).updatedAt).toISOString()
  const resourceBody = async (id = 'custom', action = 'spend') => ({ expectedUpdatedAt: await revision(), id, action })
  it('requires independent temp/resource consent and cannot upgrade during approval', async () => {
    const old = await grant(true, false, true)
    expect((await request('/session', { token: old.token })).data.capabilities).toMatchObject({ tempHpWrite: false, resourcesWrite: false })
    await request(tempPath(), { token: old.token, body: { expectedUpdatedAt: await revision(), hpTemp: 5 }, expected: 403 })
    await request(resourcePath(), { token: old.token, body: await resourceBody(), expected: 403 })
    const temp = await grant(false, false, false, true)
    const resource = await grant(false, false, false, false, true)
    expect((await request('/session', { token: temp.token })).data.capabilities).toMatchObject({ hpWrite: false, slotsWrite: false, tempHpWrite: true, resourcesWrite: false })
    expect((await request('/session', { token: resource.token })).data.capabilities).toMatchObject({ tempHpWrite: false, resourcesWrite: true })
    await request(resourcePath(), { token: temp.token, body: await resourceBody(), expected: 403 })
    await request(tempPath(), { token: resource.token, body: { expectedUpdatedAt: await revision(), hpTemp: 5 }, expected: 403 })
    const pending = await pair()
    const context = await request(`/approval/context?request=${pending.id}`, { website: true })
    expect(context.data.pairing).toMatchObject({ tempHpWrite: false, resourcesWrite: false })
    await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(roomId), tempHpWrite: true, resourcesWrite: true } })
    const redeemed = await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 201 })
    const record = await ExtensionSession.findOne({ tokenHash: proofHash(redeemed.data.token) }).orFail(); sessions.push(record._id)
    expect(record.tempHpWrite).toBe(false); expect(record.resourcesWrite).toBe(false)
  })
  it('sets and clears temporary HP only, rejects broad/invalid writes and conflicts', async () => {
    const write = await grant(false, false, false, true), before = await current()
    const body = { expectedUpdatedAt: await revision(), hpTemp: 7 }
    for (const invalid of [{ ...body, hpTemp: -1 }, { ...body, hpTemp: 10000 }, { ...body, hpTemp: 1.5 }, { ...body, hpTemp: '7' }, { ...body, hpCurrent: 1 }]) {
      await request(tempPath(), { token: write.token, body: invalid, expected: 400 })
    }
    expect((await request(tempPath(), { token: write.token, body })).data.hp.temp).toBe(7)
    await request(tempPath(), { token: write.token, body, expected: 409 })
    const after = await current()
    expect(after.combat).toEqual({ ...before.combat, hpTemp: 7 })
    expect(after.resources).toEqual(before.resources); expect(after.spellcasting).toEqual(before.spellcasting)
    const site = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${characterId}?view=quick`, { headers: { Cookie: cookie, Origin: websiteOrigin } })
    expect(site.status).toBe(200)
    expect((await site.json() as { character: { combat: { hpTemp: number } } }).character.combat.hpTemp).toBe(7)
    expect((await request(tempPath(), { token: write.token, body: { expectedUpdatedAt: await revision(), hpTemp: 0 } })).data.hp.temp).toBe(0)
  })
  it('tracks a scaled saved resource while preserving raw maxima, metadata and other pools', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { 'meta.level': 3, resources: [
      { id: 'custom', name: 'Scaled resource', max: 1, used: 1, recovery: 'manual', notes: 'Keep this', scaling: { perLevel: 1, base: 0 } },
      { id: 'other', name: 'Other pool', max: 9, used: 4, recovery: 'short' },
      { id: 'unlimited', name: 'Unlimited pool', max: 1, used: 0, unlimited: true, recovery: 'long' },
    ] } })
    const write = await grant(false, false, false, false, true), before = await current()
    const body = await resourceBody()
    const saved = await request(resourcePath(), { token: write.token, body })
    expect(saved.data.resources.find((r: { id: string }) => r.id === 'custom')).toMatchObject({ max: 3, used: 2 })
    await request(resourcePath(), { token: write.token, body, expected: 409 })
    const after = await current()
    expect(after.resources).toEqual(before.resources.map(r => r.id === 'custom' ? { ...r, used: 2 } : r))
    expect(after.combat).toEqual(before.combat); expect(after.spellcasting).toEqual(before.spellcasting); expect(after.equipment).toEqual(before.equipment)
    await request(resourcePath(), { token: write.token, body: await resourceBody() })
    await request(resourcePath(), { token: write.token, body: await resourceBody(), expected: 400 })
    for (let i = 0; i < 3; i++) await request(resourcePath(), { token: write.token, body: await resourceBody('custom', 'restore') })
    await request(resourcePath(), { token: write.token, body: await resourceBody('custom', 'restore'), expected: 400 })
    for (const invalid of [{ ...await resourceBody(), used: 99 }, { ...await resourceBody(), max: 99 }, { ...await resourceBody(), action: 'reset' }, { ...await resourceBody(), id: 'missing' }, { ...await resourceBody(), id: 'unlimited' }, { ...await resourceBody(), id: '$.custom' }, { id: 'custom', action: 'spend' }]) {
      await request(resourcePath(), { token: write.token, body: invalid, expected: 400 })
    }
    const site = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${characterId}?view=quick`, { headers: { Cookie: cookie, Origin: websiteOrigin } })
    expect(site.status).toBe(200)
    expect((await site.json() as { character: { resources: { id: string; used: number }[] } }).character.resources.find(r => r.id === 'custom')!.used).toBe(0)
  })
  it('persists first use of a derived DM resource and serialises it with temporary HP', async () => {
    await Character.updateOne({ _id: unassignedId }, { $set: { 'meta.klass': 'Fighter', 'meta.level': 3, resources: [] } })
    const dm = await grant(false, true, false, true, true)
    const snapshot = await request(`/characters/${unassignedId}`, { token: dm.token })
    expect(snapshot.data.resources.find((r: { id: string }) => r.id === 'auto:action-surge')).toMatchObject({ max: 1, used: 0 })
    const saved = await request(`/characters/${unassignedId}/resources`, { token: dm.token, body: { expectedUpdatedAt: snapshot.data.updatedAt, id: 'auto:action-surge', action: 'spend' } })
    expect(saved.data.resources.find((r: { id: string }) => r.id === 'auto:action-surge').used).toBe(1)
    const raw = await Character.findById(unassignedId).lean().orFail()
    expect(raw.resources).toHaveLength(1); expect(raw.resources[0]).toMatchObject({ id: 'auto:action-surge', used: 1, automatic: true })
    const expectedUpdatedAt = raw.updatedAt.toISOString()
    const cross = await Promise.all([
      fetch(base + `/characters/${unassignedId}/resources`, { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${dm.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt, id: 'auto:action-surge', action: 'restore' }) }),
      fetch(base + `/characters/${unassignedId}/temp-hp`, { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${dm.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt, hpTemp: 9 }) }),
    ])
    expect(cross.map(r => r.status).sort()).toEqual([200, 409])
  })
  it('rechecks assignment, character ownership and revocation for both new controls', async () => {
    const write = await grant(false, false, false, true, true)
    const actions = [ ['temp-hp', { expectedUpdatedAt: await revision(), hpTemp: 5 }], ['resources', await resourceBody()] ] as const
    for (const [path, body] of actions) await request(`/characters/${unassignedId}/${path}`, { token: write.token, body, expected: 404 })
    try {
      await Room.updateOne({ _id: roomId }, { $set: { assignments: [] } })
      for (const [path, body] of actions) await request(`/characters/${characterId}/${path}`, { token: write.token, body, expected: 404 })
    } finally { await Room.updateOne({ _id: roomId }, { $set: { assignments: [{ characterId, userId: playerId }] } }) }
    try {
      await Character.updateOne({ _id: characterId }, { $set: { userId: playerId } })
      for (const [path, body] of actions) await request(`/characters/${characterId}/${path}`, { token: write.token, body, expected: 404 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { userId: ownerId } }) }
    await request('/session/revoke', { token: write.token, body: {} })
    for (const [path, body] of actions) await request(`/characters/${characterId}/${path}`, { token: write.token, body, expected: 401 })
  })
  const combatPath = () => `/characters/${characterId}/combat`
  const combatBody = async (field = 'inspiration', value: number | boolean = true) => ({ expectedUpdatedAt: await revision(), field, value })
  it('keeps combat consent independent and displays it without approval-body upgrades', async () => {
    const old = await grant(true, false, true, true, true)
    expect((await request('/session', { token: old.token })).data.capabilities.combatWrite).toBe(false)
    await request(combatPath(), { token: old.token, body: await combatBody(), expected: 403 })
    const pending = await pair()
    await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(roomId), combatWrite: true } })
    const redeemed = await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 201 })
    const record = await ExtensionSession.findOne({ tokenHash: proofHash(redeemed.data.token) }).orFail(); sessions.push(record._id)
    expect(record.combatWrite).toBe(false)
    const requested = await pair(false, false, false, false, true)
    expect((await request(`/approval/context?request=${requested.id}`, { website: true })).data.pairing.combatWrite).toBe(true)
    const write = await grant(false, false, false, false, false, true)
    expect((await request('/session', { token: write.token })).data.capabilities).toMatchObject({ combatWrite: true, hpWrite: false, slotsWrite: false, tempHpWrite: false, resourcesWrite: false })
    expect((await request('/approval/connections', { website: true })).data.connections.find((c: { id: string }) => c.id === String(write.id)).combatWrite).toBe(true)
    await request(hpPath(), { token: write.token, body: { expectedUpdatedAt: await revision(), hpCurrent: 1 }, expected: 403 })
    await request(tempPath(), { token: write.token, body: { expectedUpdatedAt: await revision(), hpTemp: 1 }, expected: 403 })
    await request(slotPath(), { token: write.token, body: await slotBody(), expected: 403 })
    await request(resourcePath(), { token: write.token, body: await resourceBody(), expected: 403 })
  })
  it('persists each manual combat tracker on ordinary website reads and preserves unrelated fields', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { 'combat.hitDiceTotal': 3, 'combat.hitDiceUsed': 1, 'combat.deathSavesSuccess': 0, 'combat.deathSavesFailure': 0, 'combat.inspiration': false } })
    const write = await grant(false, false, false, false, false, true)
    for (const [field, value] of [['inspiration', true], ['inspiration', false], ['hitDiceUsed', 2], ['hitDiceUsed', 0], ['deathSavesSuccess', 3], ['deathSavesSuccess', 0], ['deathSavesFailure', 3], ['deathSavesFailure', 0]] as const) {
      const before = await current(), body = await combatBody(field, value)
      const saved = await request(combatPath(), { token: write.token, body })
      const after = await current()
      expect(after.combat).toEqual({ ...before.combat, [field]: value })
      expect(after.resources).toEqual(before.resources); expect(after.equipment).toEqual(before.equipment); expect(after.spellcasting).toEqual(before.spellcasting)
      expect(after.meta).toEqual(before.meta); expect(after.personality).toEqual(before.personality)
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime())
      expect(saved.data.trackers.hitDice).toEqual({ total: after.combat.hitDiceTotal, used: after.combat.hitDiceUsed })
      expect(saved.data.trackers.deathSaves).toEqual({ successes: after.combat.deathSavesSuccess, failures: after.combat.deathSavesFailure })
      expect(saved.data.inspiration).toBe(after.combat.inspiration)
      await request(combatPath(), { token: write.token, body, expected: 409 })
      const site = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${characterId}?view=quick`, { headers: { Cookie: cookie, Origin: websiteOrigin } })
      expect(site.status).toBe(200)
      expect((await site.json() as { character: { combat: Record<string, unknown> } }).character.combat[field]).toBe(value)
    }
  })
  it('rejects invalid combat counters and broader commands without changing the character', async () => {
    const write = await grant(false, false, false, false, false, true), before = await current(), body = await combatBody()
    for (const invalid of [{ ...body, value: 'true' }, { ...body, field: 'hitDiceUsed', value: -1 }, { ...body, field: 'hitDiceUsed', value: 1.5 }, { ...body, field: 'hitDiceUsed', value: before.combat.hitDiceTotal + 1 }, { ...body, field: 'deathSavesSuccess', value: 4 }, { ...body, field: 'deathSavesFailure', value: -1 }, { ...body, field: 'deathSavesFailure', value: true }, { ...body, field: 'hpCurrent', value: 1 }, { ...body, field: 'hitDiceTotal', value: 100 }, { ...body, hpCurrent: 1 }, { ...body, combat: { inspiration: true } }, { field: 'inspiration', value: true }]) {
      await request(combatPath(), { token: write.token, body: invalid, expected: 400 })
    }
    expect(await current()).toEqual(before)
  })
  it('serialises combat with HP and checks assignments, ownership, DM access and revocation', async () => {
    const write = await grant(true, false, false, false, false, true), body = await combatBody()
    const racing = await Promise.all([
      fetch(base + combatPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      fetch(base + hpPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: body.expectedUpdatedAt, hpCurrent: 5 }) }),
    ])
    expect(racing.map(r => r.status).sort()).toEqual([200, 409])
    await request(`/characters/${unassignedId}/combat`, { token: write.token, body: await combatBody(), expected: 404 })
    try {
      await Room.updateOne({ _id: roomId }, { $set: { assignments: [] } })
      await request(combatPath(), { token: write.token, body: await combatBody(), expected: 404 })
    } finally { await Room.updateOne({ _id: roomId }, { $set: { assignments: [{ characterId, userId: playerId }] } }) }
    try {
      await Character.updateOne({ _id: characterId }, { $set: { userId: playerId } })
      await request(combatPath(), { token: write.token, body: await combatBody(), expected: 404 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { userId: ownerId } }) }
    const dm = await grant(false, true, false, false, false, true), other = await Character.findById(unassignedId).lean().orFail()
    expect((await request(`/characters/${unassignedId}/combat`, { token: dm.token, body: { expectedUpdatedAt: other.updatedAt.toISOString(), field: 'inspiration', value: true } })).data.inspiration).toBe(true)
    await request('/session/revoke', { token: write.token, body: {} })
    await request(combatPath(), { token: write.token, body: await combatBody(), expected: 401 })
  })
  const equipmentPath = () => `/characters/${characterId}/equipment`
  const equipmentBody = async (id: string, field = 'equipped', value = true) => ({ expectedUpdatedAt: await revision(), id, field, value })
  const gear = (name: string, extra: Record<string, unknown> = {}) => ({ name, qty: 1, weight: 1, notes: 'Keep saved notes', equipped: false, ...extra })
  it('requires independent equipment approval and does not upgrade previous grants', async () => {
    const old = await grant(true, false, true, true, true, true)
    expect((await request('/session', { token: old.token })).data.capabilities.equipmentWrite).toBe(false)
    await request(equipmentPath(), { token: old.token, body: await equipmentBody('a'.repeat(24)), expected: 403 })
    const pending = await pair()
    await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(roomId), equipmentWrite: true } })
    const redeemed = await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 201 })
    const record = await ExtensionSession.findOne({ tokenHash: proofHash(redeemed.data.token) }).orFail(); sessions.push(record._id)
    expect(record.equipmentWrite).toBe(false)
    const requested = await pair(false, false, false, false, false, true)
    expect((await request(`/approval/context?request=${requested.id}`, { website: true })).data.pairing.equipmentWrite).toBe(true)
    const write = await grant(false, false, false, false, false, false, true)
    expect((await request('/session', { token: write.token })).data.capabilities).toMatchObject({ equipmentWrite: true, hpWrite: false, slotsWrite: false, resourcesWrite: false, combatWrite: false })
    expect((await request('/approval/connections', { website: true })).data.connections.find((c: { id: string }) => c.id === String(write.id)).equipmentWrite).toBe(true)
    await request(combatPath(), { token: write.token, body: await combatBody(), expected: 403 })
  })
  it('equips and attunes using website rules while retaining raw definitions and quantities', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { equipment: [gear('Ring of Protection', { magicIndex: 'ring-of-protection', qty: 2 }), gear('Preserved custom item', { qty: 9, description: 'Keep definition', effects: { ac: 7 } })], 'combat.acMode': 'equipment', 'combat.itemAcBaseline': 0 } })
    const write = await grant(false, false, false, false, false, false, true)
    let raw = await current(); const id = String(raw.equipment[0]!._id), original = raw
    const before = (await request(`/characters/${characterId}`, { token: write.token })).data
    const equipBody = await equipmentBody(id)
    const equipped = await request(equipmentPath(), { token: write.token, body: equipBody })
    expect(equipped.data.equipmentChange).toEqual({ id, equipped: true, attuned: false })
    expect(equipped.data.ac).toBe(before.ac)
    await request(equipmentPath(), { token: write.token, body: equipBody, expected: 409 })
    const attuned = await request(equipmentPath(), { token: write.token, body: await equipmentBody(id, 'attuned') })
    expect(attuned.data.equipmentChange).toEqual({ id, equipped: true, attuned: true }); expect(attuned.data.ac).toBe(before.ac + 1)
    raw = await current()
    expect(raw.equipment[0]).toEqual({ ...original.equipment[0], equipped: true, attuned: true })
    expect(raw.equipment[1]).toEqual(original.equipment[1]); expect(raw.spellcasting).toEqual(original.spellcasting); expect(raw.resources).toEqual(original.resources)
    expect(raw.combat).toEqual(original.combat); expect(raw.meta).toEqual(original.meta)
    expect(raw.equipment[0]!.requiresAttunement).toBeUndefined(); expect(raw.equipment[0]!.effects).toBeUndefined()
    const site = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${characterId}?view=quick`, { headers: { Cookie: cookie, Origin: websiteOrigin } })
    expect(site.status).toBe(200)
    const item = (await site.json() as { character: { equipment: { _id: string; equipped: boolean; attuned: boolean; qty: number }[] } }).character.equipment.find(i => i._id === id)!
    expect(item).toMatchObject({ equipped: true, attuned: true, qty: 2 })
    expect((await request(equipmentPath(), { token: write.token, body: await equipmentBody(id, 'equipped', false) })).data.equipmentChange).toEqual({ id, equipped: false, attuned: true })
    expect((await request(equipmentPath(), { token: write.token, body: await equipmentBody(id, 'attuned', false) })).data.equipmentChange).toEqual({ id, equipped: false, attuned: false })
  })
  it('enforces attunement limits and rejects unavailable items, quantity and permanent changes', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { equipment: [
      ...['Trial A', 'Trial B', 'Trial C'].map(name => gear(name, { requiresAttunement: true, attuned: true })),
      gear('Trial D', { requiresAttunement: true }), gear('Trial A', { requiresAttunement: true }), gear('Empty item', { qty: 0 }), gear('Ordinary item'),
    ] } })
    const write = await grant(false, false, false, false, false, false, true), raw = await current()
    const ids = raw.equipment.map(item => String(item._id))
    const limited = await request(equipmentPath(), { token: write.token, body: await equipmentBody(ids[3]!, 'attuned'), expected: 400 })
    expect(limited.data.error).toMatch(/three items/)
    await request(equipmentPath(), { token: write.token, body: await equipmentBody(ids[2]!, 'attuned', false) })
    const duplicate = await request(equipmentPath(), { token: write.token, body: await equipmentBody(ids[4]!, 'attuned'), expected: 400 })
    expect(duplicate.data.error).toMatch(/two copies/)
    await request(equipmentPath(), { token: write.token, body: await equipmentBody(ids[3]!, 'attuned') })
    const body = await equipmentBody(ids[3]!), before = await current()
    for (const invalid of [{ ...body, id: 'missing' }, { ...body, id: 'a'.repeat(24) }, { ...body, field: 'qty', value: 0 }, { ...body, qty: 0 }, { ...body, effects: { ac: 100 } }, { ...body, value: 'true' }, { ...body, id: ids[5] }, { ...body, id: ids[6], field: 'attuned' }, { id: ids[3], field: 'equipped', value: true }]) {
      await request(equipmentPath(), { token: write.token, body: invalid, expected: 400 })
    }
    expect(await current()).toEqual(before)
  })
  it('guards equipment races, current access, DM unassigned saves and revocation', async () => {
    const write = await grant(true, false, false, false, false, false, true), raw = await current(), id = String(raw.equipment[0]!._id), body = await equipmentBody(id)
    const responses = await Promise.all([
      fetch(base + equipmentPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      fetch(base + hpPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: body.expectedUpdatedAt, hpCurrent: 6 }) }),
    ])
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    await request(`/characters/${unassignedId}/equipment`, { token: write.token, body: await equipmentBody(id), expected: 404 })
    try {
      await Room.updateOne({ _id: roomId }, { $set: { assignments: [] } })
      await request(equipmentPath(), { token: write.token, body: await equipmentBody(id), expected: 404 })
    } finally { await Room.updateOne({ _id: roomId }, { $set: { assignments: [{ characterId, userId: playerId }] } }) }
    try {
      await Character.updateOne({ _id: characterId }, { $set: { userId: playerId } })
      await request(equipmentPath(), { token: write.token, body: await equipmentBody(id), expected: 404 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { userId: ownerId } }) }
    await Character.updateOne({ _id: unassignedId }, { $set: { equipment: [gear('DM trial gear')] } })
    const dm = await grant(false, true, false, false, false, false, true), other = await Character.findById(unassignedId).lean().orFail()
    expect((await request(`/characters/${unassignedId}/equipment`, { token: dm.token, body: { expectedUpdatedAt: other.updatedAt.toISOString(), id: String(other.equipment[0]!._id), field: 'equipped', value: true } })).data.equipmentChange.equipped).toBe(true)
    await request('/session/revoke', { token: write.token, body: {} })
    await request(equipmentPath(), { token: write.token, body: await equipmentBody(id), expected: 401 })
  })
  const preparationPath = () => `/characters/${characterId}/preparation`
  const preparationBody = async (id = 'magic-missile', prepared = true) => ({ expectedUpdatedAt: await revision(), id, prepared })
  it('requires independent preparation consent and prevents approval-body escalation', async () => {
    const old = await grant(true, false, true, true, true, true, true)
    expect((await request('/session', { token: old.token })).data.capabilities.preparationWrite).toBe(false)
    await request(preparationPath(), { token: old.token, body: await preparationBody(), expected: 403 })
    const pending = await pair()
    await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(roomId), preparationWrite: true } })
    const redeemed = await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 201 })
    const record = await ExtensionSession.findOne({ tokenHash: proofHash(redeemed.data.token) }).orFail(); sessions.push(record._id)
    expect(record.preparationWrite).toBe(false)
    const requested = await pair(false, false, false, false, false, false, true)
    expect((await request(`/approval/context?request=${requested.id}`, { website: true })).data.pairing.preparationWrite).toBe(true)
    const write = await grant(false, false, false, false, false, false, false, true)
    expect((await request('/session', { token: write.token })).data.capabilities).toMatchObject({ preparationWrite: true, hpWrite: false, slotsWrite: false, equipmentWrite: false, combatWrite: false })
    expect((await request('/approval/connections', { website: true })).data.connections.find((c: { id: string }) => c.id === String(write.id)).preparationWrite).toBe(true)
    await request(hpPath(), { token: write.token, body: { expectedUpdatedAt: await revision(), hpCurrent: 1 }, expected: 403 })
    await request(slotPath(), { token: write.token, body: await slotBody(), expected: 403 })
    await request(equipmentPath(), { token: write.token, body: await equipmentBody('a'.repeat(24)), expected: 403 })
  })
  it('prepares and unprepares only saved spell references with ordinary website persistence', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { 'spellcasting.known': ['magic-missile', 'hb:missing:trial-spell'], 'spellcasting.prepared': ['shield'] } })
    const write = await grant(false, false, false, false, false, false, false, true)
    for (const [id, prepared] of [['magic-missile', true], ['magic-missile', false], ['shield', false], ['hb:missing:trial-spell', true], ['hb:missing:trial-spell', false]] as const) {
      const before = await current(), body = await preparationBody(id, prepared)
      const saved = await request(preparationPath(), { token: write.token, body }), after = await current()
      expect(saved.data.preparationChange).toEqual({ id, prepared }); expect(saved.data.magic).toBeUndefined()
      expect(after.spellcasting.prepared.includes(id)).toBe(prepared)
      expect(after.spellcasting.known).toEqual([...new Set([...before.spellcasting.known, ...before.spellcasting.prepared])])
      expect(after.spellcasting).toEqual({ ...before.spellcasting, known: after.spellcasting.known, prepared: prepared ? [...new Set([...before.spellcasting.prepared, id])] : before.spellcasting.prepared.filter(i => i !== id) })
      expect(after.combat).toEqual(before.combat); expect(after.resources).toEqual(before.resources); expect(after.equipment).toEqual(before.equipment); expect(after.meta).toEqual(before.meta); expect(after.personality).toEqual(before.personality)
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime())
      await request(preparationPath(), { token: write.token, body, expected: 409 })
      const site = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${characterId}?view=quick`, { headers: { Cookie: cookie, Origin: websiteOrigin } })
      expect(site.status).toBe(200)
      expect((await site.json() as { character: { spellcasting: { prepared: string[]; known: string[] } } }).character.spellcasting).toMatchObject({ prepared: after.spellcasting.prepared, known: after.spellcasting.known })
    }
  })
  it('rejects arbitrary and innate-only references, lists and broader spell changes', async () => {
    const write = await grant(false, false, false, false, false, false, false, true), body = await preparationBody(), before = await current()
    for (const invalid of [{ ...body, id: 'unlisted-spell' }, { ...body, id: '' }, { ...body, id: 'x'.repeat(301) }, { ...body, prepared: 'true' }, { ...body, prepared: [] }, { ...body, known: ['new'] }, { ...body, slots: {} }, { ...body, activeEffects: ['magic-missile'] }, { ...body, prepared: ['magic-missile'] }, { id: 'magic-missile', prepared: true }]) {
      await request(preparationPath(), { token: write.token, body: invalid, expected: 400 })
    }
    expect(await current()).toEqual(before)
    // A real resolved racial grant is visible in references, but cannot be promoted.
    const originalMeta = before.meta, originalRules = before.compendiumRules
    try {
      const index = 'preparation-trial-race'
      await Character.updateOne({ _id: characterId }, { $set: { 'meta.race': 'Preparation trial race', 'meta.raceIndex': index, compendiumRules: [{ kind: 'races', index, revision: 1, before: { name: 'Preparation trial race', index }, entry: { name: 'Preparation trial race', index, benefits: [{ type: 'spell', value: { key: 'misty-step', ability: 'cha', level: 2 } }] } }] } })
      const resolved = await characterOutput(await current(), String(ownerId), true)
      expect(innateRaceSpells(resolved).some(s => s.index === 'misty-step')).toBe(true)
      expect(resolved.spellcasting.known).not.toContain('misty-step')
      await request(preparationPath(), { token: write.token, body: await preparationBody('misty-step'), expected: 400 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { meta: originalMeta, compendiumRules: originalRules ?? [] } }) }
  })
  it('guards preparation races, current permissions, DM unassigned access and revocation', async () => {
    const write = await grant(true, false, false, false, false, false, false, true), body = await preparationBody()
    const responses = await Promise.all([
      fetch(base + preparationPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      fetch(base + hpPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: body.expectedUpdatedAt, hpCurrent: 7 }) }),
    ])
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    await request(`/characters/${unassignedId}/preparation`, { token: write.token, body: await preparationBody(), expected: 404 })
    try {
      await Room.updateOne({ _id: roomId }, { $set: { assignments: [] } })
      await request(preparationPath(), { token: write.token, body: await preparationBody(), expected: 404 })
    } finally { await Room.updateOne({ _id: roomId }, { $set: { assignments: [{ characterId, userId: playerId }] } }) }
    try {
      await Character.updateOne({ _id: characterId }, { $set: { userId: playerId } })
      await request(preparationPath(), { token: write.token, body: await preparationBody(), expected: 404 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { userId: ownerId } }) }
    await Character.updateOne({ _id: unassignedId }, { $set: { 'spellcasting.known': ['magic-missile'] } })
    const dm = await grant(false, true, false, false, false, false, false, true), other = await Character.findById(unassignedId).lean().orFail()
    expect((await request(`/characters/${unassignedId}/preparation`, { token: dm.token, body: { expectedUpdatedAt: other.updatedAt.toISOString(), id: 'magic-missile', prepared: true } })).data.preparationChange).toEqual({ id: 'magic-missile', prepared: true })
    await request('/session/revoke', { token: write.token, body: {} })
    await request(preparationPath(), { token: write.token, body: await preparationBody(), expected: 401 })
  })
  const inventoryPath = () => `/characters/${characterId}/inventory`
  const inventoryBody = async (id: string, action = 'remove') => ({ expectedUpdatedAt: await revision(), id, action })
  it('requires independent immutable inventory consent and prevents unrelated play actions', async () => {
    const old = await grant(true, false, true, true, true, true, true, true)
    expect((await request('/session', { token: old.token })).data.capabilities.inventoryWrite).toBe(false)
    await request(inventoryPath(), { token: old.token, body: await inventoryBody('a'.repeat(24)), expected: 403 })
    const pending = await pair()
    await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(roomId), inventoryWrite: true } })
    const redeemed = await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 201 })
    const record = await ExtensionSession.findOne({ tokenHash: proofHash(redeemed.data.token) }).orFail(); sessions.push(record._id)
    expect(record.inventoryWrite).toBe(false)
    const requested = await pair(false, false, false, false, false, false, false, true)
    expect((await request(`/approval/context?request=${requested.id}`, { website: true })).data.pairing.inventoryWrite).toBe(true)
    const write = await grant(false, false, false, false, false, false, false, false, true)
    expect((await request('/session', { token: write.token })).data.capabilities).toMatchObject({ inventoryWrite: true, hpWrite: false, slotsWrite: false, equipmentWrite: false, preparationWrite: false, combatWrite: false })
    expect((await request('/approval/connections', { website: true })).data.connections.find((c: { id: string }) => c.id === String(write.id)).inventoryWrite).toBe(true)
    await request(hpPath(), { token: write.token, body: { expectedUpdatedAt: await revision(), hpCurrent: 1 }, expected: 403 })
    await request(equipmentPath(), { token: write.token, body: await equipmentBody('a'.repeat(24)), expected: 403 })
    await request(preparationPath(), { token: write.token, body: await preparationBody(), expected: 403 })
  })
  it('persists one count, unequips empty entries, preserves definitions and recalculates AC', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { equipment: [gear('Ring of Protection', { magicIndex: 'ring-of-protection', equipped: true, attuned: true }), gear('Unchanged supplies', { qty: 9, description: 'Keep definition', effects: { ac: 7 } }), gear('Gold', { qty: 4, equipped: true, kind: 'treasure' })], 'combat.acMode': 'equipment', 'combat.itemAcBaseline': 0 } })
    const write = await grant(false, false, false, false, false, false, false, false, true), original = await current(), id = String(original.equipment[0]!._id)
    const beforeVitals = (await request(`/characters/${characterId}`, { token: write.token })).data
    const body = await inventoryBody(id), removed = await request(inventoryPath(), { token: write.token, body })
    expect(removed.data.inventoryChange).toEqual({ id, quantity: 0, equipped: false, attuned: true }); expect(removed.data.ac).toBe(beforeVitals.ac - 1)
    await request(inventoryPath(), { token: write.token, body, expected: 409 })
    let after = await current()
    expect(after.equipment[0]).toEqual({ ...original.equipment[0], qty: 0, equipped: false, attuned: true }); expect(after.equipment.slice(1)).toEqual(original.equipment.slice(1))
    expect(after.equipment[0]!.effects).toBeUndefined(); expect(after.equipment[0]!.requiresAttunement).toBeUndefined()
    expect(after.spellcasting).toEqual(original.spellcasting); expect(after.combat).toEqual(original.combat); expect(after.resources).toEqual(original.resources); expect(after.meta).toEqual(original.meta); expect(after.personality).toEqual(original.personality)
    const added = await request(inventoryPath(), { token: write.token, body: await inventoryBody(id, 'add') })
    expect(added.data.inventoryChange).toEqual({ id, quantity: 1, equipped: false, attuned: true }); expect(added.data.ac).toBe(removed.data.ac)
    const site = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${characterId}?view=quick`, { headers: { Cookie: cookie, Origin: websiteOrigin } })
    expect(site.status).toBe(200)
    expect((await site.json() as { character: { equipment: { _id: string; qty: number; equipped: boolean; attuned: boolean }[] } }).character.equipment.find(i => i._id === id)).toMatchObject({ qty: 1, equipped: false, attuned: true })
    after = await current(); expect(after.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime())
    const goldId = String(after.equipment[2]!._id)
    expect((await request(inventoryPath(), { token: write.token, body: await inventoryBody(goldId, 'add') })).data.inventoryChange).toEqual({ id: goldId, quantity: 5, equipped: false, attuned: false })
  })
  it('rejects underflow, unsafe counts, ambiguous items, broader commands and invalid attunement reactivation', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { equipment: [gear('Empty', { qty: 0 }), gear('Maximum count', { qty: Number.MAX_SAFE_INTEGER }), gear('Fractional count', { qty: 1.5 }), gear('Negative count', { qty: -1 }), ...['A', 'B', 'C'].map(name => gear(name, { attuned: true, requiresAttunement: true })), gear('D', { qty: 0, attuned: true, requiresAttunement: true }), gear('A', { qty: 0, attuned: true, requiresAttunement: true })] } })
    const write = await grant(false, false, false, false, false, false, false, false, true), before = await current(), ids = before.equipment.map(i => String(i._id)), body = await inventoryBody(ids[0]!)
    for (const invalid of [body, { ...body, id: ids[1], action: 'add' }, { ...body, id: ids[2], action: 'add' }, { ...body, id: ids[3], action: 'add' }, { ...body, id: 'missing' }, { ...body, id: 'a'.repeat(24) }, { ...body, action: 'consume' }, { ...body, action: 1 }, { ...body, qty: 99 }, { ...body, equipped: true }, { ...body, attuned: true }, { ...body, effects: { ac: 100 } }, { id: ids[0], action: 'add' }]) {
      await request(inventoryPath(), { token: write.token, body: invalid, expected: 400 })
    }
    expect(await current()).toEqual(before)
    const limit = await request(inventoryPath(), { token: write.token, body: await inventoryBody(ids[7]!, 'add'), expected: 400 }); expect(limit.data.error).toMatch(/three items/)
    await request(equipmentPath(), { token: (await grant(false, false, false, false, false, false, true)).token, body: await equipmentBody(ids[6]!, 'attuned', false) })
    const duplicate = await request(inventoryPath(), { token: write.token, body: await inventoryBody(ids[8]!, 'add'), expected: 400 }); expect(duplicate.data.error).toMatch(/two copies/)
    await request(inventoryPath(), { token: write.token, body: await inventoryBody(ids[7]!, 'add') })
    const raw = await current(), duplicateId = String(raw.equipment[0]!._id)
    await Character.updateOne({ _id: characterId }, { $push: { equipment: raw.equipment[0] } })
    const ambiguous = await current()
    await request(inventoryPath(), { token: write.token, body: await inventoryBody(duplicateId, 'add'), expected: 400 }); expect(await current()).toEqual(ambiguous)
  })
  it('serialises inventory with HP and rechecks assignment, ownership, DM access and revocation', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { equipment: [gear('Trial arrows', { qty: 5 })] } })
    const write = await grant(true, false, false, false, false, false, false, false, true), id = String((await current()).equipment[0]!._id), body = await inventoryBody(id)
    const responses = await Promise.all([
      fetch(base + inventoryPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      fetch(base + hpPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: body.expectedUpdatedAt, hpCurrent: 8 }) }),
    ])
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    await request(`/characters/${unassignedId}/inventory`, { token: write.token, body: await inventoryBody(id), expected: 404 })
    try {
      await Room.updateOne({ _id: roomId }, { $set: { assignments: [] } })
      await request(inventoryPath(), { token: write.token, body: await inventoryBody(id), expected: 404 })
    } finally { await Room.updateOne({ _id: roomId }, { $set: { assignments: [{ characterId, userId: playerId }] } }) }
    try {
      await Character.updateOne({ _id: characterId }, { $set: { userId: playerId } })
      await request(inventoryPath(), { token: write.token, body: await inventoryBody(id), expected: 404 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { userId: ownerId } }) }
    await Character.updateOne({ _id: unassignedId }, { $set: { equipment: [gear('Unassigned supplies', { qty: 2 })] } })
    const dm = await grant(false, true, false, false, false, false, false, false, true), other = await Character.findById(unassignedId).lean().orFail()
    expect((await request(`/characters/${unassignedId}/inventory`, { token: dm.token, body: { expectedUpdatedAt: other.updatedAt.toISOString(), id: String(other.equipment[0]!._id), action: 'remove' } })).data.inventoryChange.quantity).toBe(1)
    await request('/session/revoke', { token: write.token, body: {} })
    await request(inventoryPath(), { token: write.token, body: await inventoryBody(id), expected: 401 })
  })
  const effectPath = () => `/characters/${characterId}/effects`
  const effectBody = async (id = 'trial-effect', active = true) => ({ expectedUpdatedAt: await revision(), id, active })
  const effectRules = () => ['trial-effect', 'second-effect', 'foreign-effect'].map(index => ({ kind: 'spells', index, revision: 1, before: { name: index, index }, entry: { name: index, index, benefits: [{ type: 'walking-speed', value: 50 }, { type: 'damage-resistance', value: 'fire' }] } }))
  const effectGrant = (owner = false) => grant(false, owner, false, false, false, false, false, false, false, true)
  it('requires immutable effect consent and prevents unrelated write escalation', async () => {
    const old = await grant(true, false, true, true, true, true, true, true, true)
    expect((await request('/session', { token: old.token })).data.capabilities.effectsWrite).toBe(false)
    await request(effectPath(), { token: old.token, body: await effectBody(), expected: 403 })
    const pending = await pair()
    await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(roomId), effectsWrite: true } })
    const redeemed = await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 201 })
    const record = await ExtensionSession.findOne({ tokenHash: proofHash(redeemed.data.token) }).orFail(); sessions.push(record._id)
    expect(record.effectsWrite).toBe(false)
    const requested = await pair(false, false, false, false, false, false, false, false, true)
    expect((await request(`/approval/context?request=${requested.id}`, { website: true })).data.pairing.effectsWrite).toBe(true)
    const write = await effectGrant()
    expect((await request('/session', { token: write.token })).data.capabilities).toMatchObject({ effectsWrite: true, hpWrite: false, preparationWrite: false, inventoryWrite: false })
    expect((await request('/approval/connections', { website: true })).data.connections.find((c: { id: string }) => c.id === String(write.id)).effectsWrite).toBe(true)
    await request(hpPath(), { token: write.token, body: { expectedUpdatedAt: await revision(), hpCurrent: 1 }, expected: 403 })
    await request(preparationPath(), { token: write.token, body: await preparationBody(), expected: 403 })
  })
  it('toggles reviewed effects without persisting resolved definitions or spending resources', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { compendiumRules: effectRules(), 'spellcasting.known': ['trial-alias', 'second-effect', 'unreviewed'], 'spellcasting.prepared': [], 'spellcasting.activeEffects': ['second-effect'] } })
    const rules = effectRules(); rules[0]!.entry = { ...rules[0]!.entry, aliases: ['trial-alias'] } as typeof rules[0]['entry']
    await Character.updateOne({ _id: characterId }, { $set: { compendiumRules: rules } })
    const write = await effectGrant(), before = await current()
    const resolvedBefore = await characterOutput(before, String(ownerId), true)
    const { expandedSheet } = await import('./sheet')
    const { workshopLibrary } = await import('../lib/workshop-library')
    const projection = expandedSheet(resolvedBefore, await workshopLibrary(String(ownerId)))
    expect(projection.magic.effects).toEqual([{ id: 'trial-effect', name: 'trial-effect', active: false }, { id: 'second-effect', name: 'second-effect', active: true }])
    const body = await effectBody(), result = await request(effectPath(), { token: write.token, body })
    expect(result.data.effectChange).toEqual({ id: 'trial-effect', active: true })
    await request(effectPath(), { token: write.token, body, expected: 409 })
    let after = await current()
    expect(after.spellcasting).toEqual({ ...before.spellcasting, activeEffects: ['second-effect', 'trial-effect'] })
    expect(after.compendiumRules).toEqual(before.compendiumRules); expect(after.combat).toEqual(before.combat); expect(after.resources).toEqual(before.resources); expect(after.equipment).toEqual(before.equipment)
    const site = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${characterId}?view=quick`, { headers: { Cookie: cookie, Origin: websiteOrigin } })
    expect(site.status).toBe(200)
    expect((await site.json() as { character: { spellcasting: { activeEffects: string[] } } }).character.spellcasting.activeEffects).toEqual(['second-effect', 'trial-effect'])
    const active = expandedSheet(await characterOutput(after, String(ownerId), true), await workshopLibrary(String(ownerId)))
    expect(active.statistics.defenses.resistances).toContain('fire')
    expect(active.magic.effects[0]!.active).toBe(true)
    await request(effectPath(), { token: write.token, body: await effectBody('trial-effect', false) })
    after = await current(); expect(after.spellcasting.activeEffects).toEqual(['second-effect'])
  })
  it('rejects unknown, unreviewed, aliased, ambiguous effects and broader spell writes', async () => {
    const write = await effectGrant(), body = await effectBody(), before = await current()
    for (const invalid of [{ ...body, id: 'foreign-effect' }, { ...body, id: 'unreviewed' }, { ...body, id: 'trial-alias' }, { ...body, id: '' }, { ...body, id: 'x'.repeat(301) }, { ...body, active: 'true' }, { ...body, activeEffects: [] }, { ...body, slots: {} }, { id: 'trial-effect', active: true }]) {
      await request(effectPath(), { token: write.token, body: invalid, expected: 400 })
    }
    expect(await current()).toEqual(before)
    try {
      await Character.updateOne({ _id: characterId }, { $set: { 'spellcasting.known': ['second-effect'] } })
      await request(effectPath(), { token: write.token, body: await effectBody(), expected: 400 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { 'spellcasting.known': before.spellcasting.known } }) }
    await Character.updateOne({ _id: characterId }, { $push: { compendiumRules: before.compendiumRules![0] } })
    try { await request(effectPath(), { token: write.token, body: await effectBody(), expected: 400 }) }
    finally { await Character.updateOne({ _id: characterId }, { $set: { compendiumRules: before.compendiumRules } }) }
  })
  it('guards effect races, assignment changes, owner changes, DM access and revocation', async () => {
    const write = await effectGrant(), body = await effectBody()
    const responses = await Promise.all([true, false].map(active => fetch(base + effectPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, active }) })))
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    await request(`/characters/${unassignedId}/effects`, { token: write.token, body: await effectBody(), expected: 404 })
    try {
      await Room.updateOne({ _id: roomId }, { $set: { assignments: [] } })
      await request(effectPath(), { token: write.token, body: await effectBody(), expected: 404 })
    } finally { await Room.updateOne({ _id: roomId }, { $set: { assignments: [{ characterId, userId: playerId }] } }) }
    try {
      await Character.updateOne({ _id: characterId }, { $set: { userId: playerId } })
      await request(effectPath(), { token: write.token, body: await effectBody(), expected: 404 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { userId: ownerId } }) }
    await Character.updateOne({ _id: unassignedId }, { $set: { compendiumRules: effectRules(), 'spellcasting.known': ['trial-effect'], 'spellcasting.activeEffects': [] } })
    const dm = await effectGrant(true), other = await Character.findById(unassignedId).lean().orFail()
    expect((await request(`/characters/${unassignedId}/effects`, { token: dm.token, body: { expectedUpdatedAt: other.updatedAt.toISOString(), id: 'trial-effect', active: true } })).data.effectChange.active).toBe(true)
    await request('/session/revoke', { token: write.token, body: {} })
    await request(effectPath(), { token: write.token, body: await effectBody(), expected: 401 })
  })


  const featurePath = () => `/characters/${characterId}/features`
  const pinGrant = (owner = false, hp = false) => grant(hp, owner, false, false, false, false, false, false, false, false, true)
  const featureBody = async (id: string, pinned = true) => ({ expectedUpdatedAt: await revision(), id, pinned })
  it('requires independent immutable feature-pin consent', async () => {
    const old = await grant(true, false, true, true, true, true, true, true, true, true)
    expect((await request('/session', { token: old.token })).data.capabilities.featuresWrite).toBe(false)
    await request(featurePath(), { token: old.token, body: await featureBody('a'.repeat(24)), expected: 403 })
    const pending = await pair()
    await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(roomId), featuresWrite: true } })
    const redeemed = await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 201 })
    const record = await ExtensionSession.findOne({ tokenHash: proofHash(redeemed.data.token) }).orFail(); sessions.push(record._id); expect(record.featuresWrite).toBe(false)
    const write = await pinGrant()
    expect((await request('/session', { token: write.token })).data.capabilities).toMatchObject({ featuresWrite: true, effectsWrite: false, hpWrite: false, inventoryWrite: false })
    expect((await request('/approval/connections', { website: true })).data.connections.find((c: { id: string }) => c.id === String(write.id)).featuresWrite).toBe(true)
    const requested = await pair(false, false, false, false, false, false, false, false, false, true)
    expect((await request(`/approval/context?request=${requested.id}`, { website: true })).data.pairing.featuresWrite).toBe(true)
    await request(hpPath(), { token: write.token, body: { expectedUpdatedAt: await revision(), hpCurrent: 1 }, expected: 403 })
    await request(effectPath(), { token: write.token, body: await effectBody(), expected: 403 })
  })
  it('pins and unpins one saved feature without rewriting resolved content or other state', async () => {
    await Character.updateOne({ _id: characterId }, { $set: { features: [{ name: 'Trial focus', description: 'Raw saved description', origin: 'other', selectedOptions: ['A'], order: 7 }, { name: 'Other feature', description: 'Keep', pinned: true, order: 2 }] } })
    const write = await pinGrant(), before = await current(), id = String(before.features[0]!._id), body = await featureBody(id)
    const result = await request(featurePath(), { token: write.token, body }); expect(result.data.featureChange).toEqual({ id, pinned: true })
    await request(featurePath(), { token: write.token, body, expected: 409 })
    let after = await current()
    expect(after.features).toEqual([{ ...before.features[0], pinned: true }, before.features[1]])
    for (const field of ['combat', 'spellcasting', 'resources', 'equipment', 'compendiumRules', 'meta', 'personality'] as const) expect(after[field]).toEqual(before[field])
    const site = await fetch(`http://127.0.0.1:4008/api/rooms/${roomId}/characters/${characterId}?view=quick`, { headers: { Cookie: cookie, Origin: websiteOrigin } })
    expect(site.status).toBe(200); expect((await site.json() as { character: { features: { pinned: boolean }[] } }).character.features[0]!.pinned).toBe(true)
    expect((await request(featurePath(), { token: write.token, body: await featureBody(id, false) })).data.featureChange).toEqual({ id, pinned: false })
    after = await current(); expect(after.features).toEqual([{ ...before.features[0], pinned: false }, before.features[1]])
  })
  it('rejects arbitrary, ambiguous features and broader feature edits', async () => {
    const write = await pinGrant(), before = await current(), id = String(before.features[0]!._id), body = await featureBody(id)
    for (const invalid of [{ ...body, id: 'missing' }, { ...body, id: 'a'.repeat(24) }, { ...body, pinned: 1 }, { ...body, order: 4 }, { ...body, description: 'Changed' }, { ...body, features: [] }, { id, pinned: true }]) await request(featurePath(), { token: write.token, body: invalid, expected: 400 })
    expect(await current()).toEqual(before)
    await Character.updateOne({ _id: characterId }, { $push: { features: before.features[0] } })
    try { await request(featurePath(), { token: write.token, body: await featureBody(id), expected: 400 }) }
    finally { await Character.updateOne({ _id: characterId }, { $set: { features: before.features } }) }
  })
  it('guards feature/HP races, assignment, character ownership, DM unassigned access and revocation', async () => {
    const write = await pinGrant(false, true), before = await current(), id = String(before.features[0]!._id), body = await featureBody(id)
    const responses = await Promise.all([
      fetch(base + featurePath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      fetch(base + hpPath(), { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${write.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: body.expectedUpdatedAt, hpCurrent: 6 }) }),
    ])
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    await request(`/characters/${unassignedId}/features`, { token: write.token, body: await featureBody(id), expected: 404 })
    try {
      await Room.updateOne({ _id: roomId }, { $set: { assignments: [] } }); await request(featurePath(), { token: write.token, body: await featureBody(id), expected: 404 })
    } finally { await Room.updateOne({ _id: roomId }, { $set: { assignments: [{ characterId, userId: playerId }] } }) }
    try {
      await Character.updateOne({ _id: characterId }, { $set: { userId: playerId } }); await request(featurePath(), { token: write.token, body: await featureBody(id), expected: 404 })
    } finally { await Character.updateOne({ _id: characterId }, { $set: { userId: ownerId } }) }
    await Character.updateOne({ _id: unassignedId }, { $set: { features: [{ name: 'DM feature', description: 'Unassigned trial' }] } })
    const dm = await pinGrant(true), other = await Character.findById(unassignedId).lean().orFail()
    expect((await request(`/characters/${unassignedId}/features`, { token: dm.token, body: { expectedUpdatedAt: other.updatedAt.toISOString(), id: String(other.features[0]!._id), pinned: true } })).data.featureChange.pinned).toBe(true)
    await request('/session/revoke', { token: write.token, body: {} }); await request(featurePath(), { token: write.token, body: await featureBody(id), expected: 401 })
  })
  it('enforces the production trial ceiling, exact room and epoch independently of client controls', async () => {
    const originalBase = base
    const ordinaryGrant = await grant(true)
    const before = JSON.stringify(await Character.find({ userId: ownerId }).sort({ _id: 1 }).lean())
    const trial = await createExtensionApp({ websiteOrigin, extensionOrigins: [origin], readOnlyTrial: { roomId: String(roomId), epoch: 'trial-lifecycle-fixture' } })
    const listener = trial.listen(0, '127.0.0.1'); await new Promise<void>(resolve => listener.once('listening', resolve))
    base = `http://127.0.0.1:${(listener.address() as { port: number }).port}/api/extension/v1`
    try {
      await request('/session', { token: ordinaryGrant.token, expected: 401 })
      const context = await request('/approval/context', { website: true })
      expect(context.data.rooms.map((room: { id: string }) => room.id)).toEqual([String(roomId)])
      for (const flag of ['hpWrite', 'slotsWrite', 'tempHpWrite', 'resourcesWrite', 'combatWrite', 'equipmentWrite', 'preparationWrite', 'inventoryWrite', 'effectsWrite', 'featuresWrite']) await request('/pairings', { body: { challenge: proofHash(random()), [flag]: true }, expected: 403 })
      const pending = await pair()
      await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(new mongoose.Types.ObjectId()) }, expected: 403 })
      await request(`/approval/pairings/${pending.id}/approve`, { website: true, body: { roomId: String(roomId) } })
      const redeemed = await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 201 })
      const token = redeemed.data.token as string
      const session = await ExtensionSession.findOne({ tokenHash: proofHash(token) }).orFail(); sessions.push(session._id)
      expect((await request('/session', { token })).data.characters.map((character: { id: string }) => character.id)).toEqual([String(characterId)])
      await request(`/characters/${characterId}`, { token })
      await request(`/characters/${unassignedId}`, { token, expected: 404 })
      for (const action of ['hp', 'slots', 'temp-hp', 'resources', 'combat', 'equipment', 'preparation', 'inventory', 'effects', 'features', 'future-command']) await request(`/characters/${characterId}/${action}`, { token, body: {}, expected: 403 })
      await ExtensionSession.updateOne({ _id: session._id }, { $set: { hpWrite: true } })
      await request('/session', { token, expected: 403 })
      await ExtensionSession.updateOne({ _id: session._id }, { $set: { hpWrite: false, trialEpoch: 'old-lifecycle-fixture' } })
      await request('/session', { token, expected: 401 })
      await ExtensionPairing.updateOne({ _id: pending.id }, { $set: { state: 'approved', trialEpoch: 'old-lifecycle-fixture' } })
      await request(`/pairings/${pending.id}/redeem`, { body: { proof: pending.proof }, expected: 410 })
      expect(JSON.stringify(await Character.find({ userId: ownerId }).sort({ _id: 1 }).lean())).toBe(before)
    } finally { base = originalBase; await new Promise<void>(resolve => listener.close(() => resolve())) }
  })
  it('separates play and read-only approvals even with the same epoch, and keeps explicit write permissions', async () => {
    const originalBase = base, scope = { roomId: String(roomId), epoch: 'mode-boundary-fixture' }
    const listeners: Server[] = []
    const open = async (mode: 'play' | 'read') => {
      const app = await createExtensionApp({ websiteOrigin, extensionOrigins: [origin], ...(mode === 'play' ? { playTrial: scope } : { readOnlyTrial: scope }) })
      const listener = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => listener.once('listening', resolve)); listeners.push(listener)
      return `http://127.0.0.1:${(listener.address() as { port: number }).port}/api/extension/v1`
    }
    try {
      const playBase = await open('play'), readBase = await open('read')
      base = readBase
      const read = await grant()
      const pending = await pair()
      base = playBase
      await request('/session', { token: read.token, expected: 401 })
      await request(`/approval/context?request=${pending.id}`, { website: true, expected: 410 })
      const view = await grant()
      await request(`/characters/${characterId}/hp`, { token: view.token, body: {}, expected: 403 })
      const play = await grant(true)
      expect((await request('/session', { token: play.token })).data.capabilities).toMatchObject({ hpWrite: true, slotsWrite: false })
      const snapshot = await Character.findById(characterId).orFail().lean()
      await request(`/characters/${characterId}/hp`, { token: play.token, body: { expectedUpdatedAt: snapshot.updatedAt.toISOString(), hpCurrent: snapshot.combat.hpCurrent } })
      await request(`/characters/${characterId}/slots`, { token: play.token, body: {}, expected: 403 })
      await request(`/characters/${characterId}/future-command`, { token: play.token, body: {}, expected: 404 })
      base = readBase
      await request('/session', { token: play.token, expected: 401 })
      await request('/session', { token: view.token, expected: 401 })
      base = playBase
      await ExtensionSession.updateOne({ _id: play.id }, { $set: { trialEpoch: 'another-play-epoch' } })
      await request('/session', { token: play.token, expected: 401 })
      const context = await request('/approval/context', { website: true })
      expect(context.data.rooms.map((room: { id: string }) => room.id)).toEqual([String(roomId)])
    } finally {
      base = originalBase
      for (const listener of listeners) await new Promise<void>(resolve => listener.close(() => resolve()))
    }
  })
  it('denies a deleted account on the next read', async () => {
    const grantData = await grant(true, false, true, true, true, true, true, true, true, true, true)
    await User.deleteOne({ _id: playerId })
    await request('/session', { token: grantData.token, expected: 403 })
    await request(`/characters/${characterId}/hp`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), hpCurrent: 10 }, expected: 403 })
    await request(`/characters/${characterId}/slots`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), key: 'l1', action: 'spend' }, expected: 403 })
    await request(`/characters/${characterId}/temp-hp`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), hpTemp: 5 }, expected: 403 })
    await request(`/characters/${characterId}/resources`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'custom', action: 'spend' }, expected: 403 })
    await request(`/characters/${characterId}/combat`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), field: 'inspiration', value: true }, expected: 403 })
    await request(`/characters/${characterId}/equipment`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), field: 'equipped', value: true }, expected: 403 })
    await request(`/characters/${characterId}/preparation`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'magic-missile', prepared: true }, expected: 403 })
    await request(`/characters/${characterId}/inventory`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), action: 'remove' }, expected: 403 })
    await request(`/characters/${characterId}/effects`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'trial-effect', active: true }, expected: 403 })
    await request(`/characters/${characterId}/features`, { token: grantData.token, body: { expectedUpdatedAt: new Date().toISOString(), id: 'a'.repeat(24), pinned: true }, expected: 403 })
  })

})
