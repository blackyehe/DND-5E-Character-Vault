import {Router} from 'express'
import mongoose, {isValidObjectId, type ClientSession} from 'mongoose'
import {z} from 'zod'
import {Room} from '../models/Room'
import {Character} from '../models/Character'
import {User} from '../models/User'
import {Notebook, NotebookRevision} from '../models/Notebook'
import {requireAuth} from '../middleware/auth'
import {requestLimit} from '../middleware/request-limit'

const router = Router({mergeParams: true})
router.use(requireAuth)
const id = z.string().refine(isValidObjectId), ids = z.array(id).max(100).transform(values => [...new Set(values)])
const section = z.enum(['journal', 'story-items'])
const draftSchema = z.object({
  title: z.string().trim().min(1).max(120), body: z.string().max(60000), section,
  folderId: id.nullable(), audience: z.enum(['room', 'characters', 'dm']), characterIds: ids,
  relevantCharacterIds: ids, relatedIds: ids,
}).strict().refine(d => d.audience !== 'characters' || d.characterIds.length > 0, 'Choose at least one character.')
type Draft = z.infer<typeof draftSchema>
type RecordData = mongoose.InferSchemaType<typeof Notebook.schema> & {_id: mongoose.Types.ObjectId}
class NotebookError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } }
const fail = (status: number, message: string): never => {throw new NotebookError(status, message)}

async function context(roomId: string, userId: string, previewCharacter?: string, session?: ClientSession) {
  if (!isValidObjectId(roomId)) return fail(404, 'Room not found or access has ended.')
  const room = await Room.findOne({_id: roomId, $or: [{ownerId: userId}, {members: userId}]}).session(session ?? null).lean()
  if (!room) return fail(404, 'Room not found or access has ended.')
  const owner = String(room.ownerId) === userId
  if (previewCharacter && (!owner || !isValidObjectId(previewCharacter))) return fail(403, 'Player preview is unavailable.')
  const previewUser = previewCharacter ? room.assignments.find(a => String(a.characterId) === previewCharacter)?.userId : undefined
  const assigned = room.assignments.filter(a => String(a.userId) === String(previewUser ?? userId)).map(a => a.characterId)
  const characters = await Character.find({userId: room.ownerId, ...(!owner ? {_id: {$in: assigned}} : {})}).select('meta.name').session(session ?? null).lean()
  const validIds = characters.map(c => String(c._id))
  const allowed = previewCharacter ? (previewUser ? assigned.map(String) : [previewCharacter]).filter(value => validIds.includes(value)) : validIds
  if (previewCharacter && !validIds.includes(previewCharacter)) return fail(404, 'Character access has ended.')
  const dm = owner && !previewCharacter
  return {room, dm, owner, readOnly: !!previewCharacter, allowed, characters: characters.filter(c => dm || allowed.includes(String(c._id))), userId}
}
type Context = Awaited<ReturnType<typeof context>>
function scope(ctx: Context): Record<string, unknown> {
  return ctx.dm ? {} : {$or: [{audience: 'room'}, {audience: 'characters', characterIds: {$in: ctx.allowed}}]}
}
function visible(entry: {audience?: unknown; characterIds?: unknown}, ctx: Context) {
  return ctx.dm || entry.audience === 'room' || entry.audience === 'characters' && Array.isArray(entry.characterIds) && entry.characterIds.some(value => ctx.allowed.includes(String(value)))
}
function editable(entry: {section: string}, ctx: Context) {return !ctx.readOnly && (ctx.dm || entry.section === 'journal')}
function summary(entry: RecordData, ctx: Context) {
  return {id: String(entry._id), section: entry.section, title: entry.title, folderId: entry.folderId ? String(entry.folderId) : null,
    audience: entry.audience, characterIds: entry.characterIds.map(String).filter(value => ctx.dm || ctx.allowed.includes(value)),
    relevantCharacterIds: entry.relevantCharacterIds.map(String).filter(value => ctx.dm || ctx.allowed.includes(value)),
    revision: entry.revision, updatedAt: entry.updatedAt.toISOString(), editedBy: entry.editedBy, deletedAt: entry.deletedAt?.toISOString() ?? null}
}
async function detail(entry: RecordData, ctx: Context) {
  const links = await Notebook.find({roomId: ctx.room._id, kind: 'entry', deletedAt: null, ...scope(ctx), $and: [{$or: [{_id: {$in: entry.relatedIds}}, {relatedIds: entry._id}]}]}).select('title section relatedIds').lean()
  return {...summary(entry, ctx), body: entry.body, relatedIds: links.filter(link => entry.relatedIds.some(value => String(value) === String(link._id))).map(link => String(link._id)),
    connections: links.map(link => ({id: String(link._id), title: link.title, section: link.section, direction: entry.relatedIds.some(value => String(value) === String(link._id)) ? 'outgoing' : 'incoming'}))}
}
async function validateDraft(data: Draft, ctx: Context, existing?: RecordData, session?: ClientSession) {
  if (!ctx.dm) {
    if (data.section !== 'journal' || existing && (data.audience !== existing.audience || data.characterIds.join(',') !== existing.characterIds.map(String).filter(value => ctx.allowed.includes(value)).join(','))) return fail(403, 'Only the DM can change sharing or story items.')
    if (!existing && data.audience !== 'room') return fail(403, 'New player notes are shared with the room. Ask the DM to change sharing.')
  }
  if (existing && data.section !== existing.section) return fail(400, 'An entry cannot change between Journal and Story items.')
  if (data.folderId && !await Notebook.exists({_id: data.folderId, roomId: ctx.room._id, kind: 'folder', section: data.section, deletedAt: null}).session(session ?? null)) return fail(400, 'Choose an available folder in this section.')
  const requested = [...new Set([...data.characterIds, ...data.relevantCharacterIds])]
  const validCharacters = await Character.find({_id: {$in: requested}, userId: ctx.room.ownerId}).select('_id').session(session ?? null).lean()
  if (ctx.dm && validCharacters.length !== requested.length) return fail(400, 'One of the selected characters is no longer owned by the DM.')
  const relations = await Notebook.find({_id: {$in: data.relatedIds}, roomId: ctx.room._id, kind: 'entry', deletedAt: null, ...scope(ctx)}).select('_id').session(session ?? null).lean()
  if (relations.length !== data.relatedIds.length || existing && data.relatedIds.includes(String(existing._id))) return fail(400, 'Choose available entries from this room for connections.')
  let relatedIds = data.relatedIds
  if (!ctx.dm && existing) {
    const accessibleLinks = await Notebook.find({_id: {$in: existing.relatedIds}, roomId: ctx.room._id, ...scope(ctx)}).select('_id').session(session ?? null).lean()
    const accessibleSet = new Set(accessibleLinks.map(value => String(value._id)))
    relatedIds = [...new Set([...data.relatedIds, ...existing.relatedIds.map(String).filter(value => !accessibleSet.has(value))])]
  }
  return {...data, audience: ctx.dm ? data.audience : existing?.audience ?? 'room',
    characterIds: ctx.dm ? data.audience === 'characters' ? data.characterIds : [] : existing?.characterIds ?? [],
    relevantCharacterIds: ctx.dm ? data.relevantCharacterIds : existing?.relevantCharacterIds ?? [], relatedIds}
}
let initialized: Promise<unknown> | undefined
async function transaction<T>(fn: (session: ClientSession) => Promise<T>) {
  initialized ??= Promise.all([Notebook.init(), NotebookRevision.init()]).catch(error => {initialized = undefined; throw error})
  await initialized
  return mongoose.connection.transaction(fn)
}
async function saveRevision(entry: RecordData, session: ClientSession, action: string) {
  await NotebookRevision.create([{roomId: entry.roomId, entryId: entry._id, revision: entry.revision, snapshot: entry, editedBy: entry.editedBy, action}], {session})
}
const expectedSchema = z.object({expectedRevision: z.number().int().min(1)}).strict()
const actor = async (userId: string) => (await User.findById(userId).select('displayName').lean())?.displayName ?? 'Room member'
function parsed<T>(schema: z.ZodType<T>, body: unknown): T {const result = schema.safeParse(body); if (!result.success) return fail(400, result.error.issues[0]?.message ?? 'Invalid notebook values.'); return result.data}
async function entryFor(entryId: string, ctx: Context, session?: ClientSession) {
  if (!isValidObjectId(entryId)) return fail(404, 'Entry not found or access has ended.')
  const entry = await Notebook.findOne({_id: entryId, roomId: ctx.room._id}).session(session ?? null).lean()
  if (!entry || entry.kind === 'entry' && !visible(entry, ctx)) return fail(404, 'Entry not found or access has ended.')
  return entry
}
const params = (req: {params: Record<string, unknown>}) => String(req.params.roomId)
router.get('/', async (req, res) => {
  const ctx = await context(params(req), req.userId!, typeof req.query.previewCharacter === 'string' ? req.query.previewCharacter : undefined)
  const query = parsed(z.object({section, offset: z.coerce.number().int().min(0).max(100000).default(0), search: z.string().max(120).default(''), folder: z.string().max(30).default('all'), deleted: z.enum(['true', 'false']).default('false'), character: z.string().max(24).default(''), ids: z.string().max(2600).default('')}).strict(), Object.fromEntries(Object.entries(req.query).filter(([key]) => key !== 'previewCharacter')))
  if (query.character && (!isValidObjectId(query.character) || !ctx.characters.some(c => String(c._id) === query.character))) return fail(400, 'Character filter is unavailable.')
  const folders = await Notebook.find({roomId: ctx.room._id, kind: 'folder', section: query.section}).sort({title: 1}).lean()
  const filter: Record<string, unknown> = {roomId: ctx.room._id, kind: 'entry', section: query.section, deletedAt: query.deleted === 'true' ? {$ne: null} : null, ...scope(ctx)}
  if (query.search) {const regex = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$and = [{$or: [{title: {$regex: regex, $options: 'i'}}, {body: {$regex: regex, $options: 'i'}}]}]}
  if (query.character) filter.relevantCharacterIds = query.character
  if (query.folder === 'unfiled') filter.folderId = {$nin: folders.filter(f => !f.deletedAt).map(f => f._id)}
  else if (query.folder !== 'all') {if (!isValidObjectId(query.folder)) return fail(400, 'Invalid folder.'); filter.folderId = query.folder}
  if (query.ids) filter._id = {$in: parsed(z.array(id).max(100), query.ids.split(','))}
  const counts = await Notebook.find({roomId: ctx.room._id, kind: 'entry', section: query.section, deletedAt: null, ...scope(ctx)}).select('folderId').lean()
  const [entries, total] = await Promise.all([Notebook.find(filter).select('-body -relatedIds').sort({title: 1, _id: 1}).skip(query.offset).limit(60).lean(), Notebook.countDocuments(filter)])
  res.json({entries: entries.map(entry => summary(entry, ctx)), total, nextOffset: query.offset + entries.length < total ? query.offset + entries.length : null,
    folders: folders.map(f => ({id: String(f._id), title: f.title, section: f.section, revision: f.revision, deletedAt: f.deletedAt?.toISOString() ?? null, count: counts.filter(e => String(e.folderId) === String(f._id)).length})),
    characters: ctx.characters.map(c => ({id: String(c._id), name: c.meta.name})), role: ctx.dm ? 'dm' : 'player', readOnly: ctx.readOnly})
})
router.get('/entries/:entryId', async (req, res) => {
  const ctx = await context(params(req), req.userId!, typeof req.query.previewCharacter === 'string' ? req.query.previewCharacter : undefined)
  const entry = await entryFor(String(req.params.entryId), ctx)
  if (entry.kind !== 'entry') return fail(404, 'Note not found.')
  res.json(await detail(entry, ctx))
})
router.get('/entries/:entryId/history', async (req, res) => {
  const ctx = await context(params(req), req.userId!, typeof req.query.previewCharacter === 'string' ? req.query.previewCharacter : undefined)
  const entry = await entryFor(String(req.params.entryId), ctx)
  const before = req.query.before === undefined ? entry.revision + 1 : parsed(z.coerce.number().int().min(1), req.query.before)
  const versions = await NotebookRevision.find({roomId: ctx.room._id, entryId: entry._id, revision: {$lt: before}, ...(!ctx.dm ? {$or: [{'snapshot.audience': 'room'}, {'snapshot.audience': 'characters', 'snapshot.characterIds': {$in: ctx.allowed.map(value => new mongoose.Types.ObjectId(value))}}]} : {})}).sort({revision: -1}).limit(15).lean()
  res.json({versions: versions.map(v => ({revision: v.revision, title: v.snapshot.title, body: v.snapshot.body, savedAt: v.savedAt.toISOString(), editedBy: v.editedBy, action: v.action})), nextBefore: versions.length === 15 ? versions.at(-1)!.revision : null})
})
router.use(requestLimit('notebook-write', 100, 60))
router.use((req, _res, next) => {if (req.query.previewCharacter !== undefined) return fail(403, 'The notebook is read-only in player preview.'); next()})
router.post('/entries', async (req, res) => {
  const data = parsed(draftSchema, req.body), editedBy = await actor(req.userId!)
  const result = await transaction(async session => {
    const ctx = await context(params(req), req.userId!, undefined, session)
    if (!editable(data, ctx)) return fail(403, 'Only the DM can manage story items.')
    const value = await validateDraft(data, ctx, undefined, session)
    const [entry] = await Notebook.create([{...value, roomId: ctx.room._id, kind: 'entry', editedBy, createdBy: req.userId!}], {session})
    await saveRevision(entry!.toObject(), session, 'Created')
    return String(entry!._id)
  })
  res.status(201).json({id: result})
})
router.patch('/entries/:entryId', async (req, res) => {
  const data = parsed(z.object({expectedRevision: z.number().int().min(1), draft: draftSchema}).strict(), req.body), editedBy = await actor(req.userId!)
  await transaction(async session => {
    const ctx = await context(params(req), req.userId!, undefined, session), entry = await entryFor(String(req.params.entryId), ctx, session)
    if (entry.kind !== 'entry' || !editable(entry, ctx) || entry.deletedAt) return fail(403, 'This entry cannot be edited.')
    if (entry.revision !== data.expectedRevision) return fail(409, 'This entry changed elsewhere. Your draft is kept. Compare it with the latest version before saving.')
    const value = await validateDraft(data.draft, ctx, entry, session)
    const saved = await Notebook.findOneAndUpdate({_id: entry._id, revision: entry.revision}, {$set: {...value, editedBy}, $inc: {revision: 1}}, {new: true, session}).lean()
    if (!saved) return fail(409, 'The entry changed. Refresh before saving.')
    await saveRevision(saved, session, 'Edited')
  })
  res.json({ok: true})
})
router.post('/folders', async (req, res) => {
  const data = parsed(z.object({title: z.string().trim().min(1).max(120), section}).strict(), req.body), editedBy = await actor(req.userId!)
  const result = await transaction(async session => {
    const ctx = await context(params(req), req.userId!, undefined, session)
    if (!editable(data, ctx)) return fail(403, 'Only the DM can manage story folders.')
    const [entry] = await Notebook.create([{...data, kind: 'folder', roomId: ctx.room._id, editedBy, createdBy: req.userId!}], {session})
    await saveRevision(entry!.toObject(), session, 'Created')
    return String(entry!._id)
  })
  res.status(201).json({id: result})
})
router.patch('/folders/:entryId', async (req, res) => {
  const data = parsed(z.object({title: z.string().trim().min(1).max(120), expectedRevision: z.number().int().min(1)}).strict(), req.body)
  const editedBy = await actor(req.userId!)
  await transaction(async session => {
    const ctx = await context(params(req), req.userId!, undefined, session), entry = await entryFor(String(req.params.entryId), ctx, session)
    if (entry.kind !== 'folder' || !editable(entry, ctx) || entry.deletedAt) return fail(403, 'This folder cannot be renamed.')
    const saved = await Notebook.findOneAndUpdate({_id: entry._id, revision: data.expectedRevision}, {$set: {title: data.title, editedBy}, $inc: {revision: 1}}, {new: true, session}).lean()
    if (!saved) return fail(409, 'The folder changed. Refresh first.')
    await saveRevision(saved, session, 'Renamed')
  })
  res.json({ok: true})
})
router.post('/entries/:entryId/:action', async (req, res) => {
  const action = String(req.params.action)
  if (!['delete', 'recover', 'restore-version'].includes(action)) return fail(404, 'Notebook action not found.')
  const data = parsed(expectedSchema.extend({revision: z.number().int().min(1).optional()}), req.body), editedBy = await actor(req.userId!)
  await transaction(async session => {
    const ctx = await context(params(req), req.userId!, undefined, session), entry = await entryFor(String(req.params.entryId), ctx, session)
    if (!editable(entry, ctx)) return fail(403, 'Only the DM can manage story items.')
    if (entry.revision !== data.expectedRevision) return fail(409, 'This entry changed. Refresh before repeating the action.')
    if (!ctx.dm && entry.kind === 'folder' && await Notebook.exists({roomId: ctx.room._id, kind: 'entry', folderId: entry._id}).session(session)) return fail(403, 'Only the DM can remove folders that contain entries. No notes were deleted.')
    let changes: Record<string, unknown> = {deletedAt: action === 'delete' ? new Date() : null, editedBy}
    if (action === 'restore-version') {
      if (entry.kind !== 'entry' || entry.deletedAt || !data.revision) return fail(400, 'Restore a saved note version from History.')
      const version = await NotebookRevision.findOne({entryId: entry._id, roomId: ctx.room._id, revision: data.revision}).session(session).lean()
      if (!version || !visible(version.snapshot, ctx)) return fail(404, 'This version is unavailable.')
      // Revert text only: never restore old sharing, links or character assignments implicitly.
      changes = {title: version.snapshot.title, body: version.snapshot.body, editedBy}
    }
    const saved = await Notebook.findOneAndUpdate({_id: entry._id, revision: entry.revision}, {$set: changes, $inc: {revision: 1}}, {new: true, session}).lean()
    if (!saved) return fail(409, 'The entry changed. Refresh first.')
    await saveRevision(saved, session, action === 'delete' ? 'Deleted' : action === 'recover' ? 'Recovered' : `Restored text from version ${data.revision}`)
  })
  res.json({ok: true})
})
router.use((error: Error, _req: unknown, res: import('express').Response, next: import('express').NextFunction) => {
  if (error instanceof NotebookError) return res.status(error.status).json({error: error.message})
  next(error)
})
export default router
