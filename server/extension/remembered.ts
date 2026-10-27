import { Router } from 'express'
import type { Types } from 'mongoose'
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto'
import { z } from 'zod'
import { ExtensionFamily, ExtensionRenewal, ExtensionSession } from './models'
import { User } from '../models/User'
import { Room } from '../models/Room'
import { requestLimit } from '../middleware/request-limit'

export const connectionKind = z.enum(['remembered', 'session', 'long-session'])
const opaque = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
export const publicKeySchema = z.object({ kty: z.literal('EC'), crv: z.literal('P-256'), x: opaque, y: opaque }).strict()
const random = () => randomBytes(32).toString('base64url')
const hash = (value: string) => createHash('sha256').update(value).digest('base64url')
export const grantFlags = ['details', 'hpWrite', 'slotsWrite', 'tempHpWrite', 'resourcesWrite', 'combatWrite', 'equipmentWrite', 'preparationWrite', 'inventoryWrite', 'effectsWrite', 'featuresWrite'] as const
type Grant = { [K in typeof grantFlags[number]]?: boolean }
export function flags(value: Grant) { return Object.fromEntries(grantFlags.map(key => [key, value[key] === true])) }
export function validPublicKey(value: unknown): string | null {
  const parsed = publicKeySchema.safeParse(value)
  if (!parsed.success) return null
  try { createPublicKey({ key: parsed.data, format: 'jwk' }); return JSON.stringify(parsed.data) } catch { return null }
}
export function renewalTranscript(audience: string, origin: string, family: string, challenge: string, nonce: string, action: 'renew' | 'disconnect') {
  return JSON.stringify(['codex-sheet-renewal-v1', audience, origin, family, challenge, nonce, action])
}
type Boundary = { enabled: boolean; websiteOrigin: string; scope: object; record: object; roomId?: string; readOnly: boolean; now: () => Date }
export function rememberedBoundary(boundary: Boundary) {
  const { enabled, scope, record, now } = boundary
  const query = (id: string, origin: string) => ({ _id: id, ...scope, origin, ...(boundary.roomId ? { roomId: boundary.roomId } : {}), revokedAt: null, expiresAt: { $gt: now() } })
  const find = async (id: string, origin: string) => {
    if (!enabled) return null
    const family = await ExtensionFamily.findOne(query(id, origin)).lean()
    if (!family || boundary.readOnly && grantFlags.some(key => key.endsWith('Write') && family[key])) return null
    return family
  }
  const access = async (family: Grant & { _id: string; origin: string; kind: 'session' | 'remembered'; expiresAt: Date; userId: Types.ObjectId; roomId: Types.ObjectId; ownerId: Types.ObjectId }) => {
    const token = random(), expiresAt = new Date(Math.min(now().getTime() + 3600000, family.expiresAt.getTime()))
    await ExtensionSession.create({ ...record, ...flags(family), familyId: family._id, tokenHash: hash(token), origin: family.origin, scope: 'character:read', userId: family.userId, roomId: family.roomId, ownerId: family.ownerId, expiresAt })
    return { token, expiresAt, scope: 'character:read', connection: { id: family._id, kind: family.kind, expiresAt: family.expiresAt } }
  }
  const revoke = async (id: string) => {
    await ExtensionFamily.updateOne({ _id: id }, { $set: { revokedAt: now() } })
    await ExtensionSession.updateMany({ familyId: id }, { $set: { revokedAt: now() } })
  }
  const router = Router()
  router.use((_req, res, next) => enabled ? next() : res.status(404).json({ error: 'Remembered connections are unavailable.' }))
  router.post('/challenge', requestLimit('extension-renewal-challenge', 30, 60), async (req, res) => {
    const parsed = z.object({ familyId: opaque, action: z.enum(['renew', 'disconnect']) }).strict().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid renewal request.' })
    const family = await find(parsed.data.familyId, req.get('origin')!)
    if (!family) return res.status(401).json({ error: 'This remembered connection ended. Connect again.' })
    const id = random(), nonce = random(), expiresAt = new Date(now().getTime() + 60000)
    await ExtensionRenewal.create({ _id: id, familyId: family._id, nonceHash: hash(nonce), origin: family.origin, action: parsed.data.action, expiresAt })
    res.json({ id, nonce, expiresAt })
  })
  router.post('/:action', requestLimit('extension-renewal-proof', 30, 60), async (req, res) => {
    const action = req.params.action
    if (action !== 'renew' && action !== 'disconnect') return res.status(404).json({ error: 'Unknown connection command.' })
    const parsed = z.object({ familyId: opaque, challengeId: opaque, nonce: opaque, signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/) }).strict().safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Invalid browser proof.' })
    const { familyId, challengeId, nonce, signature } = parsed.data
    const family = await find(familyId, req.get('origin')!)
    if (!family) return res.status(401).json({ error: 'This remembered connection ended. Connect again.' })
    let verified = false
    try {
      const key = createPublicKey({ key: JSON.parse(family.publicKey), format: 'jwk' })
      const bytes = Buffer.from(signature, 'base64url')
      verified = bytes.toString('base64url') === signature && verify('sha256', Buffer.from(renewalTranscript(boundary.websiteOrigin, family.origin, familyId, challengeId, nonce, action)), { key, dsaEncoding: 'ieee-p1363' }, bytes)
    } catch { /* Invalid keys/signatures cannot turn into a server error. */ }
    if (!verified) return res.status(401).json({ error: 'The browser proof is invalid. Connect again.' })
    const claimed = await ExtensionRenewal.findOneAndUpdate({ _id: challengeId, familyId, origin: family.origin, action, nonceHash: hash(nonce), usedAt: null, expiresAt: { $gt: now() } }, { $set: { usedAt: now() } })
    if (!claimed) return res.status(401).json({ error: 'This renewal proof expired or was already used.' })
    if (action === 'disconnect') { await revoke(familyId); return res.json({ ok: true }) }
    const [user, room] = await Promise.all([
      User.exists({ _id: family.userId }),
      Room.exists({ _id: family.roomId, ownerId: family.ownerId, $or: [{ ownerId: family.userId }, { members: family.userId }] }),
    ])
    if (!user || !room) return res.status(403).json({ error: 'Website account or room access has ended.' })
    // Revocation racing issuance may leave an unusable row; every use rechecks the family.
    if (!await find(familyId, family.origin)) return res.status(401).json({ error: 'This remembered connection ended.' })
    res.status(201).json(await access(family))
  })
  return { router, find, access, revoke }
}
