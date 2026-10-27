import {Router} from 'express'
import mongoose, {isValidObjectId, type ClientSession} from 'mongoose'
import {z} from 'zod'
import {RoomMap, MapAsset, MapQuota} from '../models/RoomMap'
import {Notebook} from '../models/Notebook'
import {CityLibrary} from '../models/CityLibrary'
import {requireAuth} from '../middleware/auth'
import {requestLimit} from '../middleware/request-limit'
import {libraryContext, libraryScope, libraryVisible, notebookScope, libraryFail as fail, RoomLibraryError, type LibraryContext} from '../lib/room-library-access'
import {MAP_LIMITS, PIN_VISIBILITIES, PIN_COLORS, PIN_SYMBOLS, PIN_LABELS, pinDisplay} from '../../shared/room-maps'
import {regionProblem} from '../../shared/map-regions'
import {recoverableModelInitialization} from '../lib/model-initialization'
import {withDatabaseStage} from '../lib/database-error'

const router = Router({mergeParams: true})
router.use(requireAuth)
const id = z.string().refine(isValidObjectId)
const draft = z.object({title: z.string().trim().min(1).max(120), audience: z.enum(['room','characters','dm']), characterIds: z.array(id).max(100).transform(ids => [...new Set(ids)])}).strict().refine(d => d.audience !== 'characters' || d.characterIds.length > 0, 'Choose at least one character.')
const pinStyle = z.object({visibility: z.enum(PIN_VISIBILITIES), color: z.enum(PIN_COLORS), symbol: z.enum(PIN_SYMBOLS), label: z.enum(PIN_LABELS)}).strict()
const pinDraft = z.object({label: z.string().trim().min(1).max(120), entryId: id, x: z.number().min(0).max(1), y: z.number().min(0).max(1), display: pinStyle.optional(), audience: z.enum(['room','characters','dm']).optional(), characterIds: z.array(id).max(100).transform(ids => [...new Set(ids)]).optional()}).strict().refine(p => (p.audience === undefined) === (p.characterIds === undefined), 'Send pin audience and characters together.').refine(p => p.audience !== 'characters' || !!p.characterIds?.length, 'Choose at least one character.')
const expected = z.number().int().min(1)
const regionDraft=z.object({id:z.uuid(),name:z.string().trim().min(1).max(120),color:z.string().regex(/^#[0-9a-f]{6}$/i),
  opacity:z.number().min(.05).max(.6),fadeZoom:z.number().min(1.3).max(3),
  points:z.array(z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).strict()).min(3).max(MAP_LIMITS.pointsPerRegion)
}).strict().superRefine((r,ctx)=>{const message=regionProblem(r.points);if(message)ctx.addIssue({code:'custom',message})})
const regionList=z.array(regionDraft).max(MAP_LIMITS.regionsPerMap).refine(list=>new Set(list.map(r=>r.id)).size===list.length,'Each region must have a unique identity.')
type MapRecord = mongoose.InferSchemaType<typeof RoomMap.schema> & {_id: mongoose.Types.ObjectId}
function parsed<T>(schema: z.ZodType<T>, body: unknown): T {const r = schema.safeParse(body); if (!r.success) return fail(400, r.error.issues[0]?.message ?? 'Invalid map values.'); return r.data}
function preview(req: import('express').Request) {
  if (req.query.previewCharacter === undefined) return undefined
  return parsed(id, req.query.previewCharacter)
}
const ctxFor = (req: import('express').Request, session?: ClientSession) => libraryContext(String(req.params.roomId), req.userId!, preview(req), session)
function dm(ctx: LibraryContext) {if (!ctx.dm || ctx.readOnly) fail(403, 'Only the DM can change maps. Player preview is read-only.')}
async function mapFor(value: unknown, ctx: LibraryContext, session?: ClientSession) {
  if (!isValidObjectId(value as string)) return fail(404, 'Map not found or access has ended.')
  const map = await RoomMap.findOne({_id: value, roomId: ctx.room._id, ...libraryScope(ctx)}).session(session ?? null).lean()
  if (!map) return fail(404, 'Map not found or access has ended.')
  return map
}
function summary(map: MapRecord, ctx: LibraryContext) {return {id: String(map._id), title: map.title, audience: map.audience,
  characterIds: map.characterIds.map(String).filter(id => ctx.dm || ctx.allowed.includes(id)), revision: map.revision,
  updatedAt: map.updatedAt.toISOString(), width: map.width, height: map.height, bytes: map.bytes}}
async function detail(map: MapRecord, ctx: LibraryContext) {
  // Old pins inherit room access; intersect pin and note/folder access for every player response.
  const visiblePins = map.pins.filter(p => libraryVisible({...p, audience: p.audience ?? 'room'}, ctx))
  const notes = await Notebook.find({_id: {$in: visiblePins.map(p => p.entryId)}, roomId: ctx.room._id, kind: 'entry', deletedAt: null, ...(await notebookScope(ctx))}).select('title').lean()
  const titles = new Map(notes.map(n => [String(n._id), n.title]))
  const cities = new Set((await CityLibrary.find({roomId: ctx.room._id, enabled: true, entryId: {$in: notes.map(n => n._id)}}).select('entryId').lean()).map(c => String(c.entryId)))
  return {...summary(map, ctx), regions:map.regions??[], pins: visiblePins.filter(p => ctx.dm || titles.has(String(p.entryId))).map(p => ({id: String(p._id), label: p.label, entryId: String(p.entryId), x: p.x, y: p.y, display: pinDisplay(p), audience: p.audience ?? 'room', characterIds: (p.characterIds ?? []).map(String).filter(id => ctx.dm || ctx.allowed.includes(id)), noteTitle: titles.get(String(p.entryId)) ?? null, cityLibrary: cities.has(String(p.entryId))}))}
}
const initializeMaps = recoverableModelInitialization(() => [RoomMap, MapAsset, MapQuota])
async function transaction<T>(fn: (session: ClientSession) => Promise<T>) {
  await withDatabaseStage('map-initialization', initializeMaps)
  return withDatabaseStage('map-transaction', () => mongoose.connection.transaction(fn))
}
async function reserve(ctx: LibraryContext, bytes: number, session: ClientSession) {
  const budgets = [
    {key: 'site', max: MAP_LIMITS.siteBytes, count: Number.MAX_SAFE_INTEGER, message: 'Map image storage is full. Ask the DM to remove unused maps.'},
    {key: `owner:${ctx.room.ownerId}`, max: MAP_LIMITS.ownerBytes, count: Number.MAX_SAFE_INTEGER, message: 'Your map images have reached the 25 MiB account limit. Remove an unused map first.'},
    {key: `room:${ctx.room._id}`, max: MAP_LIMITS.roomBytes, count: MAP_LIMITS.mapsPerRoom, message: 'This room has reached its map limit (10 MiB or 25 maps). Remove an unused map first.'},
  ]
  for (const b of budgets) {
    await MapQuota.updateOne({_id: b.key}, {$setOnInsert: {bytes: 0, count: 0}}, {upsert: true, session})
    const result = await MapQuota.updateOne({_id: b.key, bytes: {$lte: b.max - bytes}, count: {$lt: b.count}}, {$inc: {bytes, count: 1}}, {session})
    if (!result.modifiedCount) fail(413, b.message)
  }
}
async function validateSharing(data: z.infer<typeof draft>, ctx: LibraryContext) {
  if (data.characterIds.some(id => !ctx.characters.some(c => String(c._id) === id))) fail(400, 'Choose characters currently owned by this room’s DM.')
  return {title: data.title, audience: data.audience, characterIds: data.audience === 'characters' ? data.characterIds : []}
}
async function noteFor(entryId: string, ctx: LibraryContext, session: ClientSession) {
  if (!await Notebook.exists({_id: entryId, roomId: ctx.room._id, kind: 'entry', deletedAt: null}).session(session)) fail(400, 'Choose an available notebook entry in this room.')
}
router.get('/', async (req, res) => {
  const ctx = await ctxFor(req)
  const maps = await RoomMap.find({roomId: ctx.room._id, ...libraryScope(ctx)}).select('-pins -regions').sort({title: 1, _id: 1}).limit(MAP_LIMITS.mapsPerRoom).lean()
  const assigned = new Set(ctx.room.assignments.filter(a => ctx.room.members.some(m => String(m) === String(a.userId))).map(a => String(a.characterId)))
  const quotas = ctx.dm ? await MapQuota.find({_id: {$in: [`room:${ctx.room._id}`, `owner:${ctx.room.ownerId}`]}}).lean() : []
  res.json({maps: maps.map(m => summary(m, ctx)), role: ctx.dm ? 'dm' : 'player', readOnly: ctx.readOnly,
    characters: ctx.characters.map(c => ({id: String(c._id), name: c.meta.name, assigned: assigned.has(String(c._id))})),
    ...(ctx.dm ? {storage: {roomBytes: quotas.find(q => q._id === `room:${ctx.room._id}`)?.bytes ?? 0, ownerBytes: quotas.find(q => q._id === `owner:${ctx.room.ownerId}`)?.bytes ?? 0}} : {})})
})
router.get('/:mapId/image', async (req, res) => {
  const ctx = await ctxFor(req), map = await mapFor(req.params.mapId, ctx)
  // Assets are immutable for a map ID. Revalidate access on every request, then
  // allow the browser to reuse bytes without rereading the image from MongoDB.
  const etag=`"map-${map._id}"`
  res.setHeader('Cache-Control','private, no-cache')
  res.vary('Cookie')
  res.setHeader('ETag',etag)
  if(req.get('if-none-match')?.split(',').some(value=>value.trim().replace(/^W\//,'')===etag))return res.status(304).end()
  const asset = await MapAsset.findOne({_id: map._id, roomId: ctx.room._id}).lean()
  if (!asset) return fail(404, 'Map image is unavailable.')
  res.setHeader('Content-Type', 'image/webp')
  res.setHeader('Content-Disposition', 'inline; filename="map.webp"')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  res.send(Buffer.from(asset.data.buffer))
})
router.get('/:mapId', async (req, res) => {const ctx = await ctxFor(req); res.json(await detail(await mapFor(req.params.mapId, ctx), ctx))})
router.use(requestLimit('map-write', 60, 60))
router.use(async (req, _res, next) => {dm(await ctxFor(req)); next()})
router.post('/', requestLimit('map-upload', 10, 60), async (req, res) => {
  if (typeof req.body?.image === 'string' && req.body.image.length > Math.ceil(MAP_LIMITS.imageBytes / 3) * 4) return fail(413, 'Prepare this map to 3 MiB or less before uploading.')
  const input = parsed(draft.safeExtend({image: z.string().min(4).max(Math.ceil(MAP_LIMITS.imageBytes / 3) * 4)}).strict(), req.body)
  // Reject malformed/base64 over-limit input before decoding. Never accept remote URLs or SVG.
  if (input.image.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.image)) return fail(400, 'Choose a valid PNG, JPEG or WebP image.')
  const inputBytes = Buffer.from(input.image, 'base64')
  if (inputBytes.length > MAP_LIMITS.imageBytes) return fail(413, 'Prepare this map to 3 MiB or less before uploading.')
  const png = inputBytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const jpeg = inputBytes[0] === 255 && inputBytes[1] === 216 && inputBytes[2] === 255
  const webp = inputBytes.toString('ascii',0,4) === 'RIFF' && inputBytes.toString('ascii',8,12) === 'WEBP'
  if (!png && !jpeg && !webp) return fail(400, 'Use a still PNG, JPEG or WebP image.')
  const {default: sharp} = await import('sharp')
  let image: {data: Buffer; info: {width: number; height: number}}
  try {
    const source = sharp(inputBytes, {limitInputPixels: MAP_LIMITS.inputPixels, failOn: 'warning', animated: false})
    const meta = await source.metadata()
    if (!['jpeg','png','webp'].includes(meta.format ?? '') || (meta.pages ?? 1) > 1) return fail(400, 'Use a still PNG, JPEG or WebP image.')
    if (meta.format === 'webp' && meta.width && meta.height && Math.max(meta.width,meta.height) <= MAP_LIMITS.dimension && (!meta.orientation || meta.orientation === 1)) {
      // Metadata alone does not establish that the image can be fully decoded.
      await source.clone().stats()
      image = {data: inputBytes, info: {width: meta.width, height: meta.height}}
    } else {
      const normalized = source.rotate().resize({width: MAP_LIMITS.dimension, height: MAP_LIMITS.dimension, fit: 'inside', withoutEnlargement: true})
      image = await normalized.clone().webp({quality: 85}).toBuffer({resolveWithObject: true})
    }
  } catch (e) {if (e instanceof RoomLibraryError) throw e; return fail(400, 'This image could not be read. Use a still PNG, JPEG or WebP under 16 megapixels.')}
  if (image.data.length > MAP_LIMITS.imageBytes) return fail(413, 'This map is still over 3 MiB at high quality. Choose a more compressed image or resize it.')
  const result = await transaction(async session => {
    const ctx = await ctxFor(req, session); dm(ctx)
    const sharing = await validateSharing(input, ctx)
    await reserve(ctx, image.data.length, session)
    const [map] = await RoomMap.create([{...sharing, roomId: ctx.room._id, ownerId: ctx.room.ownerId, width: image.info.width, height: image.info.height, bytes: image.data.length}], {session})
    await MapAsset.create([{_id: map!._id, roomId: ctx.room._id, data: image.data}], {session})
    return String(map!._id)
  })
  res.status(201).json({id: result})
})
router.patch('/:mapId', async (req, res) => {
  const input = parsed(z.object({expectedRevision: expected, draft}).strict(), req.body)
  await transaction(async session => {
    const ctx = await ctxFor(req, session); dm(ctx)
    const map = await mapFor(req.params.mapId, ctx, session), sharing = await validateSharing(input.draft, ctx)
    const result = await RoomMap.updateOne({_id: map._id, revision: input.expectedRevision}, {$set: sharing, $inc: {revision: 1}}, {session})
    if (!result.modifiedCount) fail(409, 'This map changed elsewhere. Refresh before saving your changes.')
  })
  res.json({ok: true})
})
router.patch('/:mapId/regions', async (req, res) => {
  const input=parsed(z.object({expectedRevision:expected,regions:regionList}).strict(),req.body)
  await transaction(async session=>{
    const ctx=await ctxFor(req,session);dm(ctx)
    const map=await mapFor(req.params.mapId,ctx,session)
    const result=await RoomMap.updateOne({_id:map._id,revision:input.expectedRevision},{$set:{regions:input.regions},$inc:{revision:1}},{session})
    if(!result.modifiedCount)fail(409,'This map changed elsewhere. Reload before saving your borders.')
  })
  res.json({ok:true})
})
router.post('/:mapId/pins', async (req, res) => {
  const input = parsed(z.object({expectedRevision: expected, pin: pinDraft}).strict(), req.body)
  await transaction(async session => {
    const ctx = await ctxFor(req, session); dm(ctx)
    const map = await mapFor(req.params.mapId, ctx, session)
    await noteFor(input.pin.entryId, ctx, session)
    const sharing = await validateSharing({title: input.pin.label, audience: input.pin.audience ?? 'room', characterIds: input.pin.characterIds ?? []}, ctx)
    if (map.pins.length >= MAP_LIMITS.pinsPerMap) fail(400, 'A map can hold up to 100 pins.')
    const result = await RoomMap.updateOne({_id: map._id, revision: input.expectedRevision}, {$push: {pins: {...input.pin, audience: sharing.audience, characterIds: sharing.characterIds}}, $inc: {revision: 1}}, {session})
    if (!result.modifiedCount) fail(409, 'This map changed elsewhere. Refresh before placing this pin.')
  })
  res.status(201).json({ok: true})
})
router.patch('/:mapId/pins/:pinId', async (req, res) => {
  const input = parsed(z.object({expectedRevision: expected, pin: pinDraft}).strict(), req.body)
  await transaction(async session => {
    const ctx = await ctxFor(req, session); dm(ctx)
    const map = await mapFor(req.params.mapId, ctx, session)
    if (!isValidObjectId(String(req.params.pinId)) || !map.pins.some(p => String(p._id) === req.params.pinId)) fail(404, 'Pin is unavailable.')
    await noteFor(input.pin.entryId, ctx, session)
    // Older drag clients omit sharing: preserve restrictions instead of resetting them.
    const sharing = input.pin.audience === undefined ? null : await validateSharing({title: input.pin.label, audience: input.pin.audience, characterIds: input.pin.characterIds ?? []}, ctx)
    const result = await RoomMap.updateOne({_id: map._id, revision: input.expectedRevision, 'pins._id': req.params.pinId}, {$set: {'pins.$.label': input.pin.label, 'pins.$.entryId': input.pin.entryId, 'pins.$.x': input.pin.x, 'pins.$.y': input.pin.y, ...(input.pin.display ? {'pins.$.display': input.pin.display} : {}), ...(sharing ? {'pins.$.audience': sharing.audience, 'pins.$.characterIds': sharing.characterIds} : {})}, $inc: {revision: 1}}, {session})
    if (!result.modifiedCount) fail(409, 'This map changed elsewhere. Refresh before moving or editing this pin.')
  })
  res.json({ok: true})
})
router.post('/:mapId/pins/:pinId/remove', async (req, res) => {
  const input = parsed(z.object({expectedRevision: expected}).strict(), req.body)
  await transaction(async session => {
    const ctx = await ctxFor(req, session); dm(ctx)
    const map = await mapFor(req.params.mapId, ctx, session)
    if (!isValidObjectId(String(req.params.pinId))) return fail(404, 'Pin is unavailable.')
    const r = await RoomMap.updateOne({_id: map._id, revision: input.expectedRevision, 'pins._id': req.params.pinId}, {$pull: {pins: {_id: req.params.pinId}}, $inc: {revision: 1}}, {session})
    if (!r.modifiedCount) fail(409, 'This map changed elsewhere. Refresh before removing the pin.')
  })
  res.json({ok: true})
})
router.post('/:mapId/delete', async (req, res) => {
  const input = parsed(z.object({expectedRevision: expected}).strict(), req.body)
  await transaction(async session => {
    const ctx = await ctxFor(req, session); dm(ctx)
    const map = await mapFor(req.params.mapId, ctx, session)
    const r = await RoomMap.deleteOne({_id: map._id, revision: input.expectedRevision}, {session})
    if (!r.deletedCount) fail(409, 'This map changed elsewhere. Refresh before deleting it.')
    await MapAsset.deleteOne({_id: map._id, roomId: ctx.room._id}, {session})
    for (const key of ['site', `owner:${map.ownerId}`, `room:${map.roomId}`]) await MapQuota.updateOne({_id: key}, {$inc: {bytes: -map.bytes, count: -1}}, {session})
  })
  res.json({ok: true})
})
router.use((error: Error, _req: unknown, res: import('express').Response, next: import('express').NextFunction) => {
  if (error instanceof RoomLibraryError) return res.status(error.status).json({error: error.message})
  next(error)
})
export default router
