import express, { type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { isValidObjectId } from 'mongoose'
import { z } from 'zod'
import { env } from '../env'
import { requireAuth } from '../middleware/auth'
import { requestLimit } from '../middleware/request-limit'
import { Room } from '../models/Room'
import { Character } from '../models/Character'
import { User } from '../models/User'
import { characterOutput } from '../lib/character-output'
import { workshopLibrary } from '../lib/workshop-library'
import { identity, vitals, expandedSheet } from './sheet'
import { ExtensionPairing, ExtensionSession, ExtensionFamily, ExtensionRenewal } from './models'
import { connectionKind, flags, rememberedBoundary, validPublicKey, publicKeySchema } from './remembered'
import { approvalPage } from './approval-page'
import { applyPlayUpdate, playUpdateSchema } from '../lib/play-update'
import { availableBenefitSpells } from '../../shared/rule-benefits'
import { itemKind } from '../../shared/item-rules'
import { duringInitialization } from './initialization-diagnostic'

const opaque = z.string().regex(/^[A-Za-z0-9_-]{43}$/)
const secret = () => randomBytes(32).toString('base64url')
export const proofHash = (value: string) => createHash('sha256').update(value).digest('base64url')
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
const fail = (res: Response, status: number, error: string) => res.status(status).json({ error })

/** Explicit HTTP boundary. Ordinary app routes and cookie/write policies stay unchanged. */
export async function createExtensionApp(options: { websiteOrigin: string; extensionOrigins: string[]; readOnlyTrial?: { roomId: string; epoch: string }; playTrial?: { roomId: string; epoch: string }; rememberedConnections?: boolean; clock?: () => number }) {
  if (options.readOnlyTrial && options.playTrial) throw new Error('Choose one production access mode.')
  const fresh = () => new Date(options.clock?.() ?? Date.now())
  const trial = options.readOnlyTrial ?? options.playTrial
  const readOnly = !!options.readOnlyTrial
  if (trial && (!/^[a-f0-9]{24}$/.test(trial.roomId) || !/^[A-Za-z0-9_-]{16,64}$/.test(trial.epoch))) throw new Error('Invalid production connection boundary.')
  // Play approval never reuses read-only, local/staging or different-epoch grants.
  const trialScope = trial ? { trialEpoch: trial.epoch, trialMode: options.playTrial ? 'play-controls' as const : { $exists: false } } : { trialEpoch: { $exists: false }, trialMode: { $exists: false } }
  const trialRecord = trial ? { trialEpoch: trial.epoch, ...(options.playTrial ? { trialMode: 'play-controls' } : {}) } : {}
  const hasWrites = (value: object) => Object.entries(value).some(([key, enabled]) => key.endsWith('Write') && enabled === true)
  const websiteOrigin = new URL(options.websiteOrigin).origin
  const origins = new Set(options.extensionOrigins.map(value => new URL(value).origin))
  if (origins.has(websiteOrigin)) throw new Error('Website and extension origins must be distinct.')
  await Promise.all([duringInitialization('pairing-indexes', () => ExtensionPairing.init()), duringInitialization('session-indexes', () => ExtensionSession.init())])
  if (options.rememberedConnections) await Promise.all([duringInitialization('family-indexes', () => ExtensionFamily.init()), duringInitialization('renewal-indexes', () => ExtensionRenewal.init())])
  const remembered = rememberedBoundary({ enabled: options.rememberedConnections === true, websiteOrigin, scope: trialScope, record: trialRecord, roomId: trial?.roomId, readOnly, now: fresh })
  const app = express()
  app.disable('x-powered-by')
  app.use((_req, res, next) => {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' })
    next()
  })
  app.get('/owlbear/connect', (_req, res) => {
    const nonce = randomBytes(18).toString('base64')
    res.set('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`)
    res.type('html').send(approvalPage(nonce))
  })
  const root = '/api/extension/v1'
  const approval = express.Router()
  approval.use(cookieParser(), requireAuth)
  // Account-specific CSRF proof is returned only to the normal website page.
  const csrf = (userId: string) => createHmac('sha256', env.JWT_SECRET).update(`extension-approval:${userId}`).digest('base64url')
  approval.use((req, res, next) => {
    if (req.get('sec-fetch-site') === 'cross-site' || req.get('origin') && req.get('origin') !== websiteOrigin) return fail(res, 403, 'Approve connections from the website itself.')
    if (req.method !== 'GET' && (req.get('origin') !== websiteOrigin || !same(req.get('x-extension-csrf') ?? '', csrf(req.userId!)))) return fail(res, 403, 'Refresh the approval page before continuing.')
    next()
  }, express.json({ limit: '2kb' }))
  approval.get('/context', async (req, res) => {
    const user = await User.findById(req.userId).select('displayName').lean()
    if (!user) return fail(res, 401, 'Sign in to the website, then check sign-in here.')
    let pairing
    if (req.query.request !== undefined) {
      const parsed = opaque.safeParse(req.query.request)
      if (!parsed.success) return fail(res, 400, 'This connection link is invalid.')
      pairing = await ExtensionPairing.findOne({ _id: parsed.data, ...trialScope, state: 'pending', expiresAt: { $gt: fresh() } }).lean()
      if (!pairing) return fail(res, 410, 'This request ended. Start Connect account again in your sheet.')
    }
    const rooms = await Room.find({ ...(trial ? { _id: trial.roomId } : {}), $or: [{ ownerId: req.userId }, { members: req.userId }] }).select('name ownerId').lean()
    res.json({ csrf: csrf(req.userId!), account: { id: String(user._id), displayName: user.displayName }, rooms: rooms.map(room => ({ id: String(room._id), name: room.name, role: String(room.ownerId) === req.userId ? 'dm' : 'player' })), ...(pairing ? { pairing: { ...(pairing.connectionKind ? { connectionKind: pairing.connectionKind } : {}), details: pairing.details === true, hpWrite: pairing.hpWrite === true, slotsWrite: pairing.slotsWrite === true, tempHpWrite: pairing.tempHpWrite === true, resourcesWrite: pairing.resourcesWrite === true, combatWrite: pairing.combatWrite === true, equipmentWrite: pairing.equipmentWrite === true, preparationWrite: pairing.preparationWrite === true, inventoryWrite: pairing.inventoryWrite === true, effectsWrite: pairing.effectsWrite === true, featuresWrite: pairing.featuresWrite === true, code: pairing.code, origin: pairing.origin, expiresAt: pairing.expiresAt } } : {}) })
  })
  approval.post('/pairings/:id/approve', requestLimit('extension-approval', 30, 900), async (req, res) => {
    if (!opaque.safeParse(req.params.id).success || !isValidObjectId(req.body.roomId)) return fail(res, 400, 'Choose a valid room.')
    if (trial && req.body.roomId !== trial.roomId) return fail(res, 403, 'This connection is limited to the selected party.')
    const room = await Room.findOne({ _id: req.body.roomId, $or: [{ ownerId: req.userId }, { members: req.userId }] }).lean()
    if (!room) return fail(res, 404, 'Room access is unavailable.')
    const updated = await ExtensionPairing.findOneAndUpdate({ _id: req.params.id, ...trialScope, state: 'pending', expiresAt: { $gt: fresh() } }, { $set: { state: 'approved', userId: req.userId, roomId: room._id, ownerId: room.ownerId } })
    if (!updated) return fail(res, 410, 'This request ended. Start Connect account again.')
    res.json({ ok: true })
  })
  approval.post('/pairings/:id/deny', async (req, res) => {
    if (!opaque.safeParse(req.params.id).success) return fail(res, 400, 'Invalid request.')
    await ExtensionPairing.updateOne({ _id: req.params.id, state: 'pending', expiresAt: { $gt: fresh() } }, { $set: { state: 'denied' } })
    res.json({ ok: true })
  })
  approval.get('/connections', async (req, res) => {
    const sessions = await ExtensionSession.find({ familyId: { $exists: false }, userId: req.userId, revokedAt: null, expiresAt: { $gt: fresh() } }).select('roomId origin expiresAt hpWrite slotsWrite tempHpWrite resourcesWrite combatWrite equipmentWrite preparationWrite inventoryWrite effectsWrite featuresWrite').sort({ createdAt: -1 }).lean()
    const families = await ExtensionFamily.find({ userId: req.userId, revokedAt: null, expiresAt: { $gt: fresh() } }).lean()
    const records = [...sessions, ...families.map(item => ({ ...item, family: true }))]
    const rooms = await Room.find({ _id: { $in: records.map(item => item.roomId) }, $or: [{ ownerId: req.userId }, { members: req.userId }] }).select('name').lean()
    res.json({ connections: records.map(item => ({ id: String(item._id), ...('family' in item ? { kind: item.kind } : {}), roomName: rooms.find(room => String(room._id) === String(item.roomId))?.name ?? 'Room access ended', origin: item.origin, hpWrite: item.hpWrite === true, slotsWrite: item.slotsWrite === true, tempHpWrite: item.tempHpWrite === true, resourcesWrite: item.resourcesWrite === true, combatWrite: item.combatWrite === true, equipmentWrite: item.equipmentWrite === true, preparationWrite: item.preparationWrite === true, inventoryWrite: item.inventoryWrite === true, effectsWrite: item.effectsWrite === true, featuresWrite: item.featuresWrite === true, expiresAt: item.expiresAt })) })
  })
  approval.post('/connections/:id/revoke', async (req, res) => {
    if (opaque.safeParse(req.params.id).success) {
      if (await ExtensionFamily.exists({ _id: req.params.id, userId: req.userId })) await remembered.revoke(req.params.id as string)
      return res.json({ ok: true })
    }
    if (!isValidObjectId(req.params.id)) return fail(res, 400, 'Invalid connection.')
    await ExtensionSession.updateOne({ _id: req.params.id, userId: req.userId }, { $set: { revokedAt: fresh() } })
    res.json({ ok: true })
  })
  app.use(`${root}/approval`, approval)
  const client = express.Router()
  client.use((req, res, next) => {
    const origin = req.get('origin')
    res.vary('Origin')
    if (!origin || !origins.has(origin)) return fail(res, 403, 'This sheet origin is not allowed.')
    res.set('Access-Control-Allow-Origin', origin)
    if (req.method === 'OPTIONS') {
      const headers = (req.get('access-control-request-headers') ?? '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean)
      if (!['GET', 'POST'].includes(req.get('access-control-request-method') ?? '') || headers.some(value => !['authorization', 'content-type'].includes(value))) return fail(res, 403, 'Request is not allowed.')
      res.set({ 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' })
      return res.sendStatus(204)
    }
    if (!['GET', 'POST'].includes(req.method)) return fail(res, 405, 'This extension method is not allowed.')
    next()
  }, express.json({ limit: '2kb' }))
  client.use('/connections', remembered.router)
  client.post('/pairings', requestLimit('extension-pairing', 15, 900), async (req, res) => {
    const parsed = z.object({ connectionKind: connectionKind.optional(), publicKey: publicKeySchema.optional(), challenge: opaque, details: z.boolean().optional(), hpWrite: z.boolean().optional(), slotsWrite: z.boolean().optional(), tempHpWrite: z.boolean().optional(), resourcesWrite: z.boolean().optional(), combatWrite: z.boolean().optional(), equipmentWrite: z.boolean().optional(), preparationWrite: z.boolean().optional(), inventoryWrite: z.boolean().optional(), effectsWrite: z.boolean().optional(), featuresWrite: z.boolean().optional() }).strict().safeParse(req.body)
    if (!parsed.success) return fail(res, 400, 'Invalid connection proof.')
    if (parsed.data.connectionKind && !options.rememberedConnections) return fail(res, 403, 'Longer connections are unavailable in this release.')
    const publicKey = parsed.data.publicKey ? validPublicKey(parsed.data.publicKey) : null
    if ((parsed.data.connectionKind && parsed.data.connectionKind !== 'long-session') ? !publicKey : parsed.data.publicKey !== undefined) return fail(res, 400, 'Choose a valid browser-bound connection.')
    if (readOnly && hasWrites(parsed.data)) return fail(res, 403, 'Character changes are disabled for this read-only trial.')
    const id = secret(), code = randomBytes(4).toString('hex').toUpperCase()
    const expiresAt = new Date(fresh().getTime() + 5 * 60_000)
    await ExtensionPairing.create({ ...trialRecord, ...(parsed.data.connectionKind ? { connectionKind: parsed.data.connectionKind, ...(publicKey ? { publicKey } : {}) } : {}), _id: id, challenge: parsed.data.challenge, details: parsed.data.details === true, hpWrite: parsed.data.hpWrite === true, slotsWrite: parsed.data.slotsWrite === true, tempHpWrite: parsed.data.tempHpWrite === true, resourcesWrite: parsed.data.resourcesWrite === true, combatWrite: parsed.data.combatWrite === true, equipmentWrite: parsed.data.equipmentWrite === true, preparationWrite: parsed.data.preparationWrite === true, inventoryWrite: parsed.data.inventoryWrite === true, effectsWrite: parsed.data.effectsWrite === true, featuresWrite: parsed.data.featuresWrite === true, origin: req.get('origin'), code, state: 'pending', expiresAt })
    res.status(201).json({ id, code, expiresAt, approvalUrl: `${websiteOrigin}/owlbear/connect?request=${id}` })
  })
  client.post('/pairings/:id/redeem', requestLimit('extension-poll', 240, 60), async (req, res) => {
    const parsed = z.object({ proof: opaque }).strict().safeParse(req.body)
    if (!opaque.safeParse(req.params.id).success || !parsed.success) return fail(res, 400, 'Invalid connection proof.')
    const query = { ...trialScope, _id: req.params.id, challenge: proofHash(parsed.data.proof), origin: req.get('origin'), expiresAt: { $gt: fresh() } }
    const pairing = await ExtensionPairing.findOne(query).lean()
    if (!pairing || pairing.state === 'consumed') return fail(res, 410, 'This request ended. Connect again.')
    if (pairing.state === 'denied') return fail(res, 403, 'Connection denied on the website.')
    if (pairing.state === 'pending') return res.status(202).json({ status: 'pending' })
    if (!pairing.userId || !pairing.roomId || !pairing.ownerId) return fail(res, 410, 'This approval is incomplete. Connect again.')
    if (trial && (String(pairing.roomId) !== trial.roomId || readOnly && hasWrites(pairing))) return fail(res, 403, 'This approval is outside the current connection scope.')
    // One atomic redemption; all racing/replayed requests lose the claim.
    const claimed = await ExtensionPairing.findOneAndUpdate({ ...query, state: 'approved' }, { $set: { state: 'consumed' } })
    if (!claimed) return fail(res, 410, 'This request has already been used.')
    if (pairing.connectionKind && !options.rememberedConnections) return fail(res, 403, 'Longer connections are unavailable in this release.')
    if (pairing.connectionKind && pairing.connectionKind !== 'long-session') {
      const family = await ExtensionFamily.create({ ...trialRecord, ...flags(pairing), _id: secret(), origin: pairing.origin, userId: pairing.userId, roomId: pairing.roomId, ownerId: pairing.ownerId, publicKey: pairing.publicKey!, kind: pairing.connectionKind, expiresAt: new Date(fresh().getTime() + (pairing.connectionKind === 'remembered' ? 30 * 24 : 12) * 3600000) })
      return res.status(201).json(await remembered.access(family.toObject()))
    }
    const token = secret(), expiresAt = new Date(fresh().getTime() + (pairing.connectionKind === 'long-session' ? 12 : 1) * 3600000)
    await ExtensionSession.create({ ...trialRecord, tokenHash: proofHash(token), origin: pairing.origin, scope: 'character:read', details: pairing.details === true, hpWrite: pairing.hpWrite === true, slotsWrite: pairing.slotsWrite === true, tempHpWrite: pairing.tempHpWrite === true, resourcesWrite: pairing.resourcesWrite === true, combatWrite: pairing.combatWrite === true, equipmentWrite: pairing.equipmentWrite === true, preparationWrite: pairing.preparationWrite === true, inventoryWrite: pairing.inventoryWrite === true, effectsWrite: pairing.effectsWrite === true, featuresWrite: pairing.featuresWrite === true, userId: pairing.userId, roomId: pairing.roomId, ownerId: pairing.ownerId, expiresAt })
    res.status(201).json({ token, expiresAt, scope: 'character:read' })
  })
  client.post('/pairings/:id/cancel', async (req, res) => {
    const parsed = z.object({ proof: opaque }).strict().safeParse(req.body)
    if (!opaque.safeParse(req.params.id).success || !parsed.success) return fail(res, 400, 'Invalid request.')
    await ExtensionPairing.updateOne({ _id: req.params.id, challenge: proofHash(parsed.data.proof), origin: req.get('origin'), state: { $in: ['pending', 'approved'] } }, { $set: { state: 'denied' } })
    res.json({ ok: true })
  })
  client.use(async (req: Request, res, next) => {
    const token = req.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1]
    if (!token) return fail(res, 401, 'Connect your website account first.')
    const session = await ExtensionSession.findOne({ ...trialScope, ...(trial ? { roomId: trial.roomId } : {}), tokenHash: proofHash(token), origin: req.get('origin'), scope: 'character:read', revokedAt: null, expiresAt: { $gt: fresh() } }).lean()
    if (!session) return fail(res, 401, 'This connection expired or was revoked. Connect again.')
    if (session.familyId) {
      const family = await remembered.find(session.familyId, req.get('origin')!)
      if (!family || ['userId', 'roomId', 'ownerId'].some(key => String(family[key as 'userId']) !== String(session[key as 'userId'])) || Object.entries(flags(family)).some(([key, value]) => value !== (session[key as 'details'] === true))) return fail(res, 401, 'This remembered connection ended. Connect again.')
      res.locals.family = family
    }
    if (readOnly && hasWrites(session)) return fail(res, 403, 'This connection is outside the read-only trial.')
    res.locals.extensionSession = session
    next()
  })
  client.post('/session/revoke', async (_req, res) => {
    if (res.locals.extensionSession.familyId) await remembered.revoke(res.locals.extensionSession.familyId)
    await ExtensionSession.updateOne({ _id: res.locals.extensionSession._id }, { $set: { revokedAt: fresh() } })
    res.json({ ok: true })
  })
  client.use(async (_req, res, next) => {
    const session = res.locals.extensionSession
    // Bind approval to the room's owner as well as its identity.
    const room = await Room.findOne({ _id: session.roomId, ownerId: session.ownerId, $or: [{ ownerId: session.userId }, { members: session.userId }] }).lean()
    const user = await User.findById(session.userId).select('displayName').lean()
    if (!room || !user) return fail(res, 403, 'Website account or room access has ended.')
    res.locals.connection = { session, room, user, dm: String(room.ownerId) === String(user._id) }
    next()
  })
  client.get('/session', async (_req, res) => {
    const { session, room, user, dm } = res.locals.connection
    const allowed = room.assignments.filter((item: { userId: unknown }) => String(item.userId) === String(user._id)).map((item: { characterId: unknown }) => item.characterId)
    const characters = await Character.find({ userId: room.ownerId, ...(dm ? {} : { _id: { $in: allowed } }) }).select('meta.name meta.klass meta.race meta.level').sort({ 'meta.name': 1 }).lean()
    res.json({ version: 1, scope: 'character:read', ...(res.locals.family ? { connection: { id: res.locals.family._id, kind: res.locals.family.kind, expiresAt: res.locals.family.expiresAt } } : {}), capabilities: { details: session.details === true, hpWrite: session.hpWrite === true, slotsWrite: session.slotsWrite === true, tempHpWrite: session.tempHpWrite === true, resourcesWrite: session.resourcesWrite === true, combatWrite: session.combatWrite === true, equipmentWrite: session.equipmentWrite === true, preparationWrite: session.preparationWrite === true, inventoryWrite: session.inventoryWrite === true, effectsWrite: session.effectsWrite === true, featuresWrite: session.featuresWrite === true }, expiresAt: session.expiresAt, account: { id: String(user._id), displayName: user.displayName }, room: { id: String(room._id), name: room.name, role: dm ? 'dm' : 'player' }, characters: characters.map(identity) })
  })
  client.get(['/characters/:id', '/characters/:id/references'], async (req, res) => {
    const { room, user, dm } = res.locals.connection
    if (!isValidObjectId(req.params.id) || !dm && !room.assignments.some((item: { characterId: unknown; userId: unknown }) => String(item.characterId) === req.params.id && String(item.userId) === String(user._id))) return fail(res, 404, 'Character access is unavailable.')
    const raw = await Character.findOne({ _id: req.params.id, userId: room.ownerId }).lean()
    if (!raw) return fail(res, 404, 'Character access is unavailable.')
    const expanded = req.path.endsWith('/references')
    if (expanded && res.locals.connection.session.details !== true) return fail(res, 403, 'Reconnect to approve expanded character details.')
    const started = performance.now()
    const resolved = await characterOutput(raw, String(room.ownerId), true)
    const output = expanded ? expandedSheet(resolved, await workshopLibrary(String(room.ownerId)), raw.features.map(item => String(item._id))) : vitals(resolved)
    // Explicit projections exclude raw imports, catalogs, emails and admin data.
    res.set('Server-Timing', `snapshot;dur=${(performance.now() - started).toFixed(1)}`)
    res.json(output)
  })
  // Deny every character mutation, including future routes and legacy write grants.
  client.use('/characters', (req, res, next) => {
    if (readOnly && req.method !== 'GET') return fail(res, 403, 'Character changes are disabled for this read-only trial.')
    next()
  })
  client.post(['/characters/:id/hp', '/characters/:id/slots', '/characters/:id/temp-hp', '/characters/:id/resources', '/characters/:id/combat', '/characters/:id/equipment', '/characters/:id/preparation', '/characters/:id/inventory', '/characters/:id/effects', '/characters/:id/features'], requestLimit('extension-play', 120, 60), async (req, res) => {
    const { session, room, user, dm } = res.locals.connection
    const action = req.path.split('/').at(-1)!
    const grants = { hp: session.hpWrite, slots: session.slotsWrite, 'temp-hp': session.tempHpWrite, resources: session.resourcesWrite, combat: session.combatWrite, equipment: session.equipmentWrite, preparation: session.preparationWrite, inventory: session.inventoryWrite, effects: session.effectsWrite, features: session.featuresWrite }
    const labels = { hp: 'HP', slots: 'spell-slot', 'temp-hp': 'temporary HP', resources: 'resource-counter', combat: 'combat-tracker', equipment: 'equipment-state', preparation: 'spell-preparation', inventory: 'inventory-count', effects: 'spell-effect', features: 'feature-pin' }
    if (grants[action as keyof typeof grants] !== true) return fail(res, 403, `Reconnect and approve ${labels[action as keyof typeof labels]} changes before saving.`)
    if (!isValidObjectId(req.params.id) || !dm && !room.assignments.some((item: { characterId: unknown; userId: unknown }) => String(item.characterId) === req.params.id && String(item.userId) === String(user._id))) return fail(res, 404, 'Character access is unavailable.')
    // These commands cannot replace pools, maxima, definitions or whole characters.
    const revision = z.iso.datetime()
    const hp = action === 'hp' ? z.object({ expectedUpdatedAt: revision, hpCurrent: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict().safeParse(req.body) : undefined
    const temp = action === 'temp-hp' ? z.object({ expectedUpdatedAt: revision, hpTemp: z.number().int().min(0).max(9999) }).strict().safeParse(req.body) : undefined
    const slot = action === 'slots' ? z.object({ expectedUpdatedAt: revision, key: z.string().regex(/^l[1-9]$/), action: z.enum(['spend', 'restore']) }).strict().safeParse(req.body) : undefined
    const resource = action === 'resources' ? z.object({ expectedUpdatedAt: revision, id: z.string().min(1).max(200), action: z.enum(['spend', 'restore']) }).strict().safeParse(req.body) : undefined
    const combat = action === 'combat' ? z.discriminatedUnion('field', [
      z.object({ expectedUpdatedAt: revision, field: z.literal('inspiration'), value: z.boolean() }).strict(),
      z.object({ expectedUpdatedAt: revision, field: z.literal('hitDiceUsed'), value: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }).strict(),
      z.object({ expectedUpdatedAt: revision, field: z.enum(['deathSavesSuccess', 'deathSavesFailure']), value: z.number().int().min(0).max(3) }).strict(),
    ]).safeParse(req.body) : undefined
    const equipment = action === 'equipment' ? z.object({ expectedUpdatedAt: revision, id: z.string().regex(/^[a-f0-9]{24}$/i), field: z.enum(['equipped', 'attuned']), value: z.boolean() }).strict().safeParse(req.body) : undefined
    const preparation = action === 'preparation' ? z.object({ expectedUpdatedAt: revision, id: z.string().min(1).max(300), prepared: z.boolean() }).strict().safeParse(req.body) : undefined
    const feature = action === 'features' ? z.object({ expectedUpdatedAt: revision, id: z.string().regex(/^[a-f0-9]{24}$/i), pinned: z.boolean() }).strict().safeParse(req.body) : undefined
    const effects = action === 'effects' ? z.object({ expectedUpdatedAt: revision, id: z.string().min(1).max(300), active: z.boolean() }).strict().safeParse(req.body) : undefined
    const inventory = action === 'inventory' ? z.object({ expectedUpdatedAt: revision, id: z.string().regex(/^[a-f0-9]{24}$/i), action: z.enum(['add', 'remove']) }).strict().safeParse(req.body) : undefined
    const data = hp?.success ? hp.data : temp?.success ? temp.data : slot?.success ? slot.data : resource?.success ? resource.data : combat?.success ? combat.data : equipment?.success ? equipment.data : preparation?.success ? preparation.data : inventory?.success ? inventory.data : effects?.success ? effects.data : feature?.success ? feature.data : undefined
    if (!data) return fail(res, 400, 'Invalid play action. Choose a valid value or Spend/Restore command.')
    const raw = await Character.findOne({ _id: req.params.id, userId: room.ownerId }).lean()
    if (!raw) return fail(res, 404, 'Character access is unavailable.')
    const conflict = () => fail(res, 409, 'This sheet changed elsewhere. Review the refreshed values before trying again.')
    if (new Date(raw.updatedAt).toISOString() !== data.expectedUpdatedAt) return conflict()
    const before = await characterOutput(raw, String(room.ownerId), true)
    let set: Record<string, unknown>
    let push: Record<string, unknown> | undefined
    try {
      if (slot?.success) {
        const { key, action, expectedUpdatedAt } = slot.data
        const current = before.spellcasting.slots[key]
        if (!current || current.max <= 0) return fail(res, 400, 'This character has no slots at that level.')
        if (action === 'restore' && current.used <= 0) return fail(res, 400, 'There are no spent slots to restore at that level.')
        const used = current.used + (action === 'spend' ? 1 : -1)
        applyPlayUpdate(before, playUpdateSchema.parse({ expectedUpdatedAt, slots: [{ key, used }] }))
        // Keep saved maxima, spell preparation and every other level untouched.
        set = { [`spellcasting.slots.${key}.used`]: used }
      } else if (resource?.success) {
        const { id, action, expectedUpdatedAt } = resource.data
        const matches = (before.resources ?? []).filter(item => item.id === id)
        const current = matches[0]
        if (matches.length !== 1 || !current || current.unlimited || current.max <= 0) return fail(res, 400, 'This resource cannot be tracked with Spend or Restore.')
        if (action === 'restore' && current.used <= 0) return fail(res, 400, 'There are no spent uses to restore.')
        const used = current.used + (action === 'spend' ? 1 : -1)
        applyPlayUpdate(before, playUpdateSchema.parse({ expectedUpdatedAt, resources: [{ id, used }] }))
        // Update the saved counter only; do not persist resolved definitions over saved ones.
        const indices = raw.resources.flatMap((item, index) => item.id === id ? [index] : [])
        if (indices.length > 1) return fail(res, 400, 'This resource is ambiguous. Review it on the website.')
        set = {}
        if (indices.length) set[`resources.${indices[0]}.used`] = used
        else push = { resources: { ...current, used } } // First use of a website-derived pool.
      } else if (equipment?.success) {
        const { expectedUpdatedAt, id, field, value } = equipment.data
        const indices = raw.equipment.flatMap((item, index) => String(item._id) === id ? [index] : [])
        const item = before.equipment.find(item => String(item._id) === id)
        if (indices.length !== 1 || !item) return fail(res, 400, 'This item is unavailable. Refresh equipment.')
        if (value && item.qty <= 0) return fail(res, 400, 'This item has no available quantity.')
        if (field === 'attuned' && value && !item.requiresAttunement) return fail(res, 400, 'This item does not require attunement.')
        const validated = applyPlayUpdate(before, playUpdateSchema.parse({ expectedUpdatedAt, equipment: [{ id, qty: item.qty, equipped: item.equipped, [field]: value }] }))
        const changed = (validated.equipment as typeof before.equipment).find(item => String(item._id) === id)!
        // Retain raw definitions and quantities; persist only this item's approved state.
        set = { [`equipment.${indices[0]}.equipped`]: changed.equipped, [`equipment.${indices[0]}.attuned`]: !!changed.attuned, 'combat.itemAcBaseline': validated['combat.itemAcBaseline'] }
      } else if (inventory?.success) {
        const { expectedUpdatedAt, id, action } = inventory.data
        const indices = raw.equipment.flatMap((item, index) => String(item._id) === id ? [index] : [])
        const matches = before.equipment.filter(item => String(item._id) === id), item = matches[0]
        if (indices.length !== 1 || matches.length !== 1 || !item) return fail(res, 400, 'This item is unavailable. Refresh equipment.')
        if (!Number.isSafeInteger(item.qty) || item.qty < 0 || action === 'remove' && item.qty === 0 || action === 'add' && item.qty === Number.MAX_SAFE_INTEGER) return fail(res, 400, 'This inventory count cannot be adjusted further.')
        const qty = item.qty + (action === 'add' ? 1 : -1)
        // Zero/treasure counts are unequipped; replenishing never equips an empty entry.
        // Retain recorded attunement and let the website validate any reactivation.
        const equipped = item.qty > 0 && itemKind(item) !== 'treasure' && item.equipped
        const validated = applyPlayUpdate(before, playUpdateSchema.parse({ expectedUpdatedAt, equipment: [{ id, qty, equipped, attuned: !!item.attuned }] }))
        const changed = (validated.equipment as typeof before.equipment).find(item => String(item._id) === id)!
        set = { [`equipment.${indices[0]}.qty`]: changed.qty, [`equipment.${indices[0]}.equipped`]: changed.equipped, [`equipment.${indices[0]}.attuned`]: !!changed.attuned, 'combat.itemAcBaseline': validated['combat.itemAcBaseline'] }
      } else if (feature?.success) {
        const { expectedUpdatedAt, id, pinned } = feature.data
        const indices = raw.features.flatMap((item, index) => String(item._id) === id ? [index] : [])
        const matches = before.features.filter(item => String(item._id) === id)
        if (indices.length !== 1 || matches.length !== 1) return fail(res, 400, 'Choose an existing saved feature. Refresh the sheet.')
        const validated = applyPlayUpdate(before, playUpdateSchema.parse({ expectedUpdatedAt, features: [{ id, pinned }] }))
        const changed = (validated.features as typeof before.features).find(item => String(item._id) === id)!
        // Persist the selected flag only, preserving saved descriptions and rule metadata.
        set = { [`features.${indices[0]}.pinned`]: !!changed.pinned }
      } else if (effects?.success) {
        const { expectedUpdatedAt, id, active } = effects.data
        const eligible = availableBenefitSpells(before).filter(spell => spell.index === id)
        if (eligible.length !== 1) return fail(res, 400, 'Choose a reviewed spell effect already on this character.')
        const current = before.spellcasting.activeEffects ?? []
        const next = active ? [...new Set([...current, id])] : current.filter(value => value !== id)
        set = applyPlayUpdate(before, playUpdateSchema.parse({ expectedUpdatedAt, activeEffects: next }))
      } else if (preparation?.success) {
        const { expectedUpdatedAt, id, prepared } = preparation.data
        // Manual preparation only: no catalog additions, innate-only grants, casting or rest.
        const available = new Set([...before.spellcasting.known, ...before.spellcasting.prepared])
        if (!available.has(id)) return fail(res, 400, 'Only spells already known or prepared on this character can be changed.')
        const next = prepared ? [...new Set([...before.spellcasting.prepared, id])] : before.spellcasting.prepared.filter(index => index !== id)
        // Website behaviour retains formerly prepared references in known spells.
        set = applyPlayUpdate(before, playUpdateSchema.parse({ expectedUpdatedAt, prepared: next }))
      } else if (combat?.success) {
        const { expectedUpdatedAt, field, value } = combat.data
        set = applyPlayUpdate(before, playUpdateSchema.parse({ expectedUpdatedAt, combat: { [field]: value } }))
      } else if (temp?.success) {
        set = applyPlayUpdate(before, playUpdateSchema.parse({ expectedUpdatedAt: temp.data.expectedUpdatedAt, combat: { hpTemp: temp.data.hpTemp } }))
      } else if (hp?.success) {
        set = applyPlayUpdate(before, playUpdateSchema.parse({ expectedUpdatedAt: hp.data.expectedUpdatedAt, combat: { hpCurrent: hp.data.hpCurrent } }))
      } else return fail(res, 400, 'Invalid play action.')
    } catch (error) { return fail(res, 400, error instanceof Error ? error.message : 'Invalid play action.') }
    // Strictly advance the revision even for two saves in the same millisecond.
    set.updatedAt = new Date(Math.max(Date.now(), new Date(raw.updatedAt).getTime() + 1))
    const saved = await Character.findOneAndUpdate({ _id: raw._id, userId: room.ownerId, updatedAt: raw.updatedAt }, { $set: set, ...(push ? { $push: push } : {}) }, { new: true, runValidators: true, timestamps: false }).lean()
    if (!saved) return conflict()
    const resolved = await characterOutput(saved, String(room.ownerId), true)
    const changed = equipment?.success ? resolved.equipment.find(item => String(item._id) === equipment.data.id) : undefined
    const inventoryChanged = inventory?.success ? resolved.equipment.find(item => String(item._id) === inventory.data.id) : undefined
    res.json({ ...vitals(resolved), ...(feature?.success ? { featureChange: { id: feature.data.id, pinned: !!resolved.features.find(item => String(item._id) === feature.data.id)?.pinned } } : {}), ...(effects?.success ? { effectChange: { id: effects.data.id, active: !!resolved.spellcasting.activeEffects?.includes(effects.data.id) } } : {}), ...(inventoryChanged ? { inventoryChange: { id: inventory!.data!.id, quantity: inventoryChanged.qty, equipped: inventoryChanged.equipped, attuned: !!inventoryChanged.attuned } } : {}), ...(changed ? { equipmentChange: { id: equipment!.data!.id, equipped: changed.equipped, attuned: !!changed.attuned } } : {}), ...(preparation?.success ? { preparationChange: { id: preparation.data.id, prepared: resolved.spellcasting.prepared.includes(preparation.data.id) } } : {}) })
  })
  client.use((_req, res) => fail(res, 404, 'Extension route not found.'))
  app.use(root, client)
  app.use((_req, res) => fail(res, 404, 'Extension route not found.'))
  app.use((error: Error & { status?: number }, _req: Request, res: Response, _next: express.NextFunction) => {
    if (error.status === 400 || error.status === 413) return fail(res, error.status, 'Invalid extension request.')
    console.error('Extension API failed', { name: error.name })
    return fail(res, 503, 'The website connection is temporarily unavailable. Try again shortly.')
  })
  return app
}
